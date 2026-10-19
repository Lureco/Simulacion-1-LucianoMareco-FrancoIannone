/**
 * tests/determinismo.test.js — Determinismo de la simulación (T42)
 * ==============================================================
 *
 * REGLA DEL GDD: misma seed + mismos parámetros ⇒ misma simulación.
 * Este test corre la MISMA lógica que la pantalla (`src/systems/simulacion.js`)
 * y compara el resultado tick a tick.
 *
 * Si este test falla, la seed no reproduce nada y el entregable final
 * ("misma seed ⇒ mismo resultado, demostrado en pantalla") no se cumple.
 */

import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { Herbivore } from '../src/entities/herbivore.js';
import { Predator } from '../src/entities/predator.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar } from '../src/systems/simulacion.js';
import { CONFIG } from '../src/config.js';

/**
 * Arma una simulación completa y corre `ticks` pasos.
 * @param {number} seed
 * @param {number} ticks
 * @returns {{ctx: object, manager: EntityManager}}
 */
function correrSimulacion(seed, ticks) {
  const prng = new PRNG(seed);
  const manager = new EntityManager();
  manager.registrar(ESPECIE.HERBIVORO, () => new Herbivore());
  manager.registrar(ESPECIE.PREDADOR, () => new Predator());

  const ctx = crearContexto({
    prng,
    mundo: { ancho: CONFIG.mundo.ancho, alto: CONFIG.mundo.alto },
    config: CONFIG,
  });
  ctx.entidades = manager;
  ctx.hash = new SpatialHash(CONFIG.mundo.ancho, CONFIG.mundo.alto, CONFIG.percepcion.celdaHash);

  sembrar(ctx, 30, ESPECIE.HERBIVORO);
  sembrar(ctx, 10, ESPECIE.PREDADOR);

  for (let i = 0; i < ticks; i++) {
    pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
  }

  return { ctx, manager };
}

/** Huella de la simulación: posición, edad y energía de cada entidad. */
function huella(manager) {
  return manager.vivas.map((e) => ({
    tipo: e.tipo,
    x: e.x,
    y: e.y,
    edad: e.edad,
    energia: e.energia,
    dirX: e.dirX,
    dirY: e.dirY,
  }));
}

describe('determinismo de la simulación', () => {
  it('misma seed ⇒ resultado idéntico', () => {
    const a = correrSimulacion(1337, 300);
    const b = correrSimulacion(1337, 300);
    expect(huella(a.manager)).toEqual(huella(b.manager));
  });

  it('la simulación avanza: las entidades no quedan quietas', () => {
    const { ctx, manager } = correrSimulacion(1337, 120);
    expect(ctx.tick).toBe(120);
    expect(manager.vivas[0].edad).toBe(120);
    // Alguien tiene que haberse movido del punto de partida.
    const algunoSeMovio = manager.vivas.some((e) => e.x !== 0 || e.y !== 0);
    expect(algunoSeMovio).toBe(true);
  });

  it('seed distintas ⇒ resultados distintos', () => {
    const a = correrSimulacion(1337, 300);
    const b = correrSimulacion(9001, 300);
    expect(huella(a.manager)).not.toEqual(huella(b.manager));
  });

  it('el hash espacial queda sincronizado con la población', () => {
    const { ctx, manager } = correrSimulacion(1337, 60);
    expect(ctx.hash.total).toBe(manager.total);
  });

  it('el pool recycle: correr y reciclar no crea objetos nuevos', () => {
    const a = correrSimulacion(1337, 30);
    const creadosPrimera = a.manager.pool.totalCreados;
    // Se liberan todas y se vuelven a sembrar: el pool las recicla.
    a.manager.limpiar();
    sembrar(a.ctx, 30, ESPECIE.HERBIVORO);
    expect(a.manager.pool.totalCreados).toBe(creadosPrimera);
  });
});
