/**
 * tests/rumbo.test.js — Regresión del bug 2 posterior a F7.5
 * ==========================================================
 *
 * El ruido de rumbo se aplica CADA TICK. Con 0.15 rad era un random walk de
 * ~60° por segundo: el animal parecía girar para todos lados sin parar.
 * Este test aísla el ruido del giro programado (ticksParaGiro) y exige que el
 * cambio de ángulo entre ticks sea pequeño para ambas especies.
 */

import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { actualizarEntidad } from '../src/systems/simulacion.js';
import { Grid } from '../src/world/grid.js';
import { CONFIG } from '../src/config.js';

/** Contexto mínimo con grilla toda tierra (sin agua que desvíe el rumbo). */
function contexto() {
  const ancho = 16;
  const alto = 16;
  const prng = new PRNG(7);
  const manager = new EntityManager();
  const ctx = crearContexto({ prng, mundo: { ancho, alto }, config: CONFIG });
  ctx.entidades = manager;
  ctx.grid = new Grid(ancho, alto);
  ctx.hash = new SpatialHash(manager, ancho, alto, CONFIG.percepcion.celdaHash);
  return { ctx, manager };
}

describe('ruido de rumbo por tick (bug 2)', () => {
  for (const [nombre, tipo] of [
    ['herbívoro', ESPECIE.HERBIVORO],
    ['carnívoro', ESPECIE.PREDADOR],
  ]) {
    it(`${nombre}: el rumbo no gira de golpe entre ticks`, () => {
      const { ctx, manager } = contexto();
      const id = manager.crear(tipo);
      manager.x[id] = 8.5;
      manager.y[id] = 8.5;
      manager.dirX[id] = 1;
      manager.dirY[id] = 0;
      // Aísla el ruido: el giro aleatorio cada 40-110 ticks no interviene.
      manager.ticksParaGiro[id] = 1e6;

      let anterior = 0;
      let maxSalto = 0;
      for (let i = 0; i < 120; i++) {
        actualizarEntidad(id, CONFIG.tiempo.pasoFijo, ctx);
        const angulo = Math.atan2(manager.dirY[id], manager.dirX[id]);
        if (i > 0) {
          const salto = Math.abs(angulo - anterior);
          maxSalto = Math.max(maxSalto, Math.min(salto, 2 * Math.PI - salto));
        }
        anterior = angulo;
      }

      // Con 0.15 rad/tick el salto podía llegar a 0.15 (8,6°).
      expect(maxSalto).toBeLessThan(0.05);
    });
  }
});
