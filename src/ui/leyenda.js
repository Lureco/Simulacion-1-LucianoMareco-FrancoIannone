/**
 * src/ui/leyenda.js — Leyenda de colores (T56)
 * ============================================
 *
 * Panel HTML con el significado de cada color. Sin esto, el usuario ve
 * puntos verdes y rojos en la pantalla y no sabe qué significa cada cosa.
 *
 * Tiene dos modos:
 *
 * - **Normal**: el color de cada **especie** (herbívoro verde, carnívoro
 *   rojo) y el de los estados de IA.
 * - **Depuración** (tecla `D`): el color pasa a ser el del **estado de
 *   IA**, así se ve de un vistazo qué está haciendo cada animal.
 *
 * Cuando está en modo depuración, muestra además el **contador por
 * estado**: cuántos animales están comiendo, cuántos huyen, etc. Es la
 * forma rápida de verificar que la IA está funcionando.
 */

import {
  COLOR_ESPECIE,
  COLOR_ESTADO,
  NOMBRE_ESPECIE,
  NOMBRE_ESTADO,
  aCss,
} from '../render/paleta.js';
import { ESPECIE, ESTADO_IA } from '../entities/entity.js';

export class Leyenda {
  /**
   * @param {HTMLElement} contenedor
   */
  constructor(contenedor) {
    this.elemento = document.createElement('div');
    this.elemento.className = 'leyenda';
    this.elemento.style.cssText = `
      position: absolute;
      left: 10px;
      bottom: 10px;
      padding: 8px 10px;
      background: rgba(11, 13, 16, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      font: 11px/1.6 ui-monospace, "Cascadia Code", Consolas, monospace;
      color: #e6e6e6;
      pointer-events: none;
      user-select: none;
    `;
    contenedor.appendChild(this.elemento);

    /** Modo depuración: el color es el del estado de IA. @type {boolean} */
    this.depuracion = false;
    /** Último HTML escrito (para no reescribirlo si no cambió). @type {string} */
    this.ultimoHtml = '';

    this.actualizar();
  }

  /**
   * Activa o desactiva el modo depuración.
   * @param {boolean} valor
   */
  setDepuracion(valor) {
    if (this.depuracion === valor) return;
    this.depuracion = valor;
    this.ultimoHtml = ''; // fuerza el redibujado
    this.actualizar();
  }

  /**
   * Redibuja la leyenda.
   * @param {object} [conteo] Cuántas entidades hay en cada estado de IA.
   */
  actualizar(conteo) {
    const lineas = [];

    lineas.push(
      `<span style="color:#9aa4b2">${this.depuracion ? 'colores por estado' : 'colores por especie'}</span>`,
    );

    if (this.depuracion) {
      // Modo depuración: los estados de IA con su contador.
      for (const estado of Object.values(ESTADO_IA)) {
        const n = conteo && conteo[estado] ? conteo[estado] : 0;
        lineas.push(
          `<span style="color:${aCss(COLOR_ESTADO[estado])}">■</span> ` +
            `${NOMBRE_ESTADO[estado]} <span style="color:#9aa4b2">${n}</span>`,
        );
      }
    } else {
      // Modo normal: las especies.
      for (const especie of Object.values(ESPECIE)) {
        lineas.push(
          `<span style="color:${aCss(COLOR_ESPECIE[especie])}">■</span> ${NOMBRE_ESPECIE[especie]}`,
        );
      }
      lineas.push(
        '<span style="color:#9aa4b2">D = colores por estado · clic = ver necesidades</span>',
      );
    }

    const html = lineas.join('<br>');
    if (html === this.ultimoHtml) return;
    this.ultimoHtml = html;
    this.elemento.innerHTML = html;
  }

  /** Saca la leyenda del DOM. */
  destruir() {
    this.elemento.remove();
  }
}
