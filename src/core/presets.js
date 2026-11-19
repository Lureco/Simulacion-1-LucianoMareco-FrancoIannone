/**
 * src/core/presets.js — Lógica pura de presets de configuración
 * ==============================================================
 * Serializar, validar y fusionar presets. No toca DOM ni almacenamiento: esas
 * partes viven en `generadorMapa.js` y `configPersistencia.js`.
 *
 * Formato de archivo (versionado para poder migrar después):
 *
 *   { "formato": "ecosistemas-presets-v1", "presets": { "Mi isla": { ... } } }
 */

import { CONFIG_BASE } from '../config.js';
import { copiarValidos } from './configUtils.js';

export const FORMATO_PRESETS = 'ecosistemas-presets-v1';

export function normalizarNombre(nombre) {
  return typeof nombre === 'string' ? nombre.trim() : '';
}

export function esNombreValido(nombre) {
  const limpio = normalizarNombre(nombre);
  return limpio.length > 0 && limpio.length <= 40;
}

/** Deja solo los valores editables con tipos válidos. */
export function limpiarValores(valores) {
  return copiarValidos(CONFIG_BASE, valores, {});
}

/** Arma el JSON de uno o varios presets. */
export function serializarPresets(presets, nombres = Object.keys(presets)) {
  const seleccion = {};
  for (const nombre of nombres) {
    if (Object.prototype.hasOwnProperty.call(presets, nombre)) {
      seleccion[nombre] = presets[nombre];
    }
  }
  return JSON.stringify({ formato: FORMATO_PRESETS, presets: seleccion }, null, 2);
}

/**
 * Valida un JSON importado. Devuelve los presets válidos y los errores
 * encontrados; las entradas inválidas se omiten en vez de abortar todo.
 */
export function validarPresets(datos) {
  const errores = [];
  const presets = {};

  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { presets, errores: ['El JSON debe contener un objeto'] };
  }
  if (datos.formato !== FORMATO_PRESETS) {
    return { presets, errores: [`Formato no reconocido (se esperaba ${FORMATO_PRESETS})`] };
  }
  if (!datos.presets || typeof datos.presets !== 'object' || Array.isArray(datos.presets)) {
    return { presets, errores: ['Falta la sección "presets"'] };
  }

  for (const [nombre, valores] of Object.entries(datos.presets)) {
    if (!esNombreValido(nombre)) {
      errores.push(`Nombre inválido: "${String(nombre).slice(0, 20)}"`);
      continue;
    }
    const limpio = limpiarValores(valores);
    if (Object.keys(limpio).length === 0) {
      errores.push(`"${nombre}" no tiene valores válidos`);
      continue;
    }
    presets[normalizarNombre(nombre)] = limpio;
  }

  return { presets, errores };
}

/** Fusiona presets importados con los guardados (los duplicados se sobrescriben). */
export function fusionarPresets(actuales, nuevos) {
  const presets = { ...actuales };
  let agregados = 0;
  let actualizados = 0;

  for (const [nombre, valores] of Object.entries(nuevos)) {
    if (Object.prototype.hasOwnProperty.call(presets, nombre)) actualizados++;
    else agregados++;
    presets[nombre] = valores;
  }

  return { presets, agregados, actualizados };
}
