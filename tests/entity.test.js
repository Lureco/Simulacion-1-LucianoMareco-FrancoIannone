/**
 * tests/entity.test.js — Entidad base, manager y pool (T22, T23, T26)
 */

import { describe, it, expect } from 'vitest';
import { Entity, ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { Herbivore } from '../src/entities/herbivore.js';
import { Predator } from '../src/entities/predator.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { Pool } from '../src/systems/pool.js';
import { PRNG } from '../src/core/prng.js';
import { CONFIG } from '../src/config.js';

/** Contexto de simulación mínimo para los tests. */
function contexto(seed = 1) {
  return {
    prng: new PRNG(seed),
    mundo: { ancho: 256, alto: 256 },
    config: CONFIG,
  };
}

describe('Entity', () => {
  it('arranca viva, con energía inicial y en estado vago', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    expect(e.vivo).toBe(true);
    expect(e.edad).toBe(0);
    expect(e.energia).toBe(CONFIG.entidades.energiaInicial);
    expect(e.estado).toBe(ESTADO_IA.VAGO);
  });

  it('expone la celda y el offset desde la posición float', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.x = 10.4;
    e.y = 7.75;
    expect(e.celdaX).toBe(10);
    expect(e.celdaY).toBe(7);
    expect(e.offsetX).toBeCloseTo(0.4, 6);
    expect(e.offsetY).toBeCloseTo(0.75, 6);
  });

  it('el índice de celda usa el formato y * ancho + x', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    e.x = 3;
    e.y = 5;
    expect(e.celda(256)).toBe(5 * 256 + 3);
  });

  it('la edad sube un tick por actualización', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    const ctx = contexto();
    e.actualizar(1 / 60, ctx);
    e.actualizar(1 / 60, ctx);
    expect(e.edad).toBe(2);
  });

  it('el rumbo siempre está normalizado', () => {
    const e = new Entity(ESPECIE.HERBIVORO);
    const ctx = contexto();
    for (let i = 0; i < 500; i++) {
      e.actualizar(1 / 60, ctx);
      const largo = Math.hypot(e.dirX, e.dirY);
      expect(largo).toBeCloseTo(1, 6);
    }
  });
});

describe('Herbivore y Predator', () => {
  it('tienen la velocidad de su especie', () => {
    expect(new Herbivore().velocidad).toBe(CONFIG.herbivoro.velocidad);
    expect(new Predator().velocidad).toBe(CONFIG.depredador.velocidad);
  });

  it('el depredador es más rápido que el herbívoro', () => {
    expect(new Predator().velocidad).toBeGreaterThan(new Herbivore().velocidad);
  });

  it('reiniciar deja la velocidad de la especie (no la borra)', () => {
    const h = new Herbivore();
    h.velocidad = 0;
    h.reiniciar();
    expect(h.velocidad).toBe(CONFIG.herbivoro.velocidad);
  });

  it('el tipo de entidad es el correcto', () => {
    expect(new Herbivore().tipo).toBe(ESPECIE.HERBIVORO);
    expect(new Predator().tipo).toBe(ESPECIE.PREDADOR);
  });
});

describe('Pool', () => {
  it('devuelve el mismo objeto al reciclar', () => {
    const pool = new Pool();
    const a = pool.obtener('x', () => ({}));
    pool.liberar('x', a);
    const b = pool.obtener('x', () => ({}));
    expect(b).toBe(a);
  });

  it('no mezcla claves distintas', () => {
    const pool = new Pool();
    const a = pool.obtener('herbivoro', () => ({ tipo: 'h' }));
    pool.liberar('herbivoro', a);
    const b = pool.obtener('depredador', () => ({ tipo: 'p' }));
    expect(b.tipo).toBe('p');
  });

  it('cuenta lo que recycle', () => {
    const pool = new Pool();
    const a = pool.obtener('x', () => ({}));
    pool.liberar('x', a);
    pool.obtener('x', () => ({}));
    expect(pool.totalCreados).toBe(1);
    expect(pool.totalLiberados).toBe(1);
    expect(pool.totalReutilizados).toBe(1);
  });
});

describe('EntityManager', () => {
  function manager() {
    const m = new EntityManager();
    m.registrar(ESPECIE.HERBIVORO, () => new Herbivore());
    m.registrar(ESPECIE.PREDADOR, () => new Predator());
    return m;
  }

  it('separa las entidades por especie', () => {
    const m = manager();
    m.crear(ESPECIE.HERBIVORO);
    m.crear(ESPECIE.HERBIVORO);
    m.crear(ESPECIE.PREDADOR);

    expect(m.contar(ESPECIE.HERBIVORO)).toBe(2);
    expect(m.contar(ESPECIE.PREDADOR)).toBe(1);
    expect(m.total).toBe(3);
  });

  it('el total baja al eliminar y la entidad queda con vivo = false', () => {
    const m = manager();
    const e = m.crear(ESPECIE.HERBIVORO);
    m.eliminar(e);
    expect(m.total).toBe(0);
    expect(m.contar(ESPECIE.HERBIVORO)).toBe(0);
    expect(e.vivo).toBe(false);
  });

  it('eliminar dos veces la misma entidad no la rompe', () => {
    const m = manager();
    const e = m.crear(ESPECIE.HERBIVORO);
    m.eliminar(e);
    m.eliminar(e);
    expect(m.total).toBe(0);
  });

  it('el pool recicla: 100 altas y bajas no crean 100 objetos nuevos', () => {
    const m = manager();
    const creadas = [];
    for (let i = 0; i < 100; i++) {
      creadas.push(m.crear(ESPECIE.HERBIVORO));
    }
    for (const e of creadas) {
      m.eliminar(e);
    }
    for (let i = 0; i < 100; i++) {
      m.crear(ESPECIE.HERBIVORO);
    }
    expect(m.pool.totalCreados).toBe(100);
    expect(m.pool.totalReutilizados).toBe(100);
    expect(m.total).toBe(100);
  });

  it('la entidad reciclada vuelve como nueva', () => {
    const m = manager();
    const e = m.crear(ESPECIE.HERBIVORO);
    e.x = 50;
    e.edad = 999;
    m.eliminar(e);

    const f = m.crear(ESPECIE.HERBIVORO);
    expect(f.x).toBe(0);
    expect(f.edad).toBe(0);
    expect(f.vivo).toBe(true);
  });

  it('el version sube con cada alta y baja', () => {
    const m = manager();
    const v0 = m.version;
    const e = m.crear(ESPECIE.HERBIVORO);
    expect(m.version).toBe(v0 + 1);
    m.eliminar(e);
    expect(m.version).toBe(v0 + 2);
  });

  it('limpiar deja el manager vacío', () => {
    const m = manager();
    for (let i = 0; i < 10; i++) m.crear(ESPECIE.HERBIVORO);
    m.limpiar();
    expect(m.total).toBe(0);
    expect(m.pool.disponibles(ESPECIE.HERBIVORO)).toBe(10);
  });

  it('lanza si se pide un tipo sin fábrica registrada', () => {
    const m = new EntityManager();
    expect(() => m.crear(ESPECIE.HERBIVORO)).toThrow();
  });
});
