/**
 * src/render/plantRenderer.js — Render de la vegetación (T32, T77 · F7.5)
 * ======================================================================
 *
 * La vegetación vive en la grilla (no son entidades). Dibujar 65.536 celdas
 * por frame no es viable, así que este renderer usa `ParticleContainer`:
 *
 * - **Un solo draw call**: todas las partículas comparten la textura base del
 *   atlas (`CONFIG.sprites`), cambia el frame por UV según el estado.
 * - **Capacidad reservada al arrancar**: `grid.ancho * grid.alto` partículas
 *   creadas una sola vez. Nunca se hace `new Particle()` en el bucle.
 * - **Culling por cámara (T64)**: el barrido de la grilla solo recorre el
 *   rectángulo de celdas visibles (más `CONFIG.render.margenCulling`), no las
 *   65.536 celdas. Es O(visibles) incluso en el peor caso.
 * - La lista se reconstruye cada `CONFIG.plantas.ticksPorRefrescoRender` ticks
 *   **o cuando se mueve la cámara**, porque el culling depende de la vista.
 * - `position` y `vertex` son dinámicos (cámara/zoom); `uvs` y `color` son
 *   estáticos y se suben con `container.update()` solo al reconstruir.
 *
 * El sprite se elige **solo por el estado** de `grid.planta`: nace semilla →
 * joven → adulta, y muerta/vacía no se dibuja. Nunca se lee la edad.
 */

import { Particle, ParticleContainer, Rectangle } from 'pixi.js';
import { CONFIG } from '../config.js';
import { PLANTA } from '../world/cell.js';
import { framePlanta } from './atlasDatos.js';

export class PlantRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{
   *   atlas: {textura: import('pixi.js').Texture, frames: Map<string, import('pixi.js').Texture>},
   *   tileSize: number,
   *   capacidad?: number
   * }} opciones
   */
  constructor(_app, { atlas, tileSize, capacidad = CONFIG.mundo.ancho * CONFIG.mundo.alto }) {
    this.atlas = atlas;
    this.tileSize = tileSize;
    this.capacidad = capacidad;

    /** Tamaño de un casillero de 64 px en píxeles de mundo (antes del zoom). */
    this.escalaBase = (tileSize * CONFIG.sprites.escalaPlanta) / CONFIG.sprites.tamanoFrame;

    // Pool fijo. Se crea TODO acá, nunca dentro del bucle.
    /** @type {Particle[]} */
    this.particulas = new Array(capacidad);
    /** Posición de mundo (píxeles) de cada partícula activa. @type {Float32Array} */
    this.mundoX = new Float32Array(capacidad);
    /** @type {Float32Array} */
    this.mundoY = new Float32Array(capacidad);
    /** Frame por defecto hasta que reconstruir() asigne el real. */
    const base = atlas.frames.get(framePlanta(PLANTA.JOVEN)) ?? atlas.textura;
    for (let i = 0; i < capacidad; i++) {
      const p = new Particle(base);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      p.scaleX = this.escalaBase;
      p.scaleY = this.escalaBase;
      this.particulas[i] = p;
    }

    /**
     * Reservar la capacidad completa (con una COPIA, porque el array del
     * container se recorta a los visibles) evita que Pixi tenga que agrandar
     * el buffer de índices a mitad de la partida.
     */
    /** @type {ParticleContainer<Particle>} */
    this.contenedor = new ParticleContainer({
      texture: atlas.textura,
      particles: this.particulas.slice(),
      dynamicProperties: {
        position: true,
        vertex: true,
        uvs: false,
        color: false,
        rotation: false,
      },
    });
    // ParticleContainer no calcula bounds: hay que darle un área manual.
    // La actualizamos en render() con el tamaño de la vista.
    this.contenedor.boundsArea = new Rectangle(0, 0, 1, 1);

    /**
     * Pixi hace un render inicial ANTES del primer `bucle()` (autoStart del
     * ticker), con las 65.536 partículas del pool y todavía sin reconstruir.
     * Sin este `update()` los atributos estáticos no se suben y ese primer
     * draw call falla con GL_INVALID_OPERATION. `reconstruir()` vuelve a
     * marcarlo al cambiar los frames.
     */
    this.contenedor.update();

    /** Último tick en el que se reconstruyó la lista. */
    this.ultimoTick = -Infinity;
    /** Rectángulo de celdas visibles de la última reconstrucción. */
    this.rect = { x0: 0, y0: 0, x1: -1, y1: -1 };
  }

  /**
   * Crea el buffer de GPU con la capacidad completa ANTES del primer frame,
   * para que no haya que reasignarlo cuando cambie la cámara.
   * @param {import('pixi.js').Application} app
   */
  reservarBufferGPU(app) {
    const pipe = app?.renderer?.renderPipes?.particle;
    if (pipe === undefined) return; // tests headless: no hay renderer
    pipe.getBuffers(this.contenedor);
  }

  /**
   * Fuerza una reconstrucción en el próximo `reconstruir()` (tecla R).
   * Se usa porque al regenerar el mundo cambia la grilla, no la cámara.
   */
  invalidar() {
    this.ultimoTick = -Infinity;
    this.rect.x1 = -1;
  }

  /**
   * Calcula el rectángulo de celdas visibles con margen.
   * @param {import('./camera.js').Camera} camara
   * @param {number} ancho Celdas de ancho de la grilla.
   * @param {number} alto Celdas de alto de la grilla.
   * @returns {{x0: number, y0: number, x1: number, y1: number}}
   */
  rectVisible(camara, ancho, alto) {
    const tile = this.tileSize;
    const margen = CONFIG.render.margenCulling;
    const medioX = camara.vistaAnchoPx / (2 * camara.zoom);
    const medioY = camara.vistaAltoPx / (2 * camara.zoom);
    const x0 = Math.max(0, Math.floor((camara.x - medioX - margen) / tile));
    const y0 = Math.max(0, Math.floor((camara.y - medioY - margen) / tile));
    const x1 = Math.min(ancho - 1, Math.ceil((camara.x + medioX + margen) / tile));
    const y1 = Math.min(alto - 1, Math.ceil((camara.y + medioY + margen) / tile));
    return { x0, y0, x1, y1 };
  }

  /**
   * Reconstruye la lista de partículas visibles. Se llama cada
   * `ticksPorRefrescoRender` ticks o cuando cambia el rectángulo visible.
   * @param {import('../world/grid.js').Grid} grid
   * @param {number} tick Tick actual de la simulación.
   * @param {number} cadaTicks Frecuencia de refresco, en ticks.
   * @param {import('./camera.js').Camera} camara
   */
  reconstruir(grid, tick, cadaTicks, camara) {
    if (grid === null) return;

    const ancho = grid.ancho;
    const r = this.rectVisible(camara, ancho, grid.alto);
    const mismoRect =
      r.x0 === this.rect.x0 &&
      r.y0 === this.rect.y0 &&
      r.x1 === this.rect.x1 &&
      r.y1 === this.rect.y1;
    if (mismoRect && tick - this.ultimoTick < cadaTicks) return;

    this.rect = r;
    this.ultimoTick = tick;

    const planta = grid.planta;
    const especies = grid.especiePlanta;
    const tile = this.tileSize;
    const children = this.contenedor.particleChildren;
    const frames = this.atlas.frames;
    let usados = 0;

    // Solo el rectángulo visible: nunca se recorren las 65.536 celdas.
    for (let y = r.y0; y <= r.y1; y++) {
      const fila = y * ancho;
      for (let x = r.x0; x <= r.x1; x++) {
        const indice = fila + x;
        // Sin capa de especie (grillas viejas) `undefined` cae en pasto.
        const clave = framePlanta(planta[indice], especies?.[indice]);
        if (clave === null) continue; // NADA / MUERTA → desaparece
        const frame = frames.get(clave);
        if (frame === undefined || usados >= this.capacidad) continue;

        const p = this.particulas[usados];
        p.texture = frame; // uv (estático) → se sube con update() al final
        this.mundoX[usados] = (x + 0.5) * tile;
        this.mundoY[usados] = (y + 0.5) * tile;
        children[usados] = p;
        usados++;
      }
    }

    children.length = usados;
    // Cambiaron las UV de los frames reutilizados → volver a subir lo estático.
    this.contenedor.update();
  }

  /**
   * Dibuja el frame: solo posiciona las partículas según la cámara.
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;
    const escala = this.escalaBase * zoom;
    const children = this.contenedor.particleChildren;

    for (let i = 0; i < children.length; i++) {
      const p = children[i];
      p.x = (this.mundoX[i] - cx) * zoom + medioX;
      p.y = (this.mundoY[i] - cy) * zoom + medioY;
      p.scaleX = escala;
      p.scaleY = escala;
    }

    const bounds = this.contenedor.boundsArea;
    bounds.x = 0;
    bounds.y = 0;
    bounds.width = camara.vistaAnchoPx;
    bounds.height = camara.vistaAltoPx;
  }

  /** Cantidad de partículas en pantalla (para tests y diagnóstico). */
  get activas() {
    return this.contenedor.particleChildren.length;
  }

  /** Libera las partículas. La textura del atlas La dueña es quien la creó. */
  destruir() {
    this.particulas.length = 0;
    this.contenedor.particleChildren.length = 0;
    this.contenedor.destroy();
    this.mundoX = new Float32Array(0);
    this.mundoY = new Float32Array(0);
  }
}
