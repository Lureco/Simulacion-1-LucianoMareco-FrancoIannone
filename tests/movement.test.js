/**
 * tests/movement.test.js — Movimiento entre celdas (SoA)
 * ======================================================
 * `mover` recibe el `id` de la entidad y escribe en los arrays tipados.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { mover } from '../src/systems/movement.js';
import { ESPECIE } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { Grid } from '../src/world/grid.js';
import { TERRENO } from '../src/world/cell.js';

/** Almacén con una entidad, más el contexto mínimo para `mover`. */
function contexto(ancho = 32, alto = 32) {
  const entidades = new EntityManager();
  const id = entidades.crear(ESPECIE.HERBIVORO);
  return { ctx: { mundo: { ancho, alto }, config: {}, entidades }, m: entidades, id };
}

describe('mover', () => {
  it('desplaza la entidad según rumbo y velocidad', () => {
    const { ctx, m, id } = contexto();
    m.velocidad[id] = 2; // celdas por segundo
    m.dirX[id] = 1;
    m.dirY[id] = 0;
    mover(id, 0.5, ctx);
    expect(m.x[id]).toBeCloseTo(1, 6);
    expect(m.y[id]).toBeCloseTo(0, 6);
  });

  it('rebota contra el borde izquierdo', () => {
    const { ctx, m, id } = contexto();
    m.velocidad[id] = 10;
    m.x[id] = 0.5;
    m.dirX[id] = -1;
    mover(id, 0.1, ctx);
    expect(m.x[id]).toBeCloseTo(0.5, 6);
    expect(m.dirX[id]).toBeGreaterThan(0);
  });

  it('rebota contra el borde derecho sin saltarse la última celda', () => {
    const { ctx, m, id } = contexto();
    m.velocidad[id] = 10;
    m.x[id] = 31.5; // centro de la última celda (ancho = 32)
    m.dirX[id] = 1;
    mover(id, 0.1, ctx);
    expect(m.x[id]).toBeCloseTo(31.5, 6);
    expect(Math.floor(m.x[id])).toBe(31);
    expect(m.dirX[id]).toBeLessThan(0);
  });

  it('rebota contra el borde superior e inferior', () => {
    const a = contexto();
    a.m.velocidad[a.id] = 10;
    a.m.dirY[a.id] = -1;
    mover(a.id, 0.1, a.ctx);
    expect(a.m.dirY[a.id]).toBeGreaterThan(0);

    const b = contexto();
    b.m.velocidad[b.id] = 10;
    b.m.y[b.id] = 31.5;
    b.m.dirY[b.id] = 1;
    mover(b.id, 0.1, b.ctx);
    expect(Math.floor(b.m.y[b.id])).toBe(31);
    expect(b.m.dirY[b.id]).toBeLessThan(0);
  });

  it('mantiene la entidad dentro del mundo', () => {
    const { ctx, m, id } = contexto(32, 32);
    m.velocidad[id] = 3;
    for (let i = 0; i < 2000; i++) {
      mover(id, 1 / 60, ctx);
      expect(m.x[id]).toBeGreaterThanOrEqual(0);
      expect(m.x[id]).toBeLessThan(32);
      expect(m.y[id]).toBeGreaterThanOrEqual(0);
      expect(m.y[id]).toBeLessThan(32);
    }
  });
});

describe('restricción de terreno en el movimiento (T49)', () => {
  /** Entidad en (4.5, 4.5) con rumbo este: la celda destino es (5, 4). */
  function contextoConTerreno(terreno) {
    const ancho = 32;
    const alto = 32;
    const entidades = new EntityManager();
    const id = entidades.crear(ESPECIE.HERBIVORO);
    entidades.x[id] = 4.5;
    entidades.y[id] = 4.5;
    entidades.dirX[id] = 1;
    entidades.dirY[id] = 0;
    entidades.velocidad[id] = 2; // paso previsto: 1 celda con dt = 0.5

    const grid = new Grid(ancho, alto);
    grid.terreno[grid.indice(5, 4)] = terreno;

    return {
      ctx: { mundo: { ancho, alto }, config: CONFIG, entidades, grid },
      entidades,
      id,
    };
  }

  it('sobre tierra avanza el paso completo', () => {
    const { ctx, entidades, id } = contextoConTerreno(TERRENO.TIERRA);
    mover(id, 0.5, ctx);
    expect(entidades.x[id]).toBeCloseTo(5.5, 6);
  });

  it('el agua frena a 1/costeAgua de la velocidad', () => {
    const { ctx, entidades, id } = contextoConTerreno(TERRENO.AGUA);
    mover(id, 0.5, ctx);
    expect(entidades.x[id]).toBeCloseTo(4.5 + 1 / CONFIG.entidades.costeAgua, 6);
  });

  it('la arena frena a 1/costeArena de la velocidad', () => {
    const { ctx, entidades, id } = contextoConTerreno(TERRENO.ARENA);
    mover(id, 0.5, ctx);
    expect(entidades.x[id]).toBeCloseTo(4.5 + 1 / CONFIG.entidades.costeArena, 6);
  });
});
