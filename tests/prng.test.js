/**
 * tests/prng.test.js — Determinismo del PRNG (T10)
 * ==================================================
 * Si estos tests fallan, la seed no reproduce nada y el requisito
 * del GDD (mismo seed ⇒ mismo resultado) está roto.
 */

import { describe, it, expect } from 'vitest';
import { PRNG, mulberry32, hashInts, hashString } from '../src/core/prng.js';

describe('mulberry32', () => {
  it('devuelve floats en [0, 1)', () => {
    const next = mulberry32(1234);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('la misma semilla produce la misma secuencia', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('semillas distintas producen secuencias distintas', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let iguales = 0;
    for (let i = 0; i < 50; i++) {
      if (a() === b()) iguales++;
    }
    expect(iguales).toBe(0);
  });
});

describe('PRNG', () => {
  it('misma semilla ⇒ misma secuencia completa', () => {
    const a = new PRNG(1337);
    const b = new PRNG(1337);
    for (let i = 0; i < 500; i++) {
      expect(a.float()).toBe(b.float());
    }
  });

  it('reset() reproduce la secuencia original', () => {
    const p = new PRNG(99);
    const primera = [p.float(), p.float(), p.float()];
    p.reset(99);
    const segunda = [p.float(), p.float(), p.float()];
    expect(segunda).toEqual(primera);
  });

  it('int() respeta el rango [min, max)', () => {
    const p = new PRNG(7);
    for (let i = 0; i < 500; i++) {
      const v = p.int(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(8);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('intInclusive() incluye el máximo', () => {
    const p = new PRNG(7);
    let vioMax = false;
    for (let i = 0; i < 500; i++) {
      const v = p.intInclusive(0, 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(2);
      if (v === 2) vioMax = true;
    }
    expect(vioMax).toBe(true);
  });

  it('range() devuelve floats dentro del intervalo', () => {
    const p = new PRNG(11);
    for (let i = 0; i < 500; i++) {
      const v = p.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it('bool(true) siempre da true y bool(false) siempre false', () => {
    const p = new PRNG(3);
    for (let i = 0; i < 100; i++) {
      expect(p.bool(1)).toBe(true);
      expect(p.bool(0)).toBe(false);
    }
  });

  it('pick() devuelve elementos del array', () => {
    const p = new PRNG(5);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(p.pick(arr));
    }
  });

  it('gaussian() tiene media y desvío aproximados', () => {
    const p = new PRNG(2024);
    const n = 20000;
    let suma = 0;
    let sumaCuadrados = 0;
    for (let i = 0; i < n; i++) {
      const v = p.gaussian(10, 2);
      suma += v;
      sumaCuadrados += v * v;
    }
    const media = suma / n;
    const varianza = sumaCuadrados / n - media * media;
    expect(media).toBeGreaterThan(9.8);
    expect(media).toBeLessThan(10.2);
    expect(Math.sqrt(varianza)).toBeGreaterThan(1.9);
    expect(Math.sqrt(varianza)).toBeLessThan(2.1);
  });

  it('fork() es determinista y no interrumpe la secuencia del padre', () => {
    const padre = new PRNG(500);
    const hijo1 = padre.fork(1);
    const hijo2 = padre.fork(1);
    const hijo3 = padre.fork(2);

    expect(hijo1.float()).toBe(hijo2.float());
    expect(hijo1.float()).not.toBe(hijo3.float());

    // El padre sigue con su propia secuencia, sin haber cambiado al forkear.
    const padreControl = new PRNG(500);
    expect(padre.float()).toBe(padreControl.float());
  });

  it('expone la semilla actual', () => {
    const p = new PRNG(123456);
    expect(p.seed).toBe(123456);
  });
});

describe('hashes', () => {
  it('hashInts es determinista y diferencia entradas', () => {
    expect(hashInts(1, 2)).toBe(hashInts(1, 2));
    expect(hashInts(1, 2)).not.toBe(hashInts(2, 1));
  });

  it('hashString es determinista y diferencia entradas', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});
