/**
 * src/render/terrainMarching.js — Marching squares para el terreno (pixel art)
 * ============================================================================
 *
 * Parte **pura** (sin DOM, sin Pixi) del render del terreno: decide, para cada
 * píxel de un tile, qué tipo de terreno dibujar usando marching squares de 4
 * esquinas muestreadas en la grilla. Así las costas y las playas dejan de ser
 * cortes rectos entre celdas y pasan a tener bordes escalonados, pero siempre
 * en pasos de píxel (estilo pixel art).
 *
 * La grilla clasifica cada celda en AGUA < ARENA < TIERRA (por altura). Las
 * transiciones se calculan por capas de elevación:
 *   - capa "arena o más": un píxel es arena/tierra si está dentro de la forma
 *     marching-squares de las celdas con tipo >= ARENA.
 *   - capa "tierra": un píxel es tierra si está dentro de la forma de las
 *     celdas con tipo == TIERRA.
 *
 * Donde tierra y agua se tocan sin celda de arena intermedia, la interpolación
 * genera una franja de arena: una playa suave y determinista.
 */

import { TERRENO } from '../world/cell.js';

/**
 * Tipo de terreno de una celda, acotado a los bordes del mapa (no devuelve
 * AGUA fuera del mundo: así el borde de la textura no inventa una costa).
 * @param {import('../world/grid.js').Grid} grid
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function tipoAcotado(grid, x, y) {
  const cx = x < 0 ? 0 : x >= grid.ancho ? grid.ancho - 1 : x;
  const cy = y < 0 ? 0 : y >= grid.alto ? grid.alto - 1 : y;
  return grid.terreno[cy * grid.ancho + cx];
}

/**
 * Altura normalizada de una celda, acotada a los bordes.
 * @param {import('../world/grid.js').Grid} grid
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function alturaAcotada(grid, x, y) {
  const cx = x < 0 ? 0 : x >= grid.ancho ? grid.ancho - 1 : x;
  const cy = y < 0 ? 0 : y >= grid.alto ? grid.alto - 1 : y;
  return grid.altura[cy * grid.ancho + cx];
}

/**
 * Peso bilineal entero para el muestreo de marching squares. Las cuatro
 * esquinas del tile son, en orden: (0,0)=TL, (1,0)=TR, (1,1)=BR, (0,1)=BL,
 * con valores 0/1. El resultado queda en [0, (tam-1)^2].
 *
 * Con `tam = 8` y píxeles `lx,ly` en 0..7, el umbral `(tam-1)^2 / 2` produce
 * los 16 casos clásicos con bordes escalonados (pixel art).
 *
 * @param {number} lx Columna del píxel dentro del tile.
 * @param {number} ly Fila del píxel dentro del tile.
 * @param {number} v00 Valor en la esquina superior izquierda.
 * @param {number} v10 Valor en la esquina superior derecha.
 * @param {number} v11 Valor en la esquina inferior derecha.
 * @param {number} v01 Valor en la esquina inferior izquierda.
 * @param {number} tam Tamaño del tile en píxeles.
 * @returns {number}
 */
export function pesoMarching(lx, ly, v00, v10, v11, v01, tam) {
  const invX = tam - 1 - lx;
  const invY = tam - 1 - ly;
  return v00 * invX * invY + v10 * lx * invY + v11 * lx * ly + v01 * invX * ly;
}

/**
 * ¿El píxel cae dentro de la forma marching-squares definida por las 4 esquinas?
 * @param {number} lx
 * @param {number} ly
 * @param {number} v00
 * @param {number} v10
 * @param {number} v11
 * @param {number} v01
 * @param {number} tam
 * @returns {boolean}
 */
export function dentroMarching(lx, ly, v00, v10, v11, v01, tam) {
  // Umbral = mitad del peso máximo ((tam-1)^2). ">=" favorece rellenar en los
  // empates exactos (caso silla), evitando huecos finos en las costas.
  const umbral = ((tam - 1) * (tam - 1)) / 2;
  return pesoMarching(lx, ly, v00, v10, v11, v01, tam) >= umbral;
}

/**
 * Tipo de terreno resultante para un píxel de la celda (tx,ty), combinando las
 * capas "arena o más" y "tierra" con marching squares.
 *
 * @param {import('../world/grid.js').Grid} grid
 * @param {number} tx Columna de la celda.
 * @param {number} ty Fila de la celda.
 * @param {number} lx Píxel X dentro del tile (0..tam-1).
 * @param {number} ly Píxel Y dentro del tile (0..tam-1).
 * @param {number} tam Tamaño del tile en píxeles.
 * @returns {number} Uno de `TERRENO`.
 */
export function terrenoDePixel(grid, tx, ty, lx, ly, tam) {
  const t00 = tipoAcotado(grid, tx, ty);
  const t10 = tipoAcotado(grid, tx + 1, ty);
  const t11 = tipoAcotado(grid, tx + 1, ty + 1);
  const t01 = tipoAcotado(grid, tx, ty + 1);

  const esTierra = dentroMarching(
    lx,
    ly,
    t00 === TERRENO.TIERRA ? 1 : 0,
    t10 === TERRENO.TIERRA ? 1 : 0,
    t11 === TERRENO.TIERRA ? 1 : 0,
    t01 === TERRENO.TIERRA ? 1 : 0,
    tam,
  );
  if (esTierra) return TERRENO.TIERRA;

  const esArena = dentroMarching(
    lx,
    ly,
    t00 >= TERRENO.ARENA ? 1 : 0,
    t10 >= TERRENO.ARENA ? 1 : 0,
    t11 >= TERRENO.ARENA ? 1 : 0,
    t01 >= TERRENO.ARENA ? 1 : 0,
    tam,
  );
  if (esArena) return TERRENO.ARENA;

  return TERRENO.AGUA;
}

/**
 * Altura sombreada para un píxel de transición: promedio bilineal de las
 * alturas de las 4 esquinas, limitado a [0,1]. Sirve para que los píxeles cuyo
 * tipo no coincide con la celda base sigan teniendo un sombreado coherente.
 *
 * @param {import('../world/grid.js').Grid} grid
 * @param {number} tx
 * @param {number} ty
 * @param {number} lx
 * @param {number} ly
 * @param {number} tam
 * @returns {number}
 */
export function alturaDePixel(grid, tx, ty, lx, ly, tam) {
  const a00 = alturaAcotada(grid, tx, ty);
  const a10 = alturaAcotada(grid, tx + 1, ty);
  const a11 = alturaAcotada(grid, tx + 1, ty + 1);
  const a01 = alturaAcotada(grid, tx, ty + 1);
  const invX = tam - 1 - lx;
  const invY = tam - 1 - ly;
  const max = (tam - 1) * (tam - 1);
  if (max <= 0) return a00;
  return (a00 * invX * invY + a10 * lx * invY + a11 * lx * ly + a01 * invX * ly) / max;
}
