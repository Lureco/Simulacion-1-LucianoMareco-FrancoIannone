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
     * Velocidad base en celdas por segundo. La fija la subclase y NO se
     * reinicia al reciclar el objeto del pool.
     * @type {number}
     */
    this.velocidad = 0;
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
   * @param {number} dt Segundos del timestep fijo (NUNCA el del frame).
   * @param {object} ctx Contexto de simulación `{ prng, mundo, config }`.
   */
  actualizar(dt, ctx) {
    this.edad += 1;
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
   * Integra la posición según el rumbo y la velocidad.
   * @param {number} dt
   * @param {object} ctx
   */
  mover(dt, ctx) {
    moverEntidad(this, dt, ctx);
  }
}
