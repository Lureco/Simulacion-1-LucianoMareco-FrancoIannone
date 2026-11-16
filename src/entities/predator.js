/**
 * src/entities/predator.js — Carnívoro / Depredador (P2)
 * =======================================================
 * Persigue herbívoros y se alimenta de ellos.
 *
 * ⚠️ REFACTOR SoA (D13): esto ya **no es una entidad**, es una **especie**.
 * Hay UNA instancia de esta clase para todo el mundo; los datos de cada
 * depredador viven en `EntityManager`. Acá solo va el comportamiento.
 *
 * En esta tanda (base de entidades) solo deambula: la persecución, la
 * caza y la cadena alimenticia llegan en F5.
 */

import { Especie } from './entity.js';
import { CONFIG } from '../config.js';

export class Depredador extends Especie {
  constructor() {
    super({ velocidad: CONFIG.depredador.velocidad });
  }
}
