import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, repartirEdadesIniciales } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import {
  sembrarVegetacion,
  contarPlantas,
  contarPlantasPorEspecie,
} from '../src/systems/plantGrowth.js';
import { CONFIG, TICKS_POR_SEGUNDO } from '../src/config.js';

const seed = Number(process.argv[2] ?? CONFIG.mundo.seedPorDefecto);
const minutos = Number(process.argv[3] ?? 10);
const ticks = Math.round(minutos * 60 * TICKS_POR_SEGUNDO);

/**
 * T60: override de UN solo parámetro por corrida (`SECCION.CLAVE=VALOR`).
 * Ejemplo: SIM_OVERRIDE=plantas.probExpansion=0.2 node scripts/simular.mjs 1337 10
 * Se aplica antes de generar el mundo, así que toda la corrida usa el mismo valor.
 */
const override = process.env.SIM_OVERRIDE;
if (override) {
  const [ruta, texto] = override.split('=');
  const [seccion, clave] = ruta.split('.');
  const valor = Number(texto);
  if (!(seccion in CONFIG) || !(clave in CONFIG[seccion]) || Number.isNaN(valor)) {
    throw new Error(`SIM_OVERRIDE inválido: ${override} (se usa SECCION.CLAVE=VALOR)`);
  }
  console.log(`override T60: ${ruta} ${CONFIG[seccion][clave]} → ${valor}`);
  CONFIG[seccion][clave] = valor;
}

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
    let sumaHambre = 0;
    let sumaSed = 0;
    let enAgua = 0;
    let comiendo = 0;
    for (const id of manager.vivos) {
      sumaHambre += manager.hambre[id];
      sumaSed += manager.sed[id];
      if (ctx.grid.terrenoEn(manager.celdaX(id), manager.celdaY(id)) === 0) enAgua++;
      if (manager.estado[id] === 1) comiendo++;
    }
    const n = manager.vivos.length || 1;
    const especies = contarPlantasPorEspecie(ctx);
    console.log(
      `min ${String(t / 3600).padStart(3)}: herb ${String(manager.contar(ESPECIE.HERBIVORO)).padStart(5)}` +
        ` · pred ${String(manager.contar(ESPECIE.PREDADOR)).padStart(4)}` +
        ` · plantas ${String(contarPlantas(ctx)).padStart(6)}` +
        ` · pasto/mic ${String(especies.pasto).padStart(6)}/${String(especies.micelio).padStart(6)}` +
        ` · despl ${String(especies.desplazamientos).padStart(6)}` +
        ` · nac ${String(ctx.nacimientosTotales).padStart(5)}` +
        ` · mue ${String(ctx.muertesTotales).padStart(5)}` +
        ` (h${ctx.muertesPorCausa.hambre} s${ctx.muertesPorCausa.sed} v${ctx.muertesPorCausa.vejez} d${ctx.muertesPorCausa.depredado})` +
        ` · H/S[${(sumaHambre / n).toFixed(2)} ${(sumaSed / n).toFixed(2)}]` +
        ` · enAgua ${((100 * enAgua) / n).toFixed(0)}%` +
        ` · comiendo ${((100 * comiendo) / n).toFixed(0)}%`,
    );
  }
}
console.log(`tiempo real: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
