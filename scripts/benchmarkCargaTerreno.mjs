/**
 * scripts/benchmarkCargaTerreno.mjs — Benchmark de carga/generación del terreno
 * ============================================================================
 *
 * Compara el tiempo de `TerrainRenderer.generar(grid)` para distintas
 * configuraciones (marching squares on/off, pixelesPorCeldaMarching y
 * maxTamanoTexturaMarching) sobre el mismo mapa y seed.
 *
 * Corre en Node con stubs mínimos de DOM/Pixi (solo rasterización y subida de
 * textura simulada), igual que otros scripts de medición del proyecto.
 *
 * Uso:
 *   node scripts/benchmarkCargaTerreno.mjs [iteraciones]
 *
 * Ejemplo:
 *   node scripts/benchmarkCargaTerreno.mjs 7
 */

import { performance } from 'node:perf_hooks';
import { Texture } from 'pixi.js';
import { CONFIG } from '../src/config.js';
import { TERRENO } from '../src/world/cell.js';
import { generarTerreno } from '../src/world/terrain.js';
import { TerrainRenderer } from '../src/render/terrainRenderer.js';

const iteraciones = Math.max(1, Number(process.argv[2] ?? 5));

// ── Stubs mínimos de DOM y Pixi para correr en Node ──────────────────

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') {
      return { getContext: () => null };
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext(tipo) {
        if (tipo !== '2d') return null;
        return {
          createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          },
          putImageData() {},
        };
      },
    };
    return canvas;
  },
};

// Evita que Pixi intente interpretar el canvas stub como recurso real.
Texture.from = () => ({ source: { scaleMode: 0 }, destroy() {} });

const COLORES_TERRENO = {
  [TERRENO.AGUA]: CONFIG.terreno.colorAgua,
  [TERRENO.ARENA]: CONFIG.terreno.colorArena,
  [TERRENO.TIERRA]: CONFIG.terreno.colorTierra,
};

// ── Datos del terreno (se generan una vez, igual para todas las configs) ──

const tDatos0 = performance.now();
const grid = generarTerreno({
  ancho: CONFIG.mundo.ancho,
  alto: CONFIG.mundo.alto,
  seed: CONFIG.mundo.seedPorDefecto,
  config: CONFIG.terreno,
});
const tiempoDatosMs = performance.now() - tDatos0;

// ── Configuraciones a comparar ───────────────────────────────────────

const casos = [
  { nombre: 'clásico (sin marching)', marchingSquares: false, detalle: 1, chunk: 1024 },
  { nombre: 'marching d=1, chunk=1024', marchingSquares: true, detalle: 1, chunk: 1024 },
  { nombre: 'marching d=2, chunk=512', marchingSquares: true, detalle: 2, chunk: 512 },
  { nombre: 'marching d=2, chunk=1024', marchingSquares: true, detalle: 2, chunk: 1024 },
  { nombre: 'marching d=4, chunk=512', marchingSquares: true, detalle: 4, chunk: 512 },
  { nombre: 'marching d=4, chunk=1024', marchingSquares: true, detalle: 4, chunk: 1024 },
  { nombre: 'marching d=4, chunk=2048', marchingSquares: true, detalle: 4, chunk: 2048 },
  { nombre: 'marching d=6, chunk=1024', marchingSquares: true, detalle: 6, chunk: 1024 },
  { nombre: 'marching d=8, chunk=1024', marchingSquares: true, detalle: 8, chunk: 1024 },
];

function mediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];
}

function promedio(valores) {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function medirCaso(caso) {
  // Warmup (no se mide): estabiliza JIT/cachés.
  {
    const renderer = new TerrainRenderer(null, {
      tileSize: CONFIG.mundo.tileSize,
      colores: COLORES_TERRENO,
      marchingSquares: caso.marchingSquares,
      pixelesPorCeldaMarching: caso.detalle,
      maxTamanoTexturaMarching: caso.chunk,
    });
    renderer.generar(grid);
    renderer.destruir();
  }

  const tiempos = [];
  let chunks = 0;
  let pixelesTotales = 0;
  for (let i = 0; i < iteraciones; i++) {
    const renderer = new TerrainRenderer(null, {
      tileSize: CONFIG.mundo.tileSize,
      colores: COLORES_TERRENO,
      marchingSquares: caso.marchingSquares,
      pixelesPorCeldaMarching: caso.detalle,
      maxTamanoTexturaMarching: caso.chunk,
    });
    const t0 = performance.now();
    renderer.generar(grid);
    const dt = performance.now() - t0;
    tiempos.push(dt);
    chunks = renderer.sprites.length;
    const detalle = renderer._modoMarchingActivo ? renderer.pixelesPorCeldaMarching : 1;
    pixelesTotales = grid.ancho * detalle * (grid.alto * detalle);
    renderer.destruir();
  }

  return {
    ...caso,
    chunks,
    pixelesTotales,
    medianaMs: mediana(tiempos),
    promedioMs: promedio(tiempos),
    minMs: Math.min(...tiempos),
    maxMs: Math.max(...tiempos),
  };
}

// ── Ejecución y reporte ──────────────────────────────────────────────

console.log('Benchmark de carga/generación del terreno');
console.log('=========================================');
console.log(
  `Mapa: ${grid.ancho}x${grid.alto} celdas · seed ${CONFIG.mundo.seedPorDefecto} · tile ${CONFIG.mundo.tileSize}px`,
);
console.log(`Datos de terreno (generarTerreno): ${tiempoDatosMs.toFixed(2)} ms (una vez)`);
console.log(`Iteraciones por caso: ${iteraciones} (+1 warmup)\n`);

const resultados = casos.map(medirCaso);
const ordenados = [...resultados].sort((a, b) => a.medianaMs - b.medianaMs);
const mejor = ordenados[0].medianaMs;

const filas = ordenados.map((r) => ({
  configuración: r.nombre,
  chunks: r.chunks,
  'px totales': r.pixelesTotales.toLocaleString('es-AR'),
  'mediana (ms)': r.medianaMs.toFixed(2),
  'promedio (ms)': r.promedioMs.toFixed(2),
  'mín (ms)': r.minMs.toFixed(2),
  'máx (ms)': r.maxMs.toFixed(2),
  relativo: `${(r.medianaMs / mejor).toFixed(2)}x`,
}));

console.table(filas);

console.log(`\nMás rápido (mediana): ${ordenados[0].nombre} — ${mejor.toFixed(2)} ms`);
console.log(
  'Nota: mide rasterización + creación de texturas/sprites con stubs en Node;',
);
console.log(
  '      no incluye subida real a GPU/WebGL del navegador (el orden relativo sirve para comparar).',
);
