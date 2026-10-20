/**
 * src/systems/perception.js — Percepción y búsqueda de recursos (T36)
 * ======================================================================
 *
 * Qué puede "ver" una entidad, según el GDD §8:
 *
 *   Herbívoro → plantas, agua, otros herbívoros
 *   Depredador → herbívoros, agua, otros depredadores
 *
 * **Las plantas y el agua NO están en el spatial hash**: las plantas viven
 * en la capa `planta` de la grilla (un `Uint8Array`) y el agua es un tipo de
 * terreno. El hash espacial solo indexa **entidades**.
 *
 * Por eso la búsqueda de plantas y de agua recorre el vecindario de la
 * **grilla**, que es un array contiguo: es rápido y no genera basura.
 *
 * Para no repetir la búsqueda cada tick (es lo más caro de la IA), cada
 * entidad **memoriza su objetivo** en sus propios campos (`objetivoPlantaX`,
 * `objetivoAguaX`, …) y solo vuelve a buscar cuando:
 * - pasó el intervalo de búsqueda (`ticksEntreBusqueda`), o
 * - el objetivo desapareció (la planta fue comida).
 *
 * Sin `new` en el bucle: los objetivos viven en la entidad, que ya viene
 * del pool.
 */

import { PLANTA, TERRENO } from '../world/cell.js';

/**
 * Busca la planta comestible más cercano dentro del radio de visión.
 *
 * Recorre el vecindario de la grilla en **anillos crecientes** y se detiene
 * en el primer anillo donde encuentra algo: así no recorre todo el radio si
 * hay comida cerca.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean} `true` si encontró una planta (queda en la entidad).
 */
export function buscarPlanta(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;

  const radio = ctx.config.herbivoro.radioVision + 6;
  const cx = entidad.celdaX;
  const cy = entidad.celdaY;
  const planta = grid.planta;

  for (let r = 1; r <= radio; r++) {
    let mejorX = -1;
    let mejorY = -1;
    let mejorEstado = PLANTA.NADA;
    let mejorD = Infinity;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Sólo el borde del anillo: el interior ya se revisó.
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) continue;

        const estado = planta[y * grid.ancho + x];
        // Sólo las plantas adultas y jóvenes sirven de alimento.
        if (estado !== PLANTA.ADULTA && estado !== PLANTA.JOVEN) continue;

        const d = dx * dx + dy * dy;
        if (d < mejorD) {
          mejorD = d;
          mejorX = x;
          mejorY = y;
          mejorEstado = estado;
        }
      }
    }

    if (mejorX !== -1) {
      entidad.objetivoPlantaX = mejorX;
      entidad.objetivoPlantaY = mejorY;
      entidad.objetivoPlantaEstado = mejorEstado;
      return true;
    }
  }

  return false;
}

/**
 * Busca la celda de agua más cercana. El agua es terreno, así que se busca
 * en la grilla, no en el hash espacial.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean} `true` si encontró agua (queda en la entidad).
 */
export function buscarAgua(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;

  const radio = ctx.config.herbivoro.radioVision * 2;
  const cx = entidad.celdaX;
  const cy = entidad.celdaY;

  for (let r = 1; r <= radio; r++) {
    let mejorX = -1;
    let mejorY = -1;
    let mejorD = Infinity;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) continue;

        if (grid.terreno[y * grid.ancho + x] !== TERRENO.AGUA) continue;

        const d = dx * dx + dy * dy;
        if (d < mejorD) {
          mejorD = d;
          mejorX = x;
          mejorY = y;
        }
      }
    }

    if (mejorX !== -1) {
      entidad.objetivoAguaX = mejorX;
      entidad.objetivoAguaY = mejorY;
      return true;
    }
  }

  return false;
}

/**
 * Busca la presa más cercana (herbívoro) usando el **spatial hash**.
 *
 * @param {object} entidad Depredador.
 * @param {object} ctx
 * @param {object[]} salida Array reutilizable donde se acumulan los vecinos.
 * @returns {object|null} La presa más cercana, o `null`.
 */
export function buscarPresa(entidad, ctx, salida) {
  const radio = ctx.config.depredador.radioVision;
  const vecinos = ctx.hash.consultar(entidad.x, entidad.y, radio, salida, entidad);
  if (vecinos.length === 0) return null;

  let mejor = null;
  let mejorD = Infinity;
  for (let i = 0; i < vecinos.length; i++) {
    const v = vecinos[i];
    if (v.tipo !== ctx.config.tipos.herbivoro) continue;
    const dx = v.x - entidad.x;
    const dy = v.y - entidad.y;
    const d = dx * dx + dy * dy;
    if (d < mejorD) {
      mejorD = d;
      mejor = v;
    }
  }
  return mejor;
}

/**
 * Busca al depredador más cercano (para huir). Usa el spatial hash.
 *
 * @param {object} entidad Herbívoro.
 * @param {object} ctx
 * @param {object[]} salida Array reutilizable donde se acumulan los vecinos.
 * @returns {object|null} El depredador más cercano, o `null`.
 */
export function buscarDepredador(entidad, ctx, salida) {
  const radio = ctx.config.depredador.radioVision;
  const vecinos = ctx.hash.consultar(entidad.x, entidad.y, radio, salida, entidad);
  if (vecinos.length === 0) return null;

  let mejor = null;
  let mejorD = Infinity;
  for (let i = 0; i < vecinos.length; i++) {
    const v = vecinos[i];
    if (v.tipo !== ctx.config.tipos.depredador) continue;
    const dx = v.x - entidad.x;
    const dy = v.y - entidad.y;
    const d = dx * dx + dy * dy;
    if (d < mejorD) {
      mejorD = d;
      mejor = v;
    }
  }
  return mejor;
}

/**
 * ¿La planta objetivo sigue viva? Si ya no, la entidad busca otra.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function objetivoPlantaValido(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;
  const x = entidad.objetivoPlantaX;
  const y = entidad.objetivoPlantaY;
  if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) return false;
  const estado = grid.planta[y * grid.ancho + x];
  return estado === PLANTA.ADULTA || estado === PLANTA.JOVEN;
}

/**
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function objetivoAguaValido(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;
  const x = entidad.objetivoAguaX;
  const y = entidad.objetivoAguaY;
  if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) return false;
  return grid.terreno[y * grid.ancho + x] === TERRENO.AGUA;
}

/**
 * ¿Hay una planta comestible **en la celda actual**? (para comer al pasar)
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function plantaEnCeldaActual(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;
  const x = entidad.celdaX;
  const y = entidad.celdaY;
  if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) return false;
  const estado = grid.planta[y * grid.ancho + x];
  return estado === PLANTA.ADULTA || estado === PLANTA.JOVEN;
}
