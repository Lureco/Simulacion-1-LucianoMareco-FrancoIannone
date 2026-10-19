/**
 * src/core/utils.js — Utilidades compartidas
 * ==========================================
 * Funciones puras y sin estado. Sin `new`, sin estado global.
 */

/**
 * Limita un valor entre un mínimo y un máximo.
 * @param {number} valor
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(valor, min, max) {
  if (valor < min) return min;
  if (valor > max) return max;
  return valor;
}

/**
 * Interpolación lineal entre dos valores.
 * @param {number} a Valor en t = 0.
 * @param {number} b Valor en t = 1.
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Índice plano de una celda en una grilla de ancho `ancho`.
 * Todas las capas de la grilla usan este mismo índice.
 * @param {number} x Columna.
 * @param {number} y Fila.
 * @param {number} ancho
 * @returns {number}
 */
export function indiceCelda(x, y, ancho) {
  return y * ancho + x;
}

/**
 * ¿La celda está dentro de los límites del mundo?
 * @param {number} x
 * @param {number} y
 * @param {number} ancho
 * @param {number} alto
 * @returns {boolean}
 */
export function dentroDeMundo(x, y, ancho, alto) {
  return x >= 0 && y >= 0 && x < ancho && y < alto;
}

/**
 * Distancia al cuadrado entre dos puntos. Evita la raíz cuadrada cuando
 * solo se necesita comparar.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function distancia2(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}
