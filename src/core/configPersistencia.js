/**
 * src/core/configPersistencia.js — Guardado local de configuración y presets
 * ==========================================================================
 * Tres claves independientes en `localStorage`:
 *
 * - `ecosistemas.config.v1`: overrides activos (se aplican al cargar `config.js`).
 * - `ecosistemas.presets.v1`: presets del usuario.
 * - `ecosistemas.ui.v1`: posición y tamaño del panel (para que no se cierre al recargar).
 *
 * Todo acceso va envuelto en `try/catch`: si el navegador bloquea el
 * almacenamiento o el JSON está corrupto, la simulación arranca igual con los
 * valores por defecto.
 */

const CLAVE_CONFIG = 'ecosistemas.config.v1';
const CLAVE_PRESETS = 'ecosistemas.presets.v1';
const CLAVE_UI = 'ecosistemas.ui.v1';

function obtenerAlmacen() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function leerJSON(clave, defecto) {
  const almacen = obtenerAlmacen();
  if (!almacen) return defecto;
  try {
    const texto = almacen.getItem(clave);
    if (!texto) return defecto;
    const datos = JSON.parse(texto);
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : defecto;
  } catch {
    return defecto;
  }
}

function escribirJSON(clave, datos) {
  const almacen = obtenerAlmacen();
  if (!almacen) return false;
  try {
    almacen.setItem(clave, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

function borrar(clave) {
  const almacen = obtenerAlmacen();
  if (!almacen) return false;
  try {
    almacen.removeItem(clave);
    return true;
  } catch {
    return false;
  }
}

/** Overrides activos. */
export function cargarOverrides() {
  return leerJSON(CLAVE_CONFIG, {});
}

export function guardarOverrides(valores) {
  return escribirJSON(CLAVE_CONFIG, valores);
}

export function limpiarOverrides() {
  return borrar(CLAVE_CONFIG);
}

/** Presets del usuario. */
export function cargarPresets() {
  return leerJSON(CLAVE_PRESETS, {});
}

export function guardarPresets(presets) {
  return escribirJSON(CLAVE_PRESETS, presets);
}

export function limpiarPresets() {
  return borrar(CLAVE_PRESETS);
}

/** Estado del panel: `{ posicion, tamanos: { abajo, pantalla } }`. */
export function cargarEstadoUI() {
  return leerJSON(CLAVE_UI, {});
}

export function guardarEstadoUI(estado) {
  return escribirJSON(CLAVE_UI, estado);
}
