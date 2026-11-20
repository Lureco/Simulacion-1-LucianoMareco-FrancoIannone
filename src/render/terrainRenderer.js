/**
 * src/render/terrainRenderer.js — Render del terreno (T15)
 * ========================================================
 *
 * REGLAS (TAREAS §2): prohibido `Graphics()` por celda o por frame.
 *
 * Estrategia: el terreno entero se pinta **una sola vez** en canvases offscreen y
 * se sube como **una textura por chunk**. En pantalla es un **Container** con un
 * `Sprite` por chunk, todos con `scaleMode: 'nearest'` para píxeles nítidos al
 * hacer zoom.
 *
 * - Con `marchingSquares` activo (pixel art): cada textura mide como máximo
 *   `maxTamanoTexturaMarching × maxTamanoTexturaMarching` px y las transiciones
 *   agua/arena/tierra se suavizan por píxel con marching squares (`terrainMarching.js`).
 *   El contenedor se escala para cubrir el mundo.
 * - Sin marching squares: una textura de 1 px por celda y el contenedor se escala
 *   por `zoom * tileSize` (comportamiento original).
 *
 * En ambos modos se conserva el sombreado por altura y un jitter determinista
 * mínimo. Costo por frame: posicionar/escalar un contenedor.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { hashInts } from '../core/prng.js';
import { TERRENO } from '../world/cell.js';
import { alturaDePixel, terrenoDePixel } from './terrainMarching.js';

/** Jitter de brillo por celda (±). Muy chico: solo rompe la banda plana. */
const JITTER_BRILLO = 0.03;

/**
 * Escribe un color RGB en el buffer RGBA, con brillo modulado.
 * @param {Uint8ClampedArray} pixeles
 * @param {number} p Índice base del píxel en el buffer.
 * @param {number} color Color base 0xRRGGBB.
 * @param {number} brillo Multiplicador de brillo.
 */
function escribirColor(pixeles, p, color, brillo) {
  pixeles[p] = Math.max(0, Math.min(255, ((color >> 16) & 0xff) * brillo));
  pixeles[p + 1] = Math.max(0, Math.min(255, ((color >> 8) & 0xff) * brillo));
  pixeles[p + 2] = Math.max(0, Math.min(255, (color & 0xff) * brillo));
  pixeles[p + 3] = 255;
}

export class TerrainRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number, colores: Record<string, number>, marchingSquares?: boolean, pixelesPorCeldaMarching?: number, maxTamanoTexturaMarching?: number}} opciones
   */
  constructor(
    app,
    {
      tileSize,
      colores,
      marchingSquares = true,
      pixelesPorCeldaMarching = 4,
      maxTamanoTexturaMarching = 1024,
    },
  ) {
    this.app = app;
    this.tileSize = tileSize;
    this.colores = colores;
    this.marchingSquares = marchingSquares;
    this.pixelesPorCeldaMarching = Math.max(1, Math.trunc(pixelesPorCeldaMarching) || 4);
    this.maxTamanoTexturaMarching = Math.max(1, Math.trunc(maxTamanoTexturaMarching) || 1024);

    /** @type {Container} Contenedor del terreno (debajo de todo). */
    this.contenedor = new Container();

    /** Sprites de chunks (uno por textura generada). */
    this.sprites = [];
    /** Texturas generadas (para destruir al regenerar/liberar). */
    this.texturas = [];
    /** Indica si el modo marching squares está activo tras la última generación. */
    this._modoMarchingActivo = false;
  }

  /**
   * Pinta la grilla en texturas nuevas. Destruye las texturas/sprites previos
   * para no acumular memoria al regenerar el mapa.
   * @param {import('../world/grid.js').Grid} grid
   */
  generar(grid) {
    this._limpiar();

    if (this.marchingSquares) {
      try {
        this.generarMarching(grid);
        this._modoMarchingActivo = true;
      } catch {
        // Si alguna textura-chunk es demasiado grande para el entorno,
        // volver al render clásico (1 px/celda) para no romper la simulación.
        this.generarPlano(grid);
        this._modoMarchingActivo = false;
      }
    } else {
      this.generarPlano(grid);
      this._modoMarchingActivo = false;
    }
  }

  /** Destruye texturas y sprites previos y vacía el contenedor. */
  _limpiar() {
    for (const sprite of this.sprites) {
      if (sprite.texture) sprite.texture.destroy(true);
      sprite.destroy();
    }
    this.sprites = [];
    this.texturas = [];
    this.contenedor.removeChildren();
  }

  /**
   * Render clásico: 1 píxel por celda, sin suavizado de bordes.
   * @param {import('../world/grid.js').Grid} grid
   */
  generarPlano(grid) {
    const { ancho, alto } = grid;

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const contexto2d = canvas.getContext('2d');
    const imagen = contexto2d.createImageData(ancho, alto);
    const pixeles = imagen.data;

    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = y * ancho + x;
        const altura = grid.altura[i];
        const color = this.colores[grid.terreno[i]] ?? 0xff00ff;
        const ruido = hashInts(x, y, 0xa5) / 4294967296 - 0.5;
        const brillo = 1 + (altura - 0.5) * 0.9 + ruido * JITTER_BRILLO;
        escribirColor(pixeles, i * 4, color, brillo);
      }
    }

    contexto2d.putImageData(imagen, 0, 0);

    const textura = Texture.from(canvas);
    textura.source.scaleMode = 'nearest';
    const sprite = new Sprite(textura);
    sprite.anchor.set(0);
    sprite.position.set(0, 0);
    this.contenedor.addChild(sprite);
    this.sprites.push(sprite);
    this.texturas.push(textura);
  }

  /**
   * Render con marching squares: resolución configurable por celda, dividido en
   * chunks para evitar crear un canvas/ImageData demasiado grande.
   * @param {import('../world/grid.js').Grid} grid
   */
  generarMarching(grid) {
    const { ancho, alto } = grid;
    const detalle = this.pixelesPorCeldaMarching;
    const maxTamano = this.maxTamanoTexturaMarching;

    const anchoPx = ancho * detalle;
    const altoPx = alto * detalle;

    const chunksX = Math.ceil(anchoPx / maxTamano);
    const chunksY = Math.ceil(altoPx / maxTamano);

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const origenX = cx * maxTamano;
        const origenY = cy * maxTamano;
        const anchoChunk = Math.min(maxTamano, anchoPx - origenX);
        const altoChunk = Math.min(maxTamano, altoPx - origenY);

        const canvas = document.createElement('canvas');
        canvas.width = anchoChunk;
        canvas.height = altoChunk;
        const contexto2d = canvas.getContext('2d');
        const imagen = contexto2d.createImageData(anchoChunk, altoChunk);
        const pixeles = imagen.data;

        for (let gy = 0; gy < altoChunk; gy++) {
          const yGlobal = origenY + gy;
          const ty = Math.floor(yGlobal / detalle);
          const ly = yGlobal % detalle;
          for (let gx = 0; gx < anchoChunk; gx++) {
            const xGlobal = origenX + gx;
            const tx = Math.floor(xGlobal / detalle);
            const lx = xGlobal % detalle;
            const i = ty * ancho + tx;
            const tipoCelda = grid.terreno[i];
            const ruido = hashInts(tx, ty, 0xa5) / 4294967296 - 0.5;

            const tipoPx = terrenoDePixel(grid, tx, ty, lx, ly, detalle);
            const alturaPx =
              tipoPx === tipoCelda ? grid.altura[i] : alturaDePixel(grid, tx, ty, lx, ly, detalle);
            const color = this.colores[tipoPx] ?? 0xff00ff;
            const brillo = 1 + (alturaPx - 0.5) * 0.9 + ruido * JITTER_BRILLO;

            const p = (gy * anchoChunk + gx) * 4;
            escribirColor(pixeles, p, color, brillo);
          }
        }

        contexto2d.putImageData(imagen, 0, 0);

        const textura = Texture.from(canvas);
        textura.source.scaleMode = 'nearest';
        const sprite = new Sprite(textura);
        sprite.anchor.set(0);
        sprite.position.set(origenX, origenY);
        this.contenedor.addChild(sprite);
        this.sprites.push(sprite);
        this.texturas.push(textura);
      }
    }
  }

  /**
   * Posiciona y escala el contenedor del terreno según la cámara. Mismo cambio
   * de coordenadas que `EntityRenderer`:
   *   pantalla = (mundo - camara) * zoom + centro_de_la_vista
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    if (this.sprites.length === 0) return;
    const zoom = camara.zoom;
    const escala = this._modoMarchingActivo
      ? (zoom * this.tileSize) / this.pixelesPorCeldaMarching
      : zoom * this.tileSize;
    this.contenedor.x = (0 - camara.x) * zoom + camara.vistaAnchoPx / 2;
    this.contenedor.y = (0 - camara.y) * zoom + camara.vistaAltoPx / 2;
    this.contenedor.scale.set(escala);
  }

  /**
   * Libera texturas y sprites (si se destruye el renderer).
   */
  destruir() {
    this._limpiar();
  }
}

/** Reexportado para que el main no importe `cell.js` solo por esto. */
export { TERRENO };
