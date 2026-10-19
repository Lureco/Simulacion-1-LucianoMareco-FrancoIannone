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
import { pasoDeSimulacion, sembrar } from './systems/simulacion.js';
import { Camera } from './render/camera.js';
import { EntityRenderer } from './render/entityRenderer.js';
import { Hud } from './ui/hud.js';

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

/** Siembra la población inicial en posiciones aleatorias. */
function poblar() {
  sembrar(ctx, CONFIG.herbivoro.poblacionInicial, ESPECIE.HERBIVORO);
  sembrar(ctx, CONFIG.depredador.poblacionInicial, ESPECIE.PREDADOR);
}

poblar();

// ── Render ────────────────────────────────────────────────────────

const tile = CONFIG.mundo.tileSize;
const renderer = new EntityRenderer(app, { tileSize: tile });
app.stage.addChild(renderer.contenedor);

const camara = new Camera(
  CONFIG.mundo.ancho * tile,
  CONFIG.mundo.alto * tile,
  app.renderer.width,
  app.renderer.height,
);
camara.conectar(app.canvas);

const hud = new Hud(contenedor);

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
        console.log(`[main] ${ESTADO.pausa ? 'PAUSA' : 'CORRIENDO'}`);
        break;
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
        poblar();
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

  renderer.render(manager, camara);

  hud.actualizar(
    {
      herbivoros: manager.contar(ESPECIE.HERBIVORO),
      depredadores: manager.contar(ESPECIE.PREDADOR),
      total: manager.total,
      ticks: ctx.tick,
      seed: ESTADO.seed,
      fps,
    },
    ahora,
  );

  app.render();
  requestAnimationFrame(bucle);
}

console.log('[main] PixiJS v8 inicializado');
console.log(`[main] Mundo: ${CONFIG.mundo.ancho}x${CONFIG.mundo.alto} celdas`);
console.log(`[main] Seed: ${ESTADO.seed}`);
console.log(
  `[main] Población: ${manager.contar(ESPECIE.HERBIVORO)} herbívoros, ` +
    `${manager.contar(ESPECIE.PREDADOR)} carnívoros`,
);
console.log(
  '[main] Controles: arrastrar = pan · rueda = zoom · F = seguir · G = centro · espacio = pausa',
);

requestAnimationFrame(bucle);

export { app, manager, ctx, camara };
