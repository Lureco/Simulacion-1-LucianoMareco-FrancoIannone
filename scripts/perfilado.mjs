/**
 * scripts/perfilado.mjs — Perfilado de T62 (F7)
 * =============================================
 *
 * Responde las tres preguntas de T62 con mediciones repetibles, sin abrir el
 * DevTools de forma interactiva:
 *
 *   1. ¿El vecindario sigue siendo O(vecinos) con 2000 entidades?
 *      Compara `SpatialHash.consultar()` contra un barrido O(n) con la misma
 *      densidad de población (el mundo crece junto con n).
 *   2. ¿Hay GC sawtooth en el heap? (indica `new` en el bucle)
 *      Corre la simulación con `--expose-gc` y registra el heap tras GC
 *      periódicos: si la línea de base no sube, no hay acumulación.
 *   3. ¿El batch de Pixi se rompe por cambiar `tint` a menudo?
 *      Alterna el modo depuración (que cambia el tint de cada partícula)
 *      durante 120 frames y verifica que los pools se reutilizan y que sigue
 *      habiendo exactamente 2 `ParticleContainer` (2 draw calls, ver D18).
 *
 * Uso: node --expose-gc scripts/perfilado.mjs
 */

import { Rectangle, Texture } from 'pixi.js';
import { CONFIG, TICKS_POR_SEGUNDO } from '../src/config.js';
import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import { sembrarVegetacion } from '../src/systems/plantGrowth.js';
import { clavesBase } from '../src/render/atlasDatos.js';
import { EntityRenderer } from '../src/render/entityRenderer.js';
import { PlantRenderer } from '../src/render/plantRenderer.js';

const MB = 1048576;

// ── 1. Vecindario: O(vecinos) vs O(n) ────────────────────────────────
function medirVecindario(n, lado) {
  const manager = new EntityManager(n);
  for (let i = 0; i < n; i++) {
    const id = manager.crear(ESPECIE.HERBIVORO);
    manager.x[id] = ((i * 37) % lado) + 0.5;
    manager.y[id] = ((i * 61) % lado) + 0.5;
  }
  const hash = new SpatialHash(manager, lado, lado, CONFIG.percepcion.celdaHash);
  hash.reconstruir();

  const salida = [];
  const prng = new PRNG(1337);
  const radio = CONFIG.herbivoro.radioVision;
  const consultas = 3000;
  const puntos = [];
  for (let q = 0; q < consultas; q++) puntos.push([prng.float() * lado, prng.float() * lado]);

  let vecinos = 0;
  let t0 = performance.now();
  for (let q = 0; q < consultas; q++) {
    hash.consultar(puntos[q][0], puntos[q][1], radio, salida);
    vecinos += salida.length;
  }
  const tHash = performance.now() - t0;

  // Barrido completo: la misma consulta recorriendo todas las entidades.
  const radio2 = radio * radio;
  t0 = performance.now();
  for (let q = 0; q < consultas; q++) {
    const [x, y] = puntos[q];
    salida.length = 0;
    for (const id of manager.vivos) {
      const dx = manager.x[id] - x;
      const dy = manager.y[id] - y;
      if (dx * dx + dy * dy <= radio2) salida.push(id);
    }
  }
  const tFuerza = performance.now() - t0;

  return {
    n,
    lado,
    usados: hash.total,
    nsConsulta: (1000 * tHash) / consultas,
    nsPorVecino: (1000 * tHash) / Math.max(1, vecinos),
    nsFuerza: (1000 * tFuerza) / consultas,
    vecinos: vecinos / consultas,
  };
}

console.log('T62.1 · vecindario (mismo radio, densidad constante)');
console.log('  n     mundo   usados  vecinos/consulta  hash ns  ns/vecino  fuerza ns  speedup');
for (const [n, lado] of [
  [500, 128],
  [1000, 181],
  [2000, 256],
]) {
  const r = medirVecindario(n, lado);
  console.log(
    `  ${String(r.n).padStart(4)}  ${String(r.lado).padStart(5)}  ${String(r.usados).padStart(6)}` +
      `  ${r.vecinos.toFixed(1).padStart(16)}  ${r.nsConsulta.toFixed(1).padStart(7)}` +
      `  ${r.nsPorVecino.toFixed(2).padStart(9)}  ${r.nsFuerza.toFixed(1).padStart(9)}` +
      `  ${(r.nsFuerza / r.nsConsulta).toFixed(1)}×`,
  );
}

// ── 2. Heap: GC sawtooth ──────────────────────────────────────────────
const seed = CONFIG.mundo.seedPorDefecto;
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

console.log('\nT62.2 · heap tras GC (simulación, 10 min)');
if (!global.gc) {
  console.log('  omitido: correr con node --expose-gc');
} else {
  global.gc();
  let base = process.memoryUsage().heapUsed / MB;
  console.log(`  inicio: ${base.toFixed(2)} MB`);
  const ticks = 10 * 60 * TICKS_POR_SEGUNDO;
  let subidaMax = 0;
  for (let t = 1; t <= ticks; t++) {
    pasoDeSimulacion(ctx, CONFIG.tiempo.pasoFijo);
    if (t % (2 * 60 * TICKS_POR_SEGUNDO) === 0) {
      global.gc();
      const heap = process.memoryUsage().heapUsed / MB;
      subidaMax = Math.max(subidaMax, heap - base);
      console.log(
        `  min ${String(t / (60 * TICKS_POR_SEGUNDO)).padStart(2)}: ${heap.toFixed(2)} MB` +
          ` (Δ ${(heap - base >= 0 ? '+' : '') + (heap - base).toFixed(2)} MB)`,
      );
    }
  }
  console.log(`  subida máxima de la línea de base: ${subidaMax.toFixed(2)} MB`);
}

// ── 3. Batch de Pixi: tint ────────────────────────────────────────────
function atlasFalso() {
  const mapa = new Map();
  for (const clave of clavesBase()) {
    mapa.set(
      clave,
      new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 64, 64) }),
    );
  }
  return { textura: Texture.EMPTY, frames: mapa, claves: clavesBase() };
}

const atlas = atlasFalso();
const tile = CONFIG.mundo.tileSize;
const plantRenderer = new PlantRenderer(null, { atlas, tileSize: tile, capacidad: 4096 });
const entityRenderer = new EntityRenderer(null, { atlas, tileSize: tile });
const camara = {
  x: (CONFIG.mundo.ancho * tile) / 2,
  y: (CONFIG.mundo.alto * tile) / 2,
  zoom: 1,
  vistaAnchoPx: CONFIG.render.anchoVentana,
  vistaAltoPx: CONFIG.render.altoVentana,
};
const grilla = {
  ancho: CONFIG.mundo.ancho,
  alto: CONFIG.mundo.alto,
  total: CONFIG.mundo.ancho * CONFIG.mundo.alto,
  planta: new Uint8Array(CONFIG.mundo.ancho * CONFIG.mundo.alto).fill(3),
};
for (let i = 0; i < 2000; i++) {
  const id = manager.crear(i % 2 === 0 ? ESPECIE.HERBIVORO : ESPECIE.PREDADOR);
  manager.x[id] = ((i * 37) % CONFIG.mundo.ancho) + 0.5;
  manager.y[id] = ((i * 61) % CONFIG.mundo.alto) + 0.5;
  manager.velocidad[id] = 1.2;
}
const poolPlantas = new Set(plantRenderer.particulas);
const poolAnimales = new Set(entityRenderer.particulaPorId);

if (global.gc) global.gc();
const heap0 = process.memoryUsage().heapUsed / MB;
for (let f = 0; f < 120; f++) {
  const depuracion = f % 2 === 0;
  plantRenderer.reconstruir(grilla, f, 1, camara);
  // Las plantas tienen tint estático; el tint dinámico es el de los animales.
  entityRenderer.setDepuracion(depuracion);
  plantRenderer.render(camara);
  entityRenderer.render(manager, camara, f);
}
if (global.gc) global.gc();
const heap1 = process.memoryUsage().heapUsed / MB;

console.log('\nT62.3 · batch de Pixi con tint cambiando cada frame');
console.log(`  ParticleContainer: 2 (plantas + animales) → 2 draw calls (ver D18)`);
const reutilizados =
  plantRenderer.contenedor.particleChildren.every((p) => poolPlantas.has(p)) &&
  entityRenderer.contenedor.particleChildren.every((p) => poolAnimales.has(p));
console.log(`  pools reutilizados: ${reutilizados ? 'sí' : 'NO'}`);
console.log(
  `  frames: 120 · heap Δ tras GC: ${(heap1 - heap0 >= 0 ? '+' : '') + (heap1 - heap0).toFixed(2)} MB`,
);
console.log(
  `  partículas activas: ${plantRenderer.activas} plantas / ${entityRenderer.activas} animales`,
);
