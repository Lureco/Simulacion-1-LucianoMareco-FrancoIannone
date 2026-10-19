/**
 * src/core/noise.js — Ruido procedural con semilla (T11/T12)
 * ===========================================================
 *
 * Implementación propia de **Value Noise 2D** (requisito de la Unidad 1,
 * sin librerías externas) + una variante fractal (fBm).
 *
 * REGLAS:
 * - Determinista: misma semilla + mismas coordenadas ⇒ mismo valor, siempre.
 *   No usa `Math.random()` ni consume el estado del PRNG de la simulación:
 *   el ruido es una **función pura** de (x, y, seed).
 * - Sin estado y sin `new`: se puede llamar desde cualquier lado.
 *
 * Sobre Perlin (T12): se evaluó y **se descarta por ahora**. El Value Noise
 * interpolado con curva `fade` + fBm da un terreno con suficiente calidad
 * visual para agua/arena/tierra, es más corto de entender y de testear.
 * Queda escrito en `docs/DECISIONES.md` (D11).
 */

import { hashInts } from './prng.js';

/**
 * Curva de interpolación "smootherstep": pendiente cero en 0 y en 1,
 * lo que evita las aristas visibles del lerpeo lineal.
 * @param {number} t Valor en [0, 1].
 * @returns {number} Valor suavizado en [0, 1].
 */
export function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Hash determinista de una celda de la grilla del ruido → float en [0, 1).
 * Usa el mismo FNV-1a que el PRNG (`hashInts`), así el ruido no necesita
 * estado propio para ser reproducible.
 * @param {number} ix Índice de lattice entero.
 * @param {number} iy Índice de lattice entero.
 * @param {number} seed Semilla de 32 bits.
 * @returns {number} Valor de esquina en [0, 1).
 */
export function esquinaRuido(ix, iy, seed) {
  return hashInts(ix, iy, seed >>> 0) / 4294967296;
}

/**
 * Value Noise 2D: cada "celda" del lattice tiene un valor aleatorio en sus
 * esquinas y el interior es una interpolación bicúbica de esos cuatro.
 * @param {number} x Coordenada continua.
 * @param {number} y Coordenada continua.
 * @param {number} seed Semilla de 32 bits.
 * @returns {number} Valor en [0, 1].
 */
export function valueNoise2D(x, y, seed) {
  // Celda del lattice que contiene el punto y parte fraccionaria dentro de ella.
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Esquinas de la celda.
  const v00 = esquinaRuido(ix, iy, seed);
  const v10 = esquinaRuido(ix + 1, iy, seed);
  const v01 = esquinaRuido(ix, iy + 1, seed);
  const v11 = esquinaRuido(ix + 1, iy + 1, seed);

  // Interpolación bicúbica (fade en los dos ejes).
  const u = fade(fx);
  const v = fade(fy);
  const a = v00 + (v10 - v00) * u;
  const b = v01 + (v11 - v01) * u;
  return a + (b - a) * v;
}

/**
 * Ruido fractal (fBm): suma de varias capas ("octavas") de Value Noise,
 * cada vez con más frecuencia y menos amplitud.
 *
 * - Más octavas ⇒ más detalle fino.
 * - `persistencia` (0..1) ⇒ cuánto pesa el detalle respecto de la forma base.
 * - `lacunaridad` ⇒ cuánto se multiplica la frecuencia en cada octava.
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {object} [opciones]
 * @param {number} [opciones.frecuencia=0.02] Frecuencia base (detalle por celda).
 * @param {number} [opciones.octavas=4] Cantidad de capas.
 * @param {number} [opciones.persistencia=0.5] Amplitud relativa de cada octava.
 * @param {number} [opciones.lacunaridad=2] Multiplicador de frecuencia por octava.
 * @returns {number} Valor aproximado en [0, 1] (fBm de ruido en [0,1] ponderado por amplitudes que suman < 1... se normaliza abajo).
 */
export function fbm2D(x, y, seed, opciones = {}) {
  const frecuencia = opciones.frecuencia ?? 0.02;
  const octavas = opciones.octavas ?? 4;
  const persistencia = opciones.persistencia ?? 0.5;
  const lacunaridad = opciones.lacunaridad ?? 2;

  let suma = 0;
  let amplitud = 1;
  let amplitudTotal = 0;
  let freq = frecuencia;

  for (let o = 0; o < octavas; o++) {
    // Cada octava usa una semilla distinta para no correlacionarse.
    suma += valueNoise2D(x * freq, y * freq, (seed + o * 0x9e3779b9) >>> 0) * amplitud;
    amplitudTotal += amplitud;
    amplitud *= persistencia;
    freq *= lacunaridad;
  }

  // Normaliza a [0, 1] para que los umbrales de terreno sean interpretables.
  return amplitudTotal > 0 ? suma / amplitudTotal : 0;
}
