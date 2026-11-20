/**
 * src/systems/eventos.js — Eventos diferidos (muertes y nacimientos)
 * ==================================================================
 *
 * Una entidad **no puede** darse de alta ni de baja en medio del recorrido
 * de `ctx.entidades.vivos`: eso cambiaría la lista mientras se itera. La
 * solución es la misma que usa la vegetación: el sistema anota el evento en
 * un buffer y `pasoDeSimulacion` lo aplica **al final del tick**, en orden
 * determinista.
 *
 * Los buffers son arrays planos que se reutilizan (no se reasignan), así no
 * generan basura por tick:
 *
 * - `_muertos`:     ids a eliminar.
 * - `_nacimientos`: tuplas `(tipo, indiceCelda, 5 genes)` a crear (F8/T67).
 *
 * Se crean de forma perezosa en el `ctx` la primera vez que hacen falta.
 */

import { bufferGenes, genesDeCria, PASO_NACIMIENTO } from './genetica.js';

/**
 * Buffer de ids a eliminar.
 * @param {object} ctx
 * @returns {number[]}
 */
export function muertesDe(ctx) {
  if (ctx._muertos === undefined) ctx._muertos = [];
  return ctx._muertos;
}

/**
 * Buffer de nacimientos, como tuplas planas de `PASO_NACIMIENTO` números.
 * @param {object} ctx
 * @returns {number[]}
 */
export function nacimientosDe(ctx) {
  if (ctx._nacimientos === undefined) ctx._nacimientos = [];
  return ctx._nacimientos;
}

/**
 * Anota la muerte de una entidad (se aplica al final del tick).
 *
 * Es **idempotente**: si la entidad ya estaba anotada (por ejemplo, la mató
 * un depredador después de que ella misma se anotó por hambre), no se
 * duplica. La bandera `moribundo` del almacén evita contar dos veces la
 * misma muerte y que dos depredadores cacen la misma presa en un tick.
 *
 * @param {object} ctx
 * @param {number} id
 */
export function anotarMuerte(ctx, id) {
  const a = ctx.entidades;
  if (a && a.moribundo) {
    if (a.moribundo[id] === 1) return;
    a.moribundo[id] = 1;
  }
  muertesDe(ctx).push(id);
}

/**
 * Anota el nacimiento de una cría (se aplica al final del tick).
 *
 * Los genes se calculan **acá**, con los padres todavía vivos: al aplicar los
 * nacimientos del final del tick un progenitor puede haber muerto y su id
 * haber sido reciclado por otra cría. El azar de la mutación sale de
 * `ctx.prng` en el momento de anotar, que es un orden fijo.
 *
 * @param {object} ctx
 * @param {number} tipo Uno de `ESPECIE`.
 * @param {number} indiceCelda Índice plano `y * ancho + x` de la celda.
 * @param {number} [padre] Id del primer progenitor; -1 si se desconoce.
 * @param {number} [madre] Id del segundo progenitor; -1 si se desconoce.
 */
export function anotarNacimiento(ctx, tipo, indiceCelda, padre = -1, madre = -1) {
  const genes = genesDeCria(ctx, padre, madre, bufferGenes(ctx));
  const evento = nacimientosDe(ctx);
  evento.push(tipo, indiceCelda);
  for (let i = 0; i < genes.length; i++) evento.push(genes[i]);
}

/** Cantidad de números que ocupa un nacimiento en el buffer. */
export { PASO_NACIMIENTO };
