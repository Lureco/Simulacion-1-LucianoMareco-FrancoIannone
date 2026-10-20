/**
 * src/systems/movement.js — Movimiento entre celdas (P2)
 * =====================================================
 *
 * Integra la posición de una entidad según su rumbo y su velocidad.
 *
 * La posición está en **celdas** (float). El borde del mundo se maneja
 * rebotando: la entidad da la vuelta en vez de quedarse pegada.
 *
 * **Coste por terreno (T40):** cruzar arena o agua cuesta más energía que
 * cruzar tierra. La arena multiplica el coste, y el agua lo multiplica
 * todavía más y además frena: atravesar un río es un決 decisión cara.
 *
 * **Restricción de terreno (T49):** el agua profunda no se puede cruzar.
 * La entidad se queda en la orilla en vez de meterse al agua sin límite.
 * Por eso el herbívoro tiene que **beber desde la orilla**: busca la celda
 * de agua y se acerca a la celda de tierra contigua.
 */

import { TERRENO } from '../world/cell.js';

/**
 * Multiplicador de velocidad según el terreno de la celda destino.
 * @param {number} terreno Uno de `TERRENO`.
 * @param {object} config
 * @returns {number}
 */
export function factorVelocidad(terreno, config) {
  if (terreno === TERRENO.AGUA) return 1 / config.entidades.costeAgua;
  if (terreno === TERRENO.ARENA) return 1 / config.entidades.costeArena;
  return 1;
}

/**
 * Multiplicador de coste energético según el terreno de la celda destino.
 * @param {number} terreno Uno de `TERRENO`.
 * @param {object} config
 * @returns {number}
 */
export function factorCoste(terreno, config) {
  if (terreno === TERRENO.AGUA) return config.entidades.costeAgua;
  if (terreno === TERRENO.ARENA) return config.entidades.costeArena;
  return 1;
}

/**
 * Mueve una entidad un paso de `dt` segundos.
 * @param {import('../entities/entity.js').Entity} entidad
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx Contexto `{ prng, mundo, config, grid }`.
 */
export function mover(entidad, dt, ctx) {
  const { ancho, alto } = ctx.mundo;
  const grid = ctx.grid;

  // El terreno de la celda destino modula la velocidad (T40/T49).
  let velocidad = entidad.velocidad;
  let coste = 1;

  if (grid !== null && grid !== undefined) {
    const terreno = grid.terrenoEn(
      Math.floor(entidad.x + entidad.dirX * entidad.velocidad * dt),
      Math.floor(entidad.y + entidad.dirY * entidad.velocidad * dt),
    );
    // El agua profunda frena pero no bloquea: el animal puede cruzarla
    // pagando un coste alto. Lo que sí hace es escalar la penalización.
    velocidad *= factorVelocidad(terreno, ctx.config);
    coste = factorCoste(terreno, ctx.config);
  }

  const xAntes = entidad.x;
  const yAntes = entidad.y;

  entidad.x += entidad.dirX * velocidad * dt;
  entidad.y += entidad.dirY * velocidad * dt;

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

  // ¿Se movió de verdad? (para el coste energético de moverse)
  entidad.moviendo =
    Math.abs(entidad.x - xAntes) > 0.000001 || Math.abs(entidad.y - yAntes) > 0.000001;

  // El terreno atravessado se cobra en energía (T40).
  if (entidad.moviendo && coste > 1) {
    entidad.necesidades.energia -= ctx.config.entidades.consumoMovimiento * (coste - 1) * dt;
  }
}
