/**
 * src/entities/entityManager.js — Almacén de entidades (SoA) (T23, T26)
 * ======================================================================
 *
 * ⚠️ REFACTOR SoA (ver `docs/DECISIONES.md` D13).
 *
 * Antes: un objeto `Entity` por animal (con `x`, `y`, `energia` como
 * propiedades) y un pool de objetos. Con 5000 animales eso son 5000 objetos
 * sueltos en el heap: mal uso de caché y presión para el recolector.
 *
 * Ahora: **Structure of Arrays**. No hay un objeto por bicho; hay un array
 * tipado por propiedad, y la identidad de un bicho es su `id` (un entero):
 *
 *     x[id], y[id], energia[id], dirX[id], ...
 *
 * Recorrer las posiciones de 5000 bichos es recorrer 5000 floats contiguos.
 * El "pool" ahora es una lista de ids libres: reciclar una entidad es
 * reutilizar un `id`, sin crear nada.
 *
 * El manager NO sabe comportarse: eso vive en la especie (`especies.js`).
 * Acá solo están los datos y el alta/baja.
 */

import { ESTADO_IA } from './entity.js';
import { especieDe } from './especies.js';
import { CONFIG } from '../config.js';

/** Capacidad con la que arranca el almacén. */
const CAPACIDAD_INICIAL = 256;

/** @param {Float32Array} actual @param {number} capacidad @returns {Float32Array} */
function crecerF32(actual, capacidad) {
  const nuevo = new Float32Array(capacidad);
  nuevo.set(actual);
  return nuevo;
}
/** @param {Int32Array} actual @param {number} capacidad @returns {Int32Array} */
function crecerI32(actual, capacidad) {
  const nuevo = new Int32Array(capacidad);
  nuevo.set(actual);
  return nuevo;
}
/** @param {Uint8Array} actual @param {number} capacidad @returns {Uint8Array} */
function crecerU8(actual, capacidad) {
  const nuevo = new Uint8Array(capacidad);
  nuevo.set(actual);
  return nuevo;
}

export class EntityManager {
  /** @param {number} [capacidadInicial] */
  constructor(capacidadInicial = CAPACIDAD_INICIAL) {
    /** Cuántos `id` entran sin reasignar. */
    this.capacidad = 0;
    /** Cuántas entidades vivas hay. */
    this.cantidad = 0;
    /** Sube en cada alta/baja. El render lo usa para reconstruir sprites. */
    this.version = 0;
    /** Ids asignados alguna vez (mide si se recicla). */
    this.totalCreados = 0;
    /** Ids reciclados desde la lista de libres. */
    this.totalReutilizados = 0;

    /** @type {number[]} Ids libres (pila de reciclado). */
    this.libres = [];
    /** @type {number[]} Ids vivos, en orden de creación. */
    this.vivos = [];
    /** @type {Map<number, number[]>} Ids vivos por tipo. */
    this.porTipo = new Map();
    /** @type {(import('./entity.js').Especie|undefined)[]} Especie de cada id. */
    this._especie = [];

    // ── Datos (SoA) ──────────────────────────────────────────────────
    /** @type {Float32Array} */ this.x = new Float32Array(0);
    /** @type {Float32Array} */ this.y = new Float32Array(0);
    /** @type {Float32Array} */ this.dirX = new Float32Array(0);
    /** @type {Float32Array} */ this.dirY = new Float32Array(0);
    /** @type {Float32Array} */ this.energia = new Float32Array(0);
    /** @type {Float32Array} */ this.velocidad = new Float32Array(0);
    /** @type {Float32Array} Necesidad de comer, 0..1 (T34). */ this.hambre = new Float32Array(0);
    /** @type {Float32Array} Necesidad de beber, 0..1 (T34). */ this.sed = new Float32Array(0);
    /** @type {Float32Array} Deseo de reproducirse, 0..1 (T34). */ this.deseoRepro =
      new Float32Array(0);
    /** @type {Int32Array} */ this.edad = new Int32Array(0);
    /** @type {Int32Array} */ this.tipo = new Int32Array(0);
    /** @type {Int32Array} */ this.ticksParaGiro = new Int32Array(0);
    /** @type {Int32Array} Ticks que faltan para poder reproducirse de nuevo. */
    this.cooldown = new Int32Array(0);
    /** @type {Int32Array} Id de la presa que persigue un depredador; -1 = ninguna (T43). */
    this.presa = new Int32Array(0);
    /** @type {Int32Array} Ticks que lleva persiguiendo la presa actual (T43). */
    this.ticksPersecucion = new Int32Array(0);
    /** @type {Int32Array} Ticks que faltan para volver a buscar presa (T43). */
    this.ticksBusqueda = new Int32Array(0);
    /** @type {Int32Array} Ticks que faltan para volver a seguir el campo al agua (T38). */
    this.ticksBusquedaAgua = new Int32Array(0);
    /** @type {Uint8Array} */ this.estado = new Uint8Array(0);
    /** @type {Uint8Array} */ this.vivo = new Uint8Array(0);
    /** @type {Uint8Array} 1 = ya anotada para morir este tick (evita duplicados). */
    this.moribundo = new Uint8Array(0);

    this.reservar(capacidadInicial);
  }

  /**
   * Garantiza capacidad para `n` ids, duplicando si hace falta.
   * @param {number} n
   */
  reservar(n) {
    if (n <= this.capacidad) return;
    const capacidad = Math.max(n, this.capacidad * 2, CAPACIDAD_INICIAL);
    this.x = crecerF32(this.x, capacidad);
    this.y = crecerF32(this.y, capacidad);
    this.dirX = crecerF32(this.dirX, capacidad);
    this.dirY = crecerF32(this.dirY, capacidad);
    this.energia = crecerF32(this.energia, capacidad);
    this.velocidad = crecerF32(this.velocidad, capacidad);
    this.hambre = crecerF32(this.hambre, capacidad);
    this.sed = crecerF32(this.sed, capacidad);
    this.deseoRepro = crecerF32(this.deseoRepro, capacidad);
    this.edad = crecerI32(this.edad, capacidad);
    this.tipo = crecerI32(this.tipo, capacidad);
    this.ticksParaGiro = crecerI32(this.ticksParaGiro, capacidad);
    this.cooldown = crecerI32(this.cooldown, capacidad);
    this.presa = crecerI32(this.presa, capacidad);
    this.ticksPersecucion = crecerI32(this.ticksPersecucion, capacidad);
    this.ticksBusqueda = crecerI32(this.ticksBusqueda, capacidad);
    this.ticksBusquedaAgua = crecerI32(this.ticksBusquedaAgua, capacidad);
    this.estado = crecerU8(this.estado, capacidad);
    this.vivo = crecerU8(this.vivo, capacidad);
    this.moribundo = crecerU8(this.moribundo, capacidad);
    this.capacidad = capacidad;
  }

  /**
   * Da de alta una entidad y devuelve su `id`. Recicla un id libre si hay.
   * @param {number} tipo
   * @returns {number} id de la entidad nueva.
   */
  crear(tipo) {
    const especie = especieDe(tipo);

    let id;
    if (this.libres.length > 0) {
      id = /** @type {number} */ (this.libres.pop());
      this.totalReutilizados++;
    } else {
      id = this.totalCreados;
      this.totalCreados++;
      this.reservar(id + 1);
    }

    // Reset: la entidad arranca como nueva (aunque el id sea reciclado).
    this.tipo[id] = tipo;
    this.x[id] = 0;
    this.y[id] = 0;
    this.dirX[id] = 1;
    this.dirY[id] = 0;
    this.energia[id] = CONFIG.entidades.energiaInicial;
    this.edad[id] = 0;
    this.velocidad[id] = especie.velocidad;
    this.hambre[id] = 0;
    this.sed[id] = 0;
    this.deseoRepro[id] = 0;
    this.cooldown[id] = 0;
    this.presa[id] = -1;
    this.ticksPersecucion[id] = 0;
    this.ticksBusqueda[id] = 0;
    this.ticksBusquedaAgua[id] = 0;
    this.estado[id] = ESTADO_IA.VAGO;
    this.ticksParaGiro[id] = 0;
    this.vivo[id] = 1;
    this.moribundo[id] = 0;
    this._especie[id] = especie;

    this.vivos.push(id);
    this.cantidad++;

    let lista = this.porTipo.get(tipo);
    if (lista === undefined) {
      lista = [];
      this.porTipo.set(tipo, lista);
    }
    lista.push(id);

    this.version++;
    return id;
  }

  /**
   * Da de baja una entidad y libera su id.
   * @param {number} id
   */
  eliminar(id) {
    if (!this.vivo[id]) return;

    this.vivo[id] = 0;
    this.moribundo[id] = 0;
    this.presa[id] = -1;
    this._especie[id] = undefined;

    const i = this.vivos.indexOf(id);
    if (i >= 0) this.vivos.splice(i, 1);

    const lista = this.porTipo.get(this.tipo[id]);
    if (lista !== undefined) {
      const j = lista.indexOf(id);
      if (j >= 0) lista.splice(j, 1);
    }

    this.libres.push(id);
    this.cantidad--;
    this.version++;
  }

  /** @param {number} id @returns {import('./entity.js').Especie|undefined} */
  especie(id) {
    return this._especie[id];
  }

  /**
   * Cantidad de entidades vivas de un tipo.
   * @param {number} tipo
   * @returns {number}
   */
  contar(tipo) {
    const lista = this.porTipo.get(tipo);
    return lista === undefined ? 0 : lista.length;
  }

  /**
   * Ids vivos de un tipo. No lo modifiques a mano.
   * @param {number} tipo
   * @returns {number[]}
   */
  deTipo(tipo) {
    const lista = this.porTipo.get(tipo);
    return lista === undefined ? [] : lista;
  }

  /** Total de entidades vivas. @returns {number} */
  get total() {
    return this.cantidad;
  }

  // ── Vistas discretas (antes eran getters de `Entity`) ───────────────

  /** @param {number} id @returns {number} */
  celdaX(id) {
    return Math.floor(this.x[id]);
  }
  /** @param {number} id @returns {number} */
  celdaY(id) {
    return Math.floor(this.y[id]);
  }
  /** @param {number} id @returns {number} */
  offsetX(id) {
    return this.x[id] - Math.floor(this.x[id]);
  }
  /** @param {number} id @returns {number} */
  offsetY(id) {
    return this.y[id] - Math.floor(this.y[id]);
  }
  /**
   * Índice de celda con el formato `y * ancho + x`.
   * @param {number} id
   * @param {number} ancho
   * @returns {number}
   */
  celda(id, ancho) {
    return this.celdaY(id) * ancho + this.celdaX(id);
  }

  /** Da de baja a todas las entidades. */
  limpiar() {
    const copia = this.vivos.slice();
    for (const id of copia) this.eliminar(id);
  }
}
