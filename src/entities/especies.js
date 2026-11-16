/**
 * src/entities/especies.js — Registro de especies
 * ===============================================
 *
 * Con SoA (D13), el comportamiento no vive en cada bicho: vive en la
 * **especie**. Acá se registran las especies una sola vez y se resuelven
 * por `tipo` (el número que guarda `EntityManager.tipo`).
 *
 * Para agregar una especie nueva (F8: 5 herbívoros, 5 carnívoros, etc.)
 * alcanza con escribir la clase y sumarla a `REGISTRO`.
 */

import { ESPECIE } from './entity.js';
import { Herbivoro } from './herbivore.js';
import { Depredador } from './predator.js';

/** @type {Map<number, import('./entity.js').Especie>} */
const REGISTRO = new Map([
  [ESPECIE.HERBIVORO, new Herbivoro()],
  [ESPECIE.PREDADOR, new Depredador()],
]);

/**
 * Devuelve la especie registrada para un tipo.
 * @param {number} tipo
 * @returns {import('./entity.js').Especie}
 */
export function especieDe(tipo) {
  const especie = REGISTRO.get(tipo);
  if (especie === undefined) {
    throw new Error(`Especies: no hay especie registrada para el tipo ${tipo}`);
  }
  return especie;
}

/**
 * Registra una especie nueva (tests / F8).
 * @param {number} tipo
 * @param {import('./entity.js').Especie} especie
 */
export function registrarEspecie(tipo, especie) {
  REGISTRO.set(tipo, especie);
}
