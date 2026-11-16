/**
 * src/systems/simulacion.js — Paso de simulación
 * ================================================
 *
 * El corazon del bucle, apartado del `main.js`. Vive en su propio modulo
 * para que el `main.js` y los tests ejecuten **exactamente la misma**
 * logica: si el test pasa, lo que se ve en pantalla es lo mismo.
 *
 * ⚠️ REFACTOR SoA (D13): se itera sobre `ids` (números) y se lee/escribe en
 * los arrays tipados del almacén. La especie se resuelve por `tipo`.
 */

import { ESPECIE } from '../entities/entity.js';
import { celdaHabitableAlAzar } from '../world/terrain.js';
import { pasoVegetacion } from './plantGrowth.js';
import { mover } from './movement.js';

/**
 * Siembra entidades de una especie en celdas habitables al azar.
 * Si el contexto todavía no tiene grilla, siembra en cualquier posición
 * (mundo vacío): así los tests de entidades no dependen del terreno.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} cantidad
 * @param {number} tipo Uno de `ESPECIE`.
 */
export function sembrar(ctx, cantidad, tipo) {
  const a = ctx.entidades;
  for (let i = 0; i < cantidad; i++) {
    const posicion = celdaHabitableAlAzar(ctx);
    const id = a.crear(tipo);
    a.x[id] = posicion.x;
    a.y[id] = posicion.y;
  }
}

/**
 * Avanza una entidad un paso: envejece, piensa y se mueve.
 * @param {number} id
 * @param {number} dt
 * @param {object} ctx
 */
export function actualizarEntidad(id, dt, ctx) {
  const a = ctx.entidades;
  a.edad[id] += 1;
  /** @type {import('../entities/entity.js').Especie} */ (a.especie(id)).pensar(id, dt, ctx);
  mover(id, dt, ctx);
}

/**
 * Avanza la simulacion un paso fijo.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} dt Segundos del timestep fijo.
 */
export function pasoDeSimulacion(ctx, dt) {
  ctx.tick++;
  const a = ctx.entidades;
  const vivos = a.vivos;
  for (let i = 0; i < vivos.length; i++) {
    actualizarEntidad(vivos[i], dt, ctx);
  }
  ctx.hash.reconstruir();

  // El autómata de vegetación va después de las entidades: en F4 los
  // herbívoros van a comer plantas, y el orden (comer → crecer) es
  // determinista y queda documentado acá.
  ctx.plantasNacidas = pasoVegetacion(ctx);
}

/** Reexportado para no obligar a los tests a importar el enum a mano. */
export { ESPECIE };
