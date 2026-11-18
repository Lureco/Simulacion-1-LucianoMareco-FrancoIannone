import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, repartirEdadesIniciales } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import { sembrarVegetacion, contarPlantas } from '../src/systems/plantGrowth.js';
import { CONFIG } from '../src/config.js';

const seed = Number(process.argv[2] ?? CONFIG.mundo.seedPorDefecto);
const minutos = Number(process.argv[3] ?? 10);
const ticks = Math.round(minutos * 60 * 60);

const prng = new PRNG(seed);
const manager = new EntityManager();
const ctx = crearContexto({
  prng,
  mundo: { ancho: CONFIG.mundo.ancho, alto: CONFIG.mundo.alto },
  config: CONFIG,
});
ctx.entidades = manager;
ctx.grid = generarTerreno({
  ancho: CONFIG.mundo.ancho,
  alto: CONFIG.mundo.alto,
  seed,
  config: CONFIG.terreno,
});
ctx.hash = new SpatialHash(
  manager,
  CONFIG.mundo.ancho,
  CONFIG.mundo.alto,
  CONFIG.percepcion.celdaHash,
);
sembrarVegetacion(ctx);
sembrar(ctx, CONFIG.herbivoro.poblacionInicial, ESPECIE.HERBIVORO);
sembrar(ctx, CONFIG.depredador.poblacionInicial, ESPECIE.PREDADOR);
repartirEdadesIniciales(ctx);

console.log(`seed ${seed} · ${minutos} min · terreno ${JSON.stringify(ctx.grid.contarTerreno())}`);
const t0 = performance.now();
for (let t = 1; t <= ticks; t++) {
  pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
  if (t % (60 * 60) === 0) {
    let sumaE = 0;
    let minE = Infinity;
    let enAgua = 0;
    let comiendo = 0;
    for (const id of manager.vivos) {
      sumaE += manager.energia[id];
      if (manager.energia[id] < minE) minE = manager.energia[id];
      if (ctx.grid.terrenoEn(manager.celdaX(id), manager.celdaY(id)) === 0) enAgua++;
      if (manager.estado[id] === 1) comiendo++;
    }
    const n = manager.vivos.length || 1;
    console.log(
      `min ${String(t / 3600).padStart(3)}: herb ${String(manager.contar(ESPECIE.HERBIVORO)).padStart(5)}` +
        ` · pred ${String(manager.contar(ESPECIE.PREDADOR)).padStart(4)}` +
        ` · plantas ${String(contarPlantas(ctx)).padStart(6)}` +
        ` · nac ${String(ctx.nacimientosTotales).padStart(5)}` +
        ` · mue ${String(ctx.muertesTotales).padStart(5)}` +
        ` (h${ctx.muertesPorCausa.hambre} s${ctx.muertesPorCausa.sed} v${ctx.muertesPorCausa.vejez} d${ctx.muertesPorCausa.depredado})` +
        ` · E[${(sumaE / n).toFixed(1)} min ${minE.toFixed(1)}]` +
        ` · enAgua ${((100 * enAgua) / n).toFixed(0)}%` +
        ` · comiendo ${((100 * comiendo) / n).toFixed(0)}%`,
    );
  }
}
console.log(`tiempo real: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
