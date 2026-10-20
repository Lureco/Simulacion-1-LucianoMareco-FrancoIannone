/**
 * src/main.js — Bootstrap y bucle principal
 * =========================================
 *
 * T04: confirmar que PixiJS v8 levanta antes de escribir lógica.
 * T25: bucle con **timestep fijo + acumulador**.
 *
 * Recordatorio PixiJS v8:
 *   - `app.init()` es ASÍNCRONO → hay que awaitsarlo.
 *   - El canvas se accede como `app.canvas` (en v7 era `app.view`).
 */

import { Application } from 'pixi.js';
import { CONFIG, ESTADO } from './config.js';
import { PRNG } from './core/prng.js';
import { crearContexto } from './core/contexto.js';
import { EntityManager } from './entities/entityManager.js';
import { ESPECIE } from './entities/entity.js';
import { Herbivore } from './entities/herbivore.js';
import { Predator } from './entities/predator.js';
import { SpatialHash } from './systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, prepararMundo } from './systems/simulacion.js';
import { Camera } from './render/camera.js';
import { EntityRenderer } from './render/entityRenderer.js';
import { TerrainRenderer } from './render/terrainRenderer.js';
import { PlantRenderer } from './render/plantRenderer.js';
import { generarTerreno } from './world/terrain.js';
import { TERRENO, PLANTA, nombreTerreno } from './world/cell.js';
import { sembrarVegetacion, contarPlantas } from './systems/plantGrowth.js';
import { Hud } from './ui/hud.js';
import { Controles } from './ui/controles.js';

const app = new Application();

await app.init({
  background: CONFIG.render.colorFondo,
  resizeTo: window,
  antialias: false,
  resolution: window.devicePixelRatio ?? 1,
  autoDensity: true,
});

const contenedor = document.getElementById('app');
if (!contenedor) throw new Error('Falta el div #app en index.html');
contenedor.appendChild(app.canvas);

// ── Simulación ─────────────────────────────────────────────────────

const prng = new PRNG(ESTADO.seed);
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

/** Colores del terreno, leídos de `CONFIG.terreno` (T58: nada hardcodeado). */
const COLORES_TERRENO = {
  [TERRENO.AGUA]: CONFIG.terreno.colorAgua,
  [TERRENO.ARENA]: CONFIG.terreno.colorArena,
  [TERRENO.TIERRA]: CONFIG.terreno.colorTierra,
};

/** Colores de cada estado de planta, leídos de `CONFIG.plantas`. */
const COLORES_PLANTA = {
  [PLANTA.SEMILLA]: CONFIG.plantas.colorSemilla,
  [PLANTA.JOVEN]: CONFIG.plantas.colorJoven,
  [PLANTA.ADULTA]: CONFIG.plantas.colorAdulta,
};

/** Genera el terreno con la seed actual y lo deja en `ctx.grid`. */
function generarMundo() {
  ctx.grid = generarTerreno({
    ancho: CONFIG.mundo.ancho,
    alto: CONFIG.mundo.alto,
    seed: ESTADO.seed,
    config: CONFIG.terreno,
  });
  // El mapa de distancia al agua se calcula una vez por mundo: permite
  // que un animal sediento camine hacia la orilla (T38).
  prepararMundo(ctx);
  return ctx.grid;
}

/** Siembra la población inicial en celdas habitables del terreno. */
function poblar() {
  sembrar(ctx, CONFIG.herbivoro.poblacionInicial, ESPECIE.HERBIVORO);
  sembrar(ctx, CONFIG.depredador.poblacionInicial, ESPECIE.PREDADOR);
}

// ── Mundo y render ────────────────────────────────────────────────
// Primero la grilla: `poblar()` la usa para elegir celdas de tierra.

const tile = CONFIG.mundo.tileSize;
const terrenoRenderer = new TerrainRenderer(app, { tileSize: tile, colores: COLORES_TERRENO });
app.stage.addChild(terrenoRenderer.contenedor);

generarMundo();
terrenoRenderer.generar(ctx.grid);
sembrarVegetacion(ctx);
poblar();

const renderer = new EntityRenderer(app, { tileSize: tile });

const plantRenderer = new PlantRenderer(app, {
  tileSize: tile,
  colores: COLORES_PLANTA,
  escala: CONFIG.plantas.escalaSprite,
});
// Orden de capas: terreno abajo, plantas encima, entidades arriba.
app.stage.addChild(plantRenderer.contenedor);
app.stage.addChild(renderer.contenedor);

const camara = new Camera(
  CONFIG.mundo.ancho * tile,
  CONFIG.mundo.alto * tile,
  app.renderer.width,
  app.renderer.height,
);
camara.conectar(app.canvas);

const hud = new Hud(contenedor);

// T33: barra de pausa y velocidad. La barra solo notifica; el estado real
// vive en `ESTADO`, que es lo que lee el bucle principal.
const controles = new Controles(contenedor, {
  alCambiarPausa: (pausada) => {
    ESTADO.pausa = pausada;
  },
  alCambiarVelocidad: (velocidad) => {
    ESTADO.escalaSimulacion = velocidad;
  },
});

window.addEventListener('resize', () => {
  camara.redimensionar(app.renderer.width, app.renderer.height);
});

// ── Controles ──────────────────────────────────────────────────────

// Un `AbortController` por registro: si el módulo se re-evalúa (HMR), el
// listener viejo se cancela y no queda disparándose dos veces.
const controlTeclado = new AbortController();
const opcionesTeclado = { signal: controlTeclado.signal };

window.addEventListener(
  'keydown',
  (e) => {
    switch (e.key.toLowerCase()) {
      case ' ':
        ESTADO.pausa = !ESTADO.pausa;
        controles.setPausa(ESTADO.pausa);
        console.log(`[main] ${ESTADO.pausa ? 'PAUSA' : 'CORRIENDO'}`);
        break;
      case '1':
      case '2':
      case '4': {
        const velocidad = Number(e.key);
        ESTADO.escalaSimulacion = velocidad;
        controles.setVelocidad(velocidad);
        console.log(`[main] velocidad de simulación: ${velocidad}×`);
        break;
      }
      case 'f': {
        // Seguir a un herbívoro al azar.
        const herbivoros = manager.deTipo(ESPECIE.HERBIVORO);
        if (herbivoros.length > 0) {
          camara.seguir(ctx.prng.pick(herbivoros), tile, 0.5);
          console.log('[main] siguiendo a un herbívoro (F para soltar)');
        }
        break;
      }
      case 'g':
        camara.soltar();
        camara.x = (CONFIG.mundo.ancho * tile) / 2;
        camara.y = (CONFIG.mundo.alto * tile) / 2;
        break;
      case 'r': {
        // Regenerar con una seed nueva: es una simulación nueva, el tiempo vuelve a 0.
        ESTADO.seed = ctx.prng.int(1, 2 ** 31);
        console.log(`[main] nueva seed: ${ESTADO.seed}`);
        manager.limpiar();
        ctx.prng = new PRNG(ESTADO.seed);
        ctx.tick = 0;
        generarMundo();
        terrenoRenderer.generar(ctx.grid);
        sembrarVegetacion(ctx);
        plantRenderer.ultimoTick = -Infinity;
        poblar();
        break;
      }
      case 's':
        console.log(`[main] seed actual: ${ESTADO.seed}`);
        break;
      case 't': {
        const { agua, arena, tierra } = ctx.grid.contarTerreno();
        console.log(
          `[main] terreno — agua: ${agua} · arena: ${arena} · tierra: ${tierra} · ` +
            `umbrales [${CONFIG.terreno.umbralAgua}, ${CONFIG.terreno.umbralArena}] · ` +
            `plantas: ${contarPlantas(ctx)}`,
        );
        break;
      }
      default:
        break;
    }
  },
  opcionesTeclado,
);

// ── Bucle principal (timestep fijo + acumulador) ─────────────────

/** Avanza la simulación un paso fijo. */
function simular(dt) {
  pasoDeSimulacion(ctx, dt);
}

let anterior = performance.now();
let acumulador = 0;
let fps = 60;

function bucle(ahora) {
  // `delta` es el tiempo real del frame. NUNCA se usa para mover entidades:
  // solo alimenta el acumulador, que produce pasos fijos de 1/60 s.
  const delta = Math.min((ahora - anterior) / 1000, 0.25);
  anterior = ahora;
  fps += (1 / Math.max(delta, 0.0001) - fps) * 0.05;

  if (!ESTADO.pausa) {
    acumulador += delta * ESTADO.escalaSimulacion;
    let pasos = 0;
    while (acumulador >= CONFIG.tiempo.pasoFijo && pasos < CONFIG.tiempo.maxPasosPorFrame) {
      simular(CONFIG.tiempo.pasoFijo);
      acumulador -= CONFIG.tiempo.pasoFijo;
      pasos++;
    }
  }

  if (camara.objetivo) {
    camara.seguir(camara.objetivo, tile, delta);
  }

  terrenoRenderer.render(camara);
  plantRenderer.reconstruir(ctx.grid, ctx.tick, CONFIG.plantas.ticksPorRefrescoRender);
  plantRenderer.render(camara);
  renderer.render(manager, camara);

  hud.actualizar(
    {
      plantas: contarPlantas(ctx),
      herbivoros: manager.contar(ESPECIE.HERBIVORO),
      depredadores: manager.contar(ESPECIE.PREDADOR),
      total: manager.total,
      ticks: ctx.tick,
      seed: ESTADO.seed,
      fps,
      velocidad: ESTADO.escalaSimulacion,
      pausa: ESTADO.pausa,
      muertes: ctx.muertes,
    },
    ahora,
  );

  app.render();
  requestAnimationFrame(bucle);
}

console.log('[main] PixiJS v8 inicializado');
console.log(`[main] Mundo: ${CONFIG.mundo.ancho}x${CONFIG.mundo.alto} celdas`);
console.log(`[main] Seed: ${ESTADO.seed}`);
{
  const { agua, arena, tierra } = ctx.grid.contarTerreno();
  console.log(
    `[main] Terreno: ${nombreTerreno(TERRENO.AGUA)} ${agua} · ` +
      `${nombreTerreno(TERRENO.ARENA)} ${arena} · ${nombreTerreno(TERRENO.TIERRA)} ${tierra}`,
  );
}
console.log(
  `[main] Población: ${manager.contar(ESPECIE.HERBIVORO)} herbívoros, ` +
    `${manager.contar(ESPECIE.PREDADOR)} carnívoros`,
);
console.log(`[main] Vegetación inicial: ${contarPlantas(ctx)} semillas`);
console.log(
  '[main] Controles: arrastrar = pan · rueda = zoom · F = seguir · G = centro · ' +
    'espacio = pausa · 1/2/4 = velocidad · R = nueva seed · S = ver seed · T = terreno',
);

requestAnimationFrame(bucle);

export { app, manager, ctx, camara };
