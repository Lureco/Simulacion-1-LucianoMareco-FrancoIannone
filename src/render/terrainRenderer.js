/**
 * src/render/terrainRenderer.js — Render del terreno (T15)
 * ========================================================
 *
 * REGLAS (TAREAS §2): prohibido `Graphics()` por celda o por frame.
 *
 * Estrategia: el terreno entero se pinta **una sola vez** en un canvas
 * offscreen y se sube como **una única textura**. En pantalla es **un único
 * `Sprite`**, con `scaleMode: 'nearest'` para píxeles nítidos al hacer zoom.
 *
 * - Con `marchingSquares` activo (pixel art): la textura mide
 *   `ancho*tileSize × alto*tileSize` y las transiciones agua/arena/tierra se
 *   suavizan por píxel con marching squares (`terrainMarching.js`), evitando
 *   cortes rectos entre celdas. El sprite se escala solo por el zoom.
 * - Sin marching squares: la textura mide 1 px por celda y el sprite se escala
 *   por `zoom * tileSize` (comportamiento original).
 *
 * En ambos modos se conserva el sombreado por altura y un jitter determinista
 * mínimo. Costo por frame: posicionar un sprite.
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
   * @param {{tileSize: number, colores: Record<string, number>, marchingSquares?: boolean}} opciones
   */
  constructor(app, { tileSize, colores, marchingSquares = true }) {
    this.app = app;
    this.tileSize = tileSize;
    this.colores = colores;
    this.marchingSquares = marchingSquares;

    /** @type {Container} Contenedor del sprite del terreno (debajo de todo). */
    this.contenedor = new Container();

    /** @type {Sprite | null} Único sprite del mapa. */
    this.sprite = null;
    /** @type {Texture | null} Textura del mapa. */
    this.textura = null;
  }

  /**
   * Pinta la grilla en una textura nueva. Si ya había una, la destruye para
   * no acumular texturas.
   * @param {import('../world/grid.js').Grid} grid
   */
  generar(grid) {
    if (this.marchingSquares) {
      this.generarMarching(grid);
    } else {
      this.generarPlano(grid);
    }

    if (this.textura) this.textura.source.scaleMode = 'nearest';

    if (!this.sprite) {
      this.sprite = new Sprite(this.textura);
      this.sprite.anchor.set(0);
      this.contenedor.addChild(this.sprite);
    } else {
      this.sprite.texture = this.textura;
    }
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

    if (this.textura) this.textura.destroy(true);
    this.textura = Texture.from(canvas);
  }

  /**
   * Render con marching squares: 1 tile por celda para bordes pixel-art.
   * @param {import('../world/grid.js').Grid} grid
   */
  generarMarching(grid) {
    const { ancho, alto } = grid;
    const tile = this.tileSize;

    const canvas = document.createElement('canvas');
    canvas.width = ancho * tile;
    canvas.height = alto * tile;
    const contexto2d = canvas.getContext('2d');
    const imagen = contexto2d.createImageData(canvas.width, canvas.height);
    const pixeles = imagen.data;
    const anchoPx = canvas.width;

    for (let ty = 0; ty < alto; ty++) {
      for (let tx = 0; tx < ancho; tx++) {
        const i = ty * ancho + tx;
        const tipoCelda = grid.terreno[i];
        const ruido = hashInts(tx, ty, 0xa5) / 4294967296 - 0.5;

        const baseY = ty * tile;
        const baseX = tx * tile;

        for (let ly = 0; ly < tile; ly++) {
          for (let lx = 0; lx < tile; lx++) {
            const tipoPx = terrenoDePixel(grid, tx, ty, lx, ly, tile);
            const alturaPx =
              tipoPx === tipoCelda ? grid.altura[i] : alturaDePixel(grid, tx, ty, lx, ly, tile);
            const color = this.colores[tipoPx] ?? 0xff00ff;
            const brillo = 1 + (alturaPx - 0.5) * 0.9 + ruido * JITTER_BRILLO;

            const p = ((baseY + ly) * anchoPx + (baseX + lx)) * 4;
            escribirColor(pixeles, p, color, brillo);
          }
        }
      }
    }

    contexto2d.putImageData(imagen, 0, 0);

    if (this.textura) this.textura.destroy(true);
    this.textura = Texture.from(canvas);
  }

  /**
   * Posiciona el sprite del terreno según la cámara. Mismo cambio de
   * coordenadas que `EntityRenderer`:
   *   pantalla = (mundo - camara) * zoom + centro_de_la_vista
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    if (!this.sprite) return;
    const zoom = camara.zoom;
    this.sprite.x = (0 - camara.x) * zoom + camara.vistaAnchoPx / 2;
    this.sprite.y = (0 - camara.y) * zoom + camara.vistaAltoPx / 2;
    this.sprite.scale.set(this.marchingSquares ? zoom : zoom * this.tileSize);
  }

  /**
   * Libera la textura (si se destruye el renderer).
   */
  destruir() {
    if (this.sprite) this.sprite.destroy();
    if (this.textura) this.textura.destroy(true);
    this.sprite = null;
    this.textura = null;
  }
}

/** Reexportado para que el main no importe `cell.js` solo por esto. */
export { TERRENO };
