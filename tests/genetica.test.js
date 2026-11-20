/**
 * tests/genetica.test.js — F8 · T67
 * ==================================
 *
 * Herencia mutacional de los cinco rasgos del animal. Comprueba que los genes
 * son datos SoA, que se heredan de ambos padres, que mutan solo con el PRNG de
 * la simulación y que se aplican de verdad a movimiento, consumo y celda.
 */

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { clonarConfig } from '../src/core/configUtils.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { anotarNacimiento, nacimientosDe } from '../src/systems/eventos.js';
import {
  aplicarGenesDesde,
  bufferGenes,
  CANTIDAD_GENES,
  genesDeCria,
  GEN,
  PASO_NACIMIENTO,
} from '../src/systems/genetica.js';
import { aplicarNacimientos } from '../src/systems/simulacion.js';
import { actualizarNecesidades } from '../src/systems/needs.js';
import { mover } from '../src/systems/movement.js';

/** PRNG scripted: `float()` devuelve los valores en orden. */
function prngScript(...valores) {
  let i = 0;
  return {
    float: () => valores[i++] ?? 0,
    bool: (p = 0.5) => (valores[i++] ?? 0) < p,
    int: () => 0,
  };
}

/** Contexto mínimo con la config clonada (para poder tunear mutaciones). */
function contexto(prng = new PRNG(1337), cambios = {}) {
  const config = clonarConfig(CONFIG);
  Object.assign(config.genetica, cambios);
  const ctx = crearContexto({ prng, mundo: { ancho: 16, alto: 16 }, config });
  ctx.entidades = new EntityManager();
  return ctx;
}

/** Fija los cinco genes de un id en los arrays del manager. */
function setGenes(a, id, valores) {
  a.genVelocidad[id] = valores[GEN.VELOCIDAD];
  a.genTamano[id] = valores[GEN.TAMANO];
  a.genPercepcion[id] = valores[GEN.PERCEPCION];
  a.genConsumo[id] = valores[GEN.CONSUMO];
  a.genReproduccion[id] = valores[GEN.REPRODUCCION];
}

/** Lee los cinco genes de un id en un array normal (para `toEqual`). */
function getGenes(a, id) {
  return [
    a.genVelocidad[id],
    a.genTamano[id],
    a.genPercepcion[id],
    a.genConsumo[id],
    a.genReproduccion[id],
  ];
}

/** Compara genes con tolerancia: los arrays son Float32Array (D13). */
function expectGenes(obtenidos, esperados) {
  obtenidos.forEach((valor, i) => expect(valor).toBeCloseTo(esperados[i], 5));
}

describe('T67 · almacén de genes', () => {
  it('todo individuo nace con genes neutrales y se reciclan en crear', () => {
    const a = new EntityManager();
    const id = a.crear(ESPECIE.HERBIVORO);
    expect(getGenes(a, id)).toEqual([1, 1, 1, 1, 1]);

    setGenes(a, id, [1.2, 0.9, 1.1, 0.8, 1.4]);
    a.eliminar(id);
    const reciclado = a.crear(ESPECIE.HERBIVORO);
    expect(reciclado).toBe(id);
    expect(getGenes(a, reciclado)).toEqual([1, 1, 1, 1, 1]);
  });

  it('los arrays crecen con la capacidad del manager', () => {
    const a = new EntityManager(1);
    for (let i = 0; i < 8; i++) a.crear(ESPECIE.HERBIVORO);
    expect(a.genVelocidad).toBeInstanceOf(Float32Array);
    expect(a.genTamano.length).toBeGreaterThanOrEqual(8);
    expect(a.genReproduccion.length).toBeGreaterThanOrEqual(8);
  });
});

describe('T67 · herencia y mutación', () => {
  it('sin mutación hereda el promedio de ambos padres', () => {
    const ctx = contexto(prngScript(0.9, 0.9, 0.9, 0.9, 0.9));
    const a = ctx.entidades;
    const padre = a.crear(ESPECIE.HERBIVORO);
    const madre = a.crear(ESPECIE.HERBIVORO);
    setGenes(a, padre, [1, 1, 1, 1, 1]);
    setGenes(a, madre, [1.4, 0.8, 1.2, 0.6, 1.3]);

    const genes = genesDeCria(ctx, padre, madre, bufferGenes(ctx));

    expectGenes(genes, [1.2, 0.9, 1.1, 0.8, 1.15]);
  });

  it('con mutación suma o resta el delta y nunca sale de los límites', () => {
    const ctx = contexto(prngScript(0, 0, 0, 0, 0), {
      probMutacion: 1,
      deltaMutacion: 0.5,
      maxRasgo: 1.3,
      minRasgo: 0.7,
    });
    const a = ctx.entidades;
    const padre = a.crear(ESPECIE.HERBIVORO);
    const madre = a.crear(ESPECIE.HERBIVORO);
    setGenes(a, padre, [1, 1, 1, 1, 1]);
    setGenes(a, madre, [1, 1, 1, 1, 1]);

    const genes = genesDeCria(ctx, padre, madre, bufferGenes(ctx));

    expectGenes(genes, [1.3, 1.3, 1.3, 1.3, 1.3]);

    const negativo = contexto(prngScript(0, 0.9, 0, 0.9, 0, 0.9, 0, 0.9, 0, 0.9), {
      probMutacion: 1,
      deltaMutacion: 0.5,
      minRasgo: 0.7,
    });
    const b = negativo.entidades;
    const p = b.crear(ESPECIE.HERBIVORO);
    const m = b.crear(ESPECIE.HERBIVORO);
    expectGenes(genesDeCria(negativo, p, m, bufferGenes(negativo)), [0.7, 0.7, 0.7, 0.7, 0.7]);
  });

  it('sin padres los genes son neutrales y no consumen azar', () => {
    const ctx = contexto(prngScript(0, 0, 0, 0, 0), { probMutacion: 1 });
    const genes = genesDeCria(ctx, -1, -1, bufferGenes(ctx));
    expect(Array.from(genes)).toEqual([1, 1, 1, 1, 1]);
  });

  it('el mismo PRNG da la misma descendencia', () => {
    const generar = () => {
      const ctx = contexto(new PRNG(4242));
      const a = ctx.entidades;
      const padre = a.crear(ESPECIE.HERBIVORO);
      const madre = a.crear(ESPECIE.HERBIVORO);
      setGenes(a, padre, [1.1, 1.2, 0.9, 1.3, 0.8]);
      setGenes(a, madre, [0.9, 0.8, 1.1, 0.7, 1.2]);
      return Array.from(genesDeCria(ctx, padre, madre, bufferGenes(ctx)));
    };
    expect(generar()).toEqual(generar());
  });
});

describe('T67 · aplicación al nacer', () => {
  it('el evento de nacimiento lleva 5 genes y la cría los recibe', () => {
    const ctx = contexto(prngScript(0.9, 0.9, 0.9, 0.9, 0.9));
    const a = ctx.entidades;
    const padre = a.crear(ESPECIE.HERBIVORO);
    const madre = a.crear(ESPECIE.HERBIVORO);
    setGenes(a, padre, [1, 1, 1, 1, 1]);
    setGenes(a, madre, [1.4, 0.8, 1.2, 0.6, 1.3]);

    anotarNacimiento(ctx, ESPECIE.HERBIVORO, 5, padre, madre);
    expect(nacimientosDe(ctx)).toHaveLength(PASO_NACIMIENTO);
    expect(PASO_NACIMIENTO).toBe(2 + CANTIDAD_GENES);

    expect(aplicarNacimientos(ctx)).toBe(1);
    expectGenes(getGenes(a, 2), [1.2, 0.9, 1.1, 0.8, 1.15]);
    expect(nacimientosDe(ctx)).toHaveLength(0);
  });

  it('un evento sin padres crea genes neutrales', () => {
    const ctx = contexto();
    anotarNacimiento(ctx, ESPECIE.PREDADOR, 7);
    aplicarNacimientos(ctx);
    expect(getGenes(ctx.entidades, 0)).toEqual([1, 1, 1, 1, 1]);
  });

  it('aplicarGenesDesde escribe en el offset correcto', () => {
    const a = new EntityManager();
    const id = a.crear(ESPECIE.HERBIVORO);
    aplicarGenesDesde(a, id, [0, 0, 1.1, 1.2, 1.3, 1.4, 1.5], 2);
    expectGenes(getGenes(a, id), [1.1, 1.2, 1.3, 1.4, 1.5]);
  });
});

describe('T67 · efectos en los sistemas', () => {
  it('el gen de velocidad escala el movimiento', () => {
    const ctx = contexto();
    const a = ctx.entidades;
    const id = a.crear(ESPECIE.HERBIVORO);
    a.velocidad[id] = 2;
    a.dirX[id] = 1;
    a.genVelocidad[id] = 1.5;
    mover(id, 0.5, ctx);
    expect(a.x[id]).toBeCloseTo(1.5, 6);
  });

  it('el gen de consumo escala hambre y sed', () => {
    const ctx = contexto();
    const a = ctx.entidades;
    const id = a.crear(ESPECIE.HERBIVORO);
    a.genConsumo[id] = 2;
    actualizarNecesidades(id, 1, ctx);
    expect(a.hambre[id]).toBeCloseTo(CONFIG.herbivoro.consumoHambre * 2, 6);
    expect(a.sed[id]).toBeCloseTo(CONFIG.herbivoro.consumoSed * 2, 6);
  });
});
