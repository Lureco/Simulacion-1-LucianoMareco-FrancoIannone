/**
 * src/systems/genetica.js — Herencia y mutación de rasgos (F8/T67)
 * ==================================================================
 *
 * Cada individuo lleva cinco genes como multiplicadores de los rasgos de su
 * especie: velocidad, tamaño, percepción, consumo y tiempo de reproducción.
 * El valor 1 es el rasgo base de la especie; los genes viven en arrays SoA del
 * `EntityManager` (ver D13), no en objetos por animal.
 *
 * La cría hereda el promedio ponderado de los dos progenitores y cada gen puede
 * mutar con `CONFIG.genetica.probMutacion`, sumando o restando `deltaMutacion` y
 * quedando siempre dentro de `[minRasgo, maxRasgo]`. Todo el azar sale de
 * `ctx.prng` y se consume en orden fijo, así que la misma seed da la misma
 * descendencia.
 *
 * No se crea nada por nacimiento: el buffer de genes se reserva una sola vez
 * en el contexto y se rellena en sitio.
 */

import { clamp } from '../core/utils.js';

/** Cantidad de genes por cría (y de floats extra por evento de nacimiento). */
export const CANTIDAD_GENES = 5;

/** Paso del buffer plano de nacimientos: `(tipo, indice, 5 genes)`. */
export const PASO_NACIMIENTO = 2 + CANTIDAD_GENES;

/** Posición de cada gen dentro del bloque de 5 floats. */
export const GEN = {
  VELOCIDAD: 0,
  TAMANO: 1,
  PERCEPCION: 2,
  CONSUMO: 3,
  REPRODUCCION: 4,
};

/**
 * Buffer perezoso donde se calculan los genes de la cría antes de anotar el
 * nacimiento. Se reutiliza en cada reproducción: nunca se crea dentro del
 * bucle caliente.
 * @param {object} ctx
 * @returns {Float32Array}
 */
export function bufferGenes(ctx) {
  if (ctx._genesCria === undefined || ctx._genesCria.length !== CANTIDAD_GENES) {
    ctx._genesCria = new Float32Array(CANTIDAD_GENES);
  }
  return ctx._genesCria;
}

/**
 * Hereda un gen de ambos padres y aplica mutación con el PRNG de la
 * simulación. Sin azar externo: ni `Math.random()` ni valores globales.
 * @param {object} ctx
 * @param {number} valorPadre
 * @param {number} valorMadre
 * @returns {number}
 */
function heredarGen(ctx, valorPadre, valorMadre) {
  const cfg = ctx.config.genetica;
  const base = valorPadre * cfg.pesoPadre + valorMadre * (1 - cfg.pesoPadre);
  if (ctx.prng.float() >= cfg.probMutacion) return clamp(base, cfg.minRasgo, cfg.maxRasgo);
  const signo = ctx.prng.bool(cfg.probMutacionPositiva) ? 1 : -1;
  return clamp(base + signo * cfg.deltaMutacion, cfg.minRasgo, cfg.maxRasgo);
}

/**
 * Calcula los cinco genes de una cría. Si no hay padres conocidos (por
 * ejemplo, una llamada directa a `anotarNacimiento` en un test) devuelve genes
 * neutrales sin consumir azar, manteniendo el determinismo anterior.
 *
 * @param {object} ctx
 * @param {number} padre Id del primer progenitor, o -1.
 * @param {number} madre Id del segundo progenitor, o -1.
 * @param {Float32Array} salida Buffer de `CANTIDAD_GENES` floats.
 * @returns {Float32Array} La misma `salida`.
 */
export function genesDeCria(ctx, padre, madre, salida) {
  if (padre < 0 || madre < 0) {
    salida.fill(1);
    return salida;
  }
  const a = ctx.entidades;
  salida[GEN.VELOCIDAD] = heredarGen(ctx, a.genVelocidad[padre], a.genVelocidad[madre]);
  salida[GEN.TAMANO] = heredarGen(ctx, a.genTamano[padre], a.genTamano[madre]);
  salida[GEN.PERCEPCION] = heredarGen(ctx, a.genPercepcion[padre], a.genPercepcion[madre]);
  salida[GEN.CONSUMO] = heredarGen(ctx, a.genConsumo[padre], a.genConsumo[madre]);
  salida[GEN.REPRODUCCION] = heredarGen(ctx, a.genReproduccion[padre], a.genReproduccion[madre]);
  return salida;
}

/**
 * Copia los genes de un buffer plano de nacimientos a los arrays de una cría
 * recién creada. `offset` apunta al primer gen dentro del evento.
 * @param {import('../entities/entityManager.js').EntityManager} a
 * @param {number} id
 * @param {number[]} buffer
 * @param {number} offset
 */
export function aplicarGenesDesde(a, id, buffer, offset) {
  a.genVelocidad[id] = buffer[offset + GEN.VELOCIDAD];
  a.genTamano[id] = buffer[offset + GEN.TAMANO];
  a.genPercepcion[id] = buffer[offset + GEN.PERCEPCION];
  a.genConsumo[id] = buffer[offset + GEN.CONSUMO];
  a.genReproduccion[id] = buffer[offset + GEN.REPRODUCCION];
}
