/**
 * tests/separacion.test.js — Separación estilo boids
 * ==================================================
 * Un bicho ajusta su rumbo para no amontonarse con los de su especie. La
 * separación es un steering: no cambia la velocidad, no detiene a nadie y no
 * consume azar (la seed sigue reproduciendo la misma simulación).
 */

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { aplicarSeparacion } from '../src/systems/separacion.js';
import { mover } from '../src/systems/movement.js';

const ANCHO = 32;
const ALTO = 32;

/**
 * Config explícita para las pruebas geométricas: los radios/fuerzas son tuneo
 * de `CONFIG` y pueden cambiar, así que los tests no deben depender de ellos.
 */
const CONFIG_PRUEBA = structuredClone(CONFIG);
CONFIG_PRUEBA.percepcion.radioSeparacion = 1.6;

/** Contexto mínimo con hash, como el que arma el bucle de simulación. */
function contexto(config = CONFIG) {
  const entidades = new EntityManager();
  const ctx = crearContexto({
    prng: new PRNG(1),
    mundo: { ancho: ANCHO, alto: ALTO },
    config,
  });
  ctx.entidades = entidades;
  ctx.hash = new SpatialHash(entidades, ANCHO, ALTO, config.percepcion.celdaHash);
  return { ctx, entidades };
}

/** Dos bichos en (10, 10) y (10.7, 10), ambos mirando al este. */
function parVecinos(tipoVecino = ESPECIE.HERBIVORO) {
  const { ctx, entidades } = contexto(CONFIG_PRUEBA);
  const a = entidades.crear(ESPECIE.HERBIVORO);
  const b = entidades.crear(tipoVecino);
  entidades.x[a] = 10;
  entidades.y[a] = 10;
  entidades.x[b] = 10.7;
  entidades.y[b] = 10;
  entidades.dirX[a] = 1;
  entidades.dirY[a] = 0;
  entidades.dirX[b] = 1;
  entidades.dirY[b] = 0;
  ctx.hash.reconstruir();
  return { ctx, entidades, a, b };
}

describe('separación estilo boids', () => {
  it('un vecino muy cercano puede invertir el rumbo', () => {
    const { ctx, entidades, a } = parVecinos();
    aplicarSeparacion(a, ctx);
    expect(entidades.dirX[a]).toBeLessThan(0);
    expect(Math.abs(entidades.dirY[a])).toBeLessThan(1e-6);
  });

  it('un vecino dentro del radio pero lejano solo inclina el rumbo', () => {
    const { ctx, entidades, a, b } = parVecinos();
    entidades.x[b] = 11;
    entidades.y[b] = 10.7;
    ctx.hash.reconstruir();

    aplicarSeparacion(a, ctx);
    expect(entidades.dirX[a]).toBeGreaterThan(0.5);
    expect(entidades.dirY[a]).toBeLessThan(-0.2);
  });

  it('no separa de otra especie', () => {
    const { ctx, entidades, a } = parVecinos(ESPECIE.PREDADOR);
    aplicarSeparacion(a, ctx);
    expect(entidades.dirX[a]).toBe(1);
    expect(entidades.dirY[a]).toBe(0);
  });

  it('ignora vecinos muertos o ya anotados para morir', () => {
    const muerto = parVecinos();
    muerto.entidades.vivo[muerto.b] = 0;
    aplicarSeparacion(muerto.a, muerto.ctx);
    expect(muerto.entidades.dirX[muerto.a]).toBe(1);

    const moribundo = parVecinos();
    moribundo.entidades.moribundo[moribundo.b] = 1;
    aplicarSeparacion(moribundo.a, moribundo.ctx);
    expect(moribundo.entidades.dirX[moribundo.a]).toBe(1);
  });

  it('no empuja a quien está detenido comiendo o bebiendo', () => {
    const { ctx, entidades, a } = parVecinos();
    entidades.dirX[a] = 0;
    entidades.dirY[a] = 0;
    aplicarSeparacion(a, ctx);
    expect(entidades.dirX[a]).toBe(0);
    expect(entidades.dirY[a]).toBe(0);
  });

  it('sin hash (o con la separación en 0) el rumbo queda intacto', () => {
    const sinHash = parVecinos();
    sinHash.ctx.hash = null;
    aplicarSeparacion(sinHash.a, sinHash.ctx);
    expect(sinHash.entidades.dirX[sinHash.a]).toBe(1);

    const config = structuredClone(CONFIG);
    config.percepcion.fuerzaSeparacion = 0;
    const { ctx, entidades } = contexto(config);
    const id = entidades.crear(ESPECIE.HERBIVORO);
    const otro = entidades.crear(ESPECIE.HERBIVORO);
    entidades.dirX[id] = 1;
    entidades.x[otro] = 10.2;
    ctx.hash.reconstruir();
    aplicarSeparacion(id, ctx);
    expect(entidades.dirX[id]).toBe(1);
  });

  it('no consume azar', () => {
    const { ctx, a } = parVecinos();
    const testigo = new PRNG(1);
    aplicarSeparacion(a, ctx);
    expect(ctx.prng.float()).toBe(testigo.float());
  });

  it('dos bichos que se acercan dejan de superponerse', () => {
    /** Distancia mínima alcanzada por dos bichos que caminan el uno al otro. */
    function distanciaMinima(fuerzaSeparacion) {
      const config = structuredClone(CONFIG);
      config.percepcion.fuerzaSeparacion = fuerzaSeparacion;
      const { ctx, entidades } = contexto(config);
      const a = entidades.crear(ESPECIE.HERBIVORO);
      const b = entidades.crear(ESPECIE.HERBIVORO);
      entidades.x[a] = 10;
      entidades.y[a] = 10;
      entidades.x[b] = 11.2;
      entidades.y[b] = 10;
      entidades.dirX[a] = 1;
      entidades.dirX[b] = -1;
      entidades.velocidad[a] = 1.2;
      entidades.velocidad[b] = 1.2;
      ctx.hash.reconstruir();

      let minima = Infinity;
      for (let tick = 0; tick < 60; tick++) {
        aplicarSeparacion(a, ctx);
        aplicarSeparacion(b, ctx);
        mover(a, CONFIG.tiempo.pasoFijo, ctx);
        mover(b, CONFIG.tiempo.pasoFijo, ctx);
        ctx.hash.reconstruir();
        minima = Math.min(minima, Math.abs(entidades.x[b] - entidades.x[a]));
      }
      return minima;
    }

    expect(distanciaMinima(CONFIG.percepcion.fuerzaSeparacion)).toBeGreaterThan(
      distanciaMinima(0) + 0.3,
    );
  });
});
