/**
 * src/systems/movement.js — Movimiento entre celdas (P2)
 * =====================================================
 *
 * Integra la posición de una entidad según su rumbo y su velocidad.
 *
 * ⚠️ REFACTOR SoA (D13): ya no recibe un objeto entidad, recibe su `id` y
 * escribe en los arrays tipados de `ctx.entidades`.
 *
 * La posición está en **celdas** (float). El borde del mundo se maneja
 * rebotando: la entidad da la vuelta en vez de quedarse pegada.
 *
 * **Restricción de terreno (T49):** el tipo de celda **destino** modula la
 * velocidad: arena ÷ 1.6 y agua ÷ 4. El coste energético (T40) se cobra aparte
 * en `needs.js`, según la celda en la que está la entidad. Así cruzar agua es
 * una decisión cara y lenta, aunque no un muro infranqueable: la IA evita el
 * agua al deambular (campo BFS, T38) y solo se mete si va a beber o persigue.
 *
 * Los factores se derivan de `costeAgua`/`costeArena` de la config, así no hay
 * números nuevos sueltos ni parámetros duplicados (D17).
 */

import { TERRENO } from '../world/cell.js';

/** Guarda numérica para que `floor(x)` nunca devuelva `ancho`/`alto` al rebotar. */
const MARGEN_BORDE = 1e-4;

/**
 * Multiplicador de velocidad según el terreno de la celda destino.
 * @param {number} terreno Uno de `TERRENO`.
 * @param {object} config `CONFIG` (o un objeto con `entidades.costeAgua/Arena`).
 * @returns {number}
 */
export function factorVelocidad(terreno, config) {
  const ent = config?.entidades;
  if (!ent) return 1;
  if (terreno === TERRENO.AGUA) return 1 / ent.costeAgua;
  if (terreno === TERRENO.ARENA) return 1 / ent.costeArena;
  return 1;
}

/**
 * Mueve una entidad un paso de `dt` segundos.
 * @param {number} id
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx Contexto `{ prng, mundo, config, grid, entidades }`.
 */
export function mover(id, dt, ctx) {
  const { ancho, alto } = ctx.mundo;
  const a = ctx.entidades;
  const grid = ctx.grid;

  // El paso "previsto" (sin penalizar) decide qué celda se quiere cruzar.
  // Se calcula antes de aplicar el factor para que no dependa de sí mismo.
  const pasoX = a.dirX[id] * a.velocidad[id] * dt;
  const pasoY = a.dirY[id] * a.velocidad[id] * dt;

  let factor = 1;
  if (grid) {
    const destinoX = Math.floor(a.x[id] + pasoX);
    const destinoY = Math.floor(a.y[id] + pasoY);
    factor = factorVelocidad(grid.terrenoEn(destinoX, destinoY), ctx.config);
  }

  a.x[id] += pasoX * factor;
  a.y[id] += pasoY * factor;

  // Rebote contra los BORDES DEL MUNDO (0 y `ancho`/`alto`), no contra el
  // borde izquierdo de la última celda (`ancho - 1`). Si se rebota en
  // `ancho - 1`, una entidad sembrada en el centro de la última celda
  // (`ancho - 0.5`) es reflejada en el primer `mover()` y la última franja
  // del mapa queda inhabitable. El margen evita que `floor(x)` devuelva
  // `ancho` si el rebote cae exactamente en el borde.
  const limiteX = ancho - MARGEN_BORDE;
  const limiteY = alto - MARGEN_BORDE;

  if (a.x[id] < 0) {
    a.x[id] = Math.min(-a.x[id], limiteX);
    a.dirX[id] = Math.abs(a.dirX[id]);
  } else if (a.x[id] > limiteX) {
    a.x[id] = Math.min(2 * ancho - a.x[id], limiteX);
    a.dirX[id] = -Math.abs(a.dirX[id]);
  }

  if (a.y[id] < 0) {
    a.y[id] = Math.min(-a.y[id], limiteY);
    a.dirY[id] = Math.abs(a.dirY[id]);
  } else if (a.y[id] > limiteY) {
    a.y[id] = Math.min(2 * alto - a.y[id], limiteY);
    a.dirY[id] = -Math.abs(a.dirY[id]);
  }
}
