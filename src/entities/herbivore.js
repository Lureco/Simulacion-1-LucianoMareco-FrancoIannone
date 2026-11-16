/**
 * src/entities/herbivore.js — Herbívoro (P2)
 * ===========================================
 * Come plantas, bebe agua y huye de los depredadores.
 *
 * ⚠️ REFACTOR SoA (D13): esto ya **no es una entidad**, es una **especie**.
 * Hay UNA instancia de esta clase para todo el mundo; los datos de cada
 * herbívoro viven en `EntityManager`. Acá solo va el comportamiento.
 *
 * En esta tanda (base de entidades) solo deambula: las necesidades, la
 * busca de comida y la reproducción llegan en F4.
 */

import { Especie } from './entity.js';
import { CONFIG } from '../config.js';

export class Herbivoro extends Especie {
  constructor() {
    super({ velocidad: CONFIG.herbivoro.velocidad });
  }
}
