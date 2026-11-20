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
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, repartirEdadesIniciales } from '../src/systems/simulacion.js';
import { sembrarVegetacion } from '../src/systems/plantGrowth.js';
import { generarTerreno } from '../src/world/terrain.js';
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

  const ctx = crearContexto({
    prng,
    mundo: { ancho: CONFIG.mundo.ancho, alto: CONFIG.mundo.alto },
    config: CONFIG,
  });
  ctx.entidades = manager;
  ctx.hash = new SpatialHash(
    manager,
    CONFIG.mundo.ancho,
    CONFIG.mundo.alto,
    CONFIG.percepcion.celdaHash,
  );

  sembrar(ctx, 30, ESPECIE.HERBIVORO);
  sembrar(ctx, 10, ESPECIE.PREDADOR);

  for (let i = 0; i < ticks; i++) {
    pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
  }

  return { ctx, manager };
}

/** Huella de la simulación: posición, edad y necesidades de cada entidad. */
function huella(manager) {
  const salida = [];
  for (const id of manager.vivos) {
    salida.push({
      tipo: manager.tipo[id],
      x: manager.x[id],
      y: manager.y[id],
      edad: manager.edad[id],
      hambre: manager.hambre[id],
      sed: manager.sed[id],
      deseoRepro: manager.deseoRepro[id],
      estado: manager.estado[id],
      dirX: manager.dirX[id],
      dirY: manager.dirY[id],
      genes: [
        manager.genVelocidad[id],
        manager.genTamano[id],
        manager.genPercepcion[id],
        manager.genConsumo[id],
        manager.genReproduccion[id],
      ],
    });
  }
  return salida;
}

/**
 * Arma un mundo completo (terreno + vegetación + entidades) y corre `ticks`
 * pasos: así se ejercita la IA del herbívoro de verdad (comer, beber,
 * reproducirse, morir), no solo el deambular.
 * @param {number} seed
 * @param {number} ticks
 */
function correrMundo(seed, ticks) {
  const ancho = 64;
  const alto = 64;
  const prng = new PRNG(seed);
  const manager = new EntityManager();

  const ctx = crearContexto({ prng, mundo: { ancho, alto }, config: CONFIG });
  ctx.entidades = manager;
  ctx.grid = generarTerreno({ ancho, alto, seed, config: CONFIG.terreno });
  ctx.hash = new SpatialHash(manager, ancho, alto, CONFIG.percepcion.celdaHash);

  sembrarVegetacion(ctx);
  sembrar(ctx, 30, ESPECIE.HERBIVORO);
  sembrar(ctx, 6, ESPECIE.PREDADOR);
  repartirEdadesIniciales(ctx);

  for (let i = 0; i < ticks; i++) {
    pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
  }

  return { ctx, manager };
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
    expect(manager.edad[manager.vivos[0]]).toBe(120);
    // Alguien tiene que haberse movido del punto de partida.
    const algunoSeMovio = manager.vivos.some((id) => manager.x[id] !== 0 || manager.y[id] !== 0);
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

  it('el almacén recicla: limpiar y volver a sembrar no crea ids nuevos', () => {
    const a = correrSimulacion(1337, 30);
    const creadosPrimera = a.manager.totalCreados;
    // Se liberan todas y se vuelven a sembrar: el almacén recicla los ids.
    a.manager.limpiar();
    sembrar(a.ctx, 30, ESPECIE.HERBIVORO);
    expect(a.manager.totalCreados).toBe(creadosPrimera);
  });

  it('misma seed ⇒ mismo resultado con terreno, vegetación y necesidades (T42)', () => {
    const a = correrMundo(1337, 12000);
    const b = correrMundo(1337, 12000);
    expect(huella(a.manager)).toEqual(huella(b.manager));
    expect(a.ctx.nacimientosTotales).toBe(b.ctx.nacimientosTotales);
    expect(a.ctx.muertesTotales).toBe(b.ctx.muertesTotales);
  }, 30000);

  it('con terreno las necesidades avanzan y la vida sigue (T34-T41)', () => {
    const { ctx, manager } = correrMundo(1337, 12000);
    const algunoConHambre = manager.vivos.some((id) => manager.hambre[id] > 0);
    const algunoConSed = manager.vivos.some((id) => manager.sed[id] > 0);
    expect(algunoConHambre).toBe(true);
    expect(algunoConSed).toBe(true);
    expect(ctx.nacimientosTotales).toBeGreaterThan(0);
  }, 30000);
});
