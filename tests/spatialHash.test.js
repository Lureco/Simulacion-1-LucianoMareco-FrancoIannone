/**
 * tests/spatialHash.test.js — Spatial Hash (T24)
 * ==============================================
 * El vecindario tiene que ser O(vecinos), no O(n²). Estos tests verifican
 * que el hash devuelve exactamente lo mismo que un barrido directo.
 *
 * ⚠️ REFACTOR SoA (D13): el hash indexa **ids** y lee las posiciones del
 * almacén de entidades.
 */

import { describe, it, expect } from 'vitest';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { ESPECIE } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';

/** Almacén con una entidad en cada posición. Devuelve el almacén y los ids. */
function almacenCon(posiciones) {
  const m = new EntityManager();
  const ids = [];
  for (const [x, y] of posiciones) {
    const id = m.crear(ESPECIE.HERBIVORO);
    m.x[id] = x;
    m.y[id] = y;
    ids.push(id);
  }
  return { m, ids };
}

/** Referencia: barrido directo de todas las entidades. Devuelve ids. */
function barrido(m, ids, x, y, radio, excluirId) {
  const salida = [];
  const r2 = radio * radio;
  for (const id of ids) {
    if (id === excluirId) continue;
    const dx = m.x[id] - x;
    const dy = m.y[id] - y;
    if (dx * dx + dy * dy <= r2) salida.push(id);
  }
  return salida;
}

describe('SpatialHash', () => {
  it('indexa todas las entidades', () => {
    const { m } = almacenCon([
      [0, 0],
      [100, 100],
      [255, 255],
    ]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();
    expect(hash.total).toBe(3);
  });

  it('devuelve lo mismo que un barrido directo', () => {
    const posiciones = [];
    for (let i = 0; i < 50; i++) {
      posiciones.push([i * 1.3, i * 0.7]);
    }
    const { m, ids } = almacenCon(posiciones);
    const hash = new SpatialHash(m, 64, 64, 8);
    hash.reconstruir();

    const salida = [];
    for (const id of ids) {
      const esperado = barrido(m, ids, m.x[id], m.y[id], 5, id);
      const obtenido = hash.consultar(m.x[id], m.y[id], 5, salida, id);
      expect(obtenido.length).toBe(esperado.length);
      for (const encontrado of esperado) {
        expect(obtenido).toContain(encontrado);
      }
    }
  });

  it('respeta el radio', () => {
    const { m, ids } = almacenCon([
      [10, 10],
      [30, 30],
    ]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();

    const salida = [];
    hash.consultar(10, 10, 5, salida);
    expect(salida).toContain(ids[0]);
    expect(salida).not.toContain(ids[1]);
  });

  it('excluye la entidad consultada', () => {
    const { m, ids } = almacenCon([
      [10, 10],
      [11, 10],
    ]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();

    const salida = [];
    hash.consultar(10, 10, 5, salida, ids[0]);
    expect(salida).not.toContain(ids[0]);
    expect(salida).toContain(ids[1]);
  });

  it('reutiliza el array de salida (no genera basura)', () => {
    const { m } = almacenCon([[10, 10]]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();
    const salida = [];
    const primero = hash.consultar(10, 10, 5, salida);
    const segundo = hash.consultar(10, 10, 5, salida);
    expect(primero).toBe(salida);
    expect(segundo).toBe(salida);
  });

  it('la consulta se vacía antes de cada búsqueda', () => {
    const { m, ids } = almacenCon([
      [10, 10],
      [200, 200],
    ]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();
    const salida = [];
    hash.consultar(10, 10, 5, salida);
    expect(salida.length).toBe(1);
    hash.consultar(200, 200, 5, salida);
    expect(salida.length).toBe(1);
    expect(salida[0]).toBe(ids[1]);
  });

  it('limpiar vacía los buckets', () => {
    const { m } = almacenCon([[10, 10]]);
    const hash = new SpatialHash(m, 256, 256, 8);
    hash.reconstruir();
    hash.limpiar();
    expect(hash.total).toBe(0);
  });

  it('no se rompe con entidades en el borde del mundo', () => {
    const { m, ids } = almacenCon([
      [0, 0],
      [15, 15],
      [0, 15],
    ]);
    const hash = new SpatialHash(m, 16, 16, 4);
    hash.reconstruir();
    const salida = [];
    const esperado = barrido(m, ids, 0, 0, 20);
    const obtenido = hash.consultar(0, 0, 20, salida);
    expect(obtenido.length).toBe(esperado.length);
  });

  it('es O(vecinos): muchas entidades lejos no se mezclan', () => {
    const posiciones = [];
    for (let i = 0; i < 200; i++) {
      posiciones.push([(i % 16) * 16, Math.floor(i / 16) * 16]);
    }
    const { m } = almacenCon(posiciones);
    const hash = new SpatialHash(m, 256, 256, 16);
    hash.reconstruir();

    const salida = [];
    hash.consultar(0, 0, 4, salida);
    // Solo las del bucket 0,0 (4 celdas de radio) pueden entrar.
    expect(salida.length).toBeLessThanOrEqual(4);
  });
});
