/**
 * tests/movement.test.js — Movimiento entre celdas
 */

import { describe, it, expect } from 'vitest';
import { mover } from '../src/systems/movement.js';
import { Entity, ESPECIE } from '../src/entities/entity.js';

function contexto(ancho = 32, alto = 32) {
  return { mundo: { ancho, alto }, config: {} };
}

describe('mover', () => {
  it('desplaza la entidad según rumbo y velocidad', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.velocidad = 2; // celdas por segundo
    e.dirX = 1;
    e.dirY = 0;
    mover(e, 0.5, contexto());
    expect(e.x).toBeCloseTo(1, 6);
    expect(e.y).toBeCloseTo(0, 6);
  });

  it('rebota contra el borde izquierdo', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.velocidad = 10;
    e.x = 0.5;
    e.dirX = -1;
    mover(e, 0.1, contexto());
    expect(e.x).toBeCloseTo(0.5, 6);
    expect(e.dirX).toBeGreaterThan(0);
  });

  it('rebota contra el borde derecho', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.velocidad = 10;
    e.x = 30.5;
    e.dirX = 1;
    mover(e, 0.1, contexto());
    expect(e.x).toBeCloseTo(30.5, 6);
    expect(e.dirX).toBeLessThan(0);
  });

  it('rebota contra el borde superior e inferior', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.velocidad = 10;
    e.dirY = -1;
    mover(e, 0.1, contexto());
    expect(e.dirY).toBeGreaterThan(0);

    const f = new Entity(ESPECIE.HERBIVORO);
    f.velocidad = 10;
    f.y = 30.5;
    f.dirY = 1;
    mover(f, 0.1, contexto());
    expect(f.dirY).toBeLessThan(0);
  });

  it('mantiene la entidad dentro del mundo', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.velocidad = 3;
    const ctx = contexto(32, 32);
    for (let i = 0; i < 2000; i++) {
      mover(e, 1 / 60, ctx);
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(31);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(31);
    }
  });
});
