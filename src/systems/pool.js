/**
 * src/systems/pool.js — Pool de objetos (T26)
 * ============================================
 *
 * REGLA DE LA SIMULACIÓN: nada de `new` dentro del bucle.
 * Las entidades se crean una vez y se reciclan: cuando una muere, vuelve
 * al pool en vez de quedarse como basura para el recolector.
 *
 * El pool está indexado por "clave" (el tipo de entidad), para que un
 * herbívoro nunca recycle como depredador.
 */

export class Pool {
  constructor() {
    /** @type {Map<string|number, object[]>} Objetos libres por clave. */
    this.libres = new Map();
    /** Objetos creados en total desde el arranque (para medir si se recicla). */
    this.totalCreados = 0;
    /** Objetos devueltos al pool en total. */
    this.totalLiberados = 0;
    /** Objetos reciclados (sacados del pool) en total. */
    this.totalReutilizados = 0;
  }

  /**
   * Saca un objeto del pool. Si no hay, llama a la fábrica para crear uno.
   * @template T
   * @param {string|number} clave
   * @param {() => T} fabrica
   * @returns {T}
   */
  obtener(clave, fabrica) {
    const lista = this.libres.get(clave);
    if (lista !== undefined && lista.length > 0) {
      const obj = /** @type {T} */ (lista.pop());
      this.totalReutilizados++;
      return obj;
    }
    this.totalCreados++;
    return fabrica();
  }

  /**
   * Devuelve un objeto al pool para reutilizarlo.
   * @param {string|number} clave
   * @param {object} obj
   */
  liberar(clave, obj) {
    let lista = this.libres.get(clave);
    if (lista === undefined) {
      lista = [];
      this.libres.set(clave, lista);
    }
    lista.push(obj);
    this.totalLiberados++;
  }

  /**
   * ¿Cuántos objetos hay libres para una clave?
   * @param {string|number} clave
   * @returns {number}
   */
  disponibles(clave) {
    const lista = this.libres.get(clave);
    return lista === undefined ? 0 : lista.length;
  }

  /** Vacía el pool (tests / reinicio de mundo). */
  limpiar() {
    this.libres.clear();
  }
}
