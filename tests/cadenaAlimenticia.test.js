/**
 * tests/cadenaAlimenticia.test.js — Cadena alimenticia (F5 · T43/T45/T50)
 * ======================================================================
 *
 * Cubre el lado del **depredador** de la cadena trófica:
 *
 *   1. Caza: detecta al herbívoro cercano, lo mata y se alimenta.
 *   2. La muerte se cuenta como `depredado` y no se duplica entre cazadores.
 *   3. El herbívoro **huye** del depredador (T43).
 *   4. Al deambular mantiene la distancia al agua (T38).
 *
 * Usa la MISMA API que la pantalla (`src/systems/simulacion.js`), con una
 * `Grid` de prueba para no depender del terreno procedural.
 */

import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { Grid } from '../src/world/grid.js';
import { TERRENO } from '../src/world/cell.js';
import { CONFIG } from '../src/config.js';
import { calcularCampos } from '../src/world/terrain.js';
import { actualizarEntidad, aplicarMuertes, pasoDeSimulacion } from '../src/systems/simulacion.js';

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

describe('cadena alimenticia (T43/T50)', () => {
  it('el depredador caza al herbívoro: lo mata y se alimenta', () => {
    const { ctx, manager } = contextoConGrid();
    const pred = manager.crear(ESPECIE.PREDADOR);
    const herb = manager.crear(ESPECIE.HERBIVORO);
    manager.x[pred] = 8.5;
    manager.y[pred] = 8.5;
    manager.x[herb] = 8.5;
    manager.y[herb] = 8.5;
    manager.hambre[pred] = 0.9;
    ctx.hash.reconstruir();

    const hambre0 = manager.hambre[pred];

    // Primer tick: detecta la presa y apunta. Segundo tick: la alcanza y la mata.
    actualizarEntidad(pred, CONFIG.tiempo.pasoFijo, ctx);
    actualizarEntidad(pred, CONFIG.tiempo.pasoFijo, ctx);

    // La presa queda marcada para morir y la causa es `depredado`.
    expect(manager.moribundo[herb]).toBe(1);
    expect(ctx.muertesPorCausa.depredado).toBe(1);
    // El depredador se alimentó.
    expect(manager.hambre[pred]).toBeLessThan(hambre0);

    // La muerte se aplica al final del tick.
    aplicarMuertes(ctx);
    expect(manager.vivo[herb]).toBe(0);
    expect(manager.contar(ESPECIE.HERBIVORO)).toBe(0);
  });

  it('dos depredadores no cuentan la misma presa dos veces (T45)', () => {
    const { ctx, manager } = contextoConGrid();
    const pred1 = manager.crear(ESPECIE.PREDADOR);
    const pred2 = manager.crear(ESPECIE.PREDADOR);
    const herb = manager.crear(ESPECIE.HERBIVORO);
    manager.x[pred1] = 8.5;
    manager.y[pred1] = 8.5;
    manager.x[pred2] = 8.6;
    manager.y[pred2] = 8.5;
    manager.x[herb] = 8.5;
    manager.y[herb] = 8.5;
    manager.hambre[pred1] = 0.9;
    manager.hambre[pred2] = 0.9;
    // Las dos ya tienen a la presa en la mira (evita depender del gate de búsqueda).
    manager.presa[pred1] = herb;
    manager.presa[pred2] = herb;
    ctx.hash.reconstruir();

    actualizarEntidad(pred1, CONFIG.tiempo.pasoFijo, ctx);
    actualizarEntidad(pred2, CONFIG.tiempo.pasoFijo, ctx);

    expect(ctx.muertesPorCausa.depredado).toBe(1);
  });

  it('una presa ya marcada como moribunda no se actualiza en el mismo tick (T43/T45)', () => {
    const { ctx, manager } = contextoConGrid();
    const pred = manager.crear(ESPECIE.PREDADOR);
    const herb = manager.crear(ESPECIE.HERBIVORO);
    manager.x[pred] = 8.5;
    manager.y[pred] = 8.5;
    manager.x[herb] = 8.5;
    manager.y[herb] = 8.5;
    manager.hambre[pred] = 0.9;
    // El depredador ya la tiene en la mira: la mata en este tick.
    manager.presa[pred] = herb;
    // La presa, además, estaría hambrienta este tick. Si `pasoDeSimulacion` no
    // la salteara, se contaría dos veces (depredado + hambre).
    manager.hambre[herb] = 1;
    ctx.hash.reconstruir();

    pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);

    expect(ctx.muertesPorCausa.depredado).toBe(1);
    expect(ctx.muertesPorCausa.hambre).toBe(0);
    expect(manager.contar(ESPECIE.HERBIVORO)).toBe(0);
  });

  it('el herbívoro huye del depredador que tiene cerca (T43)', () => {
    const { ctx, manager } = contextoConGrid();
    const herb = manager.crear(ESPECIE.HERBIVORO);
    const pred = manager.crear(ESPECIE.PREDADOR);
    manager.x[herb] = 8.5;
    manager.y[herb] = 8.5;
    manager.x[pred] = 10.5;
    manager.y[pred] = 8.5;
    ctx.hash.reconstruir();

    actualizarEntidad(herb, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[herb]).toBe(ESTADO_IA.HUYENDO);
    // Huye en dirección contraria al depredador (que está a la derecha).
    expect(manager.dirX[herb]).toBeLessThan(0);
    expect(Math.abs(manager.dirY[herb])).toBeLessThan(1e-6);
  });
});

describe('distancia al agua al deambular (T38)', () => {
  it('el herbívoro se aleja de la orilla si está demasiado cerca', () => {
    const { ctx, manager } = contextoConGrid();
    // Columna de agua en x = 0 y campos BFS calculados.
    const grid = ctx.grid;
    for (let y = 0; y < grid.alto; y++) grid.terreno[grid.indice(0, y)] = TERRENO.AGUA;
    calcularCampos(grid);

    const herb = manager.crear(ESPECIE.HERBIVORO);
    manager.x[herb] = 1.5;
    manager.y[herb] = 8.5;
    manager.sed[herb] = 0;
    ctx.hash.reconstruir();

    actualizarEntidad(herb, CONFIG.tiempo.pasoFijo, ctx);

    expect(manager.estado[herb]).toBe(ESTADO_IA.VAGO);
    // El agua está a la izquierda: se aleja hacia la derecha.
    expect(manager.dirX[herb]).toBeGreaterThan(0);
  });
});
