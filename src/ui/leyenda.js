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
 *
 * ⚠️ REFACTOR SoA (D13): la selección llega como un **objeto plano de
 * vista** (lo arma `necesidadesRenderer`), no como una entidad OOP. Así
 * esta clase no necesita saber nada de los arrays tipados. Desde F8/T67
 * esa vista incluye también los cinco genes del individuo.
 */

import {
  COLOR_ESPECIE,
  COLOR_ESTADO,
  COLOR_GEN,
  COLOR_NECESIDAD,
  NOMBRE_ESPECIE,
  aCss,
} from '../render/paleta.js';
import { ESPECIE, ESTADO_IA, NOMBRE_ESTADO } from '../entities/entity.js';
import { CONFIG, TICKS_POR_SEGUNDO } from '../config.js';
import { filasGenes } from './geneticaVista.js';

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
   * @param {object} [seleccion] Vista plana de la entidad seleccionada.
   */
  actualizar(conteo, seleccion) {
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
        '<span style="color:#9aa4b2">D = estados · clic = ver necesidades y genes</span>',
      );
    }

    // Barra de progreso para un valor de necesidad.
    const segmentos = CONFIG.ui.barraSegmentos;
    const barra = (valor) => {
      const llenos = Math.round(valor * segmentos);
      return (
        '<span style="color:#6bdc7a">' +
        '█'.repeat(llenos) +
        '</span><span style="color:#374151">' +
        '░'.repeat(segmentos - llenos) +
        '</span>'
      );
    };

    // Barra genética: 0 = minRasgo, 1 = maxRasgo, con 1.00 en el centro.
    const barraGen = (fila) => {
      const llenos = Math.round(fila.normalizado * segmentos);
      return (
        `<span style="color:${aCss(COLOR_GEN[fila.clave])}">` +
        '█'.repeat(llenos) +
        '</span><span style="color:#374151">' +
        '░'.repeat(segmentos - llenos) +
        '</span>'
      );
    };

    // Las barras de necesidades del animal seleccionado (T56).
    if (seleccion && seleccion.vivo) {
      const nombre = NOMBRE_ESPECIE[seleccion.tipo] ?? 'bicho';
      lineas.push(`<span style="color:#9aa4b2">— ${nombre} —</span>`);

      const fila = (etiqueta, color, valor, textoNumero) =>
        `<span style="color:${aCss(color)}">■</span> ${etiqueta.padEnd(13)} ` +
        `${barra(valor)} ` +
        (textoNumero !== undefined ? `<span style="color:#9aa4b2">${textoNumero}</span>` : '');

      const edadSegundos = Math.round(seleccion.edadTicks / TICKS_POR_SEGUNDO);
      const edadMaximaSegundos = Math.round(seleccion.edadMaximaTicks / TICKS_POR_SEGUNDO);

      lineas.push(
        fila('hambre', COLOR_NECESIDAD.hambre, seleccion.hambre, seleccion.hambre.toFixed(2)),
      );
      lineas.push(fila('sed', COLOR_NECESIDAD.sed, seleccion.sed, seleccion.sed.toFixed(2)));
      lineas.push(
        fila(
          'reproducción',
          COLOR_NECESIDAD.reproduccion,
          seleccion.reproduccion,
          seleccion.reproduccion.toFixed(2),
        ),
      );
      lineas.push(
        fila(
          'edad',
          COLOR_NECESIDAD.edad,
          seleccion.edad,
          `${edadSegundos}/${edadMaximaSegundos} s`,
        ),
      );

      // Genes del mismo individuo (T67). 1.00 es el rasgo base de la especie:
      // ↑ indica arriba del base, ↓ abajo y = exactamente en el base.
      const genes = filasGenes(seleccion.genes);
      if (genes.length > 0) {
        lineas.push('<span style="color:#9aa4b2">— genes (1.00 = base) —</span>');
        for (const gen of genes) {
          lineas.push(
            `<span style="color:${aCss(COLOR_GEN[gen.clave])}">■</span> ` +
              `${gen.etiqueta.padEnd(13)} ${barraGen(gen)} ` +
              `<span style="color:#9aa4b2">${gen.valor.toFixed(2)} ${gen.marca}</span>`,
          );
        }
      }
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
