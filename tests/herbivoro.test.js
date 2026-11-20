/**
 * tests/herbivoro.test.js — IA del herbívoro (F4 · T34-T41)
 * =========================================================
 *
 * Cubre la decisión por prioridad, comer, beber, el coste por terreno, la
 * muerte por sed y la reproducción. Usa una `Grid` de prueba (todo tierra por
 * defecto) para no depender del terreno procedural.
 */

import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { Grid } from '../src/world/grid.js';
import { TERRENO, PLANTA } from '../src/world/cell.js';
import { CONFIG } from '../src/config.js';
import { calcularCampos } from '../src/world/terrain.js';
import { direccionAlAgua, direccionATierra } from '../src/systems/perception.js';
import { factorVelocidad } from '../src/systems/movement.js';
import {
  actualizarEntidad,
  aplicarMuertes,
  aplicarNacimientos,
  repartirEdadesIniciales,
} from '../src/systems/simulacion.js';

/**
 * Contexto con grilla (todo tierra) y hash listos.
 * @param {number} [seed]
 * @param {number} [ancho]
 * @param {number} [alto]
 */
function contextoConGrid(seed = 1, ancho = 16, alto = 16) {
  const prng = new PRNG(seed);
  const manager = new EntityManager();
  const ctx = crearContexto({ prng, mundo: { ancho, alto }, config: CONFIG });
  ctx.entidades = manager;
  ctx.grid = new Grid(ancho, alto);
  ctx.hash = new SpatialHash(manager, ancho, alto, CONFIG.percepcion.celdaHash);
  return { ctx, manager };
}

/** Crea un herbívoro en el centro de la grilla. */
function herbivoroEnElCentro(ctx, manager, x = 8.5, y = 8.5) {
  const id = manager.crear(ESPECIE.HERBIVORO);
  manager.x[id] = x;
  manager.y[id] = y;
  return id;
}

describe('necesidades del herbívoro', () => {
  it('hambre y sed suben con el tiempo (T34)', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    const hambre0 = manager.hambre[id];

    for (let i = 0; i < 60; i++) actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.hambre[id]).toBeGreaterThan(hambre0);
    expect(manager.sed[id]).toBeGreaterThan(0);
    expect(manager.hambre[id]).toBeLessThanOrEqual(1);
    expect(manager.sed[id]).toBeLessThanOrEqual(1);
  });

  it('no muere en los primeros 30 s de simulación (T41)', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    for (let i = 0; i < 30 * 60; i++) {
      actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);
      aplicarMuertes(ctx);
    }
    expect(manager.vivo[id]).toBe(1);
  });
});

describe('decisiones por prioridad (T35)', () => {
  it('come cuando tiene hambre y está encima de una planta (T37)', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    const indice = ctx.grid.indice(8, 8);
    ctx.grid.planta[indice] = PLANTA.ADULTA;
    manager.hambre[id] = 0.9;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[id]).toBe(ESTADO_IA.COMIENDO);
    expect(ctx.grid.planta[indice]).toBe(PLANTA.NADA);
    expect(manager.hambre[id]).toBe(0);
  });

  it('bebe cuando tiene sed y está sobre agua (T38)', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager, 4.5, 4.5);
    ctx.grid.terreno[ctx.grid.indice(4, 4)] = TERRENO.AGUA;
    manager.sed[id] = 0.9;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[id]).toBe(ESTADO_IA.BEBIENDO);
    expect(manager.sed[id]).toBe(0);
  });

  it('come antes que beber si las dos necesidades son críticas', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    ctx.grid.planta[ctx.grid.indice(8, 8)] = PLANTA.ADULTA;
    ctx.grid.terreno[ctx.grid.indice(9, 8)] = TERRENO.AGUA;
    manager.hambre[id] = 0.9;
    manager.sed[id] = 0.9;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[id]).toBe(ESTADO_IA.COMIENDO);
  });

  it('explora cuando no tiene necesidades urgentes (T39)', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[id]).toBe(ESTADO_IA.VAGO);
  });
});

describe('coste por terreno (T40)', () => {
  it('atravesar agua es más lento que la tierra', () => {
    const tierra = factorVelocidad(TERRENO.TIERRA, CONFIG);
    const agua = factorVelocidad(TERRENO.AGUA, CONFIG);
    const arena = factorVelocidad(TERRENO.ARENA, CONFIG);

    expect(tierra).toBe(1);
    expect(agua).toBeLessThan(tierra);
    expect(arena).toBeLessThan(tierra);
    expect(agua).toBeLessThan(arena);
  });
});

describe('reproducción', () => {
  it('dos herbívoros dispuestos y juntos producen una cría (T46/T47)', () => {
    const { ctx, manager } = contextoConGrid();
    const a = herbivoroEnElCentro(ctx, manager, 8.5, 8.5);
    const b = herbivoroEnElCentro(ctx, manager, 8.6, 8.5);

    for (const id of [a, b]) {
      manager.edad[id] = CONFIG.herbivoro.edadMinimaReproduccion;
      manager.deseoRepro[id] = 1;
      manager.cooldown[id] = 0;
    }
    ctx.hash.reconstruir();

    actualizarEntidad(a, CONFIG.tiempo.pasoFijo, ctx);
    aplicarNacimientos(ctx);

    expect(manager.total).toBe(3);
    expect(ctx.nacimientosTotales).toBe(1);
    // Los progenitores quedan en cooldown y sin deseo.
    expect(manager.cooldown[a]).toBe(CONFIG.herbivoro.cooldownReproduccion);
    expect(manager.deseoRepro[a]).toBe(0);
  });

  it('la cría nace sobre tierra, no sobre agua', () => {
    const { ctx, manager } = contextoConGrid();
    const a = herbivoroEnElCentro(ctx, manager, 8.5, 8.5);
    // Rodeamos de agua salvo una celda de tierra: la cría debe caer ahí.
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
    ]) {
      ctx.grid.terreno[ctx.grid.indice(8 + dx, 8 + dy)] = TERRENO.AGUA;
    }

    manager.edad[a] = CONFIG.herbivoro.edadMinimaReproduccion;
    manager.deseoRepro[a] = 1;
    ctx.hash.reconstruir();

    const indice = ctx.grid.indice(-1 + 8, -1 + 8); // (-1,-1) queda tierra
    const especie = manager.especie(a);
    const destino = especie.celdaLibreAdyacente(ctx, 8, 8);
    expect(destino).toBe(indice);
  });
});

describe('causas de muerte (T45)', () => {
  it('muere de hambre cuando el hambre llega al máximo', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    manager.hambre[id] = 1;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);
    aplicarMuertes(ctx);

    expect(manager.vivo[id]).toBe(0);
    expect(ctx.muertesPorCausa.hambre).toBe(1);
  });

  it('muere de sed cuando la sed llega al máximo', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    manager.sed[id] = 1;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);
    aplicarMuertes(ctx);

    expect(manager.vivo[id]).toBe(0);
    expect(ctx.muertesPorCausa.sed).toBe(1);
  });

  it('muere de vejez al alcanzar la edad máxima', () => {
    const { ctx, manager } = contextoConGrid();
    const id = herbivoroEnElCentro(ctx, manager);
    manager.edad[id] = CONFIG.entidades.edadMaximaTicks;

    actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);
    aplicarMuertes(ctx);

    expect(manager.vivo[id]).toBe(0);
    expect(ctx.muertesPorCausa.vejez).toBe(1);
  });
});

describe('navegación por campos (T38)', () => {
  /** Grilla 5×5 con una columna de agua en x = 0 y campos ya calculados. */
  function grillaConAgua() {
    const grid = new Grid(5, 5);
    for (let y = 0; y < 5; y++) grid.terreno[grid.indice(0, y)] = TERRENO.AGUA;
    calcularCampos(grid);
    return grid;
  }

  it('direccionAlAgua apunta hacia el agua más cercana', () => {
    const grid = grillaConAgua();
    const salida = { encontrado: false, x: 0, y: 0, indice: -1 };
    direccionAlAgua({ grid }, 2.5, 2.5, salida);
    expect(salida.encontrado).toBe(true);
    expect(salida.x).toBeLessThan(2.5); // el agua está a la izquierda
  });

  it('direccionATierra apunta hacia la tierra más cercana desde el agua', () => {
    const grid = grillaConAgua();
    const salida = { encontrado: false, x: 0, y: 0, indice: -1 };
    direccionATierra({ grid }, 0.5, 2.5, salida);
    expect(salida.encontrado).toBe(true);
    expect(salida.x).toBeGreaterThan(0.5); // la tierra está a la derecha
  });

  it('sin grilla no encuentra nada (no rompe)', () => {
    const salida = { encontrado: false, x: 0, y: 0, indice: -1 };
    direccionAlAgua({ grid: null }, 1, 1, salida);
    expect(salida.encontrado).toBe(false);
  });
});

describe('reparto de edades iniciales', () => {
  it('es determinista con la misma seed', () => {
    const a = contextoConGrid(7);
    const idA = herbivoroEnElCentro(a.ctx, a.manager);
    const b = contextoConGrid(7);
    const idB = herbivoroEnElCentro(b.ctx, b.manager);

    repartirEdadesIniciales(a.ctx);
    repartirEdadesIniciales(b.ctx);

    expect(a.manager.edad[idA]).toBe(b.manager.edad[idB]);
    expect(a.manager.edad[idA]).toBeLessThanOrEqual(CONFIG.entidades.edadMaximaTicks / 2);
  });
});
