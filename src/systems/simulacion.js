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
 *
 * Orden de un tick (determinista):
 *
 *   1. Cada entidad viva: `especie.actualizar` (envejecer, necesidades,
 *      decidir, moverse, gastar energía). Puede anotar muertes y nacimientos.
 *   2. Aplicar muertes (libera `id`s).
 *   3. Aplicar nacimientos (crea crías en celdas anotadas).
 *   4. Reconstruir el Spatial Hash.
 *   5. Autómata de vegetación.
 */

import { ESPECIE } from '../entities/entity.js';
import { celdaHabitableAlAzar } from '../world/terrain.js';
import { pasoVegetacion } from './plantGrowth.js';
import { muertesDe, nacimientosDe } from './eventos.js';

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
 * Reparte edades al azar entre la población actual (hasta el 50% de la vida
 * máxima) para que la primera generación no envejezca —y muera— toda al mismo
 * tiempo. Consume el PRNG de la simulación, así que es determinista.
 * @param {object} ctx
 */
export function repartirEdadesIniciales(ctx) {
  const a = ctx.entidades;
  const max = ctx.config.entidades.edadMaximaTicks;
  for (let i = 0; i < a.vivos.length; i++) {
    a.edad[a.vivos[i]] = Math.floor(ctx.prng.float() * max * 0.5);
  }
}

/**
 * Avanza una entidad un paso delegando en su especie.
 * @param {number} id
 * @param {number} dt
 * @param {object} ctx
 */
export function actualizarEntidad(id, dt, ctx) {
  const especie = ctx.entidades.especie(id);
  if (especie) especie.actualizar(id, dt, ctx);
}

/**
 * Aplica las muertes anotadas durante el tick.
 * @param {object} ctx
 * @returns {number} Cuántas entidades murieron.
 */
export function aplicarMuertes(ctx) {
  const muertos = muertesDe(ctx);
  const n = muertos.length;
  for (let i = 0; i < n; i++) ctx.entidades.eliminar(muertos[i]);
  muertos.length = 0;
  if (n > 0) ctx.muertesTotales += n;
  return n;
}

/**
 * Aplica los nacimientos anotados durante el tick (T47).
 * Respeta `maxEntidades`: si se llegó al tope, los nacimientos se descartan.
 * @param {object} ctx
 * @returns {number} Cuántas crías nacieron.
 */
export function aplicarNacimientos(ctx) {
  const nacimientos = nacimientosDe(ctx);
  const a = ctx.entidades;
  const grid = ctx.grid;
  let n = 0;

  for (let i = 0; i < nacimientos.length; i += 2) {
    if (a.total >= ctx.config.entidades.maxEntidades) break;
    const tipo = nacimientos[i];
    const indice = nacimientos[i + 1];
    const id = a.crear(tipo);
    if (grid) {
      a.x[id] = (indice % grid.ancho) + 0.5;
      a.y[id] = Math.floor(indice / grid.ancho) + 0.5;
    }
    n++;
  }

  nacimientos.length = 0;
  if (n > 0) ctx.nacimientosTotales += n;
  return n;
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

  // 1. Entidades. Se itera por índice sobre `vivos`; las altas y bajas se
  //    difieren al final, así que la lista no cambia durante el recorrido.
  //    Si un depredador ya anotó a la presa (`moribundo`), se la saltea: ya
  //    está contada como `depredado` y no debe moverse, comer ni registrar
  //    otra causa de muerte en el mismo tick (T43/T45).
  for (let i = 0; i < vivos.length; i++) {
    const id = vivos[i];
    if (!a.vivo[id]) continue;
    if (a.moribundo && a.moribundo[id] === 1) continue;
    actualizarEntidad(id, dt, ctx);
  }

  // 2-3. Muertes y nacimientos anotados durante el tick.
  aplicarMuertes(ctx);
  aplicarNacimientos(ctx);

  // 4. El hash refleja las posiciones (y la población) al cerrar el tick.
  ctx.hash.reconstruir();

  // 5. El autómata de vegetación va después de las entidades: el orden
  //    (comer → crecer) es determinista y queda documentado acá.
  ctx.plantasNacidas = pasoVegetacion(ctx);
}

/** Reexportado para no obligar a los tests a importar el enum a mano. */
export { ESPECIE };
