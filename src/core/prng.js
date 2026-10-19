/**
 * src/core/prng.js — Generador pseudoaleatorio determinista
 * ==========================================================
 *
 * PROHIBIDO usar `Math.random()` dentro de la simulación.
 * Todo el azar pasa por acá, para que la misma semilla produzca
 * siempre la misma simulación.
 *
 * Algoritmo: mulberry32 (rápido, 32 bits de estado, buena distribución
 * para simulación y para propósito general). No es criptográfico.
 */

/** Semilla por defecto si no se pasa ninguna. */
export const SEMILLA_POR_DEFECTO = 1337;

/**
 * Generador de números pseudoaleatorios determinista de 32 bits.
 * @param {number} seed Semilla sin signo. Se normaliza con `>>> 0`.
 * @returns {() => number} Función que devuelve floats en [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash FNV-1a de 32 bits sobre una lista de enteros.
 * Sirve para derivar semillas hijas a partir de (semilla, sal).
 * @param {...number} nums Enteros a hashear.
 * @returns {number} Hash de 32 bits sin signo.
 */
export function hashInts(...nums) {
  let h = 0x811c9dc5;
  for (const n of nums) {
    let x = n >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/**
 * Hash FNV-1a de 32 bits sobre un string (para seeds escritas por el usuario).
 * @param {string} str
 * @returns {number} Hash de 32 bits sin signo.
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (str.charCodeAt(i) >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Fachada del PRNG con utilidades para la simulación.
 *
 * Todos los métodos son deterministas: dos instancias con la misma semilla
 * producen exactamente la misma secuencia de valores.
 */
export class PRNG {
  /** @type {number} */
  #estado;
  /** @type {() => number} */
  #next;
  /** Cache del Box-Muller: guarda el segundo valor normal generado. */
  #gaussCache = null;

  /**
   * @param {number} [seed=SEMILLA_POR_DEFECTO]
   */
  constructor(seed = SEMILLA_POR_DEFECTO) {
    this.reset(seed);
  }

  /** Semilla actual (32 bits sin signo). */
  get seed() {
    return this.#estado;
  }

  /**
   * Reinicia el generador con una semilla nueva (o la misma).
   * @param {number} [seed]
   * @returns {this}
   */
  reset(seed = this.#estado) {
    this.#estado = seed >>> 0;
    this.#next = mulberry32(this.#estado);
    this.#gaussCache = null;
    return this;
  }

  /** @returns {number} Float en [0, 1). */
  float() {
    return this.#next();
  }

  /**
   * Float en [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  range(min, max) {
    return min + this.#next() * (max - min);
  }

  /**
   * Entero en [min, max) — el máximo queda excluido.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  int(min, max) {
    if (max <= min) return min;
    return min + Math.floor(this.#next() * (max - min));
  }

  /**
   * Entero en [min, max] — ambos incluidos.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  intInclusive(min, max) {
    if (max <= min) return min;
    return min + Math.floor(this.#next() * (max - min + 1));
  }

  /**
   * Booleano con probabilidad p de ser true.
   * @param {number} [p=0.5]
   * @returns {boolean}
   */
  bool(p = 0.5) {
    return this.#next() < p;
  }

  /**
   * @returns {-1 | 1} Signo aleatorio.
   */
  sign() {
    return this.#next() < 0.5 ? -1 : 1;
  }

  /**
   * Elemento al azar de un array. No muta el array.
   * @template T
   * @param {readonly T[]} items
   * @returns {T | undefined}
   */
  pick(items) {
    if (!items || items.length === 0) return undefined;
    return items[this.int(0, items.length)];
  }

  /**
   * Normal estándar por Box-Muller (con caché del segundo valor).
   * @param {number} [media=0]
   * @param {number} [desvio=1]
   * @returns {number}
   */
  gaussian(media = 0, desvio = 1) {
    if (this.#gaussCache !== null) {
      const valor = this.#gaussCache;
      this.#gaussCache = null;
      return media + valor * desvio;
    }
    let u;
    let v;
    let s;
    do {
      u = this.#next() * 2 - 1;
      v = this.#next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const factor = Math.sqrt((-2 * Math.log(s)) / s);
    this.#gaussCache = v * factor;
    return media + u * factor * desvio;
  }

  /**
   * Ángulo aleatorio en radianes [0, 2π).
   * @returns {number}
   */
  angle() {
    return this.#next() * Math.PI * 2;
  }

  /**
   * Deriva un PRNG hijo, determinista respecto de esta instancia.
   * Se usa para que cada sistema tenga su propio flujo de azar sin
   * que uno afecte al orden del otro.
   * @param {number} salt
   * @returns {PRNG}
   */
  fork(salt) {
    return new PRNG(hashInts(this.#estado, salt));
  }

  /**
   * Copia el estado actual de la secuencia (para guardar/cargar partidas).
   * @returns {number}
   */
  getState() {
    return this.#estado;
  }
}
