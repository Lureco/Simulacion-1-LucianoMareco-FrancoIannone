/**
 * tests/distanciaAgua.test.js — Checkbox de la franja alrededor del agua
 * =====================================================================
 * `CONFIG.percepcion.mantenerDistanciaAgua` desactiva el ajuste de rumbo que
 * mantiene a los animales a `distanciaOrilla` celdas de la orilla (T38), sin
 * quitarles la bebida cuando la sed es crítica.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { Herbivoro } from '../src/entities/herbivore.js';
import { Depredador } from '../src/entities/predator.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { Grid } from '../src/world/grid.js';
import { TERRENO } from '../src/world/cell.js';

const ANCHO = 8;
const ALTO = 8;

/** Grilla con agua en x=0 y campo de distancias `aguaDist = x`. */
function contexto(mantenerDistanciaAgua) {
  const config = structuredClone(CONFIG);
  config.percepcion.mantenerDistanciaAgua = mantenerDistanciaAgua;
  config.herbivoro.ruidoRumbo = 0;
  config.depredador.ruidoRumbo = 0;

  const entidades = new EntityManager();
  const ctx = crearContexto({ prng: new PRNG(1), mundo: { ancho: ANCHO, alto: ALTO }, config });
  ctx.entidades = entidades;
  ctx.grid = new Grid(ANCHO, ALTO);
  ctx.hash = new SpatialHash(entidades, ANCHO, ALTO, config.percepcion.celdaHash);
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      ctx.grid.aguaDist[y * ANCHO + x] = x;
    }
  }
  return { ctx, entidades };
}

/** Bicho en (3.5, 2.5) mirando al norte, con el giro aleatorio neutralizado. */
function bicho(ctx, entidades, tipo) {
  const id = entidades.crear(tipo);
  entidades.x[id] = 3.5; // aguaDist = 3, menos que distanciaOrilla (10)
  entidades.y[id] = 2.5;
  entidades.dirX[id] = 0;
  entidades.dirY[id] = 1;
  entidades.ticksParaGiro[id] = 1e6;
  return id;
}

describe('checkbox mantenerDistanciaAgua (T38)', () => {
  for (const [nombre, tipo, especie] of [
    ['herbívoro', ESPECIE.HERBIVORO, new Herbivoro()],
    ['depredador', ESPECIE.PREDADOR, new Depredador()],
  ]) {
    it(`${nombre}: activado corrige el rumbo hacia afuera del agua`, () => {
      const { ctx, entidades } = contexto(true);
      const id = bicho(ctx, entidades, tipo);

      especie.pensar(id, CONFIG.tiempo.pasoFijo, ctx);

      expect(entidades.dirX[id]).toBeGreaterThan(0.9);
      expect(entidades.dirY[id]).toBeCloseTo(0, 6);
    });

    it(`${nombre}: desactivado deja el rumbo del wander`, () => {
      const { ctx, entidades } = contexto(false);
      const id = bicho(ctx, entidades, tipo);

      especie.pensar(id, CONFIG.tiempo.pasoFijo, ctx);

      expect(entidades.dirX[id]).toBe(0);
      expect(entidades.dirY[id]).toBe(1);
    });
  }

  it('con la franja desactivada la sed crítica sigue yendo a beber', () => {
    const { ctx, entidades } = contexto(false);
    const id = bicho(ctx, entidades, ESPECIE.HERBIVORO);
    ctx.grid.terreno[ctx.grid.indice(3, 2)] = TERRENO.AGUA;
    entidades.sed[id] = 0.9;

    new Herbivoro().pensar(id, CONFIG.tiempo.pasoFijo, ctx);

    expect(entidades.estado[id]).toBe(ESTADO_IA.BEBIENDO);
    expect(entidades.sed[id]).toBe(0);
  });
});
