/**
 * tests/movement.test.js — Movimiento entre celdas (SoA)
 * ======================================================
 * `mover` recibe el `id` de la entidad y escribe en los arrays tipados.
 */

import { describe, it, expect } from 'vitest';
import { mover } from '../src/systems/movement.js';
import { ESPECIE } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';

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

  it('rebota contra el borde derecho', () => {
    const { ctx, m, id } = contexto();
    m.velocidad[id] = 10;
    m.x[id] = 30.5;
    m.dirX[id] = 1;
    mover(id, 0.1, ctx);
    expect(m.x[id]).toBeCloseTo(30.5, 6);
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
    b.m.y[b.id] = 30.5;
    b.m.dirY[b.id] = 1;
    mover(b.id, 0.1, b.ctx);
    expect(b.m.dirY[b.id]).toBeLessThan(0);
  });

  it('mantiene la entidad dentro del mundo', () => {
    const { ctx, m, id } = contexto(32, 32);
    m.velocidad[id] = 3;
    for (let i = 0; i < 2000; i++) {
      mover(id, 1 / 60, ctx);
      expect(m.x[id]).toBeGreaterThanOrEqual(0);
      expect(m.x[id]).toBeLessThanOrEqual(31);
      expect(m.y[id]).toBeGreaterThanOrEqual(0);
      expect(m.y[id]).toBeLessThanOrEqual(31);
    }
  });
});
