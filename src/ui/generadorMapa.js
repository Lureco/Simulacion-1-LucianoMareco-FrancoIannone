/**
 * src/ui/generadorMapa.js — Panel de configuración y presets
 * ============================================================
 *
 * Panel HTML sobre el canvas. Recorre `CONFIG_BASE` y arma una categoría por
 * sección (mundo, render, sprites, tiempo, ...), más una categoría "Presets"
 * con presets incluidos y guardados por el usuario (import/export JSON).
 *
 * Solo se muestran los valores editables: números, booleanos y colores. Los
 * strings de rutas de sprites y los objetos anidados se omiten: el atlas se
 * arma una sola vez al iniciar.
 *
 * El botón flotante recorre tres posiciones:
 *
 *   oculto → abajo → pantalla completa → oculto
 *
 * - **abajo**: cajón en el borde inferior (38vh), se sigue viendo la simulación.
 * - **pantalla**: ocupa toda la ventana.
 * - **oculto**: solo queda el botón flotante (estado inicial).
 *
 * En las tres, la cabecera y las acciones quedan fijas y el contenido tiene
 * scroll con la rueda del mouse. Un tirador en la esquina superior derecha
 * permite agrandar el panel arrastrando (en "abajo" solo cambia la altura y
 * se ancla al borde inferior; en "pantalla" cambian ancho y alto).
 *
 * "Aplicar y recargar" valida todo, pasa los valores a `alGenerar` (en
 * `main.js`: guardar overrides + `location.reload()`), con lo que cada cambio
 * se lee fresco desde `CONFIG` en el arranque. Posición, tamaño y scroll del
 * panel también sobreviven a esa recarga (`ecosistemas.ui.v1`).
 */

import { CONFIG, CONFIG_BASE, PRESETS } from '../config.js';
import { clamp } from '../core/utils.js';
import { hashString } from '../core/prng.js';
import { asignarPorRuta, clonarConfig, copiarValidos, valorPorRuta } from '../core/configUtils.js';
import {
  cargarEstadoUI,
  cargarPresets,
  guardarEstadoUI,
  guardarPresets,
} from '../core/configPersistencia.js';
import {
  esNombreValido,
  fusionarPresets,
  limpiarValores,
  normalizarNombre,
  serializarPresets,
  validarPresets,
} from '../core/presets.js';

/** Posiciones que recorre el botón, en orden. */
export const POSICIONES = ['oculto', 'abajo', 'pantalla'];

const ETIQUETAS = { oculto: 'Oculto', abajo: 'Abajo', pantalla: 'Pantalla' };

/** Campos que antes eran "los cuatro del mapa" (se mantienen como aliases). */
const ALIAS_INICIALES = {
  seed: 'mundo.seedPorDefecto',
  plantas: 'plantas.poblacionInicial',
  herbivoros: 'herbivoro.poblacionInicial',
  depredadores: 'depredador.poblacionInicial',
};

const RUTA_SEED = ALIAS_INICIALES.seed;

/** Colores guardados como entero `0xRRGGBB` (los de `ui` ya son `#rrggbb`). */
const COLORES_NUMERO = new Set([
  'render.colorFondo',
  'terreno.colorAgua',
  'terreno.colorArena',
  'terreno.colorTierra',
  'plantas.colorSemilla',
  'plantas.colorJoven',
  'plantas.colorAdulta',
]);

const ESTILO_BOTON = (fondo = 'rgba(255, 255, 255, 0.06)') =>
  `appearance: none; border: 1px solid rgba(255, 255, 255, 0.18);` +
  `background: ${fondo}; color: #e6e6e6; font: inherit;` +
  `padding: 4px 10px; border-radius: 6px; cursor: pointer;`;

const ESTILO_INPUT = `
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #e6e6e6;
  font: inherit;
  padding: 4px 8px;
  border-radius: 6px;
`;

const ESTILO_BASE = `
  position: absolute;
  z-index: 10;
  box-sizing: border-box;
  overflow: hidden;
  color: #e6e6e6;
  background: rgba(11, 13, 16, 0.96);
  font: 13px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
`;

const POR_POSICION = {
  oculto: 'display: none;',
  abajo:
    'display: flex; left: 0; right: 0; bottom: 0; top: auto; height: 38vh;' +
    ' border-top: 1px solid rgba(255, 255, 255, 0.18);',
  pantalla: 'display: flex; top: 0; right: 0; bottom: 0; left: 0;',
};

/** 0xRRGGBB → "#rrggbb" para `<input type="color">`. */
export function numeroAHex(valor) {
  return `#${(Number(valor) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

/** "#rrggbb" → 0xRRGGBB. */
export function hexANumero(texto) {
  const limpio = String(texto ?? '').replace(/^#/, '');
  const n = Number.parseInt(limpio, 16);
  return Number.isFinite(n) ? n >>> 0 : 0;
}

/** Valida el tamaño recuperado de `localStorage` (puede estar corrupto). */
function tamanoGuardado(valor) {
  if (!valor || typeof valor !== 'object') return null;
  const tamano = {};
  if (Number.isFinite(valor.ancho) && valor.ancho > 0) tamano.ancho = valor.ancho;
  if (Number.isFinite(valor.altura) && valor.altura > 0) tamano.altura = valor.altura;
  return Object.keys(tamano).length > 0 ? tamano : null;
}

function nombreArchivo(nombre) {
  return (
    String(nombre)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'preset'
  );
}

export class GeneradorMapa {
  /**
   * @param {HTMLElement} contenedor
   * @param {object} [opciones]
   * @param {(valores: object) => void} [opciones.alGenerar]
   * @param {() => void} [opciones.alRestablecer]
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
      alRestablecer,
      seed = CONFIG.mundo.seedPorDefecto,
      plantas = CONFIG.plantas.poblacionInicial,
      herbivoros = CONFIG.herbivoro.poblacionInicial,
      depredadores = CONFIG.depredador.poblacionInicial,
      maxPlantas = CONFIG.mundo.ancho * CONFIG.mundo.alto,
      maxNpcs = CONFIG.entidades.maxEntidades,
    } = {},
  ) {
    this.alGenerar = alGenerar;
    this.alRestablecer = alRestablecer;
    this.maxPlantas = maxPlantas;
    this.maxNpcs = maxNpcs;

    // El panel recuerda dónde estaba: así "Aplicar y recargar" no lo cierra.
    const estadoUI = cargarEstadoUI();
    this.posicion = POSICIONES.includes(estadoUI.posicion) ? estadoUI.posicion : 'oculto';

    /** @type {Record<string, HTMLInputElement>} Campos por ruta `seccion.clave`. */
    this.campos = {};
    /** @type {Record<string, string>} Tipo de cada campo editable. */
    this.tipos = {};
    this.iniciales = { seed, plantas, herbivoros, depredadores };
    this.presets = this.cargarPresetsSeguras();
    this.tamanoPorPosicion = {
      abajo: tamanoGuardado(estadoUI.tamanos?.abajo),
      pantalla: tamanoGuardado(estadoUI.tamanos?.pantalla),
    };
    this.scrollGuardado =
      Number.isFinite(estadoUI.scrollTop) && estadoUI.scrollTop >= 0 ? estadoUI.scrollTop : 0;
    this._persistenciaScrollPendiente = false;

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

    // ── Cabecera: título + acciones fijas ──
    const cabecera = document.createElement('div');
    cabecera.style.cssText =
      'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;' +
      ' margin-bottom: 12px; padding-bottom: 10px;' +
      ' border-bottom: 1px solid rgba(255, 255, 255, 0.12);';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Configuración';
    cabecera.appendChild(titulo);

    this.botonGenerar = document.createElement('button');
    this.botonGenerar.type = 'button';
    this.botonGenerar.textContent = 'Aplicar y recargar';
    this.botonGenerar.style.cssText = ESTILO_BOTON('rgba(111, 174, 82, 0.35)');
    this.botonGenerar.addEventListener('click', () => this.generar());
    cabecera.appendChild(this.botonGenerar);

    this.botonRestablecer = document.createElement('button');
    this.botonRestablecer.type = 'button';
    this.botonRestablecer.textContent = 'Restablecer';
    this.botonRestablecer.style.cssText = ESTILO_BOTON();
    this.botonRestablecer.addEventListener('click', () => this.restablecer());
    cabecera.appendChild(this.botonRestablecer);

    this.mensaje = document.createElement('span');
    this.mensaje.style.cssText = 'color: #9aa4b2;';
    cabecera.appendChild(this.mensaje);

    this.panel.appendChild(cabecera);

    // ── Contenido con scroll (rueda del mouse) ──
    this.contenido = document.createElement('div');
    this.contenido.style.cssText =
      'flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;' +
      ' padding-right: 8px;';
    this.contenido.addEventListener('scroll', () => this.guardarScroll());
    this.panel.appendChild(this.contenido);

    this.crearSeccionPresets();
    for (const [seccion, valores] of Object.entries(CONFIG_BASE)) {
      this.crearSeccionConfig(seccion, valores);
    }

    // Aliases históricos (tests y código externo siguen usando campos.seed, etc.).
    for (const [alias, ruta] of Object.entries(ALIAS_INICIALES)) {
      this.campos[alias] = this.campos[ruta];
    }

    this.crearAgarre();
    this.reflejar();
  }

  // ── Construcción del formulario ────────────────────────────────────────

  /** Encabezado + grilla de campos para una sección de `CONFIG_BASE`. */
  crearSeccionConfig(seccion, valoresBase) {
    const bloque = document.createElement('section');
    bloque.style.cssText = 'margin-bottom: 20px;';

    const titulo = document.createElement('h3');
    titulo.textContent = seccion;
    titulo.style.cssText =
      'margin: 0 0 8px; font-size: 13px; text-transform: uppercase;' +
      ' letter-spacing: 0.08em; color: #8fb8e0;';
    bloque.appendChild(titulo);

    const grilla = document.createElement('div');
    grilla.style.cssText =
      'display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));' +
      ' gap: 10px 14px;';

    for (const [clave, base] of Object.entries(valoresBase)) {
      const ruta = `${seccion}.${clave}`;

      // Solo números, booleanos y colores: las rutas de sprites y los objetos
      // anidados no se muestran (no se pueden cambiar desde este panel).
      const tipo = this.tipoCampo(ruta, base);
      if (tipo === null) continue;

      this.crearCampo(grilla, clave, tipo, this.valorInicial(ruta, base), ruta);
    }

    bloque.appendChild(grilla);
    this.contenido.appendChild(bloque);
  }

  /** Valor que se muestra al abrir el panel (los cuatro iniciales viven en ESTADO). */
  valorInicial(ruta, base) {
    for (const [alias, rutaAlias] of Object.entries(ALIAS_INICIALES)) {
      if (ruta === rutaAlias && this.iniciales[alias] !== undefined) {
        return this.iniciales[alias];
      }
    }
    return valorPorRuta(CONFIG, ruta) ?? base;
  }

  /** Tipo de input según el valor por defecto y la ruta; `null` si no es editable. */
  tipoCampo(ruta, base) {
    if (ruta === RUTA_SEED) return 'seed';
    if (COLORES_NUMERO.has(ruta)) return 'colorHex';
    if (typeof base === 'boolean') return 'booleano';
    if (typeof base === 'string' && /^#[0-9a-f]{6}$/i.test(base)) return 'colorString';
    if (typeof base === 'number') return 'numero';
    return null;
  }

  /** Agrega un campo editable y guarda la referencia en `this.campos[ruta]`. */
  crearCampo(contenedor, etiquetaTexto, tipo, valor, ruta) {
    const envoltorio = document.createElement('label');
    envoltorio.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    const texto = document.createElement('span');
    texto.textContent = etiquetaTexto;
    texto.style.cssText = 'color: #9aa4b2;';
    envoltorio.appendChild(texto);

    const input = document.createElement('input');
    input.type =
      tipo === 'booleano'
        ? 'checkbox'
        : tipo === 'colorHex' || tipo === 'colorString'
          ? 'color'
          : 'number';

    if (tipo === 'booleano') {
      input.checked = Boolean(valor);
      input.style.cssText = 'width: 18px; height: 18px; accent-color: #6fae52;';
    } else {
      input.value = tipo === 'colorHex' ? numeroAHex(valor) : String(valor ?? '');
      input.style.cssText = `width: 100%; ${ESTILO_INPUT}`;
      if (tipo === 'numero') input.step = Number.isInteger(Number(valor)) ? '1' : '0.001';
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault?.();
        this.generar();
      }
    });
    envoltorio.appendChild(input);
    contenedor.appendChild(envoltorio);

    this.campos[ruta] = input;
    this.tipos[ruta] = tipo;
    return input;
  }

  // ── Presets ────────────────────────────────────────────────────────────

  cargarPresetsSeguras() {
    const guardados = cargarPresets();
    const limpios = {};
    for (const [nombre, valores] of Object.entries(guardados)) {
      if (!esNombreValido(nombre)) continue;
      const validos = limpiarValores(valores);
      if (Object.keys(validos).length > 0) limpios[normalizarNombre(nombre)] = validos;
    }
    return limpios;
  }

  crearSeccionPresets() {
    const bloque = document.createElement('section');
    bloque.style.cssText = 'margin-bottom: 22px;';

    const titulo = document.createElement('h3');
    titulo.textContent = 'Presets';
    titulo.style.cssText =
      'margin: 0 0 8px; font-size: 13px; text-transform: uppercase;' +
      ' letter-spacing: 0.08em; color: #8fb8e0;';
    bloque.appendChild(titulo);

    const fila = document.createElement('div');
    fila.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';

    this.selectPresets = document.createElement('select');
    this.selectPresets.style.cssText = `min-width: 190px; ${ESTILO_INPUT}`;
    fila.appendChild(this.selectPresets);

    this.nombrePreset = document.createElement('input');
    this.nombrePreset.type = 'text';
    this.nombrePreset.style.cssText = `width: 170px; ${ESTILO_INPUT}`;
    fila.appendChild(this.nombrePreset);

    const acciones = [
      ['Cargar en el formulario', () => this.cargarPreset()],
      ['Guardar como…', () => this.guardarPreset()],
      ['Borrar', () => this.borrarPreset()],
      ['Descargar seleccionado', () => this.descargar(true)],
      ['Descargar todos', () => this.descargar(false)],
    ];
    for (const [texto, fn] of acciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = texto;
      boton.style.cssText = ESTILO_BOTON();
      boton.addEventListener('click', fn);
      fila.appendChild(boton);
    }

    this.entradaJSON = document.createElement('input');
    this.entradaJSON.type = 'file';
    this.entradaJSON.accept = 'application/json,.json';
    this.entradaJSON.style.cssText = 'max-width: 220px; color: #9aa4b2;';
    this.entradaJSON.addEventListener('change', (e) => this.subirJSON(e));
    fila.appendChild(this.entradaJSON);

    bloque.appendChild(fila);

    const pista = document.createElement('p');
    pista.textContent =
      'Elegir un preset llena el formulario: revisalo y apretá Aplicar y recargar. ' +
      'El nombre a la derecha se usa para Guardar como…';
    pista.style.cssText = 'margin: 8px 0 0; color: #9aa4b2;';
    bloque.appendChild(pista);

    this.contenido.appendChild(bloque);
    this.refrescarSelectPresets();
  }

  refrescarSelectPresets() {
    const seleccionAnterior = String(this.selectPresets?.value ?? '');
    if (typeof this.selectPresets.replaceChildren === 'function') {
      this.selectPresets.replaceChildren();
    } else {
      this.selectPresets.children.length = 0;
    }

    const agregar = (valor, texto) => {
      const opcion = document.createElement('option');
      opcion.value = valor;
      opcion.textContent = texto;
      this.selectPresets.appendChild(opcion);
    };

    agregar('', 'Elegir preset…');
    for (const nombre of Object.keys(PRESETS))
      agregar(`incluido:${nombre}`, `Incluido · ${nombre}`);
    for (const nombre of Object.keys(this.presets))
      agregar(`guardado:${nombre}`, `Guardado · ${nombre}`);

    const existe = this.selectPresets.children.some?.(
      (opcion) => opcion.value === seleccionAnterior,
    );
    this.selectPresets.value = existe ? seleccionAnterior : '';
  }

  presetSeleccionado() {
    const valor = String(this.selectPresets?.value ?? '');
    if (valor.startsWith('incluido:')) {
      const nombre = valor.slice('incluido:'.length);
      return { nombre, valores: PRESETS[nombre] ?? {}, incluido: true };
    }
    if (valor.startsWith('guardado:')) {
      const nombre = valor.slice('guardado:'.length);
      return { nombre, valores: this.presets[nombre] ?? {}, incluido: false };
    }
    return null;
  }

  /** Carga defaults + override del preset en los campos (sin aplicar). */
  cargarPreset() {
    const seleccion = this.presetSeleccionado();
    if (seleccion === null) {
      this.mensaje.textContent = 'Elegí un preset de la lista';
      return;
    }
    const valores = clonarConfig(CONFIG_BASE);
    copiarValidos(valores, seleccion.valores, valores);
    this.escribir(valores);
    this.mensaje.textContent = `Preset "${seleccion.nombre}" cargado · presioná Aplicar y recargar`;
  }

  /** Vuelca valores con forma de CONFIG en los inputs. */
  escribir(valores) {
    for (const [ruta, input] of Object.entries(this.campos)) {
      const tipo = this.tipos[ruta];
      if (!tipo) continue;
      const valor = valorPorRuta(valores, ruta);
      if (valor === undefined) continue;
      if (tipo === 'booleano') input.checked = Boolean(valor);
      else if (tipo === 'colorHex') input.value = numeroAHex(valor);
      else input.value = String(valor);
    }
  }

  guardarPreset() {
    const nombre = normalizarNombre(this.nombrePreset.value);
    if (!esNombreValido(nombre)) {
      this.mensaje.textContent = 'Nombre de preset inválido (1 a 40 caracteres)';
      return;
    }
    if (Object.prototype.hasOwnProperty.call(PRESETS, nombre)) {
      this.mensaje.textContent = 'Ese nombre pertenece a un preset incluido';
      return;
    }
    const valores = this.leer();
    if (valores === null) return;

    this.presets[nombre] = valores;
    guardarPresets(this.presets);
    this.refrescarSelectPresets();
    this.selectPresets.value = `guardado:${nombre}`;
    this.mensaje.textContent = `Preset "${nombre}" guardado`;
  }

  borrarPreset() {
    const seleccion = this.presetSeleccionado();
    if (seleccion === null) {
      this.mensaje.textContent = 'Elegí un preset de la lista';
      return;
    }
    if (seleccion.incluido) {
      this.mensaje.textContent = 'Los presets incluidos no se pueden borrar';
      return;
    }
    delete this.presets[seleccion.nombre];
    guardarPresets(this.presets);
    this.refrescarSelectPresets();
    this.mensaje.textContent = `Preset "${seleccion.nombre}" borrado`;
  }

  descargar(seleccionado) {
    if (seleccionado) {
      const seleccion = this.presetSeleccionado();
      if (seleccion === null) {
        this.mensaje.textContent = 'Elegí un preset de la lista';
        return;
      }
      const texto = serializarPresets({ [seleccion.nombre]: seleccion.valores });
      this.descargarTexto(`preset-${nombreArchivo(seleccion.nombre)}.json`, texto);
      return;
    }

    const nombres = Object.keys(this.presets);
    if (nombres.length === 0) {
      this.mensaje.textContent = 'No hay presets guardados para descargar';
      return;
    }
    this.descargarTexto('presets-ecosistemas.json', serializarPresets(this.presets, nombres));
  }

  descargarTexto(nombre, texto) {
    const blob = new Blob([texto], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    this.mensaje.textContent = `Descargado ${nombre}`;
  }

  subirJSON(evento) {
    const archivo = evento?.target?.files?.[0];
    if (!archivo) return;

    if (typeof FileReader !== 'undefined') {
      const lector = new FileReader();
      lector.onload = () => this.importarJSON(String(lector.result ?? ''));
      lector.onerror = () => {
        this.mensaje.textContent = 'No se pudo leer el archivo';
      };
      lector.readAsText(archivo);
    } else if (typeof archivo.text === 'function') {
      archivo
        .text()
        .then((texto) => this.importarJSON(texto))
        .catch(() => {
          this.mensaje.textContent = 'No se pudo leer el archivo';
        });
    } else {
      this.mensaje.textContent = 'No se pudo leer el archivo';
    }
  }

  importarJSON(texto) {
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      this.mensaje.textContent = 'JSON inválido';
      return;
    }

    const { presets, errores } = validarPresets(datos);
    for (const nombre of Object.keys(PRESETS)) {
      if (Object.prototype.hasOwnProperty.call(presets, nombre)) {
        delete presets[nombre];
        errores.push(`"${nombre}" ya existe como preset incluido`);
      }
    }
    if (Object.keys(presets).length === 0) {
      this.mensaje.textContent = errores[0] ?? 'No hay presets válidos en el archivo';
      return;
    }

    const fusion = fusionarPresets(this.presets, presets);
    this.presets = fusion.presets;
    guardarPresets(this.presets);
    this.refrescarSelectPresets();

    const aviso = `Importados ${Object.keys(presets).length} · ${fusion.agregados} nuevos, ${fusion.actualizados} actualizados`;
    this.mensaje.textContent = errores.length > 0 ? `${aviso} · ${errores.length} omitidos` : aviso;
  }

  // ── Redimensionado por arrastre ────────────────────────────────────────

  /** Tirador en la esquina superior derecha (se agrega al final del panel). */
  crearAgarre() {
    this.agarre = document.createElement('div');
    this.agarre.className = 'generador-mapa-resize';
    this.agarre.textContent = '◥';
    this.agarre.style.cssText = `
      position: absolute;
      right: 2px;
      top: 2px;
      z-index: 2;
      width: 18px;
      height: 18px;
      cursor: ns-resize;
      touch-action: none;
      user-select: none;
      text-align: center;
      color: rgba(255, 255, 255, 0.45);
      font: 14px/18px ui-monospace, "Cascadia Code", Consolas, monospace;
    `;
    this.agarre.addEventListener('pointerdown', (evento) => this.empezarRedimension(evento));
    this.panel.appendChild(this.agarre);
  }

  /**
   * Arranca el arrastre. En "abajo" el panel sigue anclado al borde inferior y
   * solo cambia la altura (arrastrar hacia arriba lo agranda). En "pantalla"
   * cambian ancho y alto con el anclaje arriba-izquierda.
   */
  empezarRedimension(evento) {
    if (this.posicion === 'oculto') return;
    evento.preventDefault?.();

    const rect = this.panel.getBoundingClientRect();
    const anchoInicial = rect.width;
    const altoInicial = rect.height;
    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const anchoVentana = typeof window !== 'undefined' ? window.innerWidth : anchoInicial;
    const altoVentana = typeof window !== 'undefined' ? window.innerHeight : altoInicial;

    const maxAncho = anchoVentana - rect.left;
    const maxAlto = this.posicion === 'abajo' ? rect.bottom : altoVentana - rect.top;
    const minAncho = Math.min(320, maxAncho);
    const minAlto = Math.min(160, maxAlto);

    this.agarre.setPointerCapture?.(evento.pointerId);

    const mover = (e) => {
      const dx = e.clientX - inicioX;
      const dy = e.clientY - inicioY;
      const tamano =
        this.posicion === 'abajo'
          ? { altura: clamp(altoInicial - dy, minAlto, maxAlto) }
          : {
              ancho: clamp(anchoInicial + dx, minAncho, maxAncho),
              altura: clamp(altoInicial + dy, minAlto, maxAlto),
            };
      this.tamanoPorPosicion[this.posicion] = tamano;
      this.aplicarTamano();
    };

    const terminar = (e) => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', terminar);
      window.removeEventListener('pointercancel', terminar);
      this.agarre.releasePointerCapture?.(e?.pointerId);
      this.persistirEstadoUI();
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', terminar);
    window.addEventListener('pointercancel', terminar);
  }

  /** Reaplica el tamaño guardado para la posición actual (si lo hay). */
  aplicarTamano() {
    const tamano = this.tamanoPorPosicion[this.posicion];
    if (!tamano || this.posicion === 'oculto') return;

    if (this.posicion === 'abajo') {
      this.panel.style.height = `${Math.round(tamano.altura)}px`;
      return;
    }

    this.panel.style.top = '0';
    this.panel.style.left = '0';
    this.panel.style.right = 'auto';
    this.panel.style.bottom = 'auto';
    this.panel.style.width = `${Math.round(tamano.ancho)}px`;
    this.panel.style.height = `${Math.round(tamano.altura)}px`;
  }

  // ── Posiciones y ciclo de vida ─────────────────────────────────────────

  /** Avanza al siguiente estado: oculto → abajo → pantalla → oculto. */
  ciclar() {
    const siguiente = (POSICIONES.indexOf(this.posicion) + 1) % POSICIONES.length;
    this.setPosicion(POSICIONES[siguiente]);
  }

  /** Fija una posición (ignora valores desconocidos). */
  setPosicion(posicion) {
    if (!POSICIONES.includes(posicion)) return;
    this.posicion = posicion;
    this.reflejar();
    this.persistirEstadoUI();
  }

  /** Reescribe solo los estilos que cambian entre posiciones. */
  reflejar() {
    this.panel.style.cssText = ESTILO_BASE + POR_POSICION[this.posicion];
    this.boton.textContent = `⚙ Configuración: ${ETIQUETAS[this.posicion]}`;
    if (this.agarre) {
      this.agarre.style.display = this.posicion === 'oculto' ? 'none' : 'block';
      this.agarre.style.cursor = this.posicion === 'abajo' ? 'ns-resize' : 'nwse-resize';
    }
    this.aplicarTamano();
    this.restaurarScroll();
  }

  /** Vuelve a colocar el contenido donde estaba (tras la recarga o un cambio de posición). */
  restaurarScroll() {
    if (this.posicion === 'oculto' || !this.scrollGuardado) return;
    const aplicar = () => {
      if (this.posicion !== 'oculto') this.contenido.scrollTop = this.scrollGuardado;
    };
    aplicar();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(aplicar);
  }

  /** Recuerda el scroll sin escribir en `localStorage` en cada evento. */
  guardarScroll() {
    if (this.posicion === 'oculto') return;
    const valor = this.contenido.scrollTop;
    if (!Number.isFinite(valor)) return;
    this.scrollGuardado = valor;
    if (this._persistenciaScrollPendiente) return;
    this._persistenciaScrollPendiente = true;
    const persistir = () => {
      this._persistenciaScrollPendiente = false;
      this.persistirEstadoUI();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(persistir);
    else persistir();
  }

  /** Guarda posición, tamaños y scroll para reabrir el panel igual tras una recarga. */
  persistirEstadoUI() {
    guardarEstadoUI({
      posicion: this.posicion,
      tamanos: this.tamanoPorPosicion,
      scrollTop: Math.round(this.scrollGuardado || 0),
    });
  }

  // ── Lectura y aplicación ────────────────────────────────────────────────

  leerSemilla(input) {
    const texto = String(input.value ?? '').trim();
    if (texto === '') return CONFIG_BASE.mundo.seedPorDefecto;
    if (/^\d+$/.test(texto)) return Number(texto) >>> 0;
    return hashString(texto);
  }

  /**
   * Parsea y valida TODOS los campos. Devuelve un objeto con forma de `CONFIG`
   * (solo valores editables) o `null` con el error en `this.mensaje`.
   */
  leer() {
    const valores = {};

    for (const [ruta, tipo] of Object.entries(this.tipos)) {
      const input = this.campos[ruta];
      let valor;

      if (tipo === 'booleano') {
        valor = Boolean(input.checked);
      } else if (tipo === 'colorHex') {
        valor = hexANumero(input.value);
      } else if (tipo === 'colorString') {
        valor = String(input.value ?? '').toLowerCase();
      } else if (tipo === 'seed') {
        valor = this.leerSemilla(input);
      } else {
        const texto = String(input.value ?? '').trim();
        if (texto === '') {
          this.mensaje.textContent = `${ruta}: ingresá un número`;
          return null;
        }
        valor = Number(texto);
        if (!Number.isFinite(valor)) {
          this.mensaje.textContent = `${ruta}: ingresá un número válido`;
          return null;
        }
        if (valor < 0) {
          this.mensaje.textContent = `${ruta}: ingresá un número ≥ 0`;
          return null;
        }
      }

      asignarPorRuta(valores, ruta, valor);
    }

    if (valores.mundo.ancho < 1 || valores.mundo.alto < 1) {
      this.mensaje.textContent = 'El mundo debe medir al menos 1 × 1 celdas';
      return null;
    }
    if (valores.tiempo.pasoFijo <= 0) {
      this.mensaje.textContent = 'El paso fijo debe ser mayor que 0';
      return null;
    }
    if (valores.camara.zoomMin > valores.camara.zoomMax) {
      this.mensaje.textContent = 'El zoom mínimo no puede superar el máximo';
      return null;
    }

    const plantas = valores.plantas.poblacionInicial;
    if (plantas > this.maxPlantas) {
      this.mensaje.textContent = `Plantas iniciales: el máximo es ${this.maxPlantas}`;
      return null;
    }
    const herbivoros = valores.herbivoro.poblacionInicial;
    const depredadores = valores.depredador.poblacionInicial;
    const tope = Math.min(this.maxNpcs, valores.entidades.maxEntidades);
    if (herbivoros + depredadores > tope) {
      this.mensaje.textContent = `Herbívoros + depredadores ≤ ${tope}`;
      return null;
    }

    this.mensaje.textContent = '';
    return valores;
  }

  /** Valida los campos y dispara `alGenerar` si todo está bien. */
  generar() {
    const valores = this.leer();
    if (valores === null) return;
    this.guardarScroll();
    this.persistirEstadoUI();
    this.mensaje.textContent = 'Aplicando configuración…';
    this.alGenerar?.(valores);
  }

  /** Pide al exterior que limpie los overrides activos. */
  restablecer() {
    this.guardarScroll();
    this.persistirEstadoUI();
    this.alRestablecer?.();
  }

  /** Saca el panel y el botón del DOM. */
  destruir() {
    this.panel.remove();
    this.boton.remove();
  }
}
