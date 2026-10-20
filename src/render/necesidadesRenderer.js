/**
 * src/render/necesidadesRenderer.js — Vista de necesidades (T56)
 * ===========================================================
 *
 * Cuando se hace clic en un animal, se le dibujan encima las barras de
 * sus necesidades (hambre, sed, energía). Es la forma de ver **por qué**
 * un animal está haciendo lo que está haciendo.
 *
 * REGLAS (TAREAS §2):
 * - No se crea ningún `Graphics` por frame: hay **uno solo** que se
 *   reutiliza, y solo se redibuja cuando hay algo seleccionado.
 * - El texto se dibuja con sprites de textura única, no con `Text` de
 *   Pixi (que crea texturas nuevas).
 *
 * Las barras son **sprites con `tint`**: se escalan en X para mostrar la
 * fracción. Escalar un sprite no rompe el batch de Pixi.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { COLOR_NECESIDAD } from './paleta.js';

/** Altura de cada barra en píxeles de mundo. */
const ALTO_BARRA = 3;

/** Separación entre barras. */
const SEPARACION = 1;

/** Ancho máximo de las barras en píxeles de mundo. */
const ANCHO_BARRA = 16;

/** Necesidades que se muestran, en orden. */
const NECESIDADES = [
  { clave: 'hambre', etiqueta: 'hambre' },
  { clave: 'sed', etiqueta: 'sed' },
  { clave: 'energia', etiqueta: 'energía' },
];

export class NecesidadesRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number}} opciones
   */
  constructor(app, { tileSize }) {
    this.app = app;
    this.tileSize = tileSize;

    /** @type {Container} */
    this.contenedor = new Container();

    /**
     * Fondo de las barras. Es **un solo** `Graphics`, reutilizado: se
     * limpia y se redibuja, pero nunca se crea uno nuevo por frame.
     * @type {Graphics}
     */
    this.fondo = new Graphics();
    this.contenedor.addChild(this.fondo);

    /** Textura blanca de 1 px para las barras tintadas. */
    this.texturaBarra = this.crearTextura();

    /**
     * Sprites de las barras: uno por necesidad y por tipo (fondo y valor).
     * @type {Sprite[]}
     */
    this.barras = [];
    for (const necesidad of NECESIDADES) {
      const relleno = new Sprite(this.texturaBarra);
      relleno.anchor.set(0, 0.5);
      this.contenedor.addChild(relleno);
      this.barras.push({ necesidad, relleno });
    }

    /** @type {object|null} Entidad seleccionada. */
    this.seleccionada = null;
    /** Último valor dibujado (para no redibujar si no cambió). @type {string} */
    this.ultimaClave = '';
  }

  /**
   * Crea la textura de 1 px que se usa para las barras tintadas.
   * @returns {import('pixi.js').Texture}
   */
  crearTextura() {
    const g = new Graphics();
    g.rect(0, 0, 1, 1).fill(0xffffff);
    const textura = this.app.renderer.generateTexture({
      target: g,
      resolution: 1,
      antialias: false,
    });
    g.destroy();
    return textura;
  }

  /**
   * Selecciona (o deselecciona) una entidad.
   * @param {object|null} entidad
   */
  seleccionar(entidad) {
    this.seleccionada = entidad;
    this.ultimaClave = '';
  }

  /**
   * Dibuja las barras de la entidad seleccionada.
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    const entidad = this.seleccionada;

    // Sin selección: no hay nada que dibujar.
    if (entidad === null || entidad === undefined || !entidad.vivo) {
      if (this.ultimaClave !== '') {
        this.fondo.clear();
        for (const barra of this.barras) barra.relleno.visible = false;
        this.ultimaClave = '';
      }
      return;
    }

    // Solo redibuja si cambió algo (posición o valores).
    const valores = NECESIDADES.map((n) => entidad.necesidades[n.clave]);
    const clave = `${entidad.x.toFixed(3)},${entidad.y.toFixed(3)},${valores
      .map((v) => v.toFixed(2))
      .join(',')}`;
    if (clave === this.ultimaClave) return;
    this.ultimaClave = clave;

    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;

    // Posición de la entidad en pantalla.
    const ex = (entidad.x * this.tileSize - cx) * zoom + medioX;
    const ey = (entidad.y * this.tileSize - cy) * zoom + medioY;

    // Las barras van **encima** del animal.
    const arriba = ey - 10 * zoom;
    const anchoPx = ANCHO_BARRA * zoom;
    const altoPx = ALTO_BARRA * zoom;

    // Fondo: un rectángulo oscuro detrás de todas las barras.
    this.fondo.clear();
    this.fondo
      .rect(
        ex - anchoPx / 2 - 1,
        arriba - 1,
        anchoPx + 2,
        (altoPx + SEPARACION) * NECESIDADES.length + 2,
      )
      .fill({ color: 0x000000, alpha: 0.65 });

    for (let i = 0; i < this.barras.length; i++) {
      const { necesidad, relleno } = this.barras[i];
      const valor = Math.max(0, Math.min(1, entidad.necesidades[necesidad.clave]));
      const y = arriba + i * (altoPx + SEPARACION);

      relleno.visible = true;
      relleno.tint = COLOR_NECESIDAD[necesidad.clave];
      relleno.x = ex - anchoPx / 2;
      relleno.y = y;
      relleno.width = anchoPx * valor;
      relleno.height = altoPx;
    }
  }

  /** Libera los recursos. */
  destruir() {
    this.fondo.destroy();
    for (const barra of this.barras) barra.relleno.destroy();
    this.texturaBarra.destroy(true);
  }
}
