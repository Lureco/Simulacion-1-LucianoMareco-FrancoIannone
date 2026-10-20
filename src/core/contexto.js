/**
 * src/core/contexto.js — Contexto de simulación
 * =============================================
 *
 * El `ctx` es el único canal por el que los sistemas hablan con el mundo.
 * Se pasa por referencia a todos los `actualizar()` y nunca se reasigna.
 *
 * Campos:
 * - `prng`   → PRNG con semilla. **Única fuente de azar** de la simulación.
 * - `mundo`  → `{ ancho, alto }` en celdas. Cuando exista la `Grid` de P1,
 *              acá va también la referencia a la grilla.
 * - `grid`   → `Grid` de P1 (terreno, planta, ocupante) o `null` mientras
 *              no se haya generado el terreno.
 * - `config` → `CONFIG` (todos los parámetros).
 * - `tick`   → número de ticks simulados desde el arranque.
 * - `hash`   → Spatial Hash, para consultas de vecindario.
 * - `entidades` → `EntityManager`.
 */

/**
 * Crea el contexto de simulación.
 * @param {object} opciones
 * @param {import('./prng.js').PRNG} opciones.prng
 * @param {{ancho: number, alto: number}} opciones.mundo
 * @param {object} [opciones.config]
 * @returns {object} Contexto mutable.
 */
export function crearContexto({ prng, mundo, config }) {
  return {
    prng,
    mundo,
    grid: null,
    config,
    tick: 0,
    hash: null,
    entidades: null,
    /**
     * Array reutilizable para las consultas al spatial hash.
     * La percepción lo usa como buffer de salida: así no se genera basura
     * en cada búsqueda de vecinos.
     * @type {object[]}
     */
    vecinos: [],
    /**
     * Distancia de cada celda al agua más cercana (BFS). Lo calcula
     * `systems/mapaAgua.js` al generar el mundo: permite que un animal
     * sediento camine hacia la orilla sin "ver" el agua (T38).
     * @type {Int32Array|null}
     */
    mapaAgua: null,
  };
}
