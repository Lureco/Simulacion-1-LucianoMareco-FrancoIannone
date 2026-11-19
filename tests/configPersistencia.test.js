/**
 * tests/configPersistencia.test.js — Overrides, presets y estado de UI en localStorage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cargarEstadoUI,
  cargarOverrides,
  cargarPresets,
  guardarEstadoUI,
  guardarOverrides,
  guardarPresets,
  limpiarOverrides,
  limpiarPresets,
} from '../src/core/configPersistencia.js';

function crearAlmacen() {
  const datos = new Map();
  return {
    datos,
    getItem: vi.fn((clave) => datos.get(clave) ?? null),
    setItem: vi.fn((clave, valor) => datos.set(clave, valor)),
    removeItem: vi.fn((clave) => datos.delete(clave)),
  };
}

beforeEach(() => vi.stubGlobal('localStorage', crearAlmacen()));
afterEach(() => vi.unstubAllGlobals());

describe('configPersistencia', () => {
  it('arranca vacío y guarda/lee overrides', () => {
    expect(cargarOverrides()).toEqual({});
    guardarOverrides({ terreno: { umbralAgua: 0.4 } });
    expect(cargarOverrides()).toEqual({ terreno: { umbralAgua: 0.4 } });
  });

  it('limpia solo los overrides activos', () => {
    vi.stubGlobal('localStorage', crearAlmacen());
    guardarOverrides({ tiempo: { escalaSimulacion: 4 } });
    guardarPresets({ Isla: { tiempo: { escalaSimulacion: 2 } } });

    limpiarOverrides();

    expect(cargarOverrides()).toEqual({});
    expect(cargarPresets()).toEqual({ Isla: { tiempo: { escalaSimulacion: 2 } } });
    limpiarPresets();
    expect(cargarPresets()).toEqual({});
  });

  it('guarda y lee el estado de la UI', () => {
    expect(cargarEstadoUI()).toEqual({});
    const estado = { posicion: 'abajo', tamanos: { abajo: { altura: 500 } } };
    guardarEstadoUI(estado);
    expect(cargarEstadoUI()).toEqual(estado);
  });

  it('ignora JSON corrupto', () => {
    localStorage.setItem('ecosistemas.config.v1', '{ esto no es json');
    expect(cargarOverrides()).toEqual({});
  });

  it('funciona sin localStorage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(cargarOverrides()).toEqual({});
    expect(cargarPresets()).toEqual({});
    expect(cargarEstadoUI()).toEqual({});
    expect(guardarOverrides({ a: 1 })).toBe(false);
    expect(guardarEstadoUI({ posicion: 'abajo' })).toBe(false);
    expect(limpiarPresets()).toBe(false);
  });
});
