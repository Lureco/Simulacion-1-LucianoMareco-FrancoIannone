/**
 * src/ui/controles.js — Controles de pausa y velocidad (T33)
 * ==========================================================
 *
 * Barra de botones HTML sobre el canvas (igual que el HUD): es más nítida
 * que texto dibujado en Pixi y no cuesta nada (solo cambia el DOM cuando
 * el estado cambia, no en cada frame).
 *
 * - **Pausa**: congela la simulación (la cámara sigue moviéndose).
 * - **Velocidad**: 1× / 2× / 4×. Multiplica el tiempo que entra al
 *   acumulador del bucle de timestep fijo (ver `src/main.js`).
 *
 * El estado **no** se guarda acá: la barra solo notifica. La verdad vive
 * en `ESTADO` (`src/config.js`), que es lo que lee el bucle principal.
 */

export class Controles {
  /**
   * @param {HTMLElement} contenedor Contenedor donde se cuelga la barra.
   * @param {object} [callbacks]
   * @param {(pausada: boolean) => void} [callbacks.alCambiarPausa]
   * @param {(velocidad: number) => void} [callbacks.alCambiarVelocidad]
   */
  constructor(contenedor, { alCambiarPausa, alCambiarVelocidad } = {}) {
    this.alCambiarPausa = alCambiarPausa;
    this.alCambiarVelocidad = alCambiarVelocidad;

    /** @type {boolean} Estado mostrado por los botones. */
    this.pausa = false;
    /** @type {number} Velocidad activa. */
    this.velocidad = 1;
    /** @type {number[]} Velocidades ofrecidas. */
    this.velocidades = [1, 2, 4];

    this.elemento = document.createElement('div');
    this.elemento.className = 'controles';
    this.elemento.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px;
      background: rgba(11, 13, 16, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      font: 13px/1.4 ui-monospace, "Cascadia Code", Consolas, monospace;
      user-select: none;
    `;
    contenedor.appendChild(this.elemento);

    /** @type {HTMLButtonElement} Botón de pausa. */
    this.botonPausa = this.crearBoton('⏸ Pausa');
    this.botonPausa.addEventListener('click', () => {
      this.setPausa(!this.pausa);
      this.alCambiarPausa?.(this.pausa);
    });

    /** @type {Map<number, HTMLButtonElement>} Botones de velocidad. */
    this.botonesVelocidad = new Map();
    for (const v of this.velocidades) {
      const boton = this.crearBoton(`${v}×`);
      boton.addEventListener('click', () => {
        this.setVelocidad(v);
        this.alCambiarVelocidad?.(v);
      });
      this.botonesVelocidad.set(v, boton);
      this.elemento.appendChild(boton);
    }

    this.elemento.appendChild(this.botonPausa);
    this.reflejar();
  }

  /**
   * Crea un botón con el estilo de la barra.
   * @param {string} texto
   * @returns {HTMLButtonElement}
   */
  crearBoton(texto) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    boton.style.cssText = `
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.06);
      color: #e6e6e6;
      font: inherit;
      padding: 3px 9px;
      border-radius: 6px;
      cursor: pointer;
    `;
    return boton;
  }

  /**
   * Refleja el estado en el aspecto de los botones.
   * Solo escribe en el DOM si algo cambió.
   */
  reflejar() {
    this.botonPausa.textContent = this.pausa ? '▶ Seguir' : '⏸ Pausa';
    this.botonPausa.style.background = this.pausa
      ? 'rgba(111, 174, 82, 0.35)'
      : 'rgba(255, 255, 255, 0.06)';

    for (const [v, boton] of this.botonesVelocidad) {
      boton.style.background =
        v === this.velocidad ? 'rgba(90, 150, 220, 0.4)' : 'rgba(255, 255, 255, 0.06)';
    }
  }

  /**
   * Cambia el estado de pausa **sin** disparar el callback.
   * Para sincronizar la barra con `ESTADO` (por ejemplo, al apretar espacio).
   * @param {boolean} pausada
   */
  setPausa(pausada) {
    if (this.pausa === pausada) return;
    this.pausa = pausada;
    this.reflejar();
  }

  /**
   * Cambia la velocidad **sin** disparar el callback.
   * @param {number} velocidad
   */
  setVelocidad(velocidad) {
    if (this.velocidad === velocidad) return;
    this.velocidad = velocidad;
    this.reflejar();
  }

  /** Saca la barra del DOM. */
  destruir() {
    this.elemento.remove();
  }
}
