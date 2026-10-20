/**
 * src/ui/hud.js — HUD (T54)
 * ==========================
 * Contadores de población, tiempo, seed y FPS.
 *
 * Es HTML plano sobre el canvas: más nítido que texto en Pixi y no cuesta
 * nada (se actualiza 5 veces por segundo, no en cada frame).
 */

import { CAUSA } from '../systems/death.js';

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

    this.ultimaActualizacion = 0;
    this.datos = {
      plantas: 0,
      herbivoros: 0,
      depredadores: 0,
      total: 0,
      ticks: 0,
      seed: 0,
      fps: 0,
      velocidad: 1,
      pausa: false,
      muertes: {
        [CAUSA.HAMBRE]: 0,
        [CAUSA.SED]: 0,
        [CAUSA.ENERGIA]: 0,
        [CAUSA.EDAD]: 0,
        [CAUSA.DEPREDADO]: 0,
        total: 0,
      },
    };
  }

  /**
   * Actualiza los valores. Solo escribe en el DOM cada 200 ms.
   * @param {object} datos
   * @param {number} ahora Marca de tiempo en ms.
   */
  actualizar(datos, ahora) {
    Object.assign(this.datos, datos);
    if (ahora - this.ultimaActualizacion < 200) return;
    this.ultimaActualizacion = ahora;

    const d = this.datos;
    const segundos = (d.ticks / 60).toFixed(1);
    const m = d.muertes;
    this.elemento.textContent = [
      `plantas     ${String(d.plantas).padStart(4)}`,
      `herbívoros  ${String(d.herbivoros).padStart(4)}`,
      `carnívoros  ${String(d.depredadores).padStart(4)}`,
      `total       ${String(d.total).padStart(4)}`,
      `tiempo      ${segundos.padStart(8)} s`,
      `seed        ${d.seed}`,
      `fps         ${String(Math.round(d.fps)).padStart(4)}`,
      `velocidad   ${String(d.velocidad).padStart(4)}×`,
      `estado      ${d.pausa ? 'PAUSA' : 'CORRIENDO'}`,
      `— muertes —`,
      `hambre      ${String(m[CAUSA.HAMBRE]).padStart(4)}`,
      `sed         ${String(m[CAUSA.SED]).padStart(4)}`,
      `energía     ${String(m[CAUSA.ENERGIA]).padStart(4)}`,
      `edad        ${String(m[CAUSA.EDAD]).padStart(4)}`,
      `depredado   ${String(m[CAUSA.DEPREDADO]).padStart(4)}`,
    ].join('\n');
  }

  /** Saca el HUD del DOM. */
  destruir() {
    this.elemento.remove();
  }
}
