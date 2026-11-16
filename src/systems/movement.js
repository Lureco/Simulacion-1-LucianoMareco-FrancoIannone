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
 * Cuando exista el terreno procedural (P1), este módulo va a consultar la
 * `Grid` para penalizar el paso por arena y agua (T40, T49). Por ahora el
 * mundo es plano.
 */

/**
 * Mueve una entidad un paso de `dt` segundos.
 * @param {number} id
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx Contexto `{ prng, mundo, config, entidades }`.
 */
export function mover(id, dt, ctx) {
  const { ancho, alto } = ctx.mundo;
  const a = ctx.entidades;

  a.x[id] += a.dirX[id] * a.velocidad[id] * dt;
  a.y[id] += a.dirY[id] * a.velocidad[id] * dt;

  // Rebote contra los bordes. El dépassement siempre es menor a una celda
  // (velocidad * dt << 1), así que la reflexión es exacta.
  if (a.x[id] < 0) {
    a.x[id] = -a.x[id];
    a.dirX[id] = Math.abs(a.dirX[id]);
  } else if (a.x[id] > ancho - 1) {
    a.x[id] = 2 * (ancho - 1) - a.x[id];
    a.dirX[id] = -Math.abs(a.dirX[id]);
  }

  if (a.y[id] < 0) {
    a.y[id] = -a.y[id];
    a.dirY[id] = Math.abs(a.dirY[id]);
  } else if (a.y[id] > alto - 1) {
    a.y[id] = 2 * (alto - 1) - a.y[id];
    a.dirY[id] = -Math.abs(a.dirY[id]);
  }
}
