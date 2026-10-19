/**
 * src/systems/movement.js — Movimiento entre celdas (P2)
 * =====================================================
 *
 * Integra la posición de una entidad según su rumbo y su velocidad.
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
 * @param {import('../entities/entity.js').Entity} entidad
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx Contexto `{ prng, mundo, config }`.
 */
export function mover(entidad, dt, ctx) {
  const { ancho, alto } = ctx.mundo;

  entidad.x += entidad.dirX * entidad.velocidad * dt;
  entidad.y += entidad.dirY * entidad.velocidad * dt;

  // Rebote contra los bordes. El dépassement siempre es menor a una celda
  // (velocidad * dt << 1), así que la reflexión es exacta.
  if (entidad.x < 0) {
    entidad.x = -entidad.x;
    entidad.dirX = Math.abs(entidad.dirX);
  } else if (entidad.x > ancho - 1) {
    entidad.x = 2 * (ancho - 1) - entidad.x;
    entidad.dirX = -Math.abs(entidad.dirX);
  }

  if (entidad.y < 0) {
    entidad.y = -entidad.y;
    entidad.dirY = Math.abs(entidad.dirY);
  } else if (entidad.y > alto - 1) {
    entidad.y = 2 * (alto - 1) - entidad.y;
    entidad.dirY = -Math.abs(entidad.dirY);
  }
}
