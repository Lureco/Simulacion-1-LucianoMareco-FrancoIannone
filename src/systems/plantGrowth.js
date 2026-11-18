/**
 * src/systems/plantGrowth.js — Plantas: crecimiento y autómata celular (T27-T31)
 * ==============================================================================
 *
 * Las plantas NO son entidades: viven en la capa `planta` del `Uint8Array` de
 * la grilla. 65.536 plantas como objetos serían GC destructor; como bytes son
 * 64 KiB y se recorren linealmente.
 *
 * Ciclo de vida (contrato §3):
 *
 *   NADA → SEMILLA → JOVEN → ADULTA → MUERTA → NADA
 *
 * Reglas del autómata (T28/T29/T30):
 * - Una `SEMILLA` en tierra crece a `JOVEN` tras `ticksSemillaAJoven` ticks.
 * - Una `JOVEN` crece a `ADULTA` tras `ticksJovenAAdulta` ticks.
 * - Una `ADULTA` intenta **expandirse** a una celda de tierra vecina vacía
 *   con probabilidad `probExpansion` por tick (nace una SEMILLA).
 * - Una `ADULTA` que cumple `ticksVidaAdulta` ticks **muere por edad** (T30):
 *   pasa a `MUERTA` y al tick siguiente la celda queda como `NADA`. La cuenta
 *   arranca en 0 al llegar a adulta, no desde que nació la semilla.
 * - Fuera de tierra, la planta no se sostiene: pasa a `MUERTA` y al tick
 *   siguiente la celda queda como `NADA`.
 *
 * Determinismo: TODO el azar sale del `ctx.prng` (nada de `Math.random()`).
 * El recorrido es por índices contiguos en orden fijo, así que la misma seed
 * da exactamente el mismo resultado tick a tick.
 *
 * Sin `new` en el bucle: la edad y el buffer de nacimientos son typed arrays
 * que se crean una sola vez y quedan cacheados en el contexto.
 */

import { PLANTA, TERRENO } from '../world/cell.js';

/** Desplazamientos ortogonales (vecindad 4), en orden fijo. */
const VECINOS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Desplazamientos con diagonales (vecindad 8), en orden fijo. */
const VECINOS_8 = [...VECINOS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Devuelve (y crea la primera vez) la capa de edad de las plantas.
 * Es un `Int32Array` paralelo a la grilla: cuántos ticks lleva la celda en
 * su estado actual. Se reinicia a 0 en cada cambio de estado.
 *
 * No es `Uint8Array`: con vidas de varios minutos el contador de un byte
 * desbordaría a 0 en 256 ticks y la planta nunca envejecería.
 * @param {object} ctx
 * @returns {Int32Array}
 */
function capaEdad(ctx) {
  if (ctx._edadPlantas === undefined || ctx._edadPlantas.length !== ctx.grid.total) {
    ctx._edadPlantas = new Int32Array(ctx.grid.total);
  }
  return ctx._edadPlantas;
}

/**
 * Semilla la vegetación inicial sobre las celdas de tierra (T31).
 * @param {object} ctx Contexto con `{ prng, grid, config }`.
 */
export function sembrarVegetacion(ctx) {
  const { grid, prng } = ctx;
  if (!grid) return;

  const { densidadSemilla } = ctx.config.plantas;
  for (let i = 0; i < grid.total; i++) {
    grid.planta[i] = PLANTA.NADA;
    if (grid.terreno[i] !== TERRENO.TIERRA) continue;
    if (prng.float() < densidadSemilla) {
      grid.planta[i] = PLANTA.SEMILLA;
    }
  }

  // La vegetación regenerada arranca con edad 0.
  capaEdad(ctx).fill(0);
}

/**
 * Avanza el autómata de vegetación un tick (T28/T29/T30).
 *
 * La expansión se escribe en un buffer de nacimientos y se aplica al final,
 * para no procesar en el mismo tick a las plantas recién nacidas (lo que
 * daría un crecimiento en cascada dependiente del orden de recorrido).
 *
 * @param {object} ctx Contexto con `{ prng, grid, config }`.
 * @returns {number} Cuántas semillas nuevas nacieron por expansión este tick.
 */
export function pasoVegetacion(ctx) {
  const { grid, prng } = ctx;
  if (!grid) return 0;

  const cfg = ctx.config.plantas;
  const total = grid.total;
  const ancho = grid.ancho;
  const alto = grid.alto;
  const terreno = grid.terreno;
  const planta = grid.planta;
  const edades = capaEdad(ctx);
  const vecinos = cfg.radioExpansion >= cfg.umbralVecindadDiagonal ? VECINOS_8 : VECINOS_4;

  if (ctx._bufferPlantas === undefined) {
    ctx._bufferPlantas = new Int32Array(total);
  }
  const buffer = ctx._bufferPlantas;
  let nacimientos = 0;

  for (let i = 0; i < total; i++) {
    const estado = planta[i];

    if (estado === PLANTA.NADA) continue;
    if (estado === PLANTA.MUERTA) {
      // La materia muerta se descompone: la celda vuelve a estar disponible.
      planta[i] = PLANTA.NADA;
      edades[i] = 0;
      continue;
    }

    // Fuera de tierra la planta no puede sostenerse (T28/T30).
    if (terreno[i] !== TERRENO.TIERRA) {
      planta[i] = PLANTA.MUERTA;
      edades[i] = 0;
      continue;
    }

    if (estado === PLANTA.SEMILLA) {
      if (++edades[i] >= cfg.ticksSemillaAJoven) {
        planta[i] = PLANTA.JOVEN;
        edades[i] = 0;
      }
    } else if (estado === PLANTA.JOVEN) {
      if (++edades[i] >= cfg.ticksJovenAAdulta) {
        planta[i] = PLANTA.ADULTA;
        edades[i] = 0;
      }
    } else {
      // ADULTA: envejece desde que llegó a adulta (T30).
      if (++edades[i] >= cfg.ticksVidaAdulta) {
        planta[i] = PLANTA.MUERTA;
        edades[i] = 0;
        continue;
      }

      // ADULTA: intenta colonizar una vecina.
      if (prng.float() < cfg.probExpansion) {
        const destino = buscarVecinaLibre(i, ancho, alto, terreno, planta, vecinos, prng);
        if (destino >= 0 && nacimientos < buffer.length) {
          // Reserva INMEDIATA: sin esto dos adultas pueden elegir la misma
          // vecina, `nacimientos` cuenta 2 y el mapa termina con 1 semilla.
          planta[destino] = PLANTA.SEMILLA;
          edades[destino] = 0;
          buffer[nacimientos++] = destino;
        }
      }
    }
  }

  return nacimientos;
}

/**
 * Busca una celda vecina de tierra y vacía para una semilla nueva.
 * Arranca en un vecino al azar y recorre en círculo, así la expansión no
 * siempre va hacia el mismo lado (lo que daría crecimiento en cruz).
 * @returns {number} Índice plano de la vecina elegida, o -1 si no hay.
 */
function buscarVecinaLibre(i, ancho, alto, terreno, planta, vecinos, prng) {
  const x = i % ancho;
  const y = (i / ancho) | 0;
  const inicio = prng.int(0, vecinos.length);

  for (let n = 0; n < vecinos.length; n++) {
    const [dx, dy] = vecinos[(inicio + n) % vecinos.length];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
    const j = ny * ancho + nx;
    if (terreno[j] !== TERRENO.TIERRA) continue;
    if (planta[j] !== PLANTA.NADA) continue;
    return j;
  }
  return -1;
}

/**
 * Un herbívoro muerde la planta de una celda (T37).
 *
 * El contrato §2 dice que P2 **no** escribe la capa `planta`. Por eso el
 * bocado no se hace desde la IA: se pide por acá, que es la API del sistema
 * de vegetación. La planta desaparece (`NADA`) y devolvemos la energía del
 * bocado para que el herbívoro se la sume.
 *
 * @param {object} ctx
 * @param {number} indice Índice plano `y * ancho + x` de la celda.
 * @returns {number} Energía del bocado (0 si no había nada comestible).
 */
export function comerPlanta(ctx, indice) {
  const grid = ctx.grid;
  if (!grid) return 0;

  const cfg = ctx.config.plantas;
  const estado = grid.planta[indice];
  if (estado !== PLANTA.ADULTA && estado !== PLANTA.JOVEN) return 0;

  grid.planta[indice] = PLANTA.NADA;
  capaEdad(ctx)[indice] = 0;

  return estado === PLANTA.ADULTA
    ? cfg.energiaPorPlanta
    : cfg.energiaPorPlanta * cfg.fraccionEnergiaJoven;
}

/**
 * Cuenta las celdas con vegetación viva (cualquier estado salvo NADA/MUERTA).
 * @param {object} ctx
 * @returns {number}
 */
export function contarPlantas(ctx) {
  const grid = ctx.grid;
  if (!grid) return 0;
  const planta = grid.planta;
  let n = 0;
  for (let i = 0; i < grid.total; i++) {
    const e = planta[i];
    if (e !== PLANTA.NADA && e !== PLANTA.MUERTA) n++;
  }
  return n;
}
