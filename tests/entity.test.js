/**
 * tests/entity.test.js — Especie, almacén SoA y reciclado (T22, T23, T26)
 * ======================================================================
 *
 * ⚠️ REFACTOR SoA (D13): ya no existe una clase por animal. La identidad de
 * un bicho es su `id`, y sus datos viven en arrays tipados dentro del
 * `EntityManager`.
 */

import { describe, it, expect } from 'vitest';
import { ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { Herbivoro } from '../src/entities/herbivore.js';
import { Depredador } from '../src/entities/predator.js';
import { especieDe } from '../src/entities/especies.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { PRNG } from '../src/core/prng.js';
import { CONFIG } from '../src/config.js';

/** Contexto mínimo con almacén, para probar comportamiento. */
function contexto(seed = 1) {
  return {
    prng: new PRNG(seed),
    mundo: { ancho: 256, alto: 256 },
    config: CONFIG,
    entidades: new EntityManager(),
  };
}

describe('Especie y almacén (SoA)', () => {
  it('los datos viven en arrays tipados', () => {
    const m = new EntityManager();
    expect(m.x).toBeInstanceOf(Float32Array);
    expect(m.edad).toBeInstanceOf(Int32Array);
    expect(m.estado).toBeInstanceOf(Uint8Array);
  });

  it('arranca viva, con energía inicial y en estado vago', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    expect(m.vivo[id]).toBe(1);
    expect(m.edad[id]).toBe(0);
    expect(m.energia[id]).toBe(CONFIG.entidades.energiaInicial);
    expect(m.estado[id]).toBe(ESTADO_IA.VAGO);
  });

  it('expone la celda y el offset desde la posición float', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    m.x[id] = 10.4;
    m.y[id] = 7.75;
    expect(m.celdaX(id)).toBe(10);
    expect(m.celdaY(id)).toBe(7);
    expect(m.offsetX(id)).toBeCloseTo(0.4, 6);
    expect(m.offsetY(id)).toBeCloseTo(0.75, 6);
  });

  it('el índice de celda usa el formato y * ancho + x', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    m.x[id] = 3;
    m.y[id] = 5;
    expect(m.celda(id, 256)).toBe(5 * 256 + 3);
  });

  it('el rumbo siempre está normalizado', () => {
    const ctx = contexto();
    const id = ctx.entidades.crear(ESPECIE.HERBIVORO);
    const especie = especieDe(ESPECIE.HERBIVORO);
    for (let i = 0; i < 500; i++) {
      especie.pensar(id, 1 / 60, ctx);
      const largo = Math.hypot(ctx.entidades.dirX[id], ctx.entidades.dirY[id]);
      expect(largo).toBeCloseTo(1, 6);
    }
  });
});

describe('Herbivoro y Depredador', () => {
  it('tienen la velocidad de su especie', () => {
    expect(new Herbivoro().velocidad).toBe(CONFIG.herbivoro.velocidad);
    expect(new Depredador().velocidad).toBe(CONFIG.depredador.velocidad);
  });

  it('el depredador es más rápido que el herbívoro', () => {
    expect(new Depredador().velocidad).toBeGreaterThan(new Herbivoro().velocidad);
  });

  it('al crear, la entidad copia la velocidad de su especie', () => {
    const m = new EntityManager();
    const h = m.crear(ESPECIE.HERBIVORO);
    const p = m.crear(ESPECIE.PREDADOR);
    // `velocidad` es Float32Array: comparar con tolerancia.
    expect(m.velocidad[h]).toBeCloseTo(CONFIG.herbivoro.velocidad, 5);
    expect(m.velocidad[p]).toBeCloseTo(CONFIG.depredador.velocidad, 5);
  });

  it('el tipo de la entidad es el correcto', () => {
    const m = new EntityManager();
    expect(m.tipo[m.crear(ESPECIE.HERBIVORO)]).toBe(ESPECIE.HERBIVORO);
    expect(m.tipo[m.crear(ESPECIE.PREDADOR)]).toBe(ESPECIE.PREDADOR);
  });
});

describe('EntityManager (almacén SoA)', () => {
  it('separa las entidades por especie', () => {
    const m = new EntityManager();
    m.crear(ESPECIE.HERBIVORO);
    m.crear(ESPECIE.HERBIVORO);
    m.crear(ESPECIE.PREDADOR);
    expect(m.contar(ESPECIE.HERBIVORO)).toBe(2);
    expect(m.contar(ESPECIE.PREDADOR)).toBe(1);
    expect(m.total).toBe(3);
  });

  it('el total baja al eliminar y el id queda libre', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    m.eliminar(id);
    expect(m.total).toBe(0);
    expect(m.contar(ESPECIE.HERBIVORO)).toBe(0);
    expect(m.vivo[id]).toBe(0);
  });

  it('eliminar dos veces el mismo id no lo rompe', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    m.eliminar(id);
    m.eliminar(id);
    expect(m.total).toBe(0);
  });

  it('recicla ids: 100 altas y bajas no crean 100 ids nuevos', () => {
    const m = new EntityManager();
    const ids = [];
    for (let i = 0; i < 100; i++) ids.push(m.crear(ESPECIE.HERBIVORO));
    for (const id of ids) m.eliminar(id);
    for (let i = 0; i < 100; i++) m.crear(ESPECIE.HERBIVORO);
    expect(m.totalCreados).toBe(100);
    expect(m.totalReutilizados).toBe(100);
    expect(m.total).toBe(100);
  });

  it('un id reciclado vuelve como nuevo', () => {
    const m = new EntityManager();
    const id = m.crear(ESPECIE.HERBIVORO);
    m.x[id] = 50;
    m.edad[id] = 999;
    m.eliminar(id);
    const nuevo = m.crear(ESPECIE.HERBIVORO);
    expect(nuevo).toBe(id);
    expect(m.x[nuevo]).toBe(0);
    expect(m.edad[nuevo]).toBe(0);
    expect(m.vivo[nuevo]).toBe(1);
  });

  it('el version sube con cada alta y baja', () => {
    const m = new EntityManager();
    const v0 = m.version;
    const id = m.crear(ESPECIE.HERBIVORO);
    expect(m.version).toBe(v0 + 1);
    m.eliminar(id);
    expect(m.version).toBe(v0 + 2);
  });

  it('limpiar deja el almacén vacío y los ids libres', () => {
    const m = new EntityManager();
    for (let i = 0; i < 10; i++) m.crear(ESPECIE.HERBIVORO);
    m.limpiar();
    expect(m.total).toBe(0);
    expect(m.libres.length).toBe(10);
  });

  it('lanza si se pide una especie desconocida', () => {
    const m = new EntityManager();
    expect(() => m.crear(99)).toThrow();
  });
});
