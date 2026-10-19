/**
 * src/entities/predator.js — Carnívoro / Depredador (P2)
 * ======================================================
 * Persigue herbívoros y se alimenta de ellos.
 *
 * En esta tanda (base de entidades) solo deambula: la persecución, la
 * caza y la cadena alimenticia llegan en F5.
 */

import { Entity, ESPECIE } from './entity.js';
import { CONFIG } from '../config.js';

export class Predator extends Entity {
  constructor() {
    super(ESPECIE.PREDADOR);
    this.velocidad = CONFIG.depredador.velocidad;
  }

  reiniciar() {
    super.reiniciar();
    this.velocidad = CONFIG.depredador.velocidad;
  }
}
