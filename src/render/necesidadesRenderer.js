/**
 * src/render/necesidadesRenderer.js — Vista de necesidades (T56)
 * ===========================================================
 *
 * Cuando se hace clic en un animal, se le dibujan encima las barras de
 * sus necesidades (hambre, sed, edad). Es la forma de ver **por qué**
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
 *
 * ⚠️ REFACTOR SoA (D13): la selección es un **id** (número) o `null`, y
 * los datos se leen de los arrays tipados del `EntityManager`. Para que
 * la leyenda no necesite saber de SoA, `seleccionada` expone un **objeto
 * plano de vista** con todos los valores ya resueltos:
 *
 *     { id, tipo, vivo, hambre, sed, reproduccion, edad, celdaX, celdaY, estado }
 *
 * donde `edad` viene **normalizada 0..1**.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { COLOR_NECESIDAD } from './paleta.js';
import { CONFIG } from '../config.js';

/**
 * Necesidades que se muestran, en orden.
 *
 * El orden es el de la **prioridad** de la IA (GDD §5.2): hambre > sed >
 * reproducción > edad. Así, de un vistazo, se ve cuál necesidad está
 * dominando y por tanto qué va a hacer el animal.
 */
const NECESIDADES = [
  { clave: 'hambre', etiqueta: 'hambre' },
  { clave: 'sed', etiqueta: 'sed' },
  { clave: 'reproduccion', etiqueta: 'reproducción' },
  { clave: 'edad', etiqueta: 'edad' },
];

export class NecesidadesRenderer {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{tileSize: number, manager: import('../entities/entityManager.js').EntityManager}} opciones
   */
  constructor(app, { tileSize, manager }) {
    this.app = app;
    this.tileSize = tileSize;
    /** @type {import('../entities/entityManager.js').EntityManager} */
    this.manager = manager;

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
     * Sprites de las barras: uno por necesidad.
     * @type {{necesidad: {clave: string, etiqueta: string}, relleno: Sprite}[]}
     */
    this.barras = [];
    for (const necesidad of NECESIDADES) {
      const relleno = new Sprite(this.texturaBarra);
      relleno.anchor.set(0, 0.5);
      this.contenedor.addChild(relleno);
      this.barras.push({ necesidad, relleno });
    }

    /** @type {number|null} Id de la entidad seleccionada. */
    this.idSeleccionado = null;
    /**
     * Vista plana de la entidad seleccionada, o `null`.
     * @type {{id: number, tipo: number, vivo: boolean, hambre: number, sed: number, reproduccion: number, edad: number, celdaX: number, celdaY: number, estado: number}|null}
     */
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
   * Selecciona (o deselecciona) una entidad por su `id`.
   * @param {number|null} idONull
   */
  seleccionar(idONull) {
    this.idSeleccionado = idONull ?? null;
    this.seleccionada = this.crearVista(this.idSeleccionado);
    this.ultimaClave = '';
  }

  /**
   * Arma el objeto plano de vista a partir de los arrays tipados.
   * @param {number|null} id
   * @returns {object|null} Vista plana, o `null` si no hay selección.
   */
  crearVista(id) {
    if (id === null || id === undefined) return null;
    const a = this.manager;
    const edadMaxima = CONFIG.entidades.edadMaximaTicks;
    return {
      id,
      tipo: a.tipo[id],
      vivo: a.vivo[id] === 1,
      hambre: a.hambre[id],
      sed: a.sed[id],
      reproduccion: a.deseoRepro[id],
      edad: edadMaxima > 0 ? Math.max(0, Math.min(1, a.edad[id] / edadMaxima)) : 0,
      edadTicks: a.edad[id],
      edadMaximaTicks: edadMaxima,
      celdaX: a.celdaX(id),
      celdaY: a.celdaY(id),
      estado: a.estado[id],
    };
  }

  /**
   * Dibuja las barras de la entidad seleccionada.
   * @param {import('./camera.js').Camera} camara
   */
  render(camara) {
    // Si el bicho murió (o su id se recicló), soltamos la selección para
    // no mostrar las barras de un animal que ya no es el mismo.
    if (this.idSeleccionado !== null && this.manager.vivo[this.idSeleccionado] !== 1) {
      this.idSeleccionado = null;
      this.ultimaClave = '';
    }

    // Refresca la vista: los valores cambian cada tick y la leyenda los lee.
    this.seleccionada = this.crearVista(this.idSeleccionado);
    const seleccion = this.seleccionada;

    // Sin selección: no hay nada que dibujar.
    if (seleccion === null || !seleccion.vivo) {
      if (this.ultimaClave !== '') {
        this.fondo.clear();
        for (const barra of this.barras) barra.relleno.visible = false;
        this.ultimaClave = '';
      }
      return;
    }

    const x = this.manager.x[seleccion.id];
    const y = this.manager.y[seleccion.id];

    // Solo redibuja si cambió algo (posición, valores **o cámara**). La
    // posición dibujada es de pantalla: si el animal está quieto en pausa y se
    // hace pan/zoom, hay que recolocar las barras igualmente.
    const valores = NECESIDADES.map((n) => this.valorNormalizado(seleccion, n.clave));
    const clave = [
      x.toFixed(3),
      y.toFixed(3),
      camara.x.toFixed(3),
      camara.y.toFixed(3),
      camara.zoom.toFixed(4),
      ...valores.map((v) => v.toFixed(2)),
    ].join(',');
    if (clave === this.ultimaClave) return;
    this.ultimaClave = clave;

    const zoom = camara.zoom;
    const medioX = camara.vistaAnchoPx / 2;
    const medioY = camara.vistaAltoPx / 2;
    const cx = camara.x;
    const cy = camara.y;

    // Posición de la entidad en pantalla.
    const ex = (x * this.tileSize - cx) * zoom + medioX;
    const ey = (y * this.tileSize - cy) * zoom + medioY;

    // Las barras van **encima** del animal.
    const arriba = ey - CONFIG.ui.barraOffsetY * zoom;
    const anchoPx = CONFIG.ui.barraAncho * zoom;
    const altoPx = CONFIG.ui.barraAlto * zoom;
    const separacion = CONFIG.ui.barraSeparacion;

    // Fondo: un rectángulo oscuro detrás de todas las barras.
    this.fondo.clear();
    this.fondo
      .rect(
        ex - anchoPx / 2 - 1,
        arriba - 1,
        anchoPx + 2,
        (altoPx + separacion) * NECESIDADES.length + 2,
      )
      .fill({ color: 0x000000, alpha: 0.65 });

    for (let i = 0; i < this.barras.length; i++) {
      const { necesidad, relleno } = this.barras[i];
      const yBarra = arriba + i * (altoPx + separacion);

      relleno.visible = true;
      relleno.tint = COLOR_NECESIDAD[necesidad.clave];
      relleno.x = ex - anchoPx / 2;
      relleno.y = yBarra;
      relleno.width = anchoPx * valores[i];
      relleno.height = altoPx;
    }
  }

  /**
   * Valor de una necesidad en `[0, 1]`, listo para dibujar la barra.
   *
   * **Ojo:** `hambre`, `sed` y `edad` ya llegan normalizadas en la vista.
   * Aun así se recorta por las dudas.
   *
   * @param {object} vista Objeto plano de vista.
   * @param {string} clave
   * @returns {number}
   */
  valorNormalizado(vista, clave) {
    return Math.max(0, Math.min(1, vista[clave]));
  }

  /** Libera los recursos. */
  destruir() {
    this.fondo.destroy();
    for (const barra of this.barras) barra.relleno.destroy();
    this.texturaBarra.destroy(true);
  }
}
