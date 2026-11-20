/**
 * src/render/atlas.js — Atlas único de sprites (T75 · F7.5)
 * =========================================================
 *
 * Las imágenes fuente viven **sueltas** en `assets/sprites/`:
 *
 *   assets/sprites/plantas/plantaNormal/{semilla,joven,adulta}.png
 *   assets/sprites/animales/trike_herbivore/walk_0.png ... walk_8.png
 *   assets/sprites/animales/ceratosaurus_carnivore/walk_0.png ... walk_10.png
 *
 * Las rutas y la cantidad de cuadros de cada especie se configuran en
 * `CONFIG.sprites`, no se hardcodean acá.
 *
 * Vite descubre los PNG con `import.meta.glob`, los ordena por ruta y este
 * módulo los dibuja **una sola vez** en un canvas offscreen. De ahí sale una
 * única textura base con sub-texturas por frame (UV), que es lo que exige
 * `ParticleContainer` en PixiJS v8.
 *
 * Si todavía no hay arte (o falta algún PNG), se dibuja un frame de prueba en
 * el mismo canvas: así el juego sigue andando mientras se cargan los sprites.
 * Nada de esto ocurre dentro del bucle de simulación.
 *
 * Las plantas cambian de sprite por **evento de estado** (`grid.planta`):
 * nace semilla → joven → adulta, y al morir desaparecen. No se usa la edad.
 */

import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { CONFIG } from '../config.js';
import { ESPECIE } from '../entities/entity.js';
import { ESPECIE_PLANTA, PLANTA } from '../world/cell.js';
import { COLOR_ESPECIE } from './paleta.js';
import { claveDe, clavesBase } from './atlasDatos.js';

// Se reexporta la parte pura (sin Vite/DOM) para no romper importes existentes.
export {
  claveDe,
  clavesBase,
  cuadrosDe,
  faseCaminar,
  frameAnimal,
  framePlanta,
} from './atlasDatos.js';

/**
 * URLs de los PNG. Vite resuelve el glob al compilar; si no hay archivos,
 * el objeto sale vacío y se usan los frames de prueba.
 */
const URLS = import.meta.glob('../../assets/sprites/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Rutas de los PNG descubiertos por Vite (para tests y diagnóstico). */
export function urlsSprites() {
  return Object.keys(URLS);
}

/**
 * Todas las claves del atlas, ordenadas. El orden fijo hace que los UV sean
 * reproducibles (misma seed + mismos archivos ⇒ mismo atlas).
 * @param {Record<string, string>} [urls]
 * @returns {string[]}
 */
export function clavesAtlas(urls = URLS) {
  const encontradas = Object.keys(urls).map(claveDe);
  return [...new Set([...clavesBase(), ...encontradas])].sort();
}

/** @param {number} color 0xRRGGBB @returns {string} */
function css(color) {
  return `#${(color ?? 0xffffff).toString(16).padStart(6, '0')}`;
}

/**
 * Dibuja un sprite de prueba cuando no hay PNG. Es temporal: se reemplaza
 * solo con tirar un archivo con la clave correspondiente en la carpeta.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} clave
 * @param {number} x
 * @param {number} y
 * @param {number} tam
 */
function dibujarFallback(ctx, clave, x, y, tam) {
  ctx.save();
  ctx.translate(x + tam / 2, y + tam / 2);

  // F8/T65: el micelio no tiene PNG propio. Su frame de prueba se dibuja con
  // forma de hongo y la paleta del hongo, para distinguirlo del pasto.
  const rutasMicelio = Object.entries(
    CONFIG.sprites.rutaPlantaPorEspecie?.[ESPECIE_PLANTA.MICELIO] ?? {},
  );
  const estadoMicelio = Number(rutasMicelio.find(([, ruta]) => ruta === clave)?.[0] ?? NaN);
  if (!Number.isNaN(estadoMicelio)) {
    const cfg = CONFIG.plantas;
    const color =
      estadoMicelio === PLANTA.SEMILLA
        ? cfg.colorMicelioSemilla
        : estadoMicelio === PLANTA.JOVEN
          ? cfg.colorMicelioJoven
          : cfg.colorMicelioAdulta;
    const radio =
      estadoMicelio === PLANTA.SEMILLA
        ? tam * 0.12
        : estadoMicelio === PLANTA.JOVEN
          ? tam * 0.2
          : tam * 0.28;
    ctx.fillStyle = css(color);
    ctx.fillRect(-radio * 0.16, -radio * 0.1, radio * 0.32, radio * 1.2);
    for (const [ox, oy, r] of [
      [-0.6, -0.35, 0.6],
      [0.6, -0.35, 0.6],
      [0, -0.65, 0.85],
    ]) {
      ctx.beginPath();
      ctx.arc(ox * radio, oy * radio, r * radio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const estado = Number(
    Object.keys(CONFIG.sprites.rutaPlanta).find((k) => CONFIG.sprites.rutaPlanta[k] === clave) ??
      NaN,
  );

  if (!Number.isNaN(estado)) {
    const color =
      estado === PLANTA.SEMILLA
        ? 0x6f7f4a
        : estado === PLANTA.JOVEN
          ? 0x6fae52
          : 0x3f8f3a;
    const radio =
      estado === PLANTA.SEMILLA ? tam * 0.16 : estado === PLANTA.JOVEN ? tam * 0.26 : tam * 0.36;
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.arc(0, 0, radio, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const tipo =
      [ESPECIE.HERBIVORO, ESPECIE.PREDADOR].find((t) =>
        clave.startsWith(`${CONFIG.sprites.rutaAnimal[t].carpeta}/`),
      ) ?? ESPECIE.HERBIVORO;
    const match = /_(\d+)$/.exec(clave);
    const cuadro = match === null ? 0 : Number(match[1]);
    const paso = cuadro % 2 === 0 ? 1 : -1;

    ctx.fillStyle = css(COLOR_ESPECIE[tipo]);
    ctx.fillRect(-tam * 0.32, -tam * 0.14, tam * 0.64, tam * 0.28);
    ctx.fillRect(-tam * 0.24, tam * 0.13 + paso * tam * 0.06, tam * 0.13, tam * 0.14);
    ctx.fillRect(tam * 0.11, tam * 0.13 - paso * tam * 0.06, tam * 0.13, tam * 0.14);
    if (tipo === ESPECIE.PREDADOR) {
      // Cola larga para distinguir al ceratosaurio del triceratops.
      ctx.fillRect(tam * 0.3, -tam * 0.05, tam * 0.24, tam * 0.08);
    } else {
      // Cuerno delantero.
      ctx.fillRect(-tam * 0.44, -tam * 0.04, tam * 0.14, tam * 0.08);
    }
  }

  ctx.restore();
}

/**
 * Arma el atlas. Se llama **una vez**, antes de crear los renderers.
 * @returns {Promise<{
 *   textura: import('pixi.js').Texture,
 *   frames: Map<string, import('pixi.js').Texture>,
 *   claves: string[],
 *   ancho: number,
 *   alto: number
 * }>}
 */
export async function crearAtlas() {
  const cfg = CONFIG.sprites;
  const tam = cfg.tamanoFrame;
  const pad = cfg.padding;
  const claves = clavesAtlas();
  const columnas = Math.max(1, Math.ceil(Math.sqrt(claves.length)));
  const filas = Math.ceil(claves.length / columnas);

  const canvas = document.createElement('canvas');
  canvas.width = columnas * (tam + pad) + pad;
  canvas.height = filas * (tam + pad) + pad;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const urls = new Map(Object.entries(URLS).map(([ruta, url]) => [claveDe(ruta), url]));

  // Cargar y decodificar TODOS los PNG en paralelo. Hacer `await decode()`
  // dentro del bucle de dibujo costaba 23 latencias seguidas y retrasaba todo
  // el arranque (terreno, vegetación y animales) varios segundos.
  const imagenes = new Map();
  await Promise.all(
    claves.map(async (clave) => {
      const url = urls.get(clave);
      if (url === undefined) return;
      try {
        const imagen = new Image();
        imagen.src = url;
        await imagen.decode();
        imagenes.set(clave, imagen);
      } catch {
        // PNG corrupto o no decodificable: se cae al frame de prueba.
      }
    }),
  );

  // El orden de `claves` es fijo, así que los UV siguen siendo reproducibles.
  for (let i = 0; i < claves.length; i++) {
    const clave = claves[i];
    const x = pad + (i % columnas) * (tam + pad);
    const y = pad + ((i / columnas) | 0) * (tam + pad);
    const imagen = imagenes.get(clave);
    let dibujado = false;

    if (imagen !== undefined) {
      // Los PNG tienen tamaños distintos (58×35, 60×35, 32×32...). Se dibujan
      // a tamaño natural y centrados en el casillero: sin estirar ni deformar.
      const anchoImg = imagen.naturalWidth || imagen.width;
      const altoImg = imagen.naturalHeight || imagen.height;
      const factor = Math.min(1, tam / Math.max(anchoImg, altoImg));
      const ancho = anchoImg * factor;
      const alto = altoImg * factor;
      ctx.drawImage(imagen, x + (tam - ancho) / 2, y + (tam - alto) / 2, ancho, alto);
      dibujado = true;
    }
    if (!dibujado && cfg.generarFallback) dibujarFallback(ctx, clave, x, y, tam);
  }

  // Una sola TextureSource para todos los frames → un solo draw call.
  const source = new CanvasSource({ resource: canvas, resolution: 1, scaleMode: 'nearest' });
  const textura = new Texture({ source });
  const frames = new Map();

  for (let i = 0; i < claves.length; i++) {
    frames.set(
      claves[i],
      new Texture({
        source,
        frame: new Rectangle(
          pad + (i % columnas) * (tam + pad),
          pad + ((i / columnas) | 0) * (tam + pad),
          tam,
          tam,
        ),
      }),
    );
  }

  return { textura, frames, claves, ancho: canvas.width, alto: canvas.height };
}
