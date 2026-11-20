/**
 * src/ui/geneticaVista.js — Vista de los genes del animal seleccionado
 * ====================================================================
 *
 * Los genes viven en arrays tipados (D13/D26), así que la UI no los lee
 * directamente: este módulo arma una vista plana y pura, igual que hace
 * `necesidadesRenderer` con hambre/sed/edad. Así se puede testear en Node,
 * sin DOM ni WebGL.
 *
 * Los cinco valores son **multiplicadores**: 1.00 es el rasgo base de la
 * especie. La barra va de `CONFIG.genetica.minRasgo` a `maxRasgo`, con el
 * punto neutral en el medio cuando los límites son simétricos.
 */

import { CONFIG } from '../config.js';
import { clamp } from '../core/utils.js';

/** Genes que se muestran, en el mismo orden en que los lista el GDD. */
export const GENES_VISIBLES = [
  { clave: 'velocidad', etiqueta: 'velocidad', array: 'genVelocidad' },
  { clave: 'tamano', etiqueta: 'tamaño', array: 'genTamano' },
  { clave: 'percepcion', etiqueta: 'percepción', array: 'genPercepcion' },
  { clave: 'consumo', etiqueta: 'consumo', array: 'genConsumo' },
  { clave: 'reproduccion', etiqueta: 'reproducción', array: 'genReproduccion' },
];

/**
 * Lee los cinco genes de una entidad desde el almacén SoA.
 * @param {import('../entities/entityManager.js').EntityManager} manager
 * @param {number} id
 * @returns {{velocidad: number, tamano: number, percepcion: number, consumo: number, reproduccion: number}}
 */
export function leerGenes(manager, id) {
  const genes = {};
  for (const gen of GENES_VISIBLES) genes[gen.clave] = manager[gen.array][id];
  return genes;
}

/**
 * Normaliza un multiplicador genético a `[0, 1]` para dibujar la barra.
 * @param {number} valor
 * @returns {number}
 */
export function normalizarGen(valor) {
  const { minRasgo, maxRasgo } = CONFIG.genetica;
  if (maxRasgo <= minRasgo) return 0;
  return clamp((valor - minRasgo) / (maxRasgo - minRasgo), 0, 1);
}

/**
 * Marca textual para mostrar si el gen está arriba, abajo o en el valor base.
 * @param {number} valor
 * @returns {'↑'|'↓'|'='}
 */
export function indicadorGen(valor) {
  if (valor > 1 + 1e-6) return '↑';
  if (valor < 1 - 1e-6) return '↓';
  return '=';
}

/**
 * Filas listas para pintar en la leyenda, con el valor ya normalizado.
 * @param {{velocidad: number, tamano: number, percepcion: number, consumo: number, reproduccion: number}|null} genes
 * @returns {{clave: string, etiqueta: string, valor: number, normalizado: number, marca: string}[]}
 */
export function filasGenes(genes) {
  if (genes === null || genes === undefined) return [];
  return GENES_VISIBLES.map((gen) => {
    const valor = genes[gen.clave];
    return {
      clave: gen.clave,
      etiqueta: gen.etiqueta,
      valor,
      normalizado: normalizarGen(valor),
      marca: indicadorGen(valor),
    };
  });
}
