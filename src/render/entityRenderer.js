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
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { COLOR_ESPECIE, COLOR_ESTADO } from './paleta.js';

/** Color de cada especie. */
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

    /** @type {Map<object, {entidad: object, sprite: Sprite}>} */
    this.registros = new Map();
    /** @type {{entidad: object, sprite: Sprite}[]} Lista para iterar sin asignar. */
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
   * @param {object} entidad
   * @returns {number}
   */
  colorDe(entidad) {
    if (this.depuracion) {
      return COLOR_ESTADO[entidad.estado] ?? 0xffffff;
    }
    return COLOR_ESPECIE[entidad.tipo] ?? 0xffffff;
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
    for (const registro of this.registros.values()) {
      registro.sprite.destroy();
    }
    for (const sprite of this.libres) {
      sprite.destroy();
    }
    this.registros.clear();
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

    const vivos = new Set();
    const nuevaLista = [];

    for (const entidad of manager.vivas) {
      vivos.add(entidad);
      let registro = this.registros.get(entidad);
      if (registro === undefined) {
        const sprite = this.libres.pop() ?? new Sprite(this.textura);
        sprite.anchor.set(0.5);
        sprite.visible = true;
        this.contenedor.addChild(sprite);
        registro = { entidad, sprite };
        this.registros.set(entidad, registro);
      }
      registro.sprite.tint = COLOR_ESPECIE[entidad.tipo] ?? 0xffffff;
      nuevaLista.push(registro);
    }

    // Las que se fueron: su sprite vuelve al pool.
    for (const [entidad, registro] of this.registros) {
      if (!vivos.has(entidad)) {
        registro.sprite.visible = false;
        this.contenedor.removeChild(registro.sprite);
        this.libres.push(registro.sprite);
        this.registros.delete(entidad);
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

    for (let i = 0; i < this.lista.length; i++) {
      const { entidad, sprite } = this.lista[i];
      sprite.x = (entidad.x * tile - cx) * zoom + medioX;
      sprite.y = (entidad.y * tile - cy) * zoom + medioY;
      sprite.scale.set(zoom);

      // En modo depuración el color depende del estado de IA, que cambia
      // cada tick: hay que recolorear. Fuera de ese modo, el color por
      // especie ya se puso en `sincronizar()` y no se toca.
      if (this.depuracion) {
        sprite.tint = this.colorDe(entidad);
      }
    }
  }
}
