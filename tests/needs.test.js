/**
 * tests/needs.test.js — Sistema de necesidades (T34)
 * ===================================================
 *
 * Las necesidades son el corazón de la IA: si están mal, todo lo demás
 * está mal. Estos tests fijan las reglas del GDD §5:
 *
 *   - Hambre, sed y reproducción suben con el tiempo.
 *   - La reproducción solo sube si la entidad NO tiene hambre ni sed.
 *   - La energía baja con el metabolismo y el movimiento.
 *   - La prioridad es hambre > sed > reproducción > explorar.
 */

import { describe, it, expect } from 'vitest';
import {
  Necesidades,
  avanzarNecesidades,
  necesidadDominante,
  energiaNormalizada,
  edadNormalizada,
  configEspecie,
} from '../src/systems/needs.js';
import { CONFIG } from '../src/config.js';
import { ESTADO_IA } from '../src/entities/entity.js';

/** Entidad mínima para testear el sistema de necesidades. */
function entidadFalsa(tipo = CONFIG.tipos.herbivoro) {
  return {
    tipo,
    edad: 0,
    moviendo: false,
    necesidades: new Necesidades(),
  };
}

/** Contexto mínimo: sólo necesita la config. */
function ctxFalso() {
  return { config: CONFIG };
}

describe('sistema de necesidades', () => {
  it('las necesidades arrancan en cero y la energía en su valor inicial', () => {
    const n = new Necesidades();
    expect(n.hambre).toBe(0);
    expect(n.sed).toBe(0);
    expect(n.reproduccion).toBe(0);
    expect(n.energia).toBe(CONFIG.entidades.energiaInicial);
  });

  it('el hambre y la sed suben con el tiempo', () => {
    const e = entidadFalsa();
    const ctx = ctxFalso();
    avanzarNecesidades(e, 1, ctx);
    expect(e.necesidades.hambre).toBeGreaterThan(0);
    expect(e.necesidades.sed).toBeGreaterThan(0);
  });

  it('el hambre y la sed no pasan de 1', () => {
    const e = entidadFalsa();
    const ctx = ctxFalso();
    avanzarNecesidades(e, 10_000, ctx);
    expect(e.necesidades.hambre).toBeLessThanOrEqual(1);
    expect(e.necesidades.sed).toBeLessThanOrEqual(1);
  });

  it('la energía baja con el metabolismo', () => {
    const e = entidadFalsa();
    const antes = e.necesidades.energia;
    avanzarNecesidades(e, 1, ctxFalso());
    expect(e.necesidades.energia).toBeLessThan(antes);
  });

  it('moverse cuesta más energía que estar quieto', () => {
    const quieto = entidadFalsa();
    const moviendo = entidadFalsa();
    moviendo.moviendo = true;

    avanzarNecesidades(quieto, 1, ctxFalso());
    avanzarNecesidades(moviendo, 1, ctxFalso());

    expect(moviendo.necesidades.energia).toBeLessThan(quieto.necesidades.energia);
  });

  it('el deseo de reproducción sube solo si no hay hambre ni sed', () => {
    const e = entidadFalsa();
    const ctx = ctxFalso();

    // Con las necesidades satisfechas, sube.
    avanzarNecesidades(e, 1, ctx);
    expect(e.necesidades.reproduccion).toBeGreaterThan(0);

    // Con hambre crítica, baja (el decaimiento es gradual, no de golpe).
    e.necesidades.hambre = CONFIG.herbivoro.hambreCritica;
    e.necesidades.reproduccion = 0.5;
    avanzarNecesidades(e, 1, ctx);
    expect(e.necesidades.reproduccion).toBeLessThan(0.5);

    // Y si sigue sin comer, sigue bajando hasta cero.
    avanzarNecesidades(e, 100, ctx);
    expect(e.necesidades.reproduccion).toBe(0);
  });

  it('la prioridad es hambre > sed > reproducción > explorar', () => {
    const e = entidadFalsa();
    const ctx = ctxFalso();

    // Todo tranquilo: explorar.
    expect(necesidadDominante(e, ctx)).toBe('explorar');

    // Con deseo de reproducción: reproducirse.
    e.necesidades.reproduccion = CONFIG.herbivoro.umbralReproduccion;
    expect(necesidadDominante(e, ctx)).toBe('reproduccion');

    // Con sed crítica: la sed le gana a la reproducción.
    e.necesidades.sed = CONFIG.herbivoro.sedCritica;
    expect(necesidadDominante(e, ctx)).toBe('sed');

    // Con hambre crítica: el hambre le gana a todo.
    e.necesidades.hambre = CONFIG.herbivoro.hambreCritica;
    expect(necesidadDominante(e, ctx)).toBe('hambre');
  });

  it('cada especie lee su propia configuración', () => {
    const herb = entidadFalsa(CONFIG.tipos.herbivoro);
    const carn = entidadFalsa(CONFIG.tipos.depredador);
    expect(configEspecie(herb, ctxFalso())).toBe(CONFIG.herbivoro);
    expect(configEspecie(carn, ctxFalso())).toBe(CONFIG.depredador);
  });

  it('la energía y la edad se normalizan a [0, 1]', () => {
    const e = entidadFalsa();
    e.necesidades.energia = CONFIG.entidades.energiaMaxima / 2;
    expect(energiaNormalizada(e)).toBeCloseTo(0.5);

    e.edad = CONFIG.entidades.edadMaximaTicks / 4;
    expect(edadNormalizada(e)).toBeCloseTo(0.25);

    // Nunca se sale del rango.
    e.necesidades.energia = -50;
    expect(energiaNormalizada(e)).toBe(0);
    e.necesidades.energia = 9999;
    expect(energiaNormalizada(e)).toBe(1);
  });

  it('los estados de IA tienen nombre legible', () => {
    expect(ESTADO_IA.VAGO).toBe('vago');
    expect(ESTADO_IA.COMIENDO).toBe('comiendo');
    expect(ESTADO_IA.BEBIENDO).toBe('bebiendo');
    expect(ESTADO_IA.HUYENDO).toBe('huyendo');
    expect(ESTADO_IA.PERSIGUIENDO).toBe('persiguiendo');
    expect(ESTADO_IA.BUSCANDO_PAREJA).toBe('buscando_pareja');
  });
});
