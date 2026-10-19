/**
 * src/render/plantRenderer.js — Render de la vegetación (T32)
 * ============================================================
 *
 * La vegetación vive en la grilla (no son entidades). Dibujar 65.536 celdas
 * por frame no es viable, así que este renderer usa la misma estrategia que
 * el terreno pero con un giro:
 *
 * - **3 texturas** (una por estado: semilla, joven, adulta) generadas UNA vez.
 * - Un **pool de sprites** que solo cubre las celdas con planta viva.
 * - La lista de sprites se reconstruye **cada `ticksPorRefrescoRender` ticks**
 *   (no por frame): la vegetación cambia lento y así el costo es despreciable.
 * - Cambiar el `tint`/`texture` de un sprite no rompe el batch de Pixi.
 *
 * Prohibido: `new Graphics()` por celda o por frame (TAREAS §2).
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { PLANTA } from '../world/cell.js';

export class PlantRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number, colores: Record<number, number>, escala: number}} opciones
   */
  constructor(app, { tileSize, colores, escala }) {
    this.app = app;
    this.tileSize = tileSize;
    this.colores = colores;
    this.escala = escala;

    /** @type {Container} */
    this.contenedor = new Container();

    /** @type {Map<number, import('pixi.js').Texture>} Una textura por estado. */
    this.texturas = new Map();
    this.texturas.set(PLANTA.SEMILLA, this.crearTextura(0.3));
    this.texturas.set(PLANTA.JOVEN, this.crearTextura(0.45));
    this.texturas.set(PLANTA.ADULTA, this.crearTextura(0.6));

    /** @type {Sprite[]} Sprites activos en pantalla. */
    this.sprites = [];
    /** @type {Sprite[]} Sprites libres para reutilizar. */
    this.libres = [];
    /** Último tick en el que se reconstruyó la lista. */
    this.ultimoTick = -Infinity;
  }

  /**
   * Textura base de una planta: un cuadradito redondeado blanco que luego se
   * tiñe. Se genera UNA vez por tamaño.
   * @param {number} fraccion Tamaño respecto del tile.
   * @returns {import('pixi.js').Texture}
   */
  crearTextura(fraccion) {
    const lado = Math.max(2, this.tileSize * fraccion);
    const g = new Graphics();
    g.roundRect(0, 0, lado, lado, lado * 0.35).fill(0xffffff);
    const textura = this.app.renderer.generateTexture({
      target: g,
      resolution: 2,
      antialias: true,
    });
    g.destroy();
    return textura;
  }

  /**
   * Reconstruye la lista de sprites a partir de la capa de plantas de la
   * grilla. Se llama cada `ticksPorRefrescoRender` ticks (T32), no por frame.
   * @param {import('../world/grid.js').Grid} grid
   * @param {number} tick Tick actual de la simulación.
   * @param {number} cadaTicks Frecuencia de refresco, en ticks.
   */
  reconstruir(grid, tick, cadaTicks) {
    if (grid === null || tick - this.ultimoTick < cadaTicks) return;
    this.ultimoTick = tick;

    const ancho = grid.ancho;
    const planta = grid.planta;
    const tile = this.tileSize;
    let usados = 0;

    for (let i = 0; i < grid.total; i++) {
      const estado = planta[i];
      if (estado === PLANTA.NADA || estado === PLANTA.MUERTA) continue;

      const sprite = this.sprites[usados] ?? this.libres.pop() ?? this.crearSprite();
      this.sprites[usados] = sprite;
      usados++;

      const x = i % ancho;
      const y = (i / ancho) | 0;

      sprite.texture = this.texturas.get(estado) ?? this.texturas.get(PLANTA.JOVEN);
      sprite.tint = this.colores[estado] ?? 0xffffff;
      // Anclaje: centro de la celda, en píxeles de mundo.
      sprite.x = (x + 0.5) * tile;
      sprite.y = (y + 0.5) * tile;
      sprite.visible = true;
    }

    // Los sprites que sobran vuelven al pool.
    for (let k = usados; k < this.sprites.length; k++) {
      const extra = this.sprites[k];
      extra.visible = false;
      this.libres.push(extra);
    }
    this.sprites.length = usados;
  }

  /** Crea un sprite nuevo ya anclado al centro. */
  crearSprite() {
    const sprite = new Sprite(this.texturas.get(PLANTA.JOVEN));
    sprite.anchor.set(0.5);
    sprite.scale.set(this.escala);
    this.contenedor.addChild(sprite);
    return sprite;
  }

  /**
   * Dibuja el frame: solo posiciona los sprites según la cámara, sin asignar.
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;
    const escalaFinal = this.escala * zoom;

    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i];
      sprite.x = (sprite.x - cx) * zoom + medioX;
      sprite.y = (sprite.y - cy) * zoom + medioY;
      sprite.scale.set(escalaFinal);
    }
  }

  /** Libera texturas y sprites. */
  destruir() {
    for (const sprite of this.sprites) sprite.destroy();
    for (const sprite of this.libres) sprite.destroy();
    for (const textura of this.texturas.values()) textura.destroy(true);
    this.sprites.length = 0;
    this.libres.length = 0;
    this.texturas.clear();
  }
}
