/**
 * src/render/terrainRenderer.js — Render del terreno (T15)
 * ========================================================
 *
 * REGLAS (TAREAS §2): prohibido `Graphics()` por celda o por frame.
 *
 * Estrategia: el terreno entero se pinta **una sola vez** en un canvas
 * offscreen de 1 píxel por celda y se sube como **una única textura**. En
 * pantalla es **un único `Sprite`** escalado a `tileSize`, con
 * `scaleMode: 'nearest'` para que los píxeles queden nítidos al hacer zoom.
 *
 * Costo por frame: posicionar un sprite. Costo por regeneración: un blit de
 * ancho×alto píxeles (65.536 para 256×256 — imperceptible).
 *
 * El color de cada celda es el del tipo de terreno modulado por la altura
 * (más profundo = más oscuro) más un jitter mínimo determinista para romper
 * el aspecto de "pintura plana".
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { hashInts } from '../core/prng.js';
import { TERRENO } from '../world/cell.js';

/** Jitter de brillo por celda (±). Muy chico: solo rompe la banda plana. */
const JITTER_BRILLO = 0.03;

export class TerrainRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number, colores: Record<string, number>}} opciones
   */
  constructor(app, { tileSize, colores }) {
    this.app = app;
    this.tileSize = tileSize;
    this.colores = colores;

    /** @type {Container} Contenedor del sprite del terreno (debajo de todo). */
    this.contenedor = new Container();

    /** @type {Sprite | null} Único sprite del mapa. */
    this.sprite = null;
    /** @type {Texture | null} Textura del mapa (1 px por celda). */
    this.textura = null;
  }

  /**
   * Pinta la grilla en una textura nueva. Si ya había una, la destruye:
   * regenerar el mapa no debe acumular texturas.
   * @param {import('../world/grid.js').Grid} grid
   */
  generar(grid) {
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

        // Brillo: más alto = más claro. El jitter por celda (determinista,
        // derivado solo de la posición) evita las bandas de color planas.
        const ruido = hashInts(x, y, 0xa5) / 4294967296 - 0.5;
        const brillo = 1 + (altura - 0.5) * 0.9 + ruido * JITTER_BRILLO;

        const p = i * 4;
        pixeles[p] = Math.max(0, Math.min(255, ((color >> 16) & 0xff) * brillo));
        pixeles[p + 1] = Math.max(0, Math.min(255, ((color >> 8) & 0xff) * brillo));
        pixeles[p + 2] = Math.max(0, Math.min(255, (color & 0xff) * brillo));
        pixeles[p + 3] = 255;
      }
    }

    contexto2d.putImageData(imagen, 0, 0);

    if (this.textura) this.textura.destroy(true);
    this.textura = Texture.from(canvas);
    this.textura.source.scaleMode = 'nearest';

    if (!this.sprite) {
      this.sprite = new Sprite(this.textura);
      this.sprite.anchor.set(0);
      this.contenedor.addChild(this.sprite);
    } else {
      this.sprite.texture = this.textura;
    }

    // La textura mide `ancho`×`alto` px (1 px por celda); `render()` la
    // escala a `tileSize * zoom` para cubrir el mundo en pantalla.
  }

  /**
   * Posiciona el sprite del terreno según la cámara. Mismo cambio de
   * coordenadas que `EntityRenderer`:
   *   pantalla = (mundo - camara) * zoom + centro_de_la_vista
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    if (!this.sprite) return;
    const tile = this.tileSize;
    const zoom = camara.zoom;
    this.sprite.x = (0 - camara.x) * zoom + camara.vistaAnchoPx / 2;
    this.sprite.y = (0 - camara.y) * zoom + camara.vistaAltoPx / 2;
    this.sprite.scale.set(zoom * tile);
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
