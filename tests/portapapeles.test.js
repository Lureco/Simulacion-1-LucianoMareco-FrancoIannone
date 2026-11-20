/**
 * tests/portapapeles.test.js — F8 · T68
 * ======================================
 *
 * El copiado de la seed se prueba con un entorno falso: no hace falta DOM
 * real ni permisos del navegador. Cubre la API moderna, su fallo y el fallback.
 */

import { describe, expect, it } from 'vitest';
import { copiarTexto } from '../src/ui/portapapeles.js';

/** Textarea falsa con el mínimo que usa el helper. */
function areaFalsa() {
  return {
    value: '',
    style: {},
    setAttribute() {},
    select() {},
    remove() {},
  };
}

describe('T68 · copiar seed', () => {
  it('usa navigator.clipboard cuando está disponible', async () => {
    let escrito = null;
    const entorno = {
      navigator: { clipboard: { writeText: async (texto) => (escrito = texto) } },
    };
    expect(await copiarTexto('12345', entorno)).toBe(true);
    expect(escrito).toBe('12345');
  });

  it('cae al execCommand si la API moderna falla', async () => {
    const area = areaFalsa();
    let copiado = false;
    const entorno = {
      navigator: { clipboard: { writeText: async () => Promise.reject(new Error('denegado')) } },
      document: {
        createElement: () => area,
        body: { appendChild() {} },
        execCommand: (orden) => {
          copiado = orden === 'copy';
          return copiado;
        },
      },
    };
    expect(await copiarTexto('abc', entorno)).toBe(true);
    expect(copiado).toBe(true);
    expect(area.value).toBe('abc');
  });

  it('devuelve false si no hay ninguna vía de copiado', async () => {
    expect(await copiarTexto('seed', {})).toBe(false);
    expect(
      await copiarTexto('seed', {
        document: {
          createElement: () => areaFalsa(),
          body: { appendChild() {} },
          execCommand: () => false,
        },
      }),
    ).toBe(false);
  });
});
