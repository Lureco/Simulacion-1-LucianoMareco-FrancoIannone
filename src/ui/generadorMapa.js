/**
 * src/ui/generadorMapa.js — Panel para generar mapas (F8 · T84)
 * =============================================================
 *
 * Panel HTML sobre el canvas con los parámetros de una generación:
 * seed, plantas iniciales, herbívoros y depredadores. El botón flotante
 * recorre tres posiciones, y la cabecera permite ir directo a cualquiera:
 *
 *   oculto → abajo → pantalla completa → oculto
 *
 * - **abajo**: un cajón en el borde inferior, se sigue viendo la simulación.
 * - **pantalla**: ocupa toda la ventana (para configurar con calma).
 * - **oculto**: solo queda el botón flotante (estado inicial).
 *
 * Igual que HUD/Controles/Leyenda, el estado real vive afuera: el panel
 * solo valida los campos y llama a `alGenerar({ seed, plantas, herbivoros,
 * depredadores })`. La seed acepta números (32 bits sin signo) o texto: en
 * ese caso se hashea con `hashString`, así cualquier frase es reproducible.
 */

import { CONFIG } from '../config.js';
import { hashString } from '../core/prng.js';

/** Posiciones que recorre el botón, en orden. */
export const POSICIONES = ['oculto', 'abajo', 'pantalla'];

const ETIQUETAS = { oculto: 'Oculto', abajo: 'Abajo', pantalla: 'Pantalla' };

const ESTILO_BASE = `
  position: absolute;
  z-index: 10;
  box-sizing: border-box;
  overflow: auto;
  color: #e6e6e6;
  background: rgba(11, 13, 16, 0.96);
  font: 13px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace;
  padding: 16px 20px;
`;

const POR_POSICION = {
  oculto: 'display: none;',
  abajo:
    'display: block; left: 0; right: 0; bottom: 0; top: auto; height: 38vh;' +
    ' border-top: 1px solid rgba(255, 255, 255, 0.18);',
  pantalla:
    'display: flex; flex-direction: column; justify-content: center;' +
    ' top: 0; right: 0; bottom: 0; left: 0;',
};

export class GeneradorMapa {
  /**
   * @param {HTMLElement} contenedor
   * @param {object} [opciones]
   * @param {(valores: {seed: number, plantas: number, herbivoros: number, depredadores: number}) => void} [opciones.alGenerar]
   * @param {number} [opciones.seed]
   * @param {number} [opciones.plantas]
   * @param {number} [opciones.herbivoros]
   * @param {number} [opciones.depredadores]
   * @param {number} [opciones.maxPlantas]
   * @param {number} [opciones.maxNpcs]
   */
  constructor(
    contenedor,
    {
      alGenerar,
      seed = CONFIG.mundo.seedPorDefecto,
      plantas = CONFIG.plantas.poblacionInicial,
      herbivoros = CONFIG.herbivoro.poblacionInicial,
      depredadores = CONFIG.depredador.poblacionInicial,
      maxPlantas = CONFIG.mundo.ancho * CONFIG.mundo.alto,
      maxNpcs = CONFIG.entidades.maxEntidades,
    } = {},
  ) {
    this.alGenerar = alGenerar;
    this.maxPlantas = maxPlantas;
    this.maxNpcs = maxNpcs;
    this.posicion = 'oculto';

    // Botón flotante debajo de la barra de pausa/velocidad (arriba a la derecha).
    this.boton = document.createElement('button');
    this.boton.type = 'button';
    this.boton.className = 'generador-mapa-toggle';
    this.boton.style.cssText = `
      position: absolute;
      top: 52px;
      right: 10px;
      z-index: 11;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(11, 13, 16, 0.85);
      color: #e6e6e6;
      font: 12px/1.4 ui-monospace, "Cascadia Code", Consolas, monospace;
      padding: 4px 9px;
      border-radius: 6px;
      cursor: pointer;
    `;
    this.boton.addEventListener('click', () => this.ciclar());
    contenedor.appendChild(this.boton);

    this.panel = document.createElement('div');
    this.panel.className = 'generador-mapa';
    contenedor.appendChild(this.panel);

    // ── Cabecera: título + acceso directo a las tres posiciones ──
    const cabecera = document.createElement('div');
    cabecera.style.cssText =
      'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Generar mapa';
    cabecera.appendChild(titulo);

    this.botonesPosicion = new Map();
    for (const pos of POSICIONES) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = ETIQUETAS[pos];
      boton.style.cssText = this.estiloBoton();
      boton.addEventListener('click', () => this.setPosicion(pos));
      this.botonesPosicion.set(pos, boton);
      cabecera.appendChild(boton);
    }
    this.panel.appendChild(cabecera);

    // ── Campos ──
    const fila = document.createElement('div');
    fila.style.cssText = 'display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;';
    this.campos = {
      seed: this.crearCampo(fila, 'Seed', 'text', String(seed)),
      plantas: this.crearCampo(fila, 'Plantas iniciales', 'number', String(plantas), maxPlantas),
      herbivoros: this.crearCampo(fila, 'Herbívoros', 'number', String(herbivoros), maxNpcs),
      depredadores: this.crearCampo(fila, 'Depredadores', 'number', String(depredadores), maxNpcs),
    };
    this.panel.appendChild(fila);

    // ── Acciones ──
    const acciones = document.createElement('div');
    acciones.style.cssText =
      'display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px;';
    this.botonGenerar = document.createElement('button');
    this.botonGenerar.type = 'button';
    this.botonGenerar.textContent = 'Generar mapa';
    this.botonGenerar.style.cssText = this.estiloBoton('rgba(111, 174, 82, 0.35)');
    this.botonGenerar.addEventListener('click', () => this.generar());
    acciones.appendChild(this.botonGenerar);

    this.mensaje = document.createElement('span');
    this.mensaje.style.cssText = 'color: #9aa4b2;';
    acciones.appendChild(this.mensaje);
    this.panel.appendChild(acciones);

    this.reflejar();
  }

  /** @returns {string} Estilo de un botón del panel. */
  estiloBoton(fondo = 'rgba(255, 255, 255, 0.06)') {
    return (
      `appearance: none; border: 1px solid rgba(255, 255, 255, 0.18);` +
      `background: ${fondo}; color: #e6e6e6; font: inherit;` +
      `padding: 4px 10px; border-radius: 6px; cursor: pointer;`
    );
  }

  /**
   * Agrega un campo al panel y devuelve el `<input>` (así se puede leer y
   * escribir desde tests y desde el callback sin depender del DOM interno).
   * @param {HTMLElement} fila
   * @param {string} etiqueta
   * @param {string} tipo
   * @param {string} valor
   * @param {number} [max]
   * @returns {HTMLInputElement}
   */
  crearCampo(fila, etiqueta, tipo, valor, max) {
    const envoltorio = document.createElement('label');
    envoltorio.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    const texto = document.createElement('span');
    texto.textContent = etiqueta;
    texto.style.cssText = 'color: #9aa4b2;';
    envoltorio.appendChild(texto);

    const input = document.createElement('input');
    input.type = tipo;
    input.value = valor;
    if (max !== undefined) {
      input.min = '0';
      input.max = String(max);
    }
    input.style.cssText = `
      width: ${tipo === 'text' ? 150 : 110}px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.06);
      color: #e6e6e6;
      font: inherit;
      padding: 4px 8px;
      border-radius: 6px;
    `;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault?.();
        this.generar();
      }
    });
    envoltorio.appendChild(input);
    fila.appendChild(envoltorio);
    return input;
  }

  /** Avanza al siguiente estado: oculto → abajo → pantalla → oculto. */
  ciclar() {
    const siguiente = (POSICIONES.indexOf(this.posicion) + 1) % POSICIONES.length;
    this.setPosicion(POSICIONES[siguiente]);
  }

  /**
   * Fija una posición (ignora valores desconocidos).
   * @param {string} posicion
   */
  setPosicion(posicion) {
    if (!POSICIONES.includes(posicion)) return;
    this.posicion = posicion;
    this.reflejar();
  }

  /** Reescribe solo los estilos que cambian entre posiciones. */
  reflejar() {
    this.panel.style.cssText = ESTILO_BASE + POR_POSICION[this.posicion];
    this.boton.textContent = `⚙ Mapa: ${ETIQUETAS[this.posicion]}`;
    for (const [pos, boton] of this.botonesPosicion) {
      boton.style.background =
        pos === this.posicion ? 'rgba(90, 150, 220, 0.4)' : 'rgba(255, 255, 255, 0.06)';
    }
  }

  /**
   * Parsea y valida los campos. Devuelve `null` y muestra el error si algo no
   * está en rango; si no, devuelve los cuatro parámetros ya normalizados.
   * @returns {{seed: number, plantas: number, herbivoros: number, depredadores: number}|null}
   */
  leer() {
    const texto = String(this.campos.seed.value ?? '').trim();
    let seed;
    if (texto === '') {
      seed = CONFIG.mundo.seedPorDefecto;
    } else if (/^\d+$/.test(texto)) {
      seed = Number(texto) >>> 0;
    } else {
      seed = hashString(texto);
    }

    const entero = (input, max, nombre) => {
      const n = Math.floor(Number(input.value));
      if (!Number.isFinite(n) || n < 0) {
        this.mensaje.textContent = `${nombre}: ingresá un número ≥ 0`;
        return null;
      }
      if (n > max) {
        this.mensaje.textContent = `${nombre}: el máximo es ${max}`;
        return null;
      }
      return n;
    };

    const plantas = entero(this.campos.plantas, this.maxPlantas, 'Plantas');
    if (plantas === null) return null;
    const herbivoros = entero(this.campos.herbivoros, this.maxNpcs, 'Herbívoros');
    if (herbivoros === null) return null;
    const depredadores = entero(this.campos.depredadores, this.maxNpcs, 'Depredadores');
    if (depredadores === null) return null;

    if (herbivoros + depredadores > this.maxNpcs) {
      this.mensaje.textContent = `Herbívoros + depredadores ≤ ${this.maxNpcs}`;
      return null;
    }

    this.mensaje.textContent = '';
    return { seed, plantas, herbivoros, depredadores };
  }

  /** Valida los campos y dispara `alGenerar` si todo está bien. */
  generar() {
    const valores = this.leer();
    if (valores === null) return;
    this.mensaje.textContent = `Generando · seed ${valores.seed}`;
    this.alGenerar?.(valores);
  }

  /** Saca el panel y el botón del DOM. */
  destruir() {
    this.panel.remove();
    this.boton.remove();
  }
}
