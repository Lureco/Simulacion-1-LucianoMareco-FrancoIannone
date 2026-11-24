/**
 * tests/presets.test.js — Lógica pura de serialización/validación de presets
 */

import { describe, expect, it } from 'vitest';
import { CONFIG_BASE, PRESETS } from '../src/config.js';
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

  it('el preset «Máximo estable» usa el tope de entidades y valores válidos', () => {
    const preset = PRESETS['Máximo estable'];
    expect(preset).toBeDefined();
    const valido = limpiarValores(preset);
    expect(valido).toEqual(preset);
    expect(preset.herbivoro.poblacionInicial + preset.depredador.poblacionInicial).toBe(
      CONFIG_BASE.entidades.maxEntidades,
    );
    expect(preset.entidadesEstaticas.poblacionInicial).toBeLessThan(
      CONFIG_BASE.mundo.ancho * CONFIG_BASE.mundo.alto,
    );
    expect(preset.percepcion.ticksEntreBusquedaDepredador).toBeGreaterThan(1);
  });

  it('el preset «Máximo estable ×2» comprime el tiempo sin tocar el reloj', () => {
    const preset = PRESETS['Máximo estable ×2'];
    const estable = PRESETS['Máximo estable'];
    expect(preset).toBeDefined();
    expect(limpiarValores(preset)).toEqual(preset);
    // El reloj (escalaSimulacion, pasoFijo, maxPasosPorFrame) queda intacto.
    expect(preset.tiempo).toBeUndefined();

    // Tasas por segundo y probabilidades por tick: ×2.
    expect(preset.herbivoro.velocidad).toBeCloseTo(CONFIG_BASE.herbivoro.velocidad * 2, 6);
    expect(preset.depredador.velocidad).toBe(estable.depredador.velocidad * 2);
    expect(preset.herbivoro.consumoHambre).toBeCloseTo(estable.herbivoro.consumoHambre * 2, 6);
    expect(preset.depredador.consumoSed).toBeCloseTo(estable.depredador.consumoSed * 2, 6);
    expect(preset.plantas.probExpansion).toBeCloseTo(estable.plantas.probExpansion * 2, 6);

    // Todo lo que se mide en ticks: ÷2.
    expect(preset.herbivoro.cooldownReproduccion).toBe(estable.herbivoro.cooldownReproduccion / 2);
    expect(preset.depredador.edadMinimaReproduccion).toBe(
      estable.depredador.edadMinimaReproduccion / 2,
    );
    expect(preset.plantas.ticksVidaAdulta).toBe(estable.plantas.ticksVidaAdulta / 2);
    expect(preset.entidades.edadMaximaTicks).toBe(CONFIG_BASE.entidades.edadMaximaTicks / 2);
    expect(preset.percepcion.ticksEntreBusqueda).toBe(estable.percepcion.ticksEntreBusqueda / 2);

    // Lo espacial y el tope de población no cambian.
    expect(preset.herbivoro.radioVision).toBe(estable.herbivoro.radioVision);
    expect(preset.depredador.radioVision).toBe(estable.depredador.radioVision);
    expect(preset.herbivoro.poblacionInicial + preset.depredador.poblacionInicial).toBe(
      CONFIG_BASE.entidades.maxEntidades,
    );
  });
});
