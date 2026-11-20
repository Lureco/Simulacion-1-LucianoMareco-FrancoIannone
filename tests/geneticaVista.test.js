/**
 * tests/geneticaVista.test.js — Vista de genes (T67)
 * ==================================================
 * Los genes se leen de los arrays SoA y se convierten en una vista plana:
 * acá se prueba esa conversión, la normalización de la barra y que la
 * leyenda efectivamente muestra los cinco valores del animal seleccionado.
 * No se necesita jsdom: se stubea `document.createElement`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { ESPECIE } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { Leyenda } from '../src/ui/leyenda.js';
import {
  GENES_VISIBLES,
  filasGenes,
  indicadorGen,
  leerGenes,
  normalizarGen,
} from '../src/ui/geneticaVista.js';

function crearElemento() {
  return {
    style: {},
    tagName: 'DIV',
    children: [],
    appendChild(hijo) {
      this.children.push(hijo);
      return hijo;
    },
    remove() {},
    innerHTML: '',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vista plana de genes', () => {
  it('lee los cinco arrays tipados del manager', () => {
    const manager = new EntityManager();
    const id = manager.crear(ESPECIE.HERBIVORO);
    manager.genVelocidad[id] = 1.1;
    manager.genTamano[id] = 0.9;
    manager.genPercepcion[id] = 1.3;
    manager.genConsumo[id] = 0.8;
    manager.genReproduccion[id] = 1.2;

    const genes = leerGenes(manager, id);
    expect(genes.velocidad).toBeCloseTo(1.1, 6);
    expect(genes.tamano).toBeCloseTo(0.9, 6);
    expect(genes.percepcion).toBeCloseTo(1.3, 6);
    expect(genes.consumo).toBeCloseTo(0.8, 6);
    expect(genes.reproduccion).toBeCloseTo(1.2, 6);
  });

  it('normaliza al rango configurado y recorta valores fuera de él', () => {
    const { minRasgo, maxRasgo } = CONFIG.genetica;
    expect(normalizarGen(minRasgo)).toBe(0);
    expect(normalizarGen(maxRasgo)).toBe(1);
    expect(normalizarGen(1)).toBeCloseTo((1 - minRasgo) / (maxRasgo - minRasgo), 5);
    expect(normalizarGen(minRasgo - 1)).toBe(0);
    expect(normalizarGen(maxRasgo + 1)).toBe(1);
  });

  it('marca si el gen está arriba, abajo o en el valor base', () => {
    expect(indicadorGen(1.12)).toBe('↑');
    expect(indicadorGen(0.84)).toBe('↓');
    expect(indicadorGen(1)).toBe('=');
  });

  it('arma cinco filas con valor, normalización y marca', () => {
    const genes = {
      velocidad: 1.12,
      tamano: 1,
      percepcion: 0.84,
      consumo: 1.05,
      reproduccion: 0.95,
    };
    const filas = filasGenes(genes);
    expect(filas).toHaveLength(5);
    expect(filas.map((f) => f.etiqueta)).toEqual(GENES_VISIBLES.map((g) => g.etiqueta));
    expect(filas[0].valor).toBe(1.12);
    expect(filas[0].marca).toBe('↑');
    expect(filas[2].marca).toBe('↓');
    expect(filas[1].normalizado).toBeCloseTo(normalizarGen(1), 5);
  });

  it('no genera filas cuando no hay selección', () => {
    expect(filasGenes(null)).toEqual([]);
  });
});

describe('leyenda con genética', () => {
  it('muestra los cinco genes del bicho seleccionado', () => {
    vi.stubGlobal('document', { createElement: crearElemento });
    const leyenda = new Leyenda(crearElemento());

    leyenda.actualizar(null, {
      tipo: ESPECIE.HERBIVORO,
      vivo: true,
      hambre: 0.2,
      sed: 0.1,
      reproduccion: 0,
      edad: 0.1,
      edadTicks: 600,
      edadMaximaTicks: 6000,
      genes: {
        velocidad: 1.12,
        tamano: 1,
        percepcion: 0.84,
        consumo: 1,
        reproduccion: 1,
      },
    });

    const html = leyenda.elemento.innerHTML;
    expect(html).toContain('genes (1.00 = base)');
    expect(html).toContain('1.12 ↑');
    expect(html).toContain('0.84 ↓');
    expect(html).toContain('1.00 =');
    for (const gen of GENES_VISIBLES) expect(html).toContain(gen.etiqueta);
  });
});
