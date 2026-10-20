/**
 * scripts/depurarSed.mjs — Diagnóstico de las necesidades de una entidad
 * ====================================================================
 *
 * Sigue a un herbívoro tick a tick e imprime su estado. Sirve para
 * entender por qué una entidad no come, no bebe o muere.
 *
 * Uso: `node scripts/depurarSed.mjs [seed] [indice] [segundos]`
 */

import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { Herbivore } from '../src/entities/herbivore.js';
import { Predator } from '../src/entities/predator.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, prepararMundo } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import { sembrarVegetacion } from '../src/systems/plantGrowth.js';
import { CONFIG } from '../src/config.js';

const seed = Number(process.argv[2] ?? 1337);
const indice = Number(process.argv[3] ?? 0);
const segundos = Number(process.argv[4] ?? 90);

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
ctx.grid = generarTerreno({
  ancho: CONFIG.mundo.ancho,
  alto: CONFIG.mundo.alto,
  seed,
  config: CONFIG.terreno,
});
prepararMundo(ctx);
sembrarVegetacion(ctx);
sembrar(ctx, 60, ESPECIE.HERBIVORO);
sembrar(ctx, 12, ESPECIE.PREDADOR);

const objetivo = manager.deTipo(ESPECIE.HERBIVORO)[indice];
console.log(`siguiendo herbívoro #${indice} · seed ${seed}`);
console.log('t    | estado       | hambre | sed   | energia | pos           | objAgua');

const dt = CONFIG.tiempo.pasoFijo;
const ticks = Math.round(segundos / dt);
for (let t = 0; t < ticks; t++) {
  pasoDeSimulacion(ctx, dt);

  if (objetivo.vivo && t % 30 === 0) {
    const n = objetivo.necesidades;
    console.log(
      [
        (t * dt).toFixed(0).padStart(4),
        objetivo.estado.padEnd(12),
        n.hambre.toFixed(2).padStart(6),
        n.sed.toFixed(2).padStart(5),
        n.energia.toFixed(1).padStart(7),
        `${objetivo.celdaX},${objetivo.celdaY}`.padEnd(13),
        `${objetivo.objetivoAguaX},${objetivo.objetivoAguaY}`,
      ].join(' | '),
    );
  }
  if (!objetivo.vivo) {
    console.log(`\n*** murió en el segundo ${(t * dt).toFixed(1)} ***`);
    break;
  }
}
