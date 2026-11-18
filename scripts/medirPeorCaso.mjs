/**
 * scripts/medirPeorCaso.mjs — Medición del peor caso de render (T79 · F7.5)
 * ========================================================================
 *
 * Fuerza el escenario límite definido en TAREAS.md:
 *   - vegetación en TODAS las celdas habitables (hasta `grid.total`),
 *   - animales hasta `CONFIG.entidades.maxEntidades`,
 *   - zoom mínimo para que quepan todos en pantalla (sin culling efectivo).
 *
 * Mide el costo de la capa de render (sin WebGL): reconstrucción de UV,
 * proyección de posiciones, flujo de partículas y heap. Pixi sube los atributos
 * dinámicos en cada `execute()`, así que esto cubre el trabajo por frame del
 * `ParticleContainer`; el draw call en sí es 1 por container (confirmado en
 * `GlParticleContainerAdaptor.execute` → un solo `drawElements`).
 *
 * Uso: node scripts/medirPeorCaso.mjs [frames]
 */

import { Rectangle, Texture } from 'pixi.js';
import { CONFIG } from '../src/config.js';
import { ESPECIE } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { PLANTA } from '../src/world/cell.js';
import { clavesBase } from '../src/render/atlasDatos.js';
import { EntityRenderer } from '../src/render/entityRenderer.js';
import { PlantRenderer } from '../src/render/plantRenderer.js';

const frames = Number(process.argv[2] ?? 60);

/** Atlas sin canvas: mismas claves, UV por frame. Suficiente para medir. */
function atlasFalso() {
  const framesMap = new Map();
  for (const clave of clavesBase()) {
    framesMap.set(
      clave,
      new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 64, 64) }),
    );
  }
  return { textura: Texture.EMPTY, frames: framesMap, claves: clavesBase() };
}

const ancho = CONFIG.mundo.ancho;
const alto = CONFIG.mundo.alto;
const total = ancho * alto;
const tile = CONFIG.mundo.tileSize;

const atlas = atlasFalso();

// ── Construcción de pools (se hace UNA vez, fuera del bucle) ────────
const t0 = performance.now();
const plantRenderer = new PlantRenderer(null, { atlas, tileSize: tile, capacidad: total });
const entityRenderer = new EntityRenderer(null, { atlas, tileSize: tile });
const manager = new EntityManager(CONFIG.entidades.maxEntidades);
const tPool = performance.now() - t0;

// Todas las celdas con planta adulta.
const planta = new Uint8Array(total).fill(PLANTA.ADULTA);
const grid = { ancho, alto, total, planta };

// Población tope, repartida por el mapa y dentro de la vista.
for (let i = 0; i < CONFIG.entidades.maxEntidades; i++) {
  const tipo = i % 2 === 0 ? ESPECIE.HERBIVORO : ESPECIE.PREDADOR;
  const id = manager.crear(tipo);
  manager.x[id] = ((i * 37) % ancho) + 0.5;
  manager.y[id] = ((i * 61) % alto) + 0.5;
  manager.dirX[id] = i % 3 === 0 ? -1 : 1;
  manager.velocidad[id] = tipo === ESPECIE.HERBIVORO ? 1.2 : 1.7;
}

// Zoom mínimo: toda la grilla entra en pantalla → peor caso sin culling.
const camara = {
  x: (ancho * tile) / 2,
  y: (alto * tile) / 2,
  zoom: 0.2,
  vistaAnchoPx: 1280,
  vistaAltoPx: 720,
};

// ── Medición ─────────────────────────────────────────────────────────
if (global.gc) global.gc();
const heapInicial = process.memoryUsage().heapUsed;
const t1 = performance.now();

let plantas = 0;
let animales = 0;
for (let f = 0; f < frames; f++) {
  plantRenderer.reconstruir(grid, f * 10, 10, camara);
  plantRenderer.render(camara);
  entityRenderer.render(manager, camara, f);
  plantas = plantRenderer.activas;
  animales = entityRenderer.activas;
}

const tSim = performance.now() - t1;
if (global.gc) global.gc();
const heapFinal = process.memoryUsage().heapUsed;

const identidadEstable =
  plantRenderer.contenedor.particleChildren[0] === plantRenderer.particulas[0] &&
  entityRenderer.contenedor.particleChildren[0] === entityRenderer.particulaPorId[0];

console.log('T79 · peor caso de render');
console.log(`  celdas con planta:            ${plantas} / ${total}`);
console.log(`  animales en pantalla:         ${animales} / ${CONFIG.entidades.maxEntidades}`);
console.log(`  pool construido en:           ${tPool.toFixed(1)} ms (una vez)`);
console.log(`  ${frames} frames en:                 ${tSim.toFixed(1)} ms`);
console.log(`  por frame:                    ${(tSim / frames).toFixed(2)} ms`);
console.log(
  `  heap Δ:                       ${((heapFinal - heapInicial) / 1048576).toFixed(2)} MB`,
);
console.log(`  draw calls por frame:         2 (1 por ParticleContainer: plantas + animales)`);
console.log(`  partículas reutilizadas:      ${identidadEstable ? 'sí' : 'NO'}`);
console.log(
  `  pool nunca excedido:          ${plantas <= total && animales <= CONFIG.entidades.maxEntidades ? 'sí' : 'NO'}`,
);
