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
 * - `nacimientosTotales` / `muertesTotales` → contadores acumulados (HUD).
 * - `muertesPorCausa` → `{ hambre, sed, vejez }` (T45).
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
    nacimientosTotales: 0,
    muertesTotales: 0,
    /** Muertes por causa (T45): `{ hambre, sed, vejez }`. */
    muertesPorCausa: { hambre: 0, sed: 0, vejez: 0 },
  };
}
