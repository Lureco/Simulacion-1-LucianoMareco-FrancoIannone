/**
 * src/world/cell.js — Constantes de celda (T19 · contrato §3)
 * ============================================================
 *
 * Un solo lugar para los tipos de terreno y los estados de planta.
 * Son números fijos (viven en `Uint8Array`), no strings.
 *
 * Regla del contrato: P2 solo **lee** `TERRENO` y `PLANTA`; nunca escribe
 * en esas capas de la grilla.
 */

/** Tipo de terreno de una celda. */
export const TERRENO = {
  AGUA: 0,
  ARENA: 1,
  TIERRA: 2,
};

/** Estado de planta de una celda. */
export const PLANTA = {
  NADA: 0,
  SEMILLA: 1,
  JOVEN: 2,
  ADULTA: 3,
  MUERTA: 4,
};

/** Cantidad de tipos de terreno distintos (para tests y loops). */
export const CANTIDAD_TERRENO = 3;

/**
 * Nombre legible de un tipo de terreno (HUD y logs de depuración).
 * @param {number} tipo Uno de `TERRENO`.
 * @returns {string}
 */
export function nombreTerreno(tipo) {
  switch (tipo) {
    case TERRENO.AGUA:
      return 'agua';
    case TERRENO.ARENA:
      return 'arena';
    case TERRENO.TIERRA:
      return 'tierra';
    default:
      return 'desconocido';
  }
}

/**
 * Nombre legible de un estado de planta.
 * @param {number} estado Uno de `PLANTA`.
 * @returns {string}
 */
export function nombrePlanta(estado) {
  switch (estado) {
    case PLANTA.NADA:
      return 'nada';
    case PLANTA.SEMILLA:
      return 'semilla';
    case PLANTA.JOVEN:
      return 'joven';
    case PLANTA.ADULTA:
      return 'adulta';
    case PLANTA.MUERTA:
      return 'muerta';
    default:
      return 'desconocido';
  }
}
