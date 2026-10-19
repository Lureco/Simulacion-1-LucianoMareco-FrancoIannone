/**
 * src/entities/herbivore.js — Herbívoro (P2)
 * =============================================
 * Come plantas, bebe agua y huye de los depredadores.
 *
 * En esta tanda (base de entidades) solo deambula: las necesidades, la
 * busca de comida y la reproducción llegan en F4.
 */

import { Entity, ESPECIE } from './entity.js';
import { CONFIG } from '../config.js';

export class Herbivore extends Entity {
  constructor() {
    super(ESPECIE.HERBIVORO);
    this.velocidad = CONFIG.herbivoro.velocidad;
  }

  reiniciar() {
    super.reiniciar();
    this.velocidad = CONFIG.herbivoro.velocidad;
  }
}
