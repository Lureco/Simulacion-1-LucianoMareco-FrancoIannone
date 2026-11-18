/**
 * tests/grafico.test.js — Regresión T61: gráfico tras regenerar (tecla R).
 * ======================================================================
 *
 * El handler de R vuelve `ctx.tick` a 0. Si el gráfico conserva las muestras
 * del seed anterior, `registrar()` descarta las muestras nuevas durante
 * ~100 s y el canvas queda congelado con las curvas viejas. Estos tests
 * cubren el `reiniciar()` nuevo y la defensa ante un tick menor.
 *
 * No se necesita jsdom: se stubea el `document.createElement('canvas')` con
 * un contexto 2D mínimo (solo se verifican las llamadas, no se dibuja).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { Grafico } from '../src/ui/grafico.js';

function crearGrafico() {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
  const canvas = { style: {}, getContext: () => ctx };
  const contenedor = { appendChild: vi.fn() };
  vi.stubGlobal('document', { createElement: () => canvas });
  return { grafico: new Grafico(contenedor), ctx };
}

afterEach(() => vi.unstubAllGlobals());

const datos = { plantas: 1000, herbivoros: 10, depredadores: 3 };

describe('T61 · gráfico tras regenerar el mundo (tecla R)', () => {
  it('reiniciar() descarta el historial y limpia el canvas', () => {
    const { grafico, ctx } = crearGrafico();
    grafico.registrar(0, datos);
    grafico.registrar(CONFIG.ui.graficoIntervaloTicks, datos);
    expect(grafico.cantidadMuestras).toBe(2);

    grafico.reiniciar();

    expect(grafico.cantidadMuestras).toBe(0);
    expect(grafico.muestras).toEqual([]);
    expect(grafico.indiceMuestras).toBe(0);
    expect(grafico.ultimoTick).toBe(-1);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, grafico.ancho, grafico.alto);

    // Y puede volver a registrar desde tick 0 sin perder la primera muestra.
    grafico.registrar(0, datos);
    expect(grafico.cantidadMuestras).toBe(1);
    expect(grafico.muestras[0].tick).toBe(0);
  });

  it('registrar() acepta un tick menor aunque no se llamara a reiniciar()', () => {
    const { grafico } = crearGrafico();
    const viejo = 100 * CONFIG.ui.graficoIntervaloTicks;
    grafico.registrar(viejo, datos);
    grafico.registrar(viejo + CONFIG.ui.graficoIntervaloTicks, datos);
    expect(grafico.cantidadMuestras).toBe(2);

    // Nueva simulación: el tick vuelve a 1. Sin la defensa se descartaría
    // porque 1 - 6060 < graficoIntervaloTicks.
    grafico.registrar(1, datos);

    expect(grafico.cantidadMuestras).toBe(3);
    expect(grafico.muestras[grafico.ultimoIndice()].tick).toBe(1);
  });
});
