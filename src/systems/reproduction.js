/**
 * src/systems/reproduction.js — Reproducción (T46, T47)
 * =====================================================
 *
 * Una entidad se reproduce cuando se cumplen **todas** estas condiciones
 * (GDD §9):
 *
 *   1 · Tiene energía suficiente.
 *   2 · No está hambrienta ni sedienta.
 *   3 · Pasó el cooldown desde la última reproducción.
 *   4 · Alcanzó la edad mínima.
 *   5 · Hay otra entidad de la misma especie cerca, en condiciones similares.
 *
 * La cría nace en una **celda libre adyacente válida** (T47): una celda de
 * tierra, sin otra entidad, y cerca de la madre.
 *
 * Determinismo: el orden de las entities es fijo (el del array del manager),
 * así que siempre crían las mismas. Todo el azar sale de `ctx.prng`.
 *
 * Sin `new` en el bucle: las crías salen del **pool** de entidades.
 */

import { TERRENO } from '../world/cell.js';

/** Desplazamientos de las celdas vecinas (vecindad 8), en orden fijo. */
const VECINOS_8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * ¿Esta entidad puede reproducirse ahora mismo?
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function puedeReproducirse(entidad, ctx) {
  const n = entidad.necesidades;
  const esp = configEspecie(entidad, ctx);

  if (n.energia < esp.energiaReproduccion) return false;
  if (n.hambre >= esp.hambreCritica) return false;
  if (n.sed >= esp.sedCritica) return false;
  // La edad vive en la entidad (contrato §1), no en las necesidades.
  if (entidad.edad < esp.edadMinimaReproduccion) return false;
  if (entidad.ticksDesdeReproduccion < esp.cooldownReproduccion) return false;

  return true;
}

/**
 * Busca una pareja compatible: misma especie, en condiciones para reproducirse.
 * Usa el spatial hash (O(vecinos), no O(n²)).
 * @param {object} entidad
 * @param {object} ctx
 * @param {object[]} salida Array reutilizable de vecinos.
 * @returns {object|null}
 */
export function buscarPareja(entidad, ctx, salida) {
  const radio = ctx.config.herbivoro.radioVision;
  const vecinos = ctx.hash.consultar(entidad.x, entidad.y, radio, salida, entidad);

  for (let i = 0; i < vecinos.length; i++) {
    const v = vecinos[i];
    if (v.tipo !== entidad.tipo) continue;
    if (v.porMorir !== null) continue;
    if (!puedeReproducirse(v, ctx)) continue;
    return v;
  }
  return null;
}

/**
 * Intenta reproducir. Si no se puede, no pasa nada.
 * @param {object} entidad La madre.
 * @param {object} ctx
 * @returns {object|null} La cría, o `null` si no se reprodujo.
 */
export function intentarReproducir(entidad, ctx) {
  if (!puedeReproducirse(entidad, ctx)) return null;

  // ¿Hay pareja?
  const pareja = buscarPareja(entidad, ctx, ctx.vecinos);
  if (pareja === null) return null;

  // ¿Dónde nace la cría?
  const posicion = celdaValidaParaCria(entidad, ctx);
  if (posicion === null) return null;

  // La cría sale del pool: no se crea un objeto nuevo en el bucle.
  const cria = ctx.entidades.crear(entidad.tipo);
  cria.x = posicion.x;
  cria.y = posicion.y;

  // La madre paga el costo de la cría.
  const esp = configEspecie(entidad, ctx);
  const n = entidad.necesidades;
  n.energia -= esp.energiaPorCria;
  n.reproduccion = 0;
  entidad.ticksDesdeReproduccion = 0;

  // La pareja también paga (y sigue disponible para otra cría).
  const np = pareja.necesidades;
  np.energia -= esp.energiaPorCria;
  np.reproduccion = 0;
  pareja.ticksDesdeReproduccion = 0;

  return cria;
}

/**
 * Busca una celda de tierra libre y adyacente donde nazca la cría.
 * @param {object} entidad La madre.
 * @param {object} ctx
 * @returns {{x: number, y: number}|null} Centro de la celda, o `null`.
 */
export function celdaValidaParaCria(entidad, ctx) {
  const grid = ctx.grid;
  if (grid === null || grid === undefined) {
    // Sin terreno (tests): nace al lado de la madre.
    return { x: entidad.x + 1, y: entidad.y };
  }

  const cx = entidad.celdaX;
  const cy = entidad.celdaY;

  // Se empieza en un vecino al azar y se recorre en círculo: así las crías
  // no salen siempre en la misma dirección.
  const inicio = ctx.prng.int(0, VECINOS_8.length);

  for (let n = 0; n < VECINOS_8.length; n++) {
    const [dx, dy] = VECINOS_8[(inicio + n) % VECINOS_8.length];
    const x = cx + dx;
    const y = cy + dy;

    if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) continue;
    if (grid.terreno[y * grid.ancho + x] !== TERRENO.TIERRA) continue;
    if (!grid.estaLibre(x, y)) continue;

    return { x: x + 0.5, y: y + 0.5 };
  }

  return null;
}

/**
 * Configuración de la especie de una entidad.
 * @param {object} entidad
 * @param {object} ctx
 * @returns {object}
 */
function configEspecie(entidad, ctx) {
  return entidad.tipo === ctx.config.tipos.herbivoro ? ctx.config.herbivoro : ctx.config.depredador;
}
