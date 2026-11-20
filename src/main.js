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
import { TERRENO } from './world/cell.js';
import {
  sembrarVegetacion,
  contarPlantas,
  contarPlantasPorEspecie,
} from './systems/plantGrowth.js';
import { Hud } from './ui/hud.js';
import { Controles } from './ui/controles.js';
import { Leyenda } from './ui/leyenda.js';
import { Grafico } from './ui/grafico.js';
import { GeneradorMapa } from './ui/generadorMapa.js';
import { copiarTexto } from './ui/portapapeles.js';
import { guardarOverrides, limpiarOverrides } from './core/configPersistencia.js';

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
  sembrar(ctx, ESTADO.inicial.herbivoros, ESPECIE.HERBIVORO);
  sembrar(ctx, ESTADO.inicial.depredadores, ESPECIE.PREDADOR);
  // Edades repartidas: si no, toda la primera generación muere a la vez.
  repartirEdadesIniciales(ctx);
}

/**
 * Regenera el mundo completo con los parámetros elegidos (T84). Es el único
 * camino de (re)generación: lo usan el menú y la tecla R. Compartir la función
 * evita que una ruta reinicie el gráfico y la otra no (regresión T61).
 * @param {{seed: number, plantas: number, herbivoros: number, depredadores: number}} parametros
 */
function regenerarMundo({ seed, plantas, herbivoros, depredadores }) {
  ESTADO.seed = seed >>> 0;
  ESTADO.inicial = { plantas, herbivoros, depredadores };

  manager.limpiar();
  ctx.prng = new PRNG(ESTADO.seed);
  ctx.tick = 0;
  ctx.nacimientosTotales = 0;
  ctx.muertesTotales = 0;
  ctx.desplazamientos = 0;
  for (const causa of Object.keys(ctx.muertesPorCausa)) ctx.muertesPorCausa[causa] = 0;
  grafico.reiniciar();
  necesidadesRenderer.seleccionar(null);

  generarMundo();
  terrenoRenderer.generar(ctx.grid);
  sembrarVegetacion(ctx, plantas);
  plantRenderer.invalidar();
  poblar();
}

// ── Mundo y render ────────────────────────────────────────────────
// Primero la grilla: `poblar()` la usa para elegir celdas de tierra.

// Atlas único: una sola textura base para todos los sprites (obligatorio para
// ParticleContainer). Ya viene cargándose desde antes de `app.init()`.
const atlas = await promesaAtlas;

const tile = CONFIG.mundo.tileSize;
const terrenoRenderer = new TerrainRenderer(app, {
  tileSize: tile,
  colores: COLORES_TERRENO,
  marchingSquares: CONFIG.terreno.marchingSquares,
  pixelesPorCeldaMarching: CONFIG.terreno.pixelesPorCeldaMarching,
  maxTamanoTexturaMarching: CONFIG.terreno.maxTamanoTexturaMarching,
});
app.stage.addChild(terrenoRenderer.contenedor);

generarMundo();
terrenoRenderer.generar(ctx.grid);
sembrarVegetacion(ctx, ESTADO.inicial.plantas);
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

// F8/T68: la seed se copia igual desde el botón del HUD que con la tecla S.
async function copiarSeed() {
  return copiarTexto(String(ESTADO.seed));
}
hud.alCopiarSeed = copiarSeed;

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

// F8/T84: panel de configuración (categorías + presets). Al aplicar se guardan
// los overrides y se recarga la página: así hasta los valores que se capturan
// al arrancar (colores, tamaño del mundo, zoom, atlas) se aplican sin parches.
const generadorMapa = new GeneradorMapa(contenedor, {
  alGenerar: (valores) => {
    guardarOverrides(valores);
    location.reload();
  },
  alRestablecer: () => {
    limpiarOverrides();
    location.reload();
  },
  seed: ESTADO.seed,
  plantas: ESTADO.inicial.plantas,
  herbivoros: ESTADO.inicial.herbivoros,
  depredadores: ESTADO.inicial.depredadores,
  maxPlantas: ctx.grid.total,
  maxNpcs: CONFIG.entidades.maxEntidades,
});

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
    // F8/T84: mientras se escribe en el panel, las teclas son texto, no
    // atajos (si no, una "r" en la seed regeneraría el mundo y un espacio
    // pausaría la simulación).
    const etiqueta = e.target?.tagName?.toLowerCase();
    if (
      etiqueta === 'input' ||
      etiqueta === 'textarea' ||
      etiqueta === 'select' ||
      e.target?.isContentEditable
    ) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'd':
        // T56: cambia el color de las entidades de "por especie" a
        // "por estado de IA". Así se ve qué está haciendo cada animal.
        ESTADO.depuracion = !ESTADO.depuracion;
        leyenda.setDepuracion(ESTADO.depuracion);
        renderer.setDepuracion(ESTADO.depuracion);
        hud.avisar(`depuración ${ESTADO.depuracion ? 'ON' : 'OFF'}`);
        break;
      case ' ':
        ESTADO.pausa = !ESTADO.pausa;
        controles.setPausa(ESTADO.pausa);
        hud.avisar(ESTADO.pausa ? 'PAUSA' : 'CORRIENDO');
        break;
      case '1':
      case '2':
      case '4': {
        const velocidad = Number(e.key);
        ESTADO.escalaSimulacion = velocidad;
        controles.setVelocidad(velocidad);
        hud.avisar(`velocidad ${velocidad}×`);
        break;
      }
      case 'f': {
        // Seguir a un triceratops al azar.
        const herbivoros = manager.deTipo(ESPECIE.HERBIVORO);
        if (herbivoros.length > 0) {
          camara.seguir(manager, ctx.prng.pick(herbivoros), tile, CONFIG.camara.dtEnfocar);
          hud.avisar('siguiendo a un triceratops (F para soltar)');
        }
        break;
      }
      case 'g':
        camara.soltar();
        camara.x = (CONFIG.mundo.ancho * tile) / 2;
        camara.y = (CONFIG.mundo.alto * tile) / 2;
        break;
      case 'r': {
        // Nueva seed con las mismas cantidades iniciales elegidas en el menú.
        const seed = ctx.prng.int(1, 2 ** 31);
        regenerarMundo({ seed, ...ESTADO.inicial });
        hud.avisar(`nueva seed ${ESTADO.seed}`);
        break;
      }
      case 's':
        copiarSeed().then((ok) => hud.avisarCopia(ok));
        break;
      case 't': {
        const { agua, arena, tierra } = ctx.grid.contarTerreno();
        hud.avisar(
          `agua ${agua} · arena ${arena} · tierra ${tierra} · plantas ${contarPlantas(ctx)}`,
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
  plantRenderer.reconstruir(ctx.grid, ctx.tick, CONFIG.entidadesEstaticas.ticksPorRefrescoRender, camara);
  plantRenderer.render(camara);
  renderer.render(manager, camara, ctx.tick);
  necesidadesRenderer.render(camara);

  // Un solo barrido de la grilla por frame (F8: el conteo por especie reemplaza
  // al conteo total, en vez de sumar otro recorrido de 65.536 celdas).
  const porEspecie = contarPlantasPorEspecie(ctx);
  const datosPoblacion = {
    plantas: porEspecie.pasto + porEspecie.micelio,
    pasto: porEspecie.pasto,
    micelio: porEspecie.micelio,
    desplazamientos: porEspecie.desplazamientos,
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

// T74: el arranque también se informa en pantalla; no queda console.log de
// depuración en `src/`. La leyenda y los controles explican el resto de atajos.
hud.avisar(`seed ${ESTADO.seed} · ${CONFIG.mundo.ancho}×${CONFIG.mundo.alto} celdas`);

// Pixi crea el buffer de GPU en el PRIMER render con el tamaño de
// `particleChildren`. Reservar la capacidad completa evita reasignaciones
// cuando cambia la cámara o crece la población.
plantRenderer.reservarBufferGPU(app);
renderer.reservarBufferGPU(app);

requestAnimationFrame(bucle);

export { app, manager, ctx, camara, generadorMapa };
