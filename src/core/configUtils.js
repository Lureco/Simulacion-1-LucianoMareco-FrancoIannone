/**
 * src/core/configUtils.js — Helpers puros para trabajar con `CONFIG`
 * =================================================================
 * Copiar/leer/escribir valores por ruta (`terreno.colorAgua`) sin duplicar
 * lógica entre `config.js` (overrides guardados) y los presets.
 *
 * Solo se consideran "editables" los números finitos, los booleanos y los
 * colores en hexadecimal CSS (`#rrggbb`). Los strings de rutas de sprites y
 * los objetos anidados quedan afuera a propósito.
 */

const COLOR_HEX = /^#[0-9a-f]{6}$/i;

/** @param {unknown} valor */
export function esColorHex(valor) {
  return typeof valor === 'string' && COLOR_HEX.test(valor);
}

/** @param {object} valor */
function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Copia profunda de un objeto de configuración (no tiene funciones ni ciclos). */
export function clonarConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

/**
 * Copia de `valores` hacia `destino` solo las claves que existen en `base` con
 * el mismo tipo y un valor válido. Las claves desconocidas se ignoran.
 *
 * @param {object} base Valores de referencia (CONFIG_BASE).
 * @param {unknown} valores Valores a filtrar.
 * @param {object} destino Objeto que se completa (se muta).
 * @returns {object} `destino`.
 */
export function copiarValidos(base, valores, destino) {
  if (!esObjeto(valores) || !esObjeto(base)) return destino;

  for (const [clave, valor] of Object.entries(valores)) {
    if (!(clave in base)) continue;
    const esperado = base[clave];

    if (esObjeto(esperado)) {
      if (!esObjeto(valor)) continue;
      if (!esObjeto(destino[clave])) destino[clave] = {};
      copiarValidos(esperado, valor, destino[clave]);
      if (Object.keys(destino[clave]).length === 0) delete destino[clave];
      continue;
    }

    if (typeof esperado === 'number' && typeof valor === 'number' && Number.isFinite(valor)) {
      destino[clave] = valor;
    } else if (typeof esperado === 'boolean' && typeof valor === 'boolean') {
      destino[clave] = valor;
    } else if (esColorHex(esperado) && esColorHex(valor)) {
      destino[clave] = valor.toLowerCase();
    }
  }

  return destino;
}

/** Lee `seccion.clave` de un objeto. */
export function valorPorRuta(objeto, ruta) {
  return ruta
    .split('.')
    .reduce((actual, clave) => (actual == null ? undefined : actual[clave]), objeto);
}

/** Escribe `seccion.clave` en un objeto, creando los niveles intermedios. */
export function asignarPorRuta(objeto, ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  let destino = objeto;
  for (const parte of partes) {
    if (!esObjeto(destino[parte])) destino[parte] = {};
    destino = destino[parte];
  }
  destino[ultima] = valor;
}
