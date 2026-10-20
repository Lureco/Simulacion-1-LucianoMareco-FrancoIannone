/**
 * src/systems/mapaAgua.js — Mapa de distancia al agua (T38)
 * =====================================================
 *
 * El problema que resuelve: el agua puede estar a 40 celdas de un animal.
 * Buscarla con un radio de visión fijo (como en el GDD §8) no alcanza: el
 * herbívoro se muere de sed antes de encontrar la orilla.
 *
 * La solución es calcular **una sola vez por mundo** un mapa con la
 * distancia (en celdas) de cada celda al agua más cercana. Se hace con un
 * **BFS multi-origen**: se encolan todas las celdas de agua con distancia 0
 * y se expande en anillos.
 *
 * Con ese mapa, el animal no "ve" el agua: **camina cuesta abajo** por el
 * gradiente. Es el mismo criterio con el que se propaga el calor o el
 * sonido, y produce una migración hacia la orilla que se ve en pantalla.
 *
 * **Por qué no rompe el "radio de visión limitado" del GDD:** la percepción
 * sigue limitada (el animal no ve lo que hay a 30 celdas). Lo que cambia es
 * que, cuando tiene sed, **sigue la pendiente hacia el agua** en vez de
 * deambular al azar. Es comportamiento de gradiente, no conocimiento
 * absoluto del mapa: el animal sigue sin saber si hay agua antes de llegar.
 *
 * Coste: O(celdas) una vez al generar el mundo (~65.536 celdas, milisegundos).
 * En runtime es **O(1)** por entidad por tick.
 *
 * Dato derivado, no una capa de la grilla: este módulo **solo lee**
 * `grid.terreno` y guarda su propio array (el contrato §2 deja la capa
 * `planta` y `terreno` al dueño P1).
 */

import { TERRENO } from '../world/cell.js';

/** Vecindad de 8 direcciones, en orden fijo (para que sea determinista). */
const VECINOS_8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Calcula la distancia de cada celda al agua más cercana.
 *
 * @param {import('../world/grid.js').Grid} grid
 * @returns {Int32Array} Distancia en celdas. `-1` = inalcanzable (no hay
 *   agua en el mapa, o la celda está aislada).
 */
export function calcularMapaAgua(grid) {
  const total = grid.total;
  const ancho = grid.ancho;
  const alto = grid.alto;

  /** @type {Int32Array} Distancia al agua. `-1` = todavía no visitada. */
  const distancia = new Int32Array(total).fill(-1);

  // Cola del BFS: un Int32Array reused como FIFO con dos índices.
  const cola = new Int32Array(total);
  let cabeza = 0;
  let colaFin = 0;

  // Origen múltiple: todas las celdas de agua arranca con distancia 0.
  for (let i = 0; i < total; i++) {
    if (grid.terreno[i] === TERRENO.AGUA) {
      distancia[i] = 0;
      cola[colaFin] = i;
      colaFin++;
    }
  }

  // Si no hay agua en el mapa, no hay nada que calcular.
  if (colaFin === 0) return distancia;

  // BFS: cada anillo es una celda más de distancia.
  while (cabeza < colaFin) {
    const actual = cola[cabeza];
    cabeza++;

    const x = actual % ancho;
    const y = (actual / ancho) | 0;
    const siguiente = distancia[actual] + 1;

    for (let n = 0; n < VECINOS_8.length; n++) {
      const nx = x + VECINOS_8[n][0];
      const ny = y + VECINOS_8[n][1];
      if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;

      const j = ny * ancho + nx;
      if (distancia[j] !== -1) continue;

      distancia[j] = siguiente;
      cola[colaFin] = j;
      colaFin++;
    }
  }

  return distancia;
}

/**
 * ¿La celda de la entidad está a una celda del agua (o dentro del agua)?
 * @param {object} entidad
 * @param {object} ctx
 * @returns {boolean}
 */
export function estaEnOrillaDeAgua(entidad, ctx) {
  const grid = ctx.grid;
  if (!grid) return false;

  const x = entidad.celdaX;
  const y = entidad.celdaY;
  if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) return false;

  // Si está dentro del agua, puede beber.
  if (grid.terreno[y * grid.ancho + x] === TERRENO.AGUA) return true;

  // Si está en tierra, mira si tiene agua en alguna celda vecina.
  for (let n = 0; n < VECINOS_8.length; n++) {
    const nx = x + VECINOS_8[n][0];
    const ny = y + VECINOS_8[n][1];
    if (nx < 0 || ny < 0 || nx >= grid.ancho || ny >= grid.alto) continue;
    if (grid.terreno[ny * grid.ancho + nx] === TERRENO.AGUA) return true;
  }

  return false;
}

/**
 * Dirección (unitaria) hacia el agua más cercana, siguiendo el gradiente.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {{x: number, y: number}|null} `null` si no hay agua alcanzable.
 */
export function direccionHaciaAgua(entidad, ctx) {
  const grid = ctx.grid;
  const mapa = ctx.mapaAgua;
  if (!grid || !mapa) return null;

  const x = entidad.celdaX;
  const y = entidad.celdaY;
  if (x < 0 || y < 0 || x >= grid.ancho || y >= grid.alto) return null;

  const actual = mapa[y * grid.ancho + x];
  if (actual <= 0) return null; // ya está en el agua o no hay agua

  // Busca la vecina con menor distancia: el gradiente apunta al agua.
  let mejorX = 0;
  let mejorY = 0;
  let mejorDistancia = actual;

  for (let n = 0; n < VECINOS_8.length; n++) {
    const nx = x + VECINOS_8[n][0];
    const ny = y + VECINOS_8[n][1];
    if (nx < 0 || ny < 0 || nx >= grid.ancho || ny >= grid.alto) continue;

    const d = mapa[ny * grid.ancho + nx];
    if (d === -1 || d >= mejorDistancia) continue;

    mejorDistancia = d;
    mejorX = nx;
    mejorY = ny;
  }

  if (mejorDistancia === actual) return null; // no se puede mejorar: es una meseta

  // Normaliza la dirección hacia el centro de la celda objetivo.
  const dx = mejorX + 0.5 - entidad.x;
  const dy = mejorY + 0.5 - entidad.y;
  const largo = Math.hypot(dx, dy);
  if (largo === 0) return null;

  return { x: dx / largo, y: dy / largo };
}
