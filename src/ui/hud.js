/**
 * src/ui/hud.js — HUD (T54)
 * ==========================
 * Contadores de población, tiempo, seed y FPS.
 *
 * Es HTML plano sobre el canvas: más nítido que texto en Pixi y no cuesta
 * nada (se actualiza 5 veces por segundo, no en cada frame).
 */

import { CONFIG, TICKS_POR_SEGUNDO } from '../config.js';

export class Hud {
  /**
   * @param {HTMLElement} contenedor
   */
  constructor(contenedor) {
    this.elemento = document.createElement('div');
    this.elemento.className = 'hud';
    this.elemento.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 10px 14px;
      background: rgba(11, 13, 16, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      font: 13px/1.6 ui-monospace, "Cascadia Code", Consolas, monospace;
      color: #e6e6e6;
      pointer-events: none;
      user-select: none;
      white-space: pre;
    `;
    contenedor.appendChild(this.elemento);

    // El texto va en un span aparte: el botón de copiar seed es hijo del HUD
    // y no debe borrarse cada vez que se refrescan los contadores.
    this.texto = document.createElement('span');
    this.elemento.appendChild(this.texto);

    this.botonSeed = document.createElement('button');
    this.botonSeed.type = 'button';
    this.botonSeed.className = 'hud-copiar-seed';
    this.botonSeed.textContent = 'copiar seed';
    this.botonSeed.title = 'Copiar la seed actual al portapapeles (tecla S)';
    this.botonSeed.style.cssText = `
      display: block;
      margin-top: 6px;
      padding: 3px 8px;
      font: inherit;
      color: #e6e6e6;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 5px;
      cursor: pointer;
      pointer-events: auto;
    `;
    this.elemento.appendChild(this.botonSeed);

    /**
     * Callback que instala `main.js`: devuelve una promesa de `true`/`false`
     * según se pudo copiar. Así el HUD no conoce la seed ni el simulador.
     * @type {(() => Promise<boolean>)|null}
     */
    this.alCopiarSeed = null;
    this.botonSeed.addEventListener('click', () => {
      if (this.alCopiarSeed !== null) this.alCopiarSeed().then((ok) => this.avisarCopia(ok));
    });
    this._temporizadorAviso = null;

    this.ultimaActualizacion = 0;
    this.datos = {
      plantas: 0,
      pasto: 0,
      micelio: 0,
      desplazamientos: 0,
      herbivoros: 0,
      depredadores: 0,
      total: 0,
      nacidos: 0,
      muertos: 0,
      ticks: 0,
      seed: 0,
      fps: 0,
      velocidad: 1,
      pausa: false,
    };
  }

  /**
   * Actualiza los valores. Solo escribe en el DOM cada `CONFIG.ui.hudIntervaloMs` ms.
   * @param {object} datos
   * @param {number} ahora Marca de tiempo en ms.
   */
  actualizar(datos, ahora) {
    Object.assign(this.datos, datos);
    if (ahora - this.ultimaActualizacion < CONFIG.ui.hudIntervaloMs) return;
    this.ultimaActualizacion = ahora;

    const d = this.datos;
    const segundos = (d.ticks / TICKS_POR_SEGUNDO).toFixed(1);
    this.texto.textContent = [
      `plantas     ${String(d.plantas).padStart(4)}`,
      `  pasto     ${String(d.pasto).padStart(4)}`,
      `  micelio   ${String(d.micelio).padStart(4)}`,
      `  desplaz.  ${String(d.desplazamientos).padStart(4)}`,
      `triceratops ${String(d.herbivoros).padStart(4)}`,
      `ceratosaurios ${String(d.depredadores).padStart(4)}`,
      `total       ${String(d.total).padStart(4)}`,
      `nacidos     ${String(d.nacidos).padStart(4)}`,
      `muertos     ${String(d.muertos).padStart(4)}`,
      `tiempo      ${segundos.padStart(8)} s`,
      `seed        ${d.seed}`,
      `fps         ${String(Math.round(d.fps)).padStart(4)}`,
      `velocidad   ${String(d.velocidad).padStart(4)}×`,
      `estado      ${d.pausa ? 'PAUSA' : 'CORRIENDO'}`,
    ].join('\n');
  }

  /**
   * Muestra el resultado de copiar la seed y vuelve al texto normal.
   * @param {boolean} ok
   */
  avisarCopia(ok) {
    this.botonSeed.textContent = ok ? 'seed copiada ✓' : 'no se pudo copiar';
    if (this._temporizadorAviso !== null) clearTimeout(this._temporizadorAviso);
    this._temporizadorAviso = setTimeout(() => {
      this.botonSeed.textContent = 'copiar seed';
      this._temporizadorAviso = null;
    }, CONFIG.ui.avisoCopiaMs);
  }

  /** Saca el HUD del DOM. */
  destruir() {
    if (this._temporizadorAviso !== null) clearTimeout(this._temporizadorAviso);
    this.elemento.remove();
  }
}
