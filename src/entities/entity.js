/**
 * src/entities/entity.js — Entidad base (T22)
 * ============================================
 *
 * Clase base de todo ser vivo. La consumen herbívoros y depredadores.
 *
 * REGLA: la entidad NO conoce el terreno, ni la grilla, ni el render.
 * Habla con el mundo a través de `ctx` (el contexto de simulación).
 *
 * Contrato completo en `docs/CONTRATO.md`.
 */

import { CONFIG } from '../config.js';
import { mover as moverEntidad } from '../systems/movement.js';
import { Necesidades, avanzarNecesidades, necesidadDominante } from '../systems/needs.js';

/** Tipos de especie. */
export const ESPECIE = {
  HERBIVORO: 1,
  PREDADOR: 2,
};

/** Estados de la IA de una entidad. */
export const ESTADO_IA = {
  VAGO: 'vago',
  COMIENDO: 'comiendo',
  BEBIENDO: 'bebiendo',
  PERSIGUIENDO: 'persiguiendo',
  HUYENDO: 'huyendo',
  BUSCANDO_PAREJA: 'buscando_pareja',
};

export class Entity {
  /**
   * @param {number} tipo Uno de `ESPECIE`.
   */
  constructor(tipo) {
    /** @type {number} */
    this.tipo = tipo;
    /**
     * Identificador único y monótono. Lo asigna el `EntityManager` al
     * crear la entidad (no al reciclarlo): sirve para la capa `ocupante`
     * de la grilla, que guarda el id de quien ocupa cada celda.
     * @type {number}
     */
    this.id = 0;
    /**
     * Velocidad base en celdas por segundo. La fija la subclase y NO se
     * reinicia al reciclar el objeto del pool.
     * @type {number}
     */
    this.velocidad = 0;
    /**
     * Estado de necesidades. Es un objeto **fijo** que se crea una vez por
     * entidad y se reinicia con `reiniciar()`: nunca se crea en el bucle.
     * @type {Necesidades}
     */
    this.necesidades = new Necesidades();
    this.reiniciar();
  }

  /**
   * Deja la entidad como recién salida del pool.
   * Solo reinicia el estado transitorio: la velocidad es de la especie.
   */
  reiniciar() {
    /** Posición horizontal en celdas (float). @type {number} */
    this.x = 0;
    /** Posición vertical en celdas (float). @type {number} */
    this.y = 0;
    /** @type {number} */
    this.energia = CONFIG.entidades.energiaInicial;
    /** Edad en ticks de simulación. @type {number} */
    this.edad = 0;
    /** Rumbo normalizado. @type {number} */
    this.dirX = 1;
    /** @type {number} */
    this.dirY = 0;
    /** @type {boolean} `false` cuando la entidad fue liberada. */
    this.vivo = true;
    /** @type {string} Uno de `ESTADO_IA`. */
    this.estado = ESTADO_IA.VAGO;
    /** Ticks que faltan para cambiar de rumbo. @type {number} */
    this.ticksParaGiro = 0;
    /** `true` si la entidad se movió en el último tick. @type {boolean} */
    this.moviendo = false;
    /**
     * Necesidad dominante del tick actual. La recalcula `actualizar()`
     * con `necesidadDominante()` y la usan las subclases para decidir.
     * @type {string}
     */
    this.necesidadActual = 'explorar';
    /**
     * Causa por la que esta entidad debe morir, o `null` si sigue viva.
     * La muerte se marca durante el tick y se aplica al final (T45).
     * @type {string|null}
     */
    this.porMorir = null;
    /**
     * Ticks desde la última reproducción. Sube con cada tick; la entidad
     * puede reproducirse cuando supera el cooldown de su especie.
     * @type {number}
     */
    this.ticksDesdeReproduccion = 0;
    /**
     * Celda de la grilla que esta entidad ocupa (-1 si ninguna).
     * La mantiene `actualizarOcupacion()` en `systems/simulacion.js`.
     * @type {number}
     */
    this.celdaOcupadaX = -1;
    /** @type {number} */
    this.celdaOcupadaY = -1;

    this.necesidades.reiniciar();
  }

  // ── Vistas discretas de la posición ──────────────────────────────

  /** @returns {number} Columna de la celda actual. */
  get celdaX() {
    return Math.floor(this.x);
  }

  /** @returns {number} Fila de la celda actual. */
  get celdaY() {
    return Math.floor(this.y);
  }

  /** @returns {number} Fracción dentro de la celda, en X. */
  get offsetX() {
    return this.x - Math.floor(this.x);
  }

  /** @returns {number} Fracción dentro de la celda, en Y. */
  get offsetY() {
    return this.y - Math.floor(this.y);
  }

  /**
   * Índice plano de la celda actual en una grilla de ancho `ancho`.
   * @param {number} ancho
   * @returns {number}
   */
  celda(ancho) {
    return Math.floor(this.y) * ancho + Math.floor(this.x);
  }

  // ── Ciclo de vida ────────────────────────────────────────────────

  /**
   * Avanza la entidad un paso de simulación.
   *
   * El orden es el del GDD §15: **necesidades → percepción → decisión →
   * movimiento**. La percepción y la decisión van en `pensar()`, que las
   * subclases sobreescriben.
   *
   * @param {number} dt Segundos del timestep fijo (NUNCA el del frame).
   * @param {object} ctx Contexto de simulación `{ prng, mundo, config }`.
   */
  actualizar(dt, ctx) {
    this.edad += 1;
    this.necesidadActual = necesidadDominante(this, ctx);
    avanzarNecesidades(this, dt, ctx);
    this.ticksDesdeReproduccion += 1;
    this.pensar(dt, ctx);
    this.mover(dt, ctx);
  }

  /**
   * Decide el rumbo. La versión base deambula: cada tanto cambia de
   * dirección al azar. Las especies más complejas lo sobreescriben.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensar(_dt, ctx) {
    this.ticksParaGiro -= 1;
    if (this.ticksParaGiro <= 0) {
      this.ticksParaGiro = ctx.prng.intInclusive(40, 110);
      const angulo = ctx.prng.angle();
      this.dirX = Math.cos(angulo);
      this.dirY = Math.sin(angulo);
    }
  }

  /**
   * Gira el rumbo hacia un punto. Se usa para caminar a una planta, al
   * agua o a una presa.
   * @param {number} x Objetivo en X (celdas).
   * @param {number} y Objetivo en Y (celdas).
   */
  caminarHacia(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    const largo = Math.hypot(dx, dy);
    if (largo > 0.0001) {
      this.dirX = dx / largo;
      this.dirY = dy / largo;
    }
  }

  /**
   * Integra la posición según el rumbo y la velocidad.
   * @param {number} dt
   * @param {object} ctx
   */
  mover(dt, ctx) {
    moverEntidad(this, dt, ctx);
  }
}
