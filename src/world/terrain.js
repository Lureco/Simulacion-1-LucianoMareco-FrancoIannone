/**
 * src/world/terrain.js — Generación procedural del terreno (T13)
 * ===============================================================
 *
 * Transforma ruido fBm en una grilla de terreno clasificada:
 *
 *   altura baja  → AGUA
 *   altura media → ARENA  (borde de costa)
 *   altura alta  → TIERRA
 *
 * Los umbrales viven en `CONFIG.terreno` (regla: nada hardcodeado).
 *
 * Además del ruido "puro", se aplica una **caída hacia los bordes**: la
 * altura se resta cerca del borde del mapa, lo que forma masas de agua
 * cerradas en vez de costas cortadas a cuchillo (T18). Con
 * `caidaBorde = 0` el mapa es ruido plano.
 *
 * Determinismo: la función es un ruido puro de (x, y, seed) — no consume el
 * PRNG de la simulación, así generar el mapa no desplaza la secuencia de
 * los animales.
 */

import { fbm2D } from '../core/noise.js';
import { clamp } from '../core/utils.js';
import { Grid } from './grid.js';
import { TERRENO } from './cell.js';

/** Desplazamientos ortogonales (vecindad 4), en orden fijo. */
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

/**
 * BFS multi-fuente genérico: para cada celda, la distancia y la dirección
 * (un paso de {-1,0,1} por eje) hacia la celda-fuente más cercana.
 *
 * Determinista: los orígenes y los vecinos se recorren en orden fijo.
 *
 * @param {Grid} grid
 * @param {number} tipoFuente Uno de `TERRENO`: la clase que actúa de fuente.
 * @param {Int32Array} dist Distancia en celdas; -1 = inalcanzable.
 * @param {Int8Array} dirX Componente X hacia la fuente.
 * @param {Int8Array} dirY Componente Y hacia la fuente.
 */
function calcularCampo(grid, tipoFuente, dist, dirX, dirY) {
  const { ancho, alto, total } = grid;

  dist.fill(-1);
  dirX.fill(0);
  dirY.fill(0);

  const cola = new Int32Array(total);
  let cabeza = 0;
  let fin = 0;

  for (let i = 0; i < total; i++) {
    if (grid.terreno[i] === tipoFuente) {
      dist[i] = 0;
      cola[fin++] = i;
    }
  }

  while (cabeza < fin) {
    const i = cola[cabeza++];
    const x = i % ancho;
    const y = (i / ancho) | 0;
    const siguiente = dist[i] + 1;

    for (let k = 0; k < 4; k++) {
      const nx = x + DX4[k];
      const ny = y + DY4[k];
      if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
      const j = ny * ancho + nx;
      if (dist[j] !== -1) continue;
      dist[j] = siguiente;
      // `j` se alcanzó desde `i`, que está más cerca de la fuente: apuntamos a `i`.
      dirX[j] = x - nx;
      dirY[j] = y - ny;
      cola[fin++] = j;
    }
  }
}

/**
 * Calcula los **campos derivados** del terreno, una sola vez al generar el
 * mapa (el terreno no cambia durante la simulación):
 *
 * - `aguaDist/aguaDirX/aguaDirY`   → hacia el agua más cercana (sed, T38).
 * - `tierraDist/tierraDirX/tierraDirY` → hacia la tierra más cercana: un
 *   herbívoro que quedó sobre agua o arena camina de vuelta a tierra, donde
 *   está la comida (T37/T40).
 *
 * Así la IA resuelve una navegación de largo alcance leyendo 2 bytes por
 * tick, en vez de barrer un radio enorme cada vez.
 *
 * @param {Grid} grid
 */
export function calcularCampos(grid) {
  calcularCampo(grid, TERRENO.AGUA, grid.aguaDist, grid.aguaDirX, grid.aguaDirY);
  calcularCampo(grid, TERRENO.TIERRA, grid.tierraDist, grid.tierraDirX, grid.tierraDirY);
}

/**
 * Genera el terreno completo de una vez.
 * @param {object} opciones
 * @param {number} opciones.ancho Ancho en celdas.
 * @param {number} opciones.alto Alto en celdas.
 * @param {number} opciones.seed Semilla de 32 bits.
 * @param {object} opciones.config Sección `CONFIG.terreno`.
 * @returns {Grid} Grilla con `terreno` y `altura` llenos.
 */
export function generarTerreno({ ancho, alto, seed, config }) {
  const grid = new Grid(ancho, alto);
  const semillaAltura = seed >>> 0;

  const opcionesRuido = {
    frecuencia: config.frecuenciaAltura,
    octavas: config.octavasAltura,
    persistencia: config.persistenciaAltura,
    lacunaridad: config.lacunaridadAltura,
  };

  const centroX = (ancho - 1) / 2;
  const centroY = (alto - 1) / 2;
  // Distancia al centro normalizada en [0, 1]: 0 en el centro, 1 en la
  // esquina más lejana. La caída usa la distancia euclídea para que la
  // isla quede redonda.
  const escalaCentro = Math.sqrt(centroX * centroX + centroY * centroY) || 1;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;

      let altura = fbm2D(x, y, semillaAltura, opcionesRuido);

      if (config.caidaBorde > 0) {
        const dx = x - centroX;
        const dy = y - centroY;
        const distancia = Math.sqrt(dx * dx + dy * dy) / escalaCentro;
        // resta cuadrática suave: el centro queda intacto, el borde hunde.
        altura -= config.caidaBorde * distancia * distancia;
      }

      altura = clamp(altura, 0, 1);
      grid.altura[i] = altura;

      if (altura < config.umbralAgua) {
        grid.terreno[i] = TERRENO.AGUA;
      } else if (altura < config.umbralArena) {
        grid.terreno[i] = TERRENO.ARENA;
      } else {
        grid.terreno[i] = TERRENO.TIERRA;
      }
    }
  }

  // Campos derivados para la navegación de los herbívoros (agua/tierra).
  calcularCampos(grid);

  return grid;
}

/**
 * Busca una celda de tierra al azar (para sembrar entidades donde sea
 * habitable). Determinista: usa el PRNG del contexto, no `Math.random()`.
 * @param {object} ctx Contexto con `{ prng, mundo, grid }`.
 * @returns {{x: number, y: number}} Posición en celdas (centro de la celda).
 */
export function celdaHabitableAlAzar(ctx) {
  const { ancho, alto } = ctx.mundo;
  const maxIntentos = ctx.config.terreno.maxIntentosHabitable;

  if (ctx.grid) {
    for (let intento = 0; intento < maxIntentos; intento++) {
      const x = ctx.prng.int(0, ancho);
      const y = ctx.prng.int(0, alto);
      if (ctx.grid.esTierra(x, y)) {
        return { x: x + 0.5, y: y + 0.5 };
      }
    }
    // Si tras N intentos no hay tierra (mapa casi todo agua), se siembra
    // igual en una posición libre cualquiera: mejor un animal varado que
    // una población de cero.
  }

  return {
    x: ctx.prng.float() * (ancho - 1),
    y: ctx.prng.float() * (alto - 1),
  };
}
