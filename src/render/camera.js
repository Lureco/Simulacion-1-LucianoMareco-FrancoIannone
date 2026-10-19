/**
 * src/render/camera.js — Cámara del mundo (T53, adelantada por P2)
 * ==================================================================
 *
 * ⚠️ Tarea de P1 (Luciano) adelantada por P2 porque sin cámara el mundo de
 * 2048 px no entra en la ventana de 1280 px. La API se acuerda en la
 * reunión de sincronización. Ver `docs/DECISIONES.md` (D3).
 *
 * La cámara trabaja en **píxeles de mundo**. El render transforma:
 *
 *   pantalla = (mundo - camara) * zoom + centro_de_la_vista
 *
 * Capacidades: pan (arrastrar), zoom (rueda), seguimiento de una entidad
 * y límites al borde del mundo.
 */

import { clamp } from '../core/utils.js';

export class Camera {
  /**
   * @param {number} mundoAnchoPx Ancho del mundo en píxeles.
   * @param {number} mundoAltoPx Alto del mundo en píxeles.
   * @param {number} vistaAnchoPx Ancho de la vista en píxeles.
   * @param {number} vistaAltoPx Alto de la vista en píxeles.
   */
  constructor(mundoAnchoPx, mundoAltoPx, vistaAnchoPx, vistaAltoPx) {
    this.mundoAnchoPx = mundoAnchoPx;
    this.mundoAltoPx = mundoAltoPx;
    this.vistaAnchoPx = vistaAnchoPx;
    this.vistaAltoPx = vistaAltoPx;

    /** Centro de la cámara en píxeles de mundo. */
    this.x = mundoAnchoPx / 2;
    this.y = mundoAltoPx / 2;
    /** Factor de zoom. */
    this.zoom = 1;
    this.zoomMin = 0.2;
    this.zoomMax = 4;

    /** Entidad que se está siguiendo, si hay. */
    this.objetivo = null;

    /** @type {{x: number, y: number}} Reutilizable para no generar basura. */
    this._punto = { x: 0, y: 0 };
  }

  /** Ajusta el tamaño de la vista (cuando se redimensiona la ventana). */
  redimensionar(anchoPx, altoPx) {
    this.vistaAnchoPx = anchoPx;
    this.vistaAltoPx = altoPx;
    this.limitar();
  }

  /**
   * Convierte píxeles de mundo a píxeles de pantalla.
   * @param {number} xPx
   * @param {number} yPx
   * @param {{x: number, y: number}} [salida] Objeto a rellenar.
   * @returns {{x: number, y: number}}
   */
  proyectar(xPx, yPx, salida) {
    const destino = salida ?? this._punto;
    destino.x = (xPx - this.x) * this.zoom + this.vistaAnchoPx / 2;
    destino.y = (yPx - this.y) * this.zoom + this.vistaAltoPx / 2;
    return destino;
  }

  /**
   * Convierte píxeles de pantalla a píxeles de mundo.
   * @param {number} xPx
   * @param {number} yPx
   * @param {{x: number, y: number}} [salida]
   * @returns {{x: number, y: number}}
   */
  desproyectar(xPx, yPx, salida) {
    const destino = salida ?? this._punto;
    destino.x = (xPx - this.vistaAnchoPx / 2) / this.zoom + this.x;
    destino.y = (yPx - this.vistaAltoPx / 2) / this.zoom + this.y;
    return destino;
  }

  /**
   * Mueve la cámara y la deja dentro de los límites del mundo.
   * @param {number} dx Desplazamiento en píxeles de mundo.
   * @param {number} dy
   */
  desplazar(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.limitar();
  }

  /**
   * Acerca o aleja la cámara alrededor de un punto de la vista.
   * @param {number} factor Mayor que 1 acerca.
   * @param {number} centroX PX de pantalla.
   * @param {number} centroY PX de pantalla.
   */
  zoomEn(factor, centroX, centroY) {
    const antes = this.zoom;
    this.zoom = clamp(this.zoom * factor, this.zoomMin, this.zoomMax);
    if (this.zoom === antes) return;

    // Mantener fijo el punto de pantalla bajo el cursor.
    const mundoAntes = this.desproyectar(centroX, centroY, this._punto);
    const wx = mundoAntes.x;
    const wy = mundoAntes.y;
    this.x = wx - (centroX - this.vistaAnchoPx / 2) / this.zoom;
    this.y = wy - (centroY - this.vistaAltoPx / 2) / this.zoom;
    this.limitar();
  }

  /**
   * Sigue suavemente a una entidad (en píxeles de mundo).
   * @param {object} entidad
   * @param {number} tileSize
   * @param {number} dt
   * @param {number} [suavizado=0.12]
   */
  seguir(entidad, tileSize, dt, suavizado = 0.12) {
    this.objetivo = entidad;
    if (!entidad) return;
    const objetivoX = entidad.x * tileSize;
    const objetivoY = entidad.y * tileSize;
    const k = 1 - Math.pow(1 - suavizado, dt * 60);
    this.x += (objetivoX - this.x) * k;
    this.y += (objetivoY - this.y) * k;
    this.limitar();
  }

  /** Deja de seguir a una entidad. */
  soltar() {
    this.objetivo = null;
  }

  /**
   * Mantiene la cámara dentro del mundo. Si el mundo entra entero en la
   * vista, lo centra.
   */
  limitar() {
    const mitadX = this.vistaAnchoPx / (2 * this.zoom);
    const mitadY = this.vistaAltoPx / (2 * this.zoom);

    if (this.mundoAnchoPx <= this.vistaAnchoPx / this.zoom) {
      this.x = this.mundoAnchoPx / 2;
    } else {
      this.x = clamp(this.x, mitadX, this.mundoAnchoPx - mitadX);
    }

    if (this.mundoAltoPx <= this.vistaAltoPx / this.zoom) {
      this.y = this.mundoAltoPx / 2;
    } else {
      this.y = clamp(this.y, mitadY, this.mundoAltoPx - mitadY);
    }
  }

  /**
   * Conecta los controles de mouse y rueda al canvas.
   * @param {HTMLCanvasElement} canvas
   * @returns {() => void} Función para desconectar.
   */
  conectar(canvas) {
    let arrastrando = false;
    let ultimoX = 0;
    let ultimoY = 0;

    const alBajar = (e) => {
      arrastrando = true;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const alMover = (e) => {
      if (!arrastrando) return;
      const dx = (e.clientX - ultimoX) / this.zoom;
      const dy = (e.clientY - ultimoY) / this.zoom;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      this.desplazar(-dx, -dy);
      this.soltar();
    };

    const alSubir = () => {
      arrastrando = false;
      canvas.style.cursor = 'grab';
    };

    const alGirar = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.zoomEn(factor, e.clientX - rect.left, e.clientY - rect.top);
      this.soltar();
    };

    canvas.addEventListener('pointerdown', alBajar);
    canvas.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSubir);
    canvas.addEventListener('wheel', alGirar, { passive: false });
    canvas.style.cursor = 'grab';

    return () => {
      canvas.removeEventListener('pointerdown', alBajar);
      canvas.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSubir);
      canvas.removeEventListener('wheel', alGirar);
    };
  }
}
