/**
 * tests/presets.test.js — Lógica pura de serialización/validación de presets
 */

import { describe, expect, it } from 'vitest';
import {
  FORMATO_PRESETS,
  esNombreValido,
  fusionarPresets,
  limpiarValores,
  serializarPresets,
  validarPresets,
} from '../src/core/presets.js';

describe('presets', () => {
  it('limpia valores: solo números, booleanos y colores conocidos', () => {
    const limpio = limpiarValores({
      terreno: { umbralAgua: 0.42, colorAgua: 0x123456, invento: 9 },
      sprites: { generarFallback: false },
      ui: { graficoColorPasto: '#ABCDEF' },
      spritesExtra: { rutaPlanta: { 1: 'otra/ruta' } },
      invento: 1,
    });

    expect(limpio).toEqual({
      terreno: { umbralAgua: 0.42, colorAgua: 0x123456 },
      sprites: { generarFallback: false },
      ui: { graficoColorPasto: '#abcdef' },
    });
  });

  it('serializa con el formato versionado y permite elegir nombres', () => {
    const presets = { Uno: { a: 1 }, Dos: { b: 2 } };
    const json = JSON.parse(serializarPresets(presets, ['Dos']));
    expect(json.formato).toBe(FORMATO_PRESETS);
    expect(Object.keys(json.presets)).toEqual(['Dos']);
  });

  it('valida un archivo importado y omite entradas malas', () => {
    const resultado = validarPresets({
      formato: FORMATO_PRESETS,
      presets: {
        '  Mi isla  ': { plantas: { probExpansion: 0.2 } },
        Vacio: { invento: 1 },
        '': { plantas: { probExpansion: 0.1 } },
      },
    });

    expect(Object.keys(resultado.presets)).toEqual(['Mi isla']);
    expect(resultado.presets['Mi isla'].plantas.probExpansion).toBe(0.2);
    expect(resultado.errores).toHaveLength(2);
  });

  it('rechaza formatos desconocidos y estructuras rotas', () => {
    expect(validarPresets(null).errores[0]).toContain('objeto');
    expect(validarPresets({ formato: 'otro' }).errores[0]).toContain('Formato no reconocido');
    expect(validarPresets({ formato: FORMATO_PRESETS }).errores[0]).toContain('presets');
  });

  it('fusiona y cuenta agregados y actualizados', () => {
    const fusion = fusionarPresets({ Uno: { a: 1 } }, { Uno: { a: 2 }, Dos: { b: 3 } });
    expect(fusion.presets.Uno.a).toBe(2);
    expect(fusion.agregados).toBe(1);
    expect(fusion.actualizados).toBe(1);
  });

  it('valida nombres de 1 a 40 caracteres', () => {
    expect(esNombreValido('Isla')).toBe(true);
    expect(esNombreValido('   ')).toBe(false);
    expect(esNombreValido('x'.repeat(41))).toBe(false);
  });
});
