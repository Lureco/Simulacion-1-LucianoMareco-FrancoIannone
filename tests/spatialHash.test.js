/**
 * tests/spatialHash.test.js — Spatial Hash (T24)
 * ==============================================
 * El vecindario tiene que ser O(vecinos), no O(n²). Estos tests verifican
 * que el hash devuelve exactamente lo mismo que un barrido directo.
 */

import { describe, it, expect } from 'vitest';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { Entity, ESPECIE } from '../src/entities/entity.js';

/** Entidad de prueba en una posición. */
function entidadEn(x, y) {
  const e = new Entity(ESPECIE.HERBIVORO);
  e.x = x;
  e.y = y;
  return e;
}

/** Referencia: barrido directo de todas las entidades. */
function barrido(entidades, x, y, radio, excluir) {
  const salida = [];
  const r2 = radio * radio;
  for (const e of entidades) {
    if (e === excluir) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) salida.push(e);
  }
  return salida;
}

describe('SpatialHash', () => {
  it('indexa todas las entidades', () => {
    const hash = new SpatialHash(256, 256, 8);
    const entidades = [entidadEn(0, 0), entidadEn(100, 100), entidadEn(255, 255)];
    hash.reconstruir(entidades);
    expect(hash.total).toBe(3);
  });

  it('devuelve lo mismo que un barrido directo', () => {
    const hash = new SpatialHash(64, 64, 8);
    const entidades = [];
    for (let i = 0; i < 50; i++) {
      entidades.push(entidadEn(i * 1.3, i * 0.7));
    }
    hash.reconstruir(entidades);

    const salida = [];
    for (const e of entidades) {
      const esperado = barrido(entidades, e.x, e.y, 5, e);
      const obtenido = hash.consultar(e.x, e.y, 5, salida, e);
      expect(obtenido.length).toBe(esperado.length);
      for (const encontrado of esperado) {
        expect(obtenido).toContain(encontrado);
      }
    }
  });

  it('respeta el radio', () => {
    const hash = new SpatialHash(256, 256, 8);
    const cerca = entidadEn(10, 10);
    const lejos = entidadEn(30, 30);
    hash.reconstruir([cerca, lejos]);

    const salida = [];
    hash.consultar(10, 10, 5, salida);
    expect(salida).toContain(cerca);
    expect(salida).not.toContain(lejos);
  });

  it('excluye la entidad consultada', () => {
    const hash = new SpatialHash(256, 256, 8);
    const a = entidadEn(10, 10);
    const b = entidadEn(11, 10);
    hash.reconstruir([a, b]);

    const salida = [];
    hash.consultar(10, 10, 5, salida, a);
    expect(salida).not.toContain(a);
    expect(salida).toContain(b);
  });

  it('reutiliza el array de salida (no genera basura)', () => {
    const hash = new SpatialHash(256, 256, 8);
    hash.reconstruir([entidadEn(10, 10)]);
    const salida = [];
    const primero = hash.consultar(10, 10, 5, salida);
    const segundo = hash.consultar(10, 10, 5, salida);
    expect(primero).toBe(salida);
    expect(segundo).toBe(salida);
  });

  it('la consulta se vacía antes de cada búsqueda', () => {
    const hash = new SpatialHash(256, 256, 8);
    hash.reconstruir([entidadEn(10, 10), entidadEn(200, 200)]);
    const salida = [];
    hash.consultar(10, 10, 5, salida);
    expect(salida.length).toBe(1);
    hash.consultar(200, 200, 5, salida);
    expect(salida.length).toBe(1);
    expect(salida[0].x).toBe(200);
  });

  it('limpiar vacía los buckets', () => {
    const hash = new SpatialHash(256, 256, 8);
    hash.reconstruir([entidadEn(10, 10)]);
    hash.limpiar();
    expect(hash.total).toBe(0);
  });

  it('no se rompe con entidades en el borde del mundo', () => {
    const hash = new SpatialHash(16, 16, 4);
    const entidades = [entidadEn(0, 0), entidadEn(15, 15), entidadEn(0, 15)];
    hash.reconstruir(entidades);
    const salida = [];
    const esperado = barrido(entidades, 0, 0, 20);
    const obtenido = hash.consultar(0, 0, 20, salida);
    expect(obtenido.length).toBe(esperado.length);
  });

  it('es O(vecinos): muchas entidades lejos no se mezclan', () => {
    const hash = new SpatialHash(256, 256, 16);
    const entidades = [];
    for (let i = 0; i < 200; i++) {
      entidades.push(entidadEn((i % 16) * 16, Math.floor(i / 16) * 16));
    }
    hash.reconstruir(entidades);

    const salida = [];
    hash.consultar(0, 0, 4, salida);
    // Solo las del bucket 0,0 (4 celdas de radio) pueden entrar.
    expect(salida.length).toBeLessThanOrEqual(4);
  });
});
