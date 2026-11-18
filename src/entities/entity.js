/**
 * src/entities/entity.js — Especie base y enums (T22)
 * ====================================================
 *
 * ⚠️ REFACTOR SoA (ver `docs/DECISIONES.md` D13):
 *
 * Acá **ya no hay una clase por animal**. Los datos de todas las entidades
 * viven en arrays tipados dentro de `EntityManager` (`almacen.js`), indexados
 * por `id`. Lo que sí sigue siendo una clase es la **especie**: define el
 * comportamiento (`pensar`) y las constantes comunes. Hay **una instancia por
 * especie**, no una por bicho.
 *
 * Por qué: con 5000 animales, tener un objeto por animal llena el heap de
 * punteros y arruina la localidad de caché en el bucle caliente. Con arrays
 * contiguos, recorrer las posiciones de 5000 bichos es recorrer memoria
 * lineal.
 *
 * La especie NO conoce el terreno, ni la grilla, ni el render. Habla con el
 * mundo a través de `ctx`.
 */

import { mover } from '../systems/movement.js';

/** Tipos de especie. Los valores se usan como índice de `tipo` en la grilla. */
export const ESPECIE = {
  HERBIVORO: 1,
  PREDADOR: 2,
};

/**
 * Estados de la IA de una entidad. **Numéricos** (viven en un `Uint8Array`).
 * @type {Record<string, number>}
 */
export const ESTADO_IA = {
  VAGO: 0,
  COMIENDO: 1,
  BEBIENDO: 2,
  PERSIGUIENDO: 3,
  HUYENDO: 4,
  BUSCANDO_PAREJA: 5,
};

/** Nombre legible de un estado (HUD / depuración). */
export const NOMBRE_ESTADO = [
  'vago',
  'comiendo',
  'bebiendo',
  'persiguiendo',
  'huyendo',
  'buscando_pareja',
];

/**
 * Especie: comportamiento compartido por todas las entidades de un tipo.
 * Se instancia **una sola vez** por especie (singleton en `especies.js`).
 */
export class Especie {
  /**
   * @param {{velocidad?: number}} opciones
   */
  constructor({ velocidad = 0 } = {}) {
    /** Velocidad base en celdas por segundo. */
    this.velocidad = velocidad;
  }

  /**
   * Avanza una entidad un tick: envejece, decide y se mueve.
   *
   * La base solo **deambula**. Las especies con IA (el herbívoro, F4) la
   * sobreescriben para meter necesidades, muerte y reproducción.
   *
   * @param {number} id
   * @param {number} dt
   * @param {object} ctx
   */
  actualizar(id, dt, ctx) {
    const a = ctx.entidades;
    a.edad[id] += 1;
    this.pensar(id, dt, ctx);
    mover(id, dt, ctx);
  }

  /**
   * Decide el rumbo. Comportamiento base: **deambular** (cada tanto cambia de
   * dirección al azar). Las especies más complejas lo sobreescriben en F4/F5.
   *
   * Recibe el `id` de la entidad; los datos los lee/escribe en `ctx.entidades`.
   *
   * @param {number} id
   * @param {number} _dt
   * @param {object} ctx
   */
  pensar(id, _dt, ctx) {
    const a = ctx.entidades;
    a.ticksParaGiro[id] -= 1;
    if (a.ticksParaGiro[id] <= 0) {
      a.ticksParaGiro[id] = ctx.prng.intInclusive(
        ctx.config.ia.ticksGiroMin,
        ctx.config.ia.ticksGiroMax,
      );
      const angulo = ctx.prng.angle();
      a.dirX[id] = Math.cos(angulo);
      a.dirY[id] = Math.sin(angulo);
    }
  }
}
