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
 *
 * ⚠️ REFACTOR SoA (D13): la UI se adapta a los arrays tipados. La
 * selección por clic recorre `manager.vivos` (ids) y `necesidadesRenderer`
 * expone una **vista plana** para que la leyenda no sepa de SoA.
 */

import { Application } from 'pixi.js';
import { CONFIG, ESTADO, TICKS_POR_SEGUNDO } from './config.js';
import { PRNG } from './core/prng.js';
import { crearContexto } from './core/contexto.js';
import { EntityManager } from './entities/entityManager.js';
import { ESPECIE } from './entities/entity.js';
import { SpatialHash } from './systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, repartirEdadesIniciales } from './systems/simulacion.js';
import { Camera } from './render/camera.js';
import { EntityRenderer } from './render/entityRenderer.js';
import { TerrainRenderer } from './render/terrainRenderer.js';
import { PlantRenderer } from './render/plantRenderer.js';
import { NecesidadesRenderer } from './render/necesidadesRenderer.js';
import { crearAtlas } from './render/atlas.js';
import { generarTerreno } from './world/terrain.js';
import { TERRENO, nombreTerreno } from './world/cell.js';
import { sembrarVegetacion, contarPlantas } from './systems/plantGrowth.js';
import { Hud } from './ui/hud.js';
import { Controles } from './ui/controles.js';
import { Leyenda } from './ui/leyenda.js';
import { Grafico } from './ui/grafico.js';

const app = new Application();

// F7.5/T75: empieza a cargar el atlas ANTES de inicializar Pixi para que las
// 23 imágenes se descarguen/decodifiquen mientras `app.init()` hace su trabajo.
const promesaAtlas = crearAtlas();

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

const ctx = crearContexto({
  prng,
  mundo: { ancho: CONFIG.mundo.ancho, alto: CONFIG.mundo.alto },
  config: CONFIG,
});
ctx.entidades = manager;
ctx.hash = new SpatialHash(
  manager,
  CONFIG.mundo.ancho,
  CONFIG.mundo.alto,
  CONFIG.percepcion.celdaHash,
);

/** Colores del terreno, leídos de `CONFIG.terreno` (T58: nada hardcodeado). */
const COLORES_TERRENO = {
  [TERRENO.AGUA]: CONFIG.terreno.colorAgua,
  [TERRENO.ARENA]: CONFIG.terreno.colorArena,
  [TERRENO.TIERRA]: CONFIG.terreno.colorTierra,
};

/** Genera el terreno con la seed actual y lo deja en `ctx.grid`. */
function generarMundo() {
  ctx.grid = generarTerreno({
    ancho: CONFIG.mundo.ancho,
    alto: CONFIG.mundo.alto,
    seed: ESTADO.seed,
    config: CONFIG.terreno,
  });
  return ctx.grid;
}

/** Siembra la población inicial en celdas habitables del terreno. */
function poblar() {
  sembrar(ctx, CONFIG.herbivoro.poblacionInicial, ESPECIE.HERBIVORO);
  sembrar(ctx, CONFIG.depredador.poblacionInicial, ESPECIE.PREDADOR);
  // Edades repartidas: si no, toda la primera generación muere a la vez.
  repartirEdadesIniciales(ctx);
}

// ── Mundo y render ────────────────────────────────────────────────
// Primero la grilla: `poblar()` la usa para elegir celdas de tierra.

// Atlas único: una sola textura base para todos los sprites (obligatorio para
// ParticleContainer). Ya viene cargándose desde antes de `app.init()`.
const atlas = await promesaAtlas;

const tile = CONFIG.mundo.tileSize;
const terrenoRenderer = new TerrainRenderer(app, { tileSize: tile, colores: COLORES_TERRENO });
app.stage.addChild(terrenoRenderer.contenedor);

generarMundo();
terrenoRenderer.generar(ctx.grid);
sembrarVegetacion(ctx);
poblar();

const renderer = new EntityRenderer(app, { atlas, tileSize: tile });

const plantRenderer = new PlantRenderer(app, {
  atlas,
  tileSize: tile,
  capacidad: ctx.grid.total,
});
// Orden de capas: terreno abajo, plantas encima, entidades arriba.
app.stage.addChild(plantRenderer.contenedor);
app.stage.addChild(renderer.contenedor);

// T56: barras de necesidades sobre la entidad seleccionada (encima de todo).
const necesidadesRenderer = new NecesidadesRenderer(app, { tileSize: tile, manager });
app.stage.addChild(necesidadesRenderer.contenedor);

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

// T55: gráfico de evolución de poblaciones.
const grafico = new Grafico(contenedor);

// T56: leyenda de colores y modo depuración.
const leyenda = new Leyenda(contenedor);

// ── Selección de entidad (T56) ───────────────────────────────────
// Un clic sobre un animal muestra sus necesidades. Se distingue del
// arrastre de cámara mirando cuánto se movió el puntero: si casi no se
// movió, fue un clic.

let punteroX = 0;
let punteroY = 0;
let movido = false;

app.canvas.addEventListener('pointerdown', (e) => {
  punteroX = e.clientX;
  punteroY = e.clientY;
  movido = false;
});

app.canvas.addEventListener('pointermove', (e) => {
  const umbral = CONFIG.ui.umbralArrastrePx;
  if (Math.abs(e.clientX - punteroX) > umbral || Math.abs(e.clientY - punteroY) > umbral) {
    movido = true;
  }
});

app.canvas.addEventListener('pointerup', (e) => {
  if (movido) return; // fue un arrastre de cámara, no un clic

  // Convierte la posición de pantalla a coordenadas de mundo.
  const rect = app.canvas.getBoundingClientRect();
  const mundoX = (e.clientX - rect.left - app.renderer.width / 2) / camara.zoom + camara.x;
  const mundoY = (e.clientY - rect.top - app.renderer.height / 2) / camara.zoom + camara.y;

  // Busca la entidad viva más cercana al clic, dentro de un radio corto.
  const radio = tile * CONFIG.ui.radioSeleccion;
  let mejor = null;
  let mejorDistancia = radio * radio;
  for (const id of manager.vivos) {
    const dx = manager.x[id] * tile - mundoX;
    const dy = manager.y[id] * tile - mundoY;
    const distancia = dx * dx + dy * dy;
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = id;
    }
  }

  necesidadesRenderer.seleccionar(mejor);
  if (mejor === null) {
    console.log('[main] selección: ninguna');
  } else {
    console.log(
      `[main] seleccionado: ${manager.tipo[mejor] === ESPECIE.HERBIVORO ? 'Triceratops' : 'Ceratosaurio'} ` +
        `en (${manager.celdaX(mejor)}, ${manager.celdaY(mejor)}) · estado ${manager.estado[mejor]}`,
    );
  }
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
      case 'd':
        // T56: cambia el color de las entidades de "por especie" a
        // "por estado de IA". Así se ve qué está haciendo cada animal.
        ESTADO.depuracion = !ESTADO.depuracion;
        leyenda.setDepuracion(ESTADO.depuracion);
        renderer.setDepuracion(ESTADO.depuracion);
        console.log(`[main] depuración: ${ESTADO.depuracion ? 'ON' : 'OFF'}`);
        break;
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
        // Seguir a un triceratops al azar.
        const herbivoros = manager.deTipo(ESPECIE.HERBIVORO);
        if (herbivoros.length > 0) {
          camara.seguir(manager, ctx.prng.pick(herbivoros), tile, CONFIG.camara.dtEnfocar);
          console.log('[main] siguiendo a un triceratops (F para soltar)');
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
        ctx.nacimientosTotales = 0;
        ctx.muertesTotales = 0;
        for (const causa of Object.keys(ctx.muertesPorCausa)) ctx.muertesPorCausa[causa] = 0;
        grafico.reiniciar();
        necesidadesRenderer.seleccionar(null);
        generarMundo();
        terrenoRenderer.generar(ctx.grid);
        sembrarVegetacion(ctx);
        plantRenderer.invalidar();
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
let fps = TICKS_POR_SEGUNDO;

function bucle(ahora) {
  // `delta` es el tiempo real del frame. NUNCA se usa para mover entidades:
  // solo alimenta el acumulador, que produce pasos fijos de 1/60 s.
  const delta = Math.min((ahora - anterior) / 1000, CONFIG.tiempo.deltaMaximo);
  anterior = ahora;
  fps += (1 / Math.max(delta, 0.0001) - fps) * CONFIG.tiempo.suavizadoFps;

  if (!ESTADO.pausa) {
    acumulador += delta * ESTADO.escalaSimulacion;
    let pasos = 0;
    while (acumulador >= CONFIG.tiempo.pasoFijo && pasos < CONFIG.tiempo.maxPasosPorFrame) {
      simular(CONFIG.tiempo.pasoFijo);
      acumulador -= CONFIG.tiempo.pasoFijo;
      pasos++;
    }
  }

  if (camara.objetivo !== null) {
    camara.seguir(manager, camara.objetivo, tile, delta);
  }

  terrenoRenderer.render(camara);
  plantRenderer.reconstruir(ctx.grid, ctx.tick, CONFIG.plantas.ticksPorRefrescoRender, camara);
  plantRenderer.render(camara);
  renderer.render(manager, camara, ctx.tick);
  necesidadesRenderer.render(camara);

  const datosPoblacion = {
    plantas: contarPlantas(ctx),
    herbivoros: manager.contar(ESPECIE.HERBIVORO),
    depredadores: manager.contar(ESPECIE.PREDADOR),
  };

  // T55: el gráfico se redibuja **una vez por segundo**, no por frame.
  // `registrar` guarda una muestra por segundo y `renderizar` solo se
  // llama cuando cambió el segundo.
  grafico.registrar(ctx.tick, datosPoblacion);
  if (ctx.tick - grafico.ultimoTick >= CONFIG.ui.graficoIntervaloTicks) {
    grafico.ultimoTick = ctx.tick;
    grafico.renderizar(datosPoblacion);
  }

  // T56: el contador por estado de IA va en la leyenda; también se pasan
  // las necesidades del animal seleccionado (vista plana).
  if (ESTADO.depuracion) {
    const conteo = {};
    for (const id of manager.vivos) {
      const estado = manager.estado[id];
      conteo[estado] = (conteo[estado] ?? 0) + 1;
    }
    leyenda.actualizar(conteo, necesidadesRenderer.seleccionada);
  } else {
    leyenda.actualizar(null, necesidadesRenderer.seleccionada);
  }

  hud.actualizar(
    {
      ...datosPoblacion,
      total: manager.total,
      nacidos: ctx.nacimientosTotales,
      muertos: ctx.muertesTotales,
      ticks: ctx.tick,
      seed: ESTADO.seed,
      fps,
      velocidad: ESTADO.escalaSimulacion,
      pausa: ESTADO.pausa,
    },
    ahora,
  );

  app.render();
  requestAnimationFrame(bucle);
}

console.log('[main] PixiJS v8 inicializado');
console.log(`[main] Atlas: ${atlas.claves.length} frames · ${atlas.ancho}x${atlas.alto} px`);
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
  `[main] Población: ${manager.contar(ESPECIE.HERBIVORO)} triceratops, ` +
    `${manager.contar(ESPECIE.PREDADOR)} ceratosaurios`,
);
console.log(`[main] Vegetación inicial: ${contarPlantas(ctx)} semillas`);
console.log(
  '[main] Controles: arrastrar = pan · rueda = zoom · F = seguir · G = centro · ' +
    'espacio = pausa · 1/2/4 = velocidad · D = depuración · clic = ver necesidades · ' +
    'R = nueva seed · S = ver seed · T = terreno',
);

// Pixi crea el buffer de GPU en el PRIMER render con el tamaño de
// `particleChildren`. Reservar la capacidad completa evita reasignaciones
// cuando cambia la cámara o crece la población.
plantRenderer.reservarBufferGPU(app);
renderer.reservarBufferGPU(app);

requestAnimationFrame(bucle);

export { app, manager, ctx, camara };
