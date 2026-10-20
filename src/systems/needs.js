/**
 * src/systems/needs.js — Sistema de necesidades (T34)
 * ================================================
 *
 * Todas las necesidades están **normalizadas en `[0, 1]`**, donde `0` es
 * "satisfecha" y `1` es "crítica". La normalización permite que la **misma
 * IA por prioridad** sirva para las dos especies: el herbívoro y el
 * depredador tienen escalas distintas (el carnívoro tarda más en hambrearse)
 * pero se comparan de la misma forma.
 *
 * Las necesidades viven en la **entidad** (`entidad.necesidades`), no en un
 * objeto aparte: así el pool de objetos las recicla con la entidad y no
 * hay `new` en el bucle de simulación.
 *
 * Contrato §4 en `docs/CONTRATO.md`.
 */

import { CONFIG } from '../config.js';

/** Claves de las necesidades. Los valores van de 0 (satisfecha) a 1 (crítica). */
export const NECESIDAD = {
  HAMBRE: 'hambre',
  SED: 'sed',
  REPRODUCCION: 'reproduccion',
  /** Ninguna necesidad urgente: la entidad deambula. */
  EXPLORAR: 'explorar',
};

/**
 * Estado de necesidades de una entidad.
 *
 * Es un objeto **plano y fijo**: se crea una vez por entidad (en el pool) y
 * se reinicia en `Entity.reiniciar()`. Nunca se crean objetos en el bucle.
 */
export class Necesidades {
  constructor() {
    /** @type {number} 0 = satisfecha, 1 = hambrienta. */
    this.hambre = 0;
    /** @type {number} 0 = hidratada, 1 = sedienta. */
    this.sed = 0;
    /** @type {number} 0 = sin apuro, 1 = quiere reproducirse. */
    this.reproduccion = 0;
    /** @type {number} Energía actual (0..`CONFIG.entidades.energiaMaxima`). */
    this.energia = CONFIG.entidades.energiaInicial;
  }

  /** Deja las necesidades como recién nacidas. */
  reiniciar() {
    this.hambre = 0;
    this.sed = 0;
    this.reproduccion = 0;
    this.energia = CONFIG.entidades.energiaInicial;
  }
}

/**
 * Avanza las necesidades de una entidad un tick.
 *
 * Las necesidades que "suben" (hambre, sed, reproducción) crecen de forma
 * constante. La energía **baja**: es lo que se consume al vivir, al moverse
 * y al cruzar terreno difícil.
 *
 * @param {object} entidad Entidad con `necesidades` y `estado`.
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx Contexto de simulación.
 */
export function avanzarNecesidades(entidad, dt, ctx) {
  const n = entidad.necesidades;
  const cfg = ctx.config;
  const esp = configEspecie(entidad, ctx);

  // La edad vive en la entidad (contrato §1), no acá: una sola fuente de
  // verdad para no que la edad y la vejez se desincronicen.

  // Las necesidades Criticables crecen siempre.
  n.hambre = Math.min(1, n.hambre + esp.consumoHambre * dt);
  n.sed = Math.min(1, n.sed + esp.consumoSed * dt);

  // El deseo de reproducir sube solo si la entidad está bien alimentada:
  // no tiene sentido reproducirse con hambre y sed encima.
  if (n.hambre < esp.hambreCritica && n.sed < esp.sedCritica) {
    n.reproduccion = Math.min(1, n.reproduccion + esp.crecimientoReproduccion * dt);
  } else {
    n.reproduccion = Math.max(0, n.reproduccion - esp.decaimientoReproduccion * dt);
  }

  // La energía baja con el metabolismo base y sube un poco al comer.
  n.energia -= cfg.entidades.consumoMetabolico * dt;

  // Moverse cuesta más que estar quieto.
  if (entidad.moviendo) {
    n.energia -= cfg.entidades.consumoMovimiento * dt;
  }
}

/**
 * Devuelve el bloque de configuración de la especie de una entidad.
 * @param {object} entidad
 * @param {object} ctx
 * @returns {object} `CONFIG.herbivoro` o `CONFIG.depredador`.
 */
export function configEspecie(entidad, ctx) {
  return entidad.tipo === ctx.config.tipos.herbivoro ? ctx.config.herbivoro : ctx.config.depredador;
}

/**
 * Normaliza la energía a `[0, 1]`: 0 = sin energía, 1 = energía llena.
 * @param {object} entidad
 * @returns {number}
 */
export function energiaNormalizada(entidad) {
  const max = CONFIG.entidades.energiaMaxima;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, entidad.necesidades.energia / max));
}

/**
 * Normaliza la edad a `[0, 1]`: 1 = llegó a la edad máxima.
 * La edad en ticks vive en la entidad (contrato §1).
 * @param {object} entidad
 * @returns {number}
 */
export function edadNormalizada(entidad) {
  const max = CONFIG.entidades.edadMaximaTicks;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, entidad.edad / max));
}

/**
 * Normaliza la reproducción a `[0, 1]`.
 * @param {object} entidad
 * @returns {number}
 */
export function reproduccionNormalizada(entidad) {
  return entidad.necesidades.reproduccion;
}

/**
 * Elige la **necesidad dominante** de la entidad: la que manda sobre las
 * demás. Es el corazón de la IA por prioridad (T35).
 *
 * Orden (según el GDD §5.2 y §5.3):
 *   hambre crítica → sed → reproducirse → explorar
 *
 * Se usa el valor **normalizado** de cada necesidad contra su umbral, así
 * las dos especies comparten la misma lógica.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {string} Una de las claves de `NECESIDAD`.
 */
export function necesidadDominante(entidad, ctx) {
  const n = entidad.necesidades;
  const esp = configEspecie(entidad, ctx);

  if (n.hambre >= esp.hambreCritica) return NECESIDAD.HAMBRE;
  if (n.sed >= esp.sedCritica) return NECESIDAD.SED;
  if (n.reproduccion >= esp.umbralReproduccion) return NECESIDAD.REPRODUCCION;
  return NECESIDAD.EXPLORAR;
}

/**
 * ¿La entidad está en un estado que la hace vulnerable?
 * Se usa para la huida del herbívoro frente al depredador (T35).
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function enPeligro(entidad, ctx) {
  const n = entidad.necesidades;
  const esp = configEspecie(entidad, ctx);
  return n.hambre >= esp.hambreCritica || n.sed >= esp.sedCritica;
}
