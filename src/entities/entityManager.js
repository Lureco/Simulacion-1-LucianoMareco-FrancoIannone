/**
 * src/entities/entityManager.js — Contenedor de entidades (T23)
 * ==============================================================
 *
 * Lleva el alta y la baja de entidades y las **separa por especie**.
 *
 * - `vivas`   → todas las entidades vivas (para iterar rápido).
 * - `porTipo` → un array por especie (para contar y para que cada sistema
 *               recorra solo lo suyo).
 * - `pool`    → recycling: una entidad liberada vuelve al pool en vez de
 *               quedar como basura (T26).
 *
 * `version` sube cada vez que cambia la población. El render la usa para
 * saber cuándo tiene que reconstruir sus sprites, sin comparar arrays.
 */

import { Pool } from '../systems/pool.js';

export class EntityManager {
  constructor() {
    /** @type {Pool} */
    this.pool = new Pool();
    /** @type {object[]} Todas las entidades vivas. */
    this.vivas = [];
    /** @type {Map<number, object[]>} Vivas agrupadas por especie. */
    this.porTipo = new Map();
    /** @type {Map<number, () => object>} Fábricas por especie. */
    this.fabricas = new Map();
    /** Sube en cada alta/baja. @type {number} */
    this.version = 0;
  }

  /**
   * Registra cómo se crea una especie.
   * @param {number} tipo
   * @param {() => object} fabrica
   */
  registrar(tipo, fabrica) {
    this.fabricas.set(tipo, fabrica);
  }

  /**
   * Da de alta una entidad de la especie indicada.
   * @param {number} tipo
   * @returns {object} La entidad (reciclada del pool si había una libre).
   */
  crear(tipo) {
    const fabrica = this.fabricas.get(tipo);
    if (fabrica === undefined) {
      throw new Error(`EntityManager: no hay fábrica registrada para el tipo ${tipo}`);
    }
    const entidad = this.pool.obtener(tipo, fabrica);
    entidad.reiniciar();
    this.vivas.push(entidad);

    let lista = this.porTipo.get(tipo);
    if (lista === undefined) {
      lista = [];
      this.porTipo.set(tipo, lista);
    }
    lista.push(entidad);

    this.version++;
    return entidad;
  }

  /**
   * Da de baja una entidad y la devuelve al pool.
   * @param {object} entidad
   */
  eliminar(entidad) {
    if (!entidad.vivo) return;

    entidad.vivo = false;

    const i = this.vivas.indexOf(entidad);
    if (i >= 0) this.vivas.splice(i, 1);

    const lista = this.porTipo.get(entidad.tipo);
    if (lista !== undefined) {
      const j = lista.indexOf(entidad);
      if (j >= 0) lista.splice(j, 1);
    }

    this.pool.liberar(entidad.tipo, entidad);
    this.version++;
  }

  /**
   * Cantidad de entidades vivas de una especie.
   * @param {number} tipo
   * @returns {number}
   */
  contar(tipo) {
    const lista = this.porTipo.get(tipo);
    return lista === undefined ? 0 : lista.length;
  }

  /**
   * Array de vivas de una especie. No lo modifiques a mano.
   * @param {number} tipo
   * @returns {object[]}
   */
  deTipo(tipo) {
    const lista = this.porTipo.get(tipo);
    return lista === undefined ? [] : lista;
  }

  /** Total de entidades vivas. @returns {number} */
  get total() {
    return this.vivas.length;
  }

  /** Da de baja a todas las entidades. */
  limpiar() {
    // Copia: `eliminar` modifica `vivas` mientras iteramos.
    for (const entidad of this.vivas.slice()) {
      this.eliminar(entidad);
    }
  }
}
