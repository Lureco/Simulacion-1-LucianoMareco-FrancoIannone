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
 * - `_nacimientos`: pares `(tipo, indiceCelda)` a crear.
 *
 * Se crean de forma perezosa en el `ctx` la primera vez que hacen falta.
 */

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
 * Buffer de nacimientos, como pares `(tipo, indiceCelda)`.
 * @param {object} ctx
 * @returns {number[]}
 */
export function nacimientosDe(ctx) {
  if (ctx._nacimientos === undefined) ctx._nacimientos = [];
  return ctx._nacimientos;
}

/**
 * Anota la muerte de una entidad (se aplica al final del tick).
 * @param {object} ctx
 * @param {number} id
 */
export function anotarMuerte(ctx, id) {
  muertesDe(ctx).push(id);
}

/**
 * Anota el nacimiento de una cría (se aplica al final del tick).
 * @param {object} ctx
 * @param {number} tipo Uno de `ESPECIE`.
 * @param {number} indiceCelda Índice plano `y * ancho + x` de la celda.
 */
export function anotarNacimiento(ctx, tipo, indiceCelda) {
  nacimientosDe(ctx).push(tipo, indiceCelda);
}
