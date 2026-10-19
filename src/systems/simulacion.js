/**
 * src/systems/simulacion.js — Paso de simulación
 * ================================================
 *
 * El corazon del bucle, apartado del `main.js`. Vive en su propio modulo
 * para que el `main.js` y los tests ejecuten **exactamente la misma**
 * logica: si el test pasa, lo que se ve en pantalla es lo mismo.
 */

import { ESPECIE } from '../entities/entity.js';
import { celdaHabitableAlAzar } from '../world/terrain.js';
import { pasoVegetacion } from './plantGrowth.js';

/**
 * Siembra entidades de una especie en celdas habitables al azar.
 * Si el contexto todavía no tiene grilla, siembra en cualquier posición
 * (mundo vacío): así los tests de entidades no dependen del terreno.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} cantidad
 * @param {number} tipo Uno de `ESPECIE`.
 */
export function sembrar(ctx, cantidad, tipo) {
  for (let i = 0; i < cantidad; i++) {
    const posicion = celdaHabitableAlAzar(ctx);
    const entidad = ctx.entidades.crear(tipo);
    entidad.x = posicion.x;
    entidad.y = posicion.y;
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

  // El autómata de vegetación va después de las entidades: en F4 los
  // herbívoros van a comer plantas, y el orden (comer → crecer) es
  // determinista y queda documentado acá.
  ctx.plantasNacidas = pasoVegetacion(ctx);
}

/** Reexportado para no obligar a los tests a importar el enum a mano. */
export { ESPECIE };
