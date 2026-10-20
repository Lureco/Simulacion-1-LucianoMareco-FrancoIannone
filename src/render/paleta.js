/**
 * src/render/paleta.js — Colores de la simulación (T56)
 * ====================================================
 *
 * Un solo lugar para los colores. Antes estaban repartidos entre el
 * renderer de entidades y el HUD; ahora la leyenda, el gráfico y los
 * sprites usan **la misma paleta**, así que lo que dice la leyenda es
 * exactamente lo que se ve en pantalla.
 *
 * Regla del proyecto: ningún color hardcodeado fuera de la config o de
 * este archivo.
 */

import { ESPECIE, ESTADO_IA } from '../entities/entity.js';

/** Color base de cada especie. */
export const COLOR_ESPECIE = {
  [ESPECIE.HERBIVORO]: 0x6bdc7a,
  [ESPECIE.PREDADOR]: 0xff5d5d,
};

/**
 * Color de cada estado de la IA. Se usa en el **modo depuración** (tecla
 * `D`): en vez de teñir por especie, el sprite se tiñe por lo que está
 * haciendo. Así se ve de un vistazo quién come, quién bebe y quién huye.
 */
export const COLOR_ESTADO = {
  [ESTADO_IA.VAGO]: 0x8b95a5,
  [ESTADO_IA.COMIENDO]: 0x9dff5c,
  [ESTADO_IA.BEBIENDO]: 0x4aa3ff,
  [ESTADO_IA.HUYENDO]: 0xff9d3d,
  [ESTADO_IA.PERSIGUIENDO]: 0xff3b6b,
  [ESTADO_IA.BUSCANDO_PAREJA]: 0xd980ff,
};

/** Nombre legible de cada estado de IA (para la leyenda). */
export const NOMBRE_ESTADO = {
  [ESTADO_IA.VAGO]: 'deambula',
  [ESTADO_IA.COMIENDO]: 'come',
  [ESTADO_IA.BEBIENDO]: 'bebe',
  [ESTADO_IA.HUYENDO]: 'huye',
  [ESTADO_IA.PERSIGUIENDO]: 'persigue',
  [ESTADO_IA.BUSCANDO_PAREJA]: 'busca pareja',
};

/** Nombre legible de cada especie (para la leyenda). */
export const NOMBRE_ESPECIE = {
  [ESPECIE.HERBIVORO]: 'herbívoro',
  [ESPECIE.PREDADOR]: 'carnívoro',
};

/**
 * Colores de las barras de necesidades (T56). Cada barra tiene su color
 * para que se distinga de un vistazo.
 */
export const COLOR_NECESIDAD = {
  hambre: 0xff8c42,
  sed: 0x4aa3ff,
  energia: 0x9dff5c,
};

/** Convierte un color 0xRRGGBB a `#rrggbb` (para CSS). */
export function aCss(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}
