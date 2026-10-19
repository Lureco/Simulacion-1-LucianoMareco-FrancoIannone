/**
 * tests/terreno.test.js — Determinismo y forma del mundo procedural (T14)
 * ======================================================================
 *
 * REGLA DEL GDD (T14): misma seed ⇒ mapa idéntico celda a celda.
 * Y el mapa tiene que tener las tres clases de terreno, con masas de agua
 * reales y no un tablero de ajedrez.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { fbm2D, valueNoise2D } from '../src/core/noise.js';
import { generarTerreno, celdaHabitableAlAzar } from '../src/world/terrain.js';
import { Grid } from '../src/world/grid.js';
import { TERRENO } from '../src/world/cell.js';

/** Genera un mapa chico para los tests (rápido, no requiere 256×256). */
function mapa(seed, ancho = 96, alto = 96) {
  return generarTerreno({ ancho, alto, seed, config: CONFIG.terreno });
}

describe('ruido con semilla', () => {
  it('value noise es determinista para la misma (x, y, seed)', () => {
    expect(valueNoise2D(10.3, 4.7, 1337)).toBe(valueNoise2D(10.3, 4.7, 1337));
  });

  it('value noise queda en [0, 1]', () => {
    for (let i = 0; i < 500; i++) {
      const v = valueNoise2D(i * 0.37, i * 0.61, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('fbm queda en [0, 1] y seeds distintas dan mapas distintos', () => {
    const a = fbm2D(5.5, 9.1, 1337, { frecuencia: 0.02, octavas: 4 });
    const b = fbm2D(5.5, 9.1, 9001, { frecuencia: 0.02, octavas: 4 });
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
    expect(a).not.toBe(b);
  });
});

describe('determinismo del terreno', () => {
  it('misma seed ⇒ mapa idéntico celda a celda', () => {
    const a = mapa(1337);
    const b = mapa(1337);
    expect(a.terreno).toEqual(b.terreno);
    expect(a.altura).toEqual(b.altura);
  });

  it('seeds distintas ⇒ mapas distintos', () => {
    const a = mapa(1337);
    const b = mapa(9001);
    expect(a.terreno).not.toEqual(b.terreno);
  });

  it('la grilla se llena entera (ninguna celda sin clasificar)', () => {
    const grid = mapa(1337);
    const { agua, arena, tierra } = grid.contarTerreno();
    expect(agua + arena + tierra).toBe(grid.total);
  });
});

describe('forma del mundo', () => {
  it('hay las tres clases de terreno (agua, arena y tierra)', () => {
    const grid = mapa(1337);
    const { agua, arena, tierra } = grid.contarTerreno();
    expect(agua).toBeGreaterThan(0);
    expect(arena).toBeGreaterThan(0);
    expect(tierra).toBeGreaterThan(0);
  });

  it('ninguna clase domina por completo el mapa', () => {
    const grid = mapa(1337);
    const { agua, tierra } = grid.contarTerreno();
    const proporcionAgua = agua / grid.total;
    const proporcionTierra = tierra / grid.total;
    expect(proporcionAgua).toBeGreaterThan(0.05);
    expect(proporcionTierra).toBeGreaterThan(0.2);
  });

  it('el agua forma masas contiguas, no ruido salteado', () => {
    // Promedio de vecinos de agua de cada celda de agua: cerca de 1 si el
    // agua está agrupada, cerca de 0.25 si está dispersa como sal y pimienta.
    const grid = mapa(777);
    let celdasAgua = 0;
    let sumaVecinosAgua = 0;
    for (let y = 1; y < grid.alto - 1; y++) {
      for (let x = 1; x < grid.ancho - 1; x++) {
        if (!grid.esAgua(x, y)) continue;
        celdasAgua++;
        let vecinos = 0;
        if (grid.esAgua(x - 1, y)) vecinos++;
        if (grid.esAgua(x + 1, y)) vecinos++;
        if (grid.esAgua(x, y - 1)) vecinos++;
        if (grid.esAgua(x, y + 1)) vecinos++;
        sumaVecinosAgua += vecinos;
      }
    }
    expect(celdasAgua).toBeGreaterThan(0);
    const promedioVecinos = sumaVecinosAgua / celdasAgua;
    expect(promedioVecinos).toBeGreaterThan(2.5);
  });

  it('los umbrales clasifican la altura como corresponde', () => {
    const grid = mapa(2024);
    for (let i = 0; i < grid.total; i++) {
      const altura = grid.altura[i];
      const tipo = grid.terreno[i];
      if (altura < CONFIG.terreno.umbralAgua) expect(tipo).toBe(TERRENO.AGUA);
      else if (altura < CONFIG.terreno.umbralArena) expect(tipo).toBe(TERRENO.ARENA);
      else expect(tipo).toBe(TERRENO.TIERRA);
    }
  });

  it('la caída de borde hunde las esquinas a agua', () => {
    // Con `caidaBorde > 0` las cuatro esquinas son agua (isla).
    const grid = mapa(1337);
    expect(grid.esAgua(0, 0)).toBe(true);
    expect(grid.esAgua(grid.ancho - 1, 0)).toBe(true);
    expect(grid.esAgua(0, grid.alto - 1)).toBe(true);
    expect(grid.esAgua(grid.ancho - 1, grid.alto - 1)).toBe(true);
  });
});

describe('grilla', () => {
  it('las capas son typed arrays del tamaño del mundo', () => {
    const grid = new Grid(16, 8);
    expect(grid.terreno).toBeInstanceOf(Uint8Array);
    expect(grid.planta).toBeInstanceOf(Uint8Array);
    expect(grid.ocupante).toBeInstanceOf(Int32Array);
    expect(grid.altura).toBeInstanceOf(Float32Array);
    expect(grid.terreno.length).toBe(128);
  });

  it('las celdas arrancan libres y se pueden ocupar y liberar', () => {
    const grid = new Grid(8, 8);
    expect(grid.estaLibre(3, 3)).toBe(true);
    expect(grid.ocupar(3, 3, 7)).toBe(true);
    expect(grid.estaLibre(3, 3)).toBe(false);
    expect(grid.ocupar(3, 3, 9)).toBe(false); // ya está ocupada
    expect(grid.liberar(3, 3, 9)).toBe(false); // el id no coincide
    expect(grid.liberar(3, 3, 7)).toBe(true);
    expect(grid.estaLibre(3, 3)).toBe(true);
  });

  it('fuera del mundo no está libre y el terreno es agua', () => {
    const grid = new Grid(8, 8);
    expect(grid.estaLibre(-1, 0)).toBe(false);
    expect(grid.estaLibre(8, 0)).toBe(false);
    expect(grid.esAgua(-1, 0)).toBe(true);
    expect(grid.esAgua(8, 8)).toBe(true);
  });
});

describe('siembra sobre el terreno', () => {
  it('siembra en celdas de tierra', () => {
    const prng = new PRNG(1337);
    const ctx = crearContexto({
      prng,
      mundo: { ancho: 96, alto: 96 },
      config: CONFIG,
    });
    ctx.grid = mapa(1337);

    for (let i = 0; i < 200; i++) {
      const { x, y } = celdaHabitableAlAzar(ctx);
      expect(ctx.grid.esTierra(Math.floor(x), Math.floor(y))).toBe(true);
    }
  });

  it('sin grilla siembra igual (mundo vacío para los tests de entidades)', () => {
    const prng = new PRNG(1337);
    const ctx = crearContexto({ prng, mundo: { ancho: 96, alto: 96 }, config: CONFIG });
    const { x, y } = celdaHabitableAlAzar(ctx);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(95);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(95);
  });
});
