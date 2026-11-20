/**
 * src/render/entityRenderer.js — Render de entidades (P2, T78 · F7.5)
 * ==================================================================
 *
 * REGLAS (TAREAS §2):
 * - Prohibido `new Graphics()` por celda o por frame. Acá no se crea NADA
 *   durante la simulación: el pool de `Particle` se arma al arrancar.
 * - Un solo draw call: `ParticleContainer` con la textura base del atlas.
 * - ⚠️ REFACTOR SoA (D13): los datos llegan por `id` desde `EntityManager`.
 *   La partícula de cada `id` se guarda en un array indexado por `id`.
 *
 * Animación (T78): un cycle de caminar por especie, con cantidad de cuadros
 * distinta (configurada en `CONFIG.sprites.rutaAnimal`). La fase sale de
 * `ctx.tick` y de la velocidad BASE de la especie — no de la velocidad
 * efectiva del terreno —, así que se frena con la pausa y el ceratosaurio
 * anima más rápido que el triceratops.
 *
 * Los sprites son **laterales**: se voltean con `scaleX` según `dirX`, sin
 * rotación (trade-off D18: no se distingue arriba de abajo).
 */

import { Particle, ParticleContainer, Rectangle } from 'pixi.js';
import { CONFIG } from '../config.js';
import { COLOR_ESPECIE, COLOR_ESTADO } from './paleta.js';
import { faseCaminar, frameAnimal } from './atlasDatos.js';

/** Color de cada especie (reexportado desde la paleta por compatibilidad). */
export { COLOR_ESPECIE };

export class EntityRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{
   *   atlas: {textura: import('pixi.js').Texture, frames: Map<string, import('pixi.js').Texture>},
   *   tileSize: number,
   *   capacidad?: number
   * }} opciones
   */
  constructor(_app, { atlas, tileSize, capacidad = CONFIG.entidades.maxEntidades }) {
    this.atlas = atlas;
    this.tileSize = tileSize;
    this.capacidad = capacidad;

    /** Tamaño de un casillero de 64 px en píxeles de mundo (antes del zoom). */
    this.escalaBase = (tileSize * CONFIG.sprites.escalaAnimal) / CONFIG.sprites.tamanoFrame;

    // Pool fijo: una partícula por id posible, creada UNA sola vez.
    /** @type {Particle[]} */
    this.particulaPorId = new Array(capacidad);
    for (let i = 0; i < capacidad; i++) {
      const p = new Particle(atlas.textura);
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      p.rotation = 0;
      this.particulaPorId[i] = p;
    }

    /**
     * Reservar la capacidad completa (con una COPIA, porque el array del
     * container se recorta a los visibles) evita que Pixi tenga que agrandar
     * el buffer de índices a mitad de la partida.
     */
    /** @type {ParticleContainer<Particle>} */
    this.contenedor = new ParticleContainer({
      texture: atlas.textura,
      particles: this.particulaPorId.slice(),
      dynamicProperties: {
        position: true, // cámara
        vertex: true, // escala (zoom) y signo de scaleX (flip)
        uvs: true, // frame del cycle de caminar
        color: true, // modo depuración (T56)
        rotation: false, // sprites laterales: siempre 0
      },
    });
    this.contenedor.boundsArea = new Rectangle(0, 0, 1, 1);

    /**
     * Pixi solo sube los atributos ESTÁTICOS (acá: `rotation`) cuando
     * `_childrenDirty` es true. Sin esto el buffer estático se queda en los
     * 4 bytes iniciales y `gl.drawElements` falla con
     * `GL_INVALID_OPERATION: Vertex buffer is not big enough` → los animales
     * no se ven. Las props dinámicas se suben solas; la rotación nunca cambia,
     * así que basta marcarlo una vez (plantRenderer ya lo hace en reconstruir).
     */
    this.contenedor.update();

    /**
     * Modo depuración (T56): teñir por estado de IA en vez de por especie.
     * @type {boolean}
     */
    this.depuracion = false;
  }

  /**
   * Crea el buffer de GPU con la capacidad completa ANTES del primer frame.
   * @param {import('pixi.js').Application} app
   */
  reservarBufferGPU(app) {
    const pipe = app?.renderer?.renderPipes?.particle;
    if (pipe === undefined) return; // tests headless: no hay renderer
    pipe.getBuffers(this.contenedor);
  }

  /** @param {boolean} valor */
  setDepuracion(valor) {
    this.depuracion = valor;
  }

  /**
   * Dibuja el frame. No asigna memoria: rellena las partículas del pool.
   * @param {import('../entities/entityManager.js').EntityManager} manager
   * @param {import('./camera.js').Camera} camara
   * @param {number} tick Tick actual de la simulación (para la animación).
   */
  render(manager, camara, tick = 0) {
    const tile = this.tileSize;
    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;
    const margen = CONFIG.render.margenCulling;
    const anchoVista = camara.vistaAnchoPx;
    const altoVista = camara.vistaAltoPx;
    const escala = this.escalaBase * zoom;

    const children = this.contenedor.particleChildren;
    const frames = this.atlas.frames;
    const xs = manager.x;
    const ys = manager.y;
    const dirs = manager.dirX;
    const tipos = manager.tipo;
    const vels = manager.velocidad;
    const genesVel = manager.genVelocidad;
    const genesTam = manager.genTamano;
    const estados = manager.estado;
    const vivos = manager.vivos;
    const depuracion = this.depuracion;

    let usados = 0;
    for (let k = 0; k < vivos.length; k++) {
      const id = vivos[k];
      if (id >= this.capacidad) continue;
      const p = this.particulaPorId[id];

      const x = (xs[id] * tile - cx) * zoom + medioX;
      const y = (ys[id] * tile - cy) * zoom + medioY;
      if (x < -margen || x > anchoVista + margen || y < -margen || y > altoVista + margen) continue;

      const tipo = tipos[id];
      const clave = frameAnimal(tipo, faseCaminar(tick, vels[id] * genesVel[id]));
      const frame = clave === null ? undefined : frames.get(clave);
      if (frame !== undefined) p.texture = frame;

      p.x = x;
      p.y = y;
      // Los PNG miran hacia la IZQUIERDA: dirX < 0 (izquierda) → sin espejo;
      // dirX > 0 (derecha) → scaleX negativo. Siempre sin rotación.
      const escalaGen = escala * genesTam[id];
      p.scaleX = escalaGen * (dirs[id] < 0 ? 1 : -1);
      p.scaleY = escalaGen;
      p.tint = depuracion ? (COLOR_ESTADO[estados[id]] ?? 0xffffff) : 0xffffff;

      children[usados] = p;
      usados++;
    }

    children.length = usados;
    const bounds = this.contenedor.boundsArea;
    bounds.x = 0;
    bounds.y = 0;
    bounds.width = anchoVista;
    bounds.height = altoVista;
  }

  /** Cantidad de partículas en pantalla (para tests y diagnóstico). */
  get activas() {
    return this.contenedor.particleChildren.length;
  }

  /** Libera las partículas. La textura del atlas la dueña es quien la creó. */
  destruir() {
    this.particulaPorId.length = 0;
    this.contenedor.particleChildren.length = 0;
    this.contenedor.destroy();
  }
}
