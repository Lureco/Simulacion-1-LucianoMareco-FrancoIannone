/**
 * src/render/entityRenderer.js — Render de entidades (P2)
 * ======================================================
 *
 * REGLAS (TAREAS §2):
 * - Prohibido `new Graphics()` por celda o por frame. Acá la textura se
 *   genera **una sola vez** al arrancar y se reutiliza para todos.
 * - Cada entidad es un `Sprite` con `tint` por especie. Cambiar el `tint`
 *   no rompe el batch de Pixi.
 * - Los sprites se reciclan con un pool: no se crean ni se destruyen
 *   durante la simulación.
 *
 * ⚠️ REFACTOR SoA (D13): los datos llegan por `id` desde `EntityManager`.
 * El sprite de cada `id` se guarda en un array indexado por `id`.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { COLOR_ESPECIE, COLOR_ESTADO } from './paleta.js';

/** Color de cada especie (reexportado desde la paleta por compatibilidad). */
export { COLOR_ESPECIE };

export class EntityRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number}} opciones
   */
  constructor(app, { tileSize }) {
    this.app = app;
    this.tileSize = tileSize;

    /** @type {Container} Contenedor donde viven los sprites. */
    this.contenedor = new Container();

    /** Textura base de una entidad (se genera UNA vez). */
    this.textura = this.crearTextura();

    /** @type {(Sprite|undefined)[]} Sprite de cada id. */
    this.spritePorId = [];
    /** @type {number[]} Ids con sprite, en orden (para iterar sin buscar). */
    this.lista = [];
    /** @type {Sprite[]} Sprites libres para reutilizar. */
    this.libres = [];
    /** Versión del manager para la que se reconstruyó la lista. */
    this.version = -1;

    /**
     * Modo depuración (T56): en vez de teñir por especie, se tiñe por el
     * estado de la IA, para ver qué está haciendo cada animal.
     * @type {boolean}
     */
    this.depuracion = false;
  }

  /**
   * Activa o desactiva el modo depuración.
   * @param {boolean} valor
   */
  setDepuracion(valor) {
    this.depuracion = valor;
    this.version = -1; // fuerza el recoloreado
  }

  /**
   * Color de una entidad según el modo actual.
   * @param {number} id
   * @param {import('../entities/entityManager.js').EntityManager} manager
   * @returns {number}
   */
  colorDe(id, manager) {
    if (this.depuracion) {
      return COLOR_ESTADO[manager.estado[id]] ?? 0xffffff;
    }
    return COLOR_ESPECIE[manager.tipo[id]] ?? 0xffffff;
  }

  /**
   * Genera la textura base de un bicho: un círculo blanco que después se
   * tiñe por especie. Se hace UNA vez.
   * @returns {import('pixi.js').Texture}
   */
  crearTextura() {
    const radio = this.tileSize * 0.45;
    const g = new Graphics();
    g.circle(this.tileSize / 2, this.tileSize / 2, radio).fill(0xffffff);
    const textura = this.app.renderer.generateTexture({
      target: g,
      resolution: 2,
      antialias: true,
    });
    g.destroy();
    return textura;
  }

  /**
   * Aclara el contenido (se llama si el renderer se destruye).
   */
  destruir() {
    for (const id of this.lista) {
      this.spritePorId[id]?.destroy();
    }
    for (const sprite of this.libres) {
      sprite.destroy();
    }
    this.spritePorId.length = 0;
    this.lista.length = 0;
    this.libres.length = 0;
    this.textura.destroy(true);
  }

  /**
   * Sincroniza los sprites con la población actual. Solo corre cuando
   * cambia la población (el manager avisa con `version`).
   * @param {import('../entities/entityManager.js').EntityManager} manager
   */
  sincronizar(manager) {
    if (manager.version === this.version) return;
    this.version = manager.version;

    const vivos = new Set(manager.vivos);
    const nuevaLista = [];

    for (const id of manager.vivos) {
      let sprite = this.spritePorId[id];
      if (sprite === undefined) {
        sprite = this.libres.pop() ?? new Sprite(this.textura);
        sprite.anchor.set(0.5);
        this.contenedor.addChild(sprite);
        this.spritePorId[id] = sprite;
      }
      sprite.visible = true;
      sprite.tint = this.colorDe(id, manager);
      nuevaLista.push(id);
    }

    // Los ids que ya no están vivos: su sprite vuelve al pool.
    for (const id of this.lista) {
      if (!vivos.has(id)) {
        const sprite = this.spritePorId[id];
        if (sprite !== undefined) {
          sprite.visible = false;
          this.contenedor.removeChild(sprite);
          this.libres.push(sprite);
          this.spritePorId[id] = undefined;
        }
      }
    }

    this.lista = nuevaLista;
  }

  /**
   * Dibuja el frame. No asigna memoria: solo escribe en los sprites.
   * @param {import('../entities/entityManager.js').EntityManager} manager
   * @param {import('./camera.js').Camera} camara
   */
  render(manager, camara) {
    this.sincronizar(manager);

    const tile = this.tileSize;
    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;

    const lista = this.lista;
    const sprites = this.spritePorId;
    const xs = manager.x;
    const ys = manager.y;

    for (let i = 0; i < lista.length; i++) {
      const id = lista[i];
      const sprite = /** @type {Sprite} */ (sprites[id]);
      sprite.x = (xs[id] * tile - cx) * zoom + medioX;
      sprite.y = (ys[id] * tile - cy) * zoom + medioY;
      sprite.scale.set(zoom);

      // En modo depuración el color depende del estado de IA, que cambia
      // cada tick: hay que recolorear. Fuera de ese modo, el color por
      // especie ya se puso en `sincronizar()` y no se toca.
      if (this.depuracion) {
        sprite.tint = this.colorDe(id, manager);
      }
    }
  }
}
