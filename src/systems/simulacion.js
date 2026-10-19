/**
 * src/systems/simulacion.js — Paso de simulación
 * ================================================
 *
 * El corazon del bucle, apartado del `main.js`. Vive en su propio modulo
 * para que el `main.js` y los tests ejecuten **exactamente la misma**
 * logica: si el test pasa, lo que se ve en pantalla es lo mismo.
 */

import { ESPECIE } from '../entities/entity.js';

/**
 * Siembra entidades de una especie en posiciones aleatorias.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} cantidad
 * @param {number} tipo Uno de `ESPECIE`.
 */
export function sembrar(ctx, cantidad, tipo) {
  const { ancho, alto } = ctx.mundo;
  for (let i = 0; i < cantidad; i++) {
    const entidad = ctx.entidades.crear(tipo);
    entidad.x = ctx.prng.float() * (ancho - 1);
    entidad.y = ctx.prng.float() * (alto - 1);
  }
}

/**
 * Avanza la simulacion un paso fijo.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} dt Segundos del timestep fijo.
 */
export function pasoDeSimulacion(ctx, dt) {
  ctx.tick++;
  const vivas = ctx.entidades.vivas;
  for (let i = 0; i < vivas.length; i++) {
    vivas[i].actualizar(dt, ctx);
  }
  ctx.hash.reconstruir(vivas);
}

/** Reexportado para no obligar a los tests a importar el enum a mano. */
export { ESPECIE };
