/**
 * scripts/validarPreset.mjs — Corre un preset incluido y mide población y CPU
 * ==========================================================================
 *
 * Complementa a `simular.mjs` (que solo admite un override por corrida): acá se
 * aplica un preset COMPLETO antes de generar el mundo, porque varios de sus
 * valores (semillas, radios, cadencias) cambian el consumo del PRNG y el orden
 * de la simulación desde el tick 1.
 *
 * Uso: node scripts/validarPreset.mjs ['Máximo estable'] [minutos] [seed]
 *   p. ej. node scripts/validarPreset.mjs 'Máximo estable' 10 1337
 *
 * Reporta una línea por minuto (poblaciones, nacimientos, muertes por causa) y
 * al final el mínimo poblacional y los ms/tick de simulación, para comparar con
 * el presupuesto de 60 FPS (16,67 ms/frame, al que además hay que sumar render).
 */

import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, repartirEdadesIniciales } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import { sembrarVegetacion, contarPlantas } from '../src/systems/plantGrowth.js';
import { CONFIG, PRESETS, TICKS_POR_SEGUNDO } from '../src/config.js';
import { copiarValidos } from '../src/core/configUtils.js';

const nombre = process.argv[2] ?? 'Máximo estable';
const preset = PRESETS[nombre];
if (!preset) {
  throw new Error(`Preset desconocido: "${nombre}". Opciones: ${Object.keys(PRESETS).join(', ')}`);
}
copiarValidos(CONFIG, preset, CONFIG);

const minutos = Number(process.argv[3] ?? 10);
const seed = Number(process.argv[4] ?? CONFIG.mundo.seedPorDefecto);
const ticks = Math.round(minutos * 60 * TICKS_POR_SEGUNDO);
const presupuesto = 1000 / 60;

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

console.log(
  `preset "${nombre}" · seed ${seed} · ${minutos} min · presupuesto ${presupuesto.toFixed(2)} ms/frame`,
);
let minH = Infinity;
let minP = Infinity;
let sumMs = 0;
let maxMs = 0;
for (let t = 1; t <= ticks; t++) {
  const inicio = performance.now();
  pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
  const ms = performance.now() - inicio;
  sumMs += ms;
  if (ms > maxMs) maxMs = ms;

  const herb = manager.contar(ESPECIE.HERBIVORO);
  const pred = manager.contar(ESPECIE.PREDADOR);
  if (herb < minH) minH = herb;
  if (pred < minP) minP = pred;

  if (t % TICKS_POR_SEGUNDO ** 2 === 0) {
    const minuto = t / TICKS_POR_SEGUNDO ** 2;
    console.log(
      `min ${String(minuto).padStart(3)}: herb ${String(herb).padStart(5)}` +
        ` · pred ${String(pred).padStart(4)} · plantas ${String(contarPlantas(ctx)).padStart(6)}` +
        ` · nac ${String(ctx.nacimientosTotales).padStart(5)} · mue ${String(ctx.muertesTotales).padStart(5)}` +
        ` (h${ctx.muertesPorCausa.hambre} s${ctx.muertesPorCausa.sed} v${ctx.muertesPorCausa.vejez} d${ctx.muertesPorCausa.depredado})`,
    );
  }
}

const media = sumMs / ticks;
console.log(
  `FIN mínimos: herb ${minH}, pred ${minP} · finales: herb ${manager.contar(ESPECIE.HERBIVORO)},` +
    ` pred ${manager.contar(ESPECIE.PREDADOR)} · plantas ${contarPlantas(ctx)}`,
);
console.log(
  `simulación: media ${media.toFixed(2)} ms/tick (${((100 * media) / presupuesto).toFixed(0)} % del presupuesto),` +
    ` pico ${maxMs.toFixed(2)} ms`,
);
