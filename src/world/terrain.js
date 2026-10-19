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
  const maxIntentos = 64;

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
