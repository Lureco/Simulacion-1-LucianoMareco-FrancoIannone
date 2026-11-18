/**
 * scripts/medirCapacidadPantalla.mjs — Capacidad de entidades en pantalla (T83 · F7)
 * ============================================================================
 *
 * Responde: ¿cuántas entidades pueden estar en pantalla sin bajar de 60 FPS?
 * Mide por separado plantas, herbívoros y depredadores, y después todo junto,
 * en dos configuraciones de cámara:
 *
 *   - zoom 1,0  → vista normal (solo entra una parte del mundo),
 *   - zoom 0,2  → zoom mínimo (el mundo completo cabe en pantalla, peor caso).
 *
 * Para cada escenario se barre una escalera de cantidades, se repite `repeticiones`
 * veces y se reporta la **mediana** de ms/frame. El estado se considera OK cuando
 * el frame entra en el presupuesto de 60 FPS (1000/60 = 16,67 ms).
 *
 * ⚠️ Igual que T79/T62, esto mide el **trabajo de render en CPU** (reconstrucción
 * de UV, proyección de posiciones y actualización del `ParticleContainer`), no un
 * FPS de navegador. El lado GPU son 2 draw calls fijos (una por container, D18)
 * y 4 vértices por partícula; no depende de cuántas entidades haya. La simulación
 * se mide aparte en T59/T62.
 *
 * Uso: node scripts/medirCapacidadPantalla.mjs [frames] [repeticiones]
 *   p. ej. node scripts/medirCapacidadPantalla.mjs 60 3
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
const repeticiones = Number(process.argv[3] ?? 3);
const calentamiento = 15;
const PRESUPUESTO_MS = 1000 / 60;

const ancho = CONFIG.mundo.ancho;
const alto = CONFIG.mundo.alto;
const total = ancho * alto;
const tile = CONFIG.mundo.tileSize;
const maxAnimales = CONFIG.entidades.maxEntidades;
const vistaAnchoPx = CONFIG.render.anchoVentana;
const vistaAltoPx = CONFIG.render.altoVentana;

const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const decimal = (n) => n.toFixed(2).replace('.', ',');

/** Atlas sin canvas: mismas claves y UV por frame. Suficiente para medir. */
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

function camaraPara(zoom) {
  return {
    x: (ancho * tile) / 2,
    y: (alto * tile) / 2,
    zoom,
    vistaAnchoPx,
    vistaAltoPx,
  };
}

/** Celdas visibles SIN margen de culling (donde se colocan las entidades). */
function celdasVisibles(camara) {
  const medioX = camara.vistaAnchoPx / (2 * camara.zoom);
  const medioY = camara.vistaAltoPx / (2 * camara.zoom);
  const x0 = Math.max(0, Math.floor((camara.x - medioX) / tile));
  const y0 = Math.max(0, Math.floor((camara.y - medioY) / tile));
  const x1 = Math.min(ancho - 1, Math.ceil((camara.x + medioX) / tile));
  const y1 = Math.min(alto - 1, Math.ceil((camara.y + medioY) / tile));
  return { x0, y0, x1, y1, columnas: x1 - x0 + 1, celdas: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

// Pools al tamaño tope, creados UNA sola vez (nunca dentro del bucle medido).
const atlas = atlasFalso();
const plantRenderer = new PlantRenderer(null, { atlas, tileSize: tile, capacidad: total });
const entityRenderer = new EntityRenderer(null, { atlas, tileSize: tile });
const manager = new EntityManager(maxAnimales);
const planta = new Uint8Array(total);
const grid = { ancho, alto, total, planta };

/** Deja `nPlantas` celdas visibles con planta y `n` animales dentro de la vista. */
function preparar(camara, nPlantas, nHerbivoros, nDepredadores) {
  const r = celdasVisibles(camara);
  planta.fill(0);
  const aPintar = Math.min(nPlantas, r.celdas);
  for (let i = 0; i < aPintar; i++) {
    const x = r.x0 + (i % r.columnas);
    const y = r.y0 + Math.floor(i / r.columnas);
    planta[y * ancho + x] = PLANTA.ADULTA;
  }

  manager.limpiar();
  const n = nHerbivoros + nDepredadores;
  for (let i = 0; i < n; i++) {
    const tipo = i < nHerbivoros ? ESPECIE.HERBIVORO : ESPECIE.PREDADOR;
    const id = manager.crear(tipo);
    // Paso primo para repartir los bichos por toda la vista (todos en pantalla).
    const idx = (i * 7919) % r.celdas;
    manager.x[id] = r.x0 + (idx % r.columnas) + 0.5;
    manager.y[id] = r.y0 + Math.floor(idx / r.columnas) + 0.5;
    manager.dirX[id] = i % 3 === 0 ? -1 : 1;
    manager.velocidad[id] = tipo === ESPECIE.HERBIVORO ? 1.2 : 1.7;
  }
  plantRenderer.invalidar();
}

/**
 * Tick GLOBAL y monotónico: se reutiliza el renderer entre escenarios, así que
 * reiniciarlo en cada repetición haría que `reconstruir()` saltara el trabajo por
 * su caché de rect/tick (T79 usa un renderer nuevo por medición). Con tick
 * creciente, `tick - ultimoTick === cadaTicks` en cada frame y se fuerza siempre
 * la reconstrucción completa: es el caso más caro y el comparable con T79.
 */
let tickGlobal = 0;

function unFrame(camara) {
  const tick = tickGlobal++;
  plantRenderer.reconstruir(grid, tick * 10, 10, camara);
  plantRenderer.render(camara);
  entityRenderer.render(manager, camara, tick);
}

function medir(camara, nPlantas, nHerbivoros, nDepredadores) {
  preparar(camara, nPlantas, nHerbivoros, nDepredadores);
  const tiempos = [];
  for (let rep = 0; rep < repeticiones; rep++) {
    for (let f = 0; f < calentamiento; f++) unFrame(camara);
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) unFrame(camara);
    tiempos.push((performance.now() - t0) / frames);
  }
  tiempos.sort((a, b) => a - b);
  return {
    plantas: plantRenderer.activas,
    animales: entityRenderer.activas,
    ms: tiempos[Math.floor(tiempos.length / 2)],
  };
}

/** Escaleras de cantidades. El tope de plantas es el de celdas visibles. */
function escenarios(camara) {
  const celdas = celdasVisibles(camara).celdas;
  const mitad = maxAnimales / 2;
  return [
    ...[1000, 5000, 10000, celdas]
      .filter((n, i, a) => a.indexOf(n) === i)
      .map((n) => ({ tipo: 'Solo plantas', plantas: n, herb: 0, pred: 0 })),
    ...[100, 500, 1000, 2000, maxAnimales].map((n) => ({
      tipo: 'Solo herbívoros',
      plantas: 0,
      herb: n,
      pred: 0,
    })),
    ...[100, 500, 1000, 2000, maxAnimales].map((n) => ({
      tipo: 'Solo depredadores',
      plantas: 0,
      herb: 0,
      pred: n,
    })),
    ...[0.25, 0.5, 0.75, 1].map((frac) => ({
      tipo: 'Todo junto',
      plantas: Math.round(celdas * frac),
      herb: Math.round(mitad * frac),
      pred: Math.round(mitad * frac),
    })),
  ];
}

function imprimirBloque(zoom, resultados, celdas) {
  console.log('');
  console.log('═'.repeat(100));
  console.log(
    `ZOOM ${decimal(zoom)} · ${miles(celdas)} celdas visibles · ` +
      `${frames} frames × ${repeticiones} repeticiones (mediana)`,
  );
  console.log('═'.repeat(100));
  console.log(
    '  Escenario              Plantas      Herb     Pred   En pantalla' +
      '   ms/frame   FPS eq.   Estado',
  );
  console.log('  ' + '─'.repeat(96));
  for (const r of resultados) {
    const enPantalla = r.med.plantas + r.med.animales;
    const ok = r.med.ms <= PRESUPUESTO_MS;
    console.log(
      `  ${r.escenario.tipo.padEnd(21)}` +
        `${miles(r.escenario.plantas).padStart(8)}` +
        `${(r.escenario.herb ? miles(r.escenario.herb) : '-').padStart(9)}` +
        `${(r.escenario.pred ? miles(r.escenario.pred) : '-').padStart(9)}` +
        `${miles(enPantalla).padStart(14)}` +
        `${decimal(r.med.ms).padStart(11)}` +
        `${decimal(1000 / r.med.ms).padStart(11)}` +
        `   ${ok ? 'OK' : 'FALLA'}`,
    );
  }

  // Techo: mayor cantidad en pantalla que todavía entra en presupuesto.
  const dentro = resultados.filter((r) => r.med.ms <= PRESUPUESTO_MS);
  const mejor = dentro.reduce((a, b) =>
    a.med.plantas + a.med.animales >= b.med.plantas + b.med.animales ? a : b,
  );
  const todos = resultados.every((r) => r.med.ms <= PRESUPUESTO_MS);
  console.log('  ' + '─'.repeat(96));
  console.log(
    `  Techo medido: ${miles(mejor.med.plantas + mejor.med.animales)} entidades ` +
      `(${miles(mejor.med.plantas)} plantas + ${miles(mejor.med.animales)} animales) ` +
      `a ${decimal(mejor.med.ms)} ms/frame`,
  );
  console.log(
    `  ¿Todos los escenarios dentro de ${decimal(PRESUPUESTO_MS)} ms?: ${todos ? 'sí' : 'NO'}`,
  );
}

console.log('T83 · capacidad de entidades en pantalla sin bajar de 60 FPS');
console.log(
  `Presupuesto: ${decimal(PRESUPUESTO_MS)} ms/frame (60 FPS) · calentamiento: ${calentamiento} frames`,
);
console.log('Render headless: reconstruir + proyectar partículas (2 draw calls en GPU, D18).');

for (const zoom of [1, CONFIG.camara.zoomMin]) {
  const camara = camaraPara(zoom);
  const esc = escenarios(camara);
  const resultados = esc.map((escenario) => ({
    escenario,
    med: medir(camara, escenario.plantas, escenario.herb, escenario.pred),
  }));
  imprimirBloque(zoom, resultados, celdasVisibles(camara).celdas);
}

console.log('');
console.log('Fin de la medición.');
