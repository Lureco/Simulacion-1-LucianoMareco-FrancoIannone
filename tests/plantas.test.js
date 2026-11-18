/**
 * tests/plantas.test.js — Crecimiento y muerte de plantas (F3 · T28/T30)
 * ======================================================================
 *
 * Cubre la muerte por edad: una planta ADULTA vive `ticksVidaAdulta` ticks
 * contados desde que llega a adulta, y después pasa a MUERTA. También guarda
 * que la capa de edad sirva para vidas de más de 255 ticks.
 *
 * La grilla de prueba es toda tierra y sin expansión, así una celda no se ve
 * afectada por las vecinas.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { Grid } from '../src/world/grid.js';
import { PLANTA } from '../src/world/cell.js';
import { pasoVegetacion } from '../src/systems/plantGrowth.js';

/**
 * @param {object} [configPlantas] Parámetros a overridear de `CONFIG.plantas`.
 */
function contextoConPlantas(configPlantas = {}) {
  const ancho = 8;
  const alto = 8;
  const config = {
    ...CONFIG,
    plantas: { ...CONFIG.plantas, probExpansion: 0, ...configPlantas },
  };
  const ctx = crearContexto({
    prng: new PRNG(1337),
    mundo: { ancho, alto },
    config,
  });
  ctx.grid = new Grid(ancho, alto);
  return ctx;
}

describe('muerte de plantas por edad (T30)', () => {
  it('la adulta vive ticksVidaAdulta ticks y después muere', () => {
    const ctx = contextoConPlantas({ ticksVidaAdulta: 5 });
    const i = ctx.grid.indice(4, 4);
    ctx.grid.planta[i] = PLANTA.ADULTA;

    for (let t = 0; t < 4; t++) pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.ADULTA);

    pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.MUERTA);

    // La materia muerta se descompone al tick siguiente.
    pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.NADA);
  });

  it('la edad se cuenta desde adulta, no desde la semilla', () => {
    const ctx = contextoConPlantas({
      ticksSemillaAJoven: 2,
      ticksJovenAAdulta: 2,
      ticksVidaAdulta: 5,
    });
    const i = ctx.grid.indice(4, 4);
    ctx.grid.planta[i] = PLANTA.SEMILLA;

    for (let t = 0; t < 2; t++) pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.JOVEN);

    for (let t = 0; t < 2; t++) pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.ADULTA);

    // Lleva 4 ticks simulados, pero recién 4 de adulta: sigue viva.
    for (let t = 0; t < 4; t++) pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.ADULTA);

    pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.MUERTA);
  });

  it('la capa de edad no desborda con vidas de más de 255 ticks', () => {
    const ctx = contextoConPlantas({ ticksSemillaAJoven: 300 });
    const i = ctx.grid.indice(4, 4);
    ctx.grid.planta[i] = PLANTA.SEMILLA;

    for (let t = 0; t < 299; t++) pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.SEMILLA);

    pasoVegetacion(ctx);
    expect(ctx.grid.planta[i]).toBe(PLANTA.JOVEN);
  });
});

describe('expansión vegetal sin semillas duplicadas (T61)', () => {
  it('dos adultas que apuntan a la misma vecina cuentan dos semillas reales', () => {
    // PRNG stub: siempre intenta expandirse y siempre arranca por el vecino 0.
    // En una grilla 3×3, las adultas de (0,1) y (2,1) apuntan primero a (1,1).
    // Sin reserva inmediata, la segunda escribe la MISMA celda y el contador
    // reporta 2 nacimientos aunque en el mapa solo aparezca 1 semilla.
    const prng = { float: () => 0, int: () => 0 };
    const config = {
      ...CONFIG,
      plantas: { ...CONFIG.plantas, probExpansion: 1, ticksVidaAdulta: 100 },
    };
    const ctx = crearContexto({ prng, mundo: { ancho: 3, alto: 3 }, config });
    ctx.grid = new Grid(3, 3); // toda tierra por defecto
    ctx.grid.planta[ctx.grid.indice(0, 1)] = PLANTA.ADULTA;
    ctx.grid.planta[ctx.grid.indice(2, 1)] = PLANTA.ADULTA;

    const antes = Array.from(ctx.grid.planta).filter((p) => p === PLANTA.SEMILLA).length;
    const nacimientos = pasoVegetacion(ctx);
    const despues = Array.from(ctx.grid.planta).filter((p) => p === PLANTA.SEMILLA).length;

    expect(nacimientos).toBe(2);
    expect(despues - antes).toBe(nacimientos);
  });
});
