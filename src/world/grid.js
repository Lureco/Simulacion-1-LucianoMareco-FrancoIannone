/**
 * src/world/grid.js — Grilla del mundo (T19-T21 · contrato §2)
 * ==============================================================
 *
 * La grilla es **memoria contigua**, no un array de objetos: cada capa es un
 * typed array y todas comparten el mismo índice plano `y * ancho + x`.
 * Sin esto, 256×256 celdas con objetos = GC destructor.
 *
 * Capas:
 * - `terreno` (Uint8Array)   → `TERRENO.*`. Solo escribe P1.
 * - `planta`  (Uint8Array)   → `PLANTA.*`.  Solo escribe P1 (F3).
 * - `ocupante` (Int32Array)  → id de entidad por celda, -1 = libre.
 * - `altura`   (Float32Array) → altura normalizada 0..1 (sombreado y testeo).
 *
 * Regla del contrato: P2 escribe **solo** en `ocupante` (via `ocupar`/
 * `liberar`), y lee el resto.
 */

import { indiceCelda, dentroDeMundo } from '../core/utils.js';
import { TERRENO } from './cell.js';

export class Grid {
  /**
   * @param {number} ancho Ancho en celdas.
   * @param {number} alto Alto en celdas.
   */
  constructor(ancho, alto) {
    this.ancho = ancho;
    this.alto = alto;
    this.total = ancho * alto;

    /** @type {Uint8Array} Tipo de terreno por celda (`TERRENO.*`). */
    this.terreno = new Uint8Array(this.total);
    /** @type {Uint8Array} Estado de planta por celda (`PLANTA.*`). */
    this.planta = new Uint8Array(this.total);
    /** @type {Int32Array} Id de entidad ocupando la celda; -1 = libre. */
    this.ocupante = new Int32Array(this.total).fill(-1);
    /** @type {Float32Array} Altura normalizada 0..1. */
    this.altura = new Float32Array(this.total);

    // Por defecto todo es tierra: un mundo sin terreno generado es habitable.
    this.terreno.fill(TERRENO.TIERRA);
  }

  /**
   * Índice plano de una celda. Las posiciones se asumen dentro del mundo
   * (consultar `dentroDeMundo` antes si vienen del exterior).
   * @param {number} x Columna.
   * @param {number} y Fila.
   * @returns {number}
   */
  indice(x, y) {
    return indiceCelda(x, y, this.ancho);
  }

  /**
   * ¿La celda está dentro de los límites del mundo?
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  dentro(x, y) {
    return dentroDeMundo(x, y, this.ancho, this.alto);
  }

  /**
   * Tipo de terreno de una celda. Fuera del mundo devuelve `AGUA` (no
   * habitable), para que los vecindarios en el borde no lean basura.
   * @param {number} x
   * @param {number} y
   * @returns {number} Uno de `TERRENO`.
   */
  terrenoEn(x, y) {
    if (!this.dentro(x, y)) return TERRENO.AGUA;
    return this.terreno[indiceCelda(x, y, this.ancho)];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  esAgua(x, y) {
    return this.terrenoEn(x, y) === TERRENO.AGUA;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  esArena(x, y) {
    return this.terrenoEn(x, y) === TERRENO.ARENA;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  esTierra(x, y) {
    return this.terrenoEn(x, y) === TERRENO.TIERRA;
  }

  /**
   * ¿La celda está en el borde del mundo?
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  esBorde(x, y) {
    return x === 0 || y === 0 || x === this.ancho - 1 || y === this.alto - 1;
  }

  /**
   * ¿Nadie ocupa la celda? Fuera del mundo nunca está libre.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  estaLibre(x, y) {
    if (!this.dentro(x, y)) return false;
    return this.ocupante[indiceCelda(x, y, this.ancho)] === -1;
  }

  /**
   * Ocupa una celda con el id de una entidad.
   * @param {number} x
   * @param {number} y
   * @param {number} id
   * @returns {boolean} `false` si la celda no estaba libre o estaba fuera.
   */
  ocupar(x, y, id) {
    if (!this.estaLibre(x, y)) return false;
    this.ocupante[indiceCelda(x, y, this.ancho)] = id;
    return true;
  }

  /**
   * Libera una celda (el id debe ser el que la ocupaba).
   * @param {number} x
   * @param {number} y
   * @param {number} id
   * @returns {boolean} `false` si la celda estaba ocupada por otro.
   */
  liberar(x, y, id) {
    if (!this.dentro(x, y)) return false;
    const i = indiceCelda(x, y, this.ancho);
    if (this.ocupante[i] !== id) return false;
    this.ocupante[i] = -1;
    return true;
  }

  /**
   * Cuenta cuántas celdas hay de cada tipo de terreno.
   * @returns {{agua: number, arena: number, tierra: number}}
   */
  contarTerreno() {
    let agua = 0;
    let arena = 0;
    let tierra = 0;
    for (let i = 0; i < this.total; i++) {
      const t = this.terreno[i];
      if (t === TERRENO.AGUA) agua++;
      else if (t === TERRENO.ARENA) arena++;
      else tierra++;
    }
    return { agua, arena, tierra };
  }
}
