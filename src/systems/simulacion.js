/**
 * src/systems/simulacion.js — Paso de simulación
 * ================================================
 *
 * El corazon del bucle, apartado del `main.js`. Vive en su propio modulo
 * para que el `main.js` y los tests ejecuten **exactamente la misma**
 * logica: si el test pasa, lo que se ve en pantalla es lo mismo.
 *
 * El orden de las operaciones es el del GDD §15 y está **fijado**:
 *
 *   1 · Necesidades y percepción + decisión   (dentro de `actualizar()`)
 *   2 · Movimiento
 *   3 · Muerte (se aplica al final, en bloque)
 *   4 · Crecimiento de las plantas
 *
 * Por qué la muerte va después del movimiento y en bloque: si una entidad
 *muriera en mitad del bucle, el array de vivas se modificaría mientras se
 * recorre y el bucle saltaría entidades. Además, el orden fijo es lo que
 * hace que la simulación sea reproducible.
 */

import { ESPECIE } from '../entities/entity.js';
import { celdaHabitableAlAzar } from '../world/terrain.js';
import { pasoVegetacion } from './plantGrowth.js';
import { aplicarMuertes, reiniciarMuertes } from './death.js';
import { calcularMapaAgua } from './mapaAgua.js';

/**
 * Prepara el mundo: terreno, mapa de distancia al agua y contadores.
 * @param {object} ctx
 */
export function prepararMundo(ctx) {
  ctx.mapaAgua = calcularMapaAgua(ctx.grid);
  reiniciarMuertes(ctx);
}

/**
 * Siembra entidades de una especie en celdas habitables al azar.
 * Si el contexto todavia no tiene grilla, siembra en cualquier posicion
 * (mundo vacio): asi los tests de entidades no dependen del terreno.
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

  // El hash espacial se reconstruye acá: sin esto, las entidades recién
  // sembradas no se verían entre sí hasta el final del primer tick, y
  // la percepción arrancaría con el vecindario vacío.
  if (ctx.hash !== null && ctx.hash !== undefined) {
    ctx.hash.reconstruir(ctx.entidades.vivas);
  }
}

/**
 * Avanza la simulacion un paso fijo.
 * @param {object} ctx Contexto de simulacion.
 * @param {number} dt Segundos del timestep fijo.
 */
export function pasoDeSimulacion(ctx, dt) {
  ctx.tick++;

  // Las entidades se actualizan de a una: cada una piensa (percepcion +
  // decision) y se mueve. El hash se reconstruye DESPUES, con las
  // posiciones ya actualizadas, para que el tick siguiente vea el mundo
  // como quedo al final de este.
  const vivas = ctx.entidades.vivas;
  for (let i = 0; i < vivas.length; i++) {
    vivas[i].actualizar(dt, ctx);
    actualizarOcupacion(vivas[i], ctx);
  }

  // La muerte se aplica en bloque, al final: asi el bucle de arriba nunca
  // ve el array de vivas cambiando.
  aplicarMuertes(ctx);

  // El autómata de vegetación va después de las entidades: el orden
  // (comer → crecer) es determinista y queda documentado acá.
  ctx.plantasNacidas = pasoVegetacion(ctx);

  // El hash se reconstruye al final: contiene las posiciones nuevas y no
  // incluye a las entidades que murieron en este tick.
  ctx.hash.reconstruir(ctx.entidades.vivas);
}

/**
 * Mantiene sincronizada la capa `ocupante` de la grilla con las entidades.
 *
 * Cuando una entidad cambia de celda, libera la anterior y ocupa la nueva.
 * La grilla verifica los ids (contrato §2), así que una entidad liberada
 * dos veces o una celda ocupada por otro no corrompe nada.
 *
 * @param {object} entidad
 * @param {object} ctx
 */
export function actualizarOcupacion(entidad, ctx) {
  const grid = ctx.grid;
  if (grid === null || grid === undefined) return;

  const x = entidad.celdaX;
  const y = entidad.celdaY;

  // ¿Cambió de celda?
  if (entidad.celdaOcupadaX === x && entidad.celdaOcupadaY === y) return;

  // Libera la celda anterior (si tenía alguna).
  if (entidad.celdaOcupadaX >= 0) {
    grid.liberar(entidad.celdaOcupadaX, entidad.celdaOcupadaY, entidad.id);
  }

  // Ocupa la nueva. Si ya había alguien (dos animales en la misma celda),
  // la grilla no la cede: el que quedó fuera simplemente no ocupa, y
  // seguirá intentándolo en el próximo tick.
  if (grid.ocupar(x, y, entidad.id)) {
    entidad.celdaOcupadaX = x;
    entidad.celdaOcupadaY = y;
  } else {
    entidad.celdaOcupadaX = -1;
    entidad.celdaOcupadaY = -1;
  }
}

/** Reexportado para no obligar a los tests a importar el enum a mano. */
export { ESPECIE, reiniciarMuertes };
