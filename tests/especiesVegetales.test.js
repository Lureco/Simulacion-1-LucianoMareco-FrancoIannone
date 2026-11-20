/**
 * tests/especiesVegetales.test.js — F8 · T65/T66
 * ==============================================
 *
 * Dos especies vegetales sobre la MISMA grilla tipada: pasto y micelio, con
 * reglas de expansión distintas y competencia territorial (el micelio puede
 * desplazar al pasto). Todo el azar sigue saliendo del PRNG.
 */

import { describe, expect, it } from 'vitest';
import { Texture, Rectangle } from 'pixi.js';
import { CONFIG } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { Grid } from '../src/world/grid.js';
import { ESPECIE_PLANTA, PLANTA, TERRENO } from '../src/world/cell.js';
import {
  contarPlantasPorEspecie,
  pasoVegetacion,
  sembrarVegetacion,
} from '../src/systems/plantGrowth.js';
import { clavesBase, framePlanta } from '../src/render/atlasDatos.js';
import { PlantRenderer } from '../src/render/plantRenderer.js';

/** Contexto chico con reglas base y los overrides que pida el test. */
function contexto(cfgPlantas = {}, prng = new PRNG(1337), ancho = 8, alto = 8) {
  const config = {
    ...CONFIG,
    plantas: { ...CONFIG.plantas, probExpansion: 0, ...cfgPlantas },
  };
  const ctx = crearContexto({ prng, mundo: { ancho, alto }, config });
  ctx.grid = new Grid(ancho, alto);
  return ctx;
}

describe('T65 · capa de especie vegetal', () => {
  it('la grilla reserva una capa Uint8Array paralela a planta', () => {
    const grid = new Grid(4, 4);
    expect(grid.especiePlanta).toBeInstanceOf(Uint8Array);
    expect(grid.especiePlanta).toHaveLength(grid.total);
    expect(grid.especiePlanta.every((e) => e === ESPECIE_PLANTA.PASTO)).toBe(true);
  });

  it('la siembra inicial respeta la fracción de micelio y es determinista', () => {
    const a = contexto({ fraccionMicelio: 0.5 });
    const b = contexto({ fraccionMicelio: 0.5 });
    sembrarVegetacion(a, 40);
    sembrarVegetacion(b, 40);

    expect(Array.from(a.grid.especiePlanta)).toEqual(Array.from(b.grid.especiePlanta));
    const conteo = contarPlantasPorEspecie(a);
    expect(conteo.pasto + conteo.micelio).toBe(40);
    expect(conteo.micelio).toBeGreaterThan(0);
    expect(conteo.pasto).toBeGreaterThan(0);
  });

  it('fracción 0 y 1 siembran una sola especie', () => {
    const pasto = contexto({ fraccionMicelio: 0 });
    sembrarVegetacion(pasto, 20);
    expect(contarPlantasPorEspecie(pasto).micelio).toBe(0);

    const micelio = contexto({ fraccionMicelio: 1 });
    sembrarVegetacion(micelio, 20);
    expect(contarPlantasPorEspecie(micelio).pasto).toBe(0);
  });
});

describe('T65 · reglas de crecimiento por especie', () => {
  it('cada especie puede tener su propio tiempo de maduración', () => {
    const ctx = contexto({
      ticksSemillaAJoven: 1,
      especies: {
        [ESPECIE_PLANTA.PASTO]: {},
        [ESPECIE_PLANTA.MICELIO]: { ticksSemillaAJoven: 5 },
      },
    });
    const pasto = ctx.grid.indice(1, 1);
    const micelio = ctx.grid.indice(6, 6);
    ctx.grid.planta[pasto] = PLANTA.SEMILLA;
    ctx.grid.planta[micelio] = PLANTA.SEMILLA;
    ctx.grid.especiePlanta[micelio] = ESPECIE_PLANTA.MICELIO;

    pasoVegetacion(ctx);

    expect(ctx.grid.planta[pasto]).toBe(PLANTA.JOVEN);
    expect(ctx.grid.planta[micelio]).toBe(PLANTA.SEMILLA);
  });
});

describe('T66 · competencia territorial', () => {
  /** PRNG fijo: siempre intenta expandirse, siempre arranca por el vecino 0. */
  const seguro = { float: () => 0, int: () => 0 };

  it('el micelio desplaza al pasto vecino y lo cuenta', () => {
    const ctx = contexto(
      {
        probExpansion: 1,
        especies: {
          [ESPECIE_PLANTA.PASTO]: { probExpansion: 0 },
          [ESPECIE_PLANTA.MICELIO]: { probExpansion: 1, probDesplazamiento: 1 },
        },
      },
      seguro,
      3,
      3,
    );
    const micelio = ctx.grid.indice(0, 1);
    const pasto = ctx.grid.indice(1, 1);
    // Sin celdas libres alrededor del micelio: solo puede desplazar al pasto.
    ctx.grid.terreno[ctx.grid.indice(0, 0)] = TERRENO.AGUA;
    ctx.grid.planta[ctx.grid.indice(0, 2)] = PLANTA.ADULTA;
    ctx.grid.planta[micelio] = PLANTA.ADULTA;
    ctx.grid.especiePlanta[micelio] = ESPECIE_PLANTA.MICELIO;
    ctx.grid.planta[pasto] = PLANTA.ADULTA;

    const nacidos = pasoVegetacion(ctx);

    expect(ctx.grid.planta[pasto]).toBe(PLANTA.SEMILLA);
    expect(ctx.grid.especiePlanta[pasto]).toBe(ESPECIE_PLANTA.MICELIO);
    expect(ctx.desplazamientos).toBe(1);
    expect(nacidos).toBe(1);
    expect(contarPlantasPorEspecie(ctx).pasto).toBe(1);
    expect(contarPlantasPorEspecie(ctx).micelio).toBe(2);
  });

  it('el pasto nunca desplaza al micelio', () => {
    const ctx = contexto({ probExpansion: 1 }, seguro, 3, 3);
    const pasto = ctx.grid.indice(0, 1);
    const micelio = ctx.grid.indice(1, 1);
    ctx.grid.planta[pasto] = PLANTA.ADULTA;
    ctx.grid.planta[micelio] = PLANTA.ADULTA;
    ctx.grid.especiePlanta[micelio] = ESPECIE_PLANTA.MICELIO;

    pasoVegetacion(ctx);

    expect(ctx.grid.especiePlanta[micelio]).toBe(ESPECIE_PLANTA.MICELIO);
    expect(ctx.desplazamientos ?? 0).toBe(0);
  });

  it('sin probabilidad de desplazamiento el pasto sobrevive', () => {
    const ctx = contexto(
      {
        probExpansion: 1,
        especies: {
          [ESPECIE_PLANTA.PASTO]: {},
          [ESPECIE_PLANTA.MICELIO]: { probExpansion: 1, probDesplazamiento: 0 },
        },
      },
      seguro,
      3,
      3,
    );
    const micelio = ctx.grid.indice(0, 1);
    const pasto = ctx.grid.indice(1, 1);
    ctx.grid.planta[micelio] = PLANTA.ADULTA;
    ctx.grid.especiePlanta[micelio] = ESPECIE_PLANTA.MICELIO;
    ctx.grid.planta[pasto] = PLANTA.ADULTA;

    pasoVegetacion(ctx);

    expect(ctx.grid.especiePlanta[pasto]).toBe(ESPECIE_PLANTA.PASTO);
    expect(ctx.desplazamientos ?? 0).toBe(0);
  });
});

describe('T65 · representación del micelio', () => {
  it('el atlas reserva un frame propio por estado y el renderer lo elige', () => {
    const clave = framePlanta(PLANTA.ADULTA, ESPECIE_PLANTA.MICELIO);
    expect(clave).not.toBe(framePlanta(PLANTA.ADULTA, ESPECIE_PLANTA.PASTO));
    expect(clavesBase()).toContain(clave);

    const frames = new Map();
    for (const c of clavesBase()) {
      frames.set(
        c,
        new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 64, 64) }),
      );
    }
    const atlas = { textura: Texture.EMPTY, frames };
    const renderer = new PlantRenderer(null, { atlas, tileSize: 8, capacidad: 4 });
    const grid = {
      ancho: 2,
      alto: 1,
      total: 2,
      planta: new Uint8Array([PLANTA.ADULTA, PLANTA.ADULTA]),
      especiePlanta: new Uint8Array([ESPECIE_PLANTA.PASTO, ESPECIE_PLANTA.MICELIO]),
    };
    renderer.reconstruir(grid, 0, 10, {
      x: 8,
      y: 4,
      zoom: 1,
      vistaAnchoPx: 32,
      vistaAltoPx: 32,
    });

    const usadas = renderer.contenedor.particleChildren.map((p) => p.texture);
    expect(usadas).toContain(frames.get(framePlanta(PLANTA.ADULTA, ESPECIE_PLANTA.PASTO)));
    expect(usadas).toContain(frames.get(clave));
  });
});
