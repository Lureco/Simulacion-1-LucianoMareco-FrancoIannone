/**
 * tests/generadorMapa.test.js — Panel de configuración y presets
 * ===============================================================
 * No se necesita jsdom: se stubea `document.createElement` con un elemento
 * mínimo. Se verifican las tres posiciones, las categorías, el scroll, los
 * tipos de campo, la validación, los presets y el objeto que llega al callback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_BASE } from '../src/config.js';
import { hashString } from '../src/core/prng.js';
import { GeneradorMapa, POSICIONES } from '../src/ui/generadorMapa.js';

/** Imita a CSSStyleDeclaration: asignar `cssText` reemplaza las demás props. */
function crearEstilo() {
  const estilo = {};
  Object.defineProperty(estilo, 'cssText', {
    configurable: true,
    get() {
      return this._cssText ?? '';
    },
    set(texto) {
      for (const clave of Object.keys(this)) {
        if (clave !== '_cssText') delete this[clave];
      }
      this._cssText = texto;
    },
  });
  return estilo;
}

function crearElemento(tagName) {
  const escuchas = new Map();
  return {
    tagName: tagName.toUpperCase(),
    type: '',
    value: '',
    min: '',
    max: '',
    step: '',
    checked: false,
    readOnly: false,
    scrollTop: 0,
    accept: '',
    href: '',
    download: '',
    textContent: '',
    className: '',
    style: crearEstilo(),
    children: [],
    appendChild(hijo) {
      this.children.push(hijo);
      return hijo;
    },
    addEventListener(tipo, fn) {
      if (!escuchas.has(tipo)) escuchas.set(tipo, []);
      escuchas.get(tipo).push(fn);
    },
    click() {
      for (const fn of escuchas.get('click') ?? []) fn({ target: this });
    },
    presionar(key) {
      for (const fn of escuchas.get('keydown') ?? []) {
        fn({ target: this, key, preventDefault: vi.fn() });
      }
    },
    despachar(tipo, evento = {}) {
      for (const fn of escuchas.get(tipo) ?? []) fn({ target: this, ...evento });
    },
    getBoundingClientRect() {
      return (
        this.rect ?? {
          left: 0,
          top: 0,
          right: 1024,
          bottom: 768,
          width: 1024,
          height: 768,
        }
      );
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    remove() {},
  };
}

function crearAlmacen() {
  const datos = new Map();
  return {
    datos,
    getItem: vi.fn((clave) => datos.get(clave) ?? null),
    setItem: vi.fn((clave, valor) => datos.set(clave, valor)),
    removeItem: vi.fn((clave) => datos.delete(clave)),
  };
}

let almacen;
let blobs;
let ventana;

beforeEach(() => {
  almacen = crearAlmacen();
  blobs = [];
  ventana = {
    innerWidth: 1024,
    innerHeight: 768,
    escuchas: new Map(),
    addEventListener(tipo, fn) {
      if (!this.escuchas.has(tipo)) this.escuchas.set(tipo, []);
      this.escuchas.get(tipo).push(fn);
    },
    removeEventListener(tipo, fn) {
      const lista = this.escuchas.get(tipo) ?? [];
      const indice = lista.indexOf(fn);
      if (indice >= 0) lista.splice(indice, 1);
    },
    despachar(tipo, evento = {}) {
      for (const fn of this.escuchas.get(tipo) ?? []) fn(evento);
    },
  };
  vi.stubGlobal('window', ventana);
  vi.stubGlobal('document', { createElement: crearElemento });
  vi.stubGlobal('localStorage', almacen);
  vi.stubGlobal(
    'Blob',
    class {
      constructor(partes, opciones) {
        this.partes = partes;
        this.opciones = opciones;
        blobs.push(this);
      }
    },
  );
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:prueba'),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    'FileReader',
    class {
      readAsText(archivo) {
        this.result = archivo.contenido;
        this.onload?.();
      }
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function crearPanel(opciones = {}) {
  const contenedor = crearElemento('div');
  const alGenerar = vi.fn();
  const alRestablecer = vi.fn();
  const panel = new GeneradorMapa(contenedor, { alGenerar, alRestablecer, ...opciones });
  return { panel, alGenerar, alRestablecer, contenedor };
}

function llenar(panel, valores) {
  for (const [campo, valor] of Object.entries(valores)) {
    panel.campos[campo].value = String(valor);
  }
}

function buscarBoton(raiz, texto) {
  if (raiz.textContent === texto && raiz.tagName === 'BUTTON') return raiz;
  for (const hijo of raiz.children ?? []) {
    const encontrado = buscarBoton(hijo, texto);
    if (encontrado) return encontrado;
  }
  return null;
}

function buscarElemento(raiz, predicado) {
  if (predicado(raiz)) return raiz;
  for (const hijo of raiz.children ?? []) {
    const encontrado = buscarElemento(hijo, predicado);
    if (encontrado) return encontrado;
  }
  return null;
}

function textosDe(raiz) {
  const resultado = raiz.textContent ? [raiz.textContent] : [];
  for (const hijo of raiz.children ?? []) resultado.push(...textosDe(hijo));
  return resultado;
}

describe('posiciones del panel', () => {
  it('arranca oculto y el botón recorre las tres posiciones en orden', () => {
    const { panel } = crearPanel();
    expect(panel.posicion).toBe('oculto');
    expect(panel.panel.style.cssText).toContain('display: none');

    panel.ciclar();
    expect(panel.posicion).toBe('abajo');
    expect(panel.panel.style.cssText).toContain('height: 38vh');

    panel.ciclar();
    expect(panel.posicion).toBe('pantalla');
    expect(panel.panel.style.cssText).toContain('top: 0');

    panel.ciclar();
    expect(panel.posicion).toBe('oculto');
  });

  it('el botón flotante recorre las posiciones y setPosicion va directo', () => {
    const { panel } = crearPanel();
    expect(POSICIONES).toEqual(['oculto', 'abajo', 'pantalla']);

    panel.setPosicion('pantalla');
    expect(panel.posicion).toBe('pantalla');

    panel.boton.click();
    expect(panel.posicion).toBe('oculto');

    panel.setPosicion('abajo');
    expect(panel.posicion).toBe('abajo');
  });

  it('ignora posiciones desconocidas', () => {
    const { panel } = crearPanel();
    panel.setPosicion('mitad');
    expect(panel.posicion).toBe('oculto');
  });
});

describe('estado del panel entre recargas', () => {
  it('restaura posición y tamaños guardados al construir', () => {
    localStorage.setItem(
      'ecosistemas.ui.v1',
      JSON.stringify({
        posicion: 'pantalla',
        tamanos: { abajo: { altura: 500 }, pantalla: { ancho: 800, altura: 600 } },
      }),
    );

    const { panel } = crearPanel();

    expect(panel.posicion).toBe('pantalla');
    expect(panel.panel.style.cssText).toContain('top: 0');
    expect(panel.panel.style.width).toBe('800px');
    expect(panel.panel.style.height).toBe('600px');
    expect(panel.tamanoPorPosicion.abajo).toEqual({ altura: 500 });
    expect(panel.agarre.style.display).toBe('block');
  });

  it('restaura el scroll del contenido al construir', () => {
    localStorage.setItem(
      'ecosistemas.ui.v1',
      JSON.stringify({ posicion: 'abajo', scrollTop: 320 }),
    );

    const { panel } = crearPanel();

    expect(panel.scrollGuardado).toBe(320);
    expect(panel.contenido.scrollTop).toBe(320);
  });

  it('guarda el scroll al desplazarse y al aplicar', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    panel.setPosicion('abajo');

    panel.contenido.scrollTop = 240;
    panel.contenido.despachar('scroll');
    expect(JSON.parse(localStorage.getItem('ecosistemas.ui.v1')).scrollTop).toBe(240);

    panel.contenido.scrollTop = 410;
    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.botonGenerar.click();

    expect(alGenerar).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('ecosistemas.ui.v1')).scrollTop).toBe(410);
  });

  it('ignora un scroll guardado inválido', () => {
    localStorage.setItem('ecosistemas.ui.v1', JSON.stringify({ posicion: 'abajo', scrollTop: -5 }));

    const { panel } = crearPanel();

    expect(panel.scrollGuardado).toBe(0);
  });

  it('guarda la posición al cambiarla y antes de aplicar', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    panel.setPosicion('abajo');
    expect(JSON.parse(localStorage.getItem('ecosistemas.ui.v1')).posicion).toBe('abajo');

    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.botonGenerar.click();

    expect(alGenerar).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('ecosistemas.ui.v1')).posicion).toBe('abajo');
  });

  it('ignora un estado guardado inválido', () => {
    localStorage.setItem(
      'ecosistemas.ui.v1',
      JSON.stringify({ posicion: 'mitad', tamanos: { abajo: { altura: 'x' } } }),
    );

    const { panel } = crearPanel();

    expect(panel.posicion).toBe('oculto');
    expect(panel.tamanoPorPosicion.abajo).toBeNull();
  });

  it('guarda el tamaño al soltar el tirador', () => {
    const { panel } = crearPanel();
    panel.setPosicion('abajo');
    panel.panel.rect = { left: 0, top: 474, right: 1024, bottom: 768, width: 1024, height: 294 };

    panel.agarre.despachar('pointerdown', { clientX: 500, clientY: 700, pointerId: 5 });
    ventana.despachar('pointermove', { clientX: 500, clientY: 500 });
    ventana.despachar('pointerup', { pointerId: 5 });

    const estado = JSON.parse(localStorage.getItem('ecosistemas.ui.v1'));
    expect(estado.tamanos.abajo).toEqual({ altura: 494 });
  });
});

describe('redimensionado por arrastre', () => {
  it('el tirador va al final del panel y se oculta con el menú', () => {
    const { panel } = crearPanel();
    expect(panel.panel.children[panel.panel.children.length - 1]).toBe(panel.agarre);
    expect(panel.agarre.className).toBe('generador-mapa-resize');
    expect(panel.agarre.style.cssText).toContain('top: 2px');
    expect(panel.agarre.style.cssText).not.toContain('bottom:');
    expect(panel.agarre.style.cssText).toContain('touch-action: none');
    expect(panel.agarre.style.display).toBe('none');

    panel.setPosicion('abajo');
    expect(panel.agarre.style.display).toBe('block');
    expect(panel.agarre.style.cursor).toBe('ns-resize');

    panel.setPosicion('pantalla');
    expect(panel.agarre.style.cursor).toBe('nwse-resize');
  });

  it('en pantalla cambia ancho y alto, anclado arriba-izquierda y limitado al viewport', () => {
    const { panel } = crearPanel();
    panel.setPosicion('pantalla');
    panel.panel.rect = { left: 0, top: 0, right: 1024, bottom: 768, width: 1024, height: 768 };

    panel.agarre.despachar('pointerdown', { clientX: 1000, clientY: 700, pointerId: 1 });
    expect(panel.agarre.setPointerCapture).toHaveBeenCalledWith(1);

    ventana.despachar('pointermove', { clientX: 900, clientY: 650 });
    expect(panel.tamanoPorPosicion.pantalla).toEqual({ ancho: 924, altura: 718 });
    expect(panel.panel.style.width).toBe('924px');
    expect(panel.panel.style.height).toBe('718px');
    expect(panel.panel.style.right).toBe('auto');
    expect(panel.panel.style.bottom).toBe('auto');

    ventana.despachar('pointermove', { clientX: 2000, clientY: 2000 });
    expect(panel.tamanoPorPosicion.pantalla).toEqual({ ancho: 1024, altura: 768 });

    ventana.despachar('pointerup', { pointerId: 1 });
    expect(panel.agarre.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(ventana.escuchas.get('pointermove')).toHaveLength(0);
    expect(ventana.escuchas.get('pointerup')).toHaveLength(0);
  });

  it('en abajo solo cambia la altura, anclado al borde inferior', () => {
    const { panel } = crearPanel();
    panel.setPosicion('abajo');
    panel.panel.rect = { left: 0, top: 474, right: 1024, bottom: 768, width: 1024, height: 294 };

    panel.agarre.despachar('pointerdown', { clientX: 500, clientY: 760, pointerId: 2 });
    ventana.despachar('pointermove', { clientX: 500, clientY: 260 });

    expect(panel.tamanoPorPosicion.abajo).toEqual({ altura: 768 });
    expect(panel.panel.style.height).toBe('768px');
    expect(panel.panel.style.cssText).toContain('bottom: 0');
    expect(panel.panel.style.width).toBeUndefined();

    ventana.despachar('pointermove', { clientX: 500, clientY: 900 });
    expect(panel.tamanoPorPosicion.abajo.altura).toBe(160);
  });

  it('recuerda el tamaño de cada posición al cambiar de una a otra', () => {
    const { panel } = crearPanel();
    panel.setPosicion('abajo');
    panel.panel.rect = { left: 0, top: 474, right: 1024, bottom: 768, width: 1024, height: 294 };
    panel.agarre.despachar('pointerdown', { clientX: 500, clientY: 700, pointerId: 3 });
    ventana.despachar('pointermove', { clientX: 500, clientY: 500 });
    ventana.despachar('pointerup', { pointerId: 3 });

    panel.setPosicion('pantalla');
    expect(panel.panel.style.height).toBeUndefined();
    expect(panel.tamanoPorPosicion.abajo.altura).toBe(494);

    panel.setPosicion('abajo');
    expect(panel.panel.style.height).toBe('494px');
  });
});

describe('categorías, scroll y tipos de campo', () => {
  it('muestra una categoría por sección de CONFIG más Presets', () => {
    const { panel } = crearPanel();
    const textos = textosDe(panel.panel);
    expect(textos).toContain('Configuración');
    expect(textos).toContain('Presets');
    for (const seccion of Object.keys(CONFIG_BASE)) expect(textos).toContain(seccion);
    expect(panel.boton.textContent).toContain('⚙ Configuración');
    expect(panel.botonGenerar.textContent).toBe('Aplicar y recargar');
  });

  it('las acciones están en la cabecera, al lado del título', () => {
    const { panel } = crearPanel();
    const cabecera = panel.panel.children[0];
    expect(cabecera.children[0].textContent).toBe('Configuración');

    const botones = cabecera.children
      .filter((hijo) => hijo.tagName === 'BUTTON')
      .map((boton) => boton.textContent);
    expect(botones).toEqual(['Aplicar y recargar', 'Restablecer']);
    expect(cabecera.children[cabecera.children.length - 1]).toBe(panel.mensaje);
  });

  it('el contenido tiene scroll con la rueda del mouse', () => {
    const { panel } = crearPanel();
    const contenido = buscarElemento(
      panel.panel,
      (nodo) => nodo.style?.cssText?.includes('overflow-y: auto') ?? false,
    );
    expect(contenido).not.toBeNull();
    expect(contenido.style.cssText).toContain('min-height: 0');
    expect(contenido.style.cssText).toContain('overscroll-behavior: contain');
  });

  it('crea inputs solo para números, booleanos y colores', () => {
    const { panel } = crearPanel();
    expect(panel.campos['terreno.umbralAgua'].type).toBe('number');
    expect(panel.campos['terreno.colorAgua'].type).toBe('color');
    expect(panel.campos['ui.graficoColorPasto'].type).toBe('color');
    expect(panel.campos['sprites.generarFallback'].type).toBe('checkbox');
    expect(panel.campos['percepcion.mantenerDistanciaAgua'].type).toBe('checkbox');

    // Las rutas de sprites (objetos anidados) ya no aparecen en el panel.
    expect(panel.campos['sprites.rutaPlanta']).toBeUndefined();
    expect(panel.campos['sprites.rutaAnimal']).toBeUndefined();
    expect(buscarElemento(panel.panel, (nodo) => nodo.tagName === 'PRE')).toBeNull();
    expect(Object.values(panel.campos).some((input) => input.readOnly)).toBe(false);
  });
});

describe('validación y callback', () => {
  it('aplica todos los valores editables con forma de CONFIG', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { seed: '42', plantas: 100, herbivoros: 10, depredadores: 3 });

    panel.botonGenerar.click();

    expect(alGenerar).toHaveBeenCalledOnce();
    const valores = alGenerar.mock.calls[0][0];
    expect(valores.mundo.seedPorDefecto).toBe(42);
    expect(valores.entidadesEstaticas.poblacionInicial).toBe(100);
    expect(valores.herbivoro.poblacionInicial).toBe(10);
    expect(valores.depredador.poblacionInicial).toBe(3);
    expect(valores.terreno.umbralAgua).toBe(CONFIG_BASE.terreno.umbralAgua);
    expect(Object.keys(valores)).toEqual(Object.keys(CONFIG_BASE));
  });

  it('convierte colores y booleanos al tipo de CONFIG', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.campos['terreno.colorAgua'].value = '#ff0000';
    panel.campos['sprites.generarFallback'].checked = false;

    panel.botonGenerar.click();

    const valores = alGenerar.mock.calls[0][0];
    expect(valores.terreno.colorAgua).toBe(0xff0000);
    expect(valores.sprites.generarFallback).toBe(false);
  });

  it('acepta seeds en texto y las hashea de forma determinista', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { seed: 'isla feliz', plantas: 100, herbivoros: 10, depredadores: 3 });

    panel.campos.seed.presionar('Enter');

    expect(alGenerar.mock.calls[0][0].mundo.seedPorDefecto).toBe(hashString('isla feliz'));
  });

  it('usa la seed por defecto si el campo está vacío', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { seed: '', plantas: 100, herbivoros: 10, depredadores: 3 });

    panel.botonGenerar.click();

    expect(alGenerar.mock.calls[0][0].mundo.seedPorDefecto).toBe(CONFIG_BASE.mundo.seedPorDefecto);
  });

  it('rechaza plantas por encima del máximo sin llamar al callback', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 100, maxNpcs: 100 });
    llenar(panel, { plantas: 101, herbivoros: 10, depredadores: 3 });

    panel.botonGenerar.click();

    expect(alGenerar).not.toHaveBeenCalled();
    expect(panel.mensaje.textContent).toContain('máximo');
  });

  it('rechaza que la suma de NPCs supere el tope de entidades', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 100, maxNpcs: 10 });
    llenar(panel, { plantas: 50, herbivoros: 6, depredadores: 6 });

    panel.botonGenerar.click();

    expect(alGenerar).not.toHaveBeenCalled();
    expect(panel.mensaje.textContent).toContain('≤ 10');
  });

  it('rechaza un número inválido en cualquier campo', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.campos['terreno.umbralAgua'].value = 'abc';

    panel.botonGenerar.click();

    expect(alGenerar).not.toHaveBeenCalled();
    expect(panel.mensaje.textContent).toContain('terreno.umbralAgua');
  });

  it('rechaza números negativos y tamaños de mundo inválidos', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.campos['terreno.umbralAgua'].value = '-1';

    panel.botonGenerar.click();
    expect(alGenerar).not.toHaveBeenCalled();
    expect(panel.mensaje.textContent).toContain('≥ 0');

    panel.campos['terreno.umbralAgua'].value = '0.32';
    panel.campos['mundo.ancho'].value = '0';
    panel.botonGenerar.click();
    expect(alGenerar).not.toHaveBeenCalled();
    expect(panel.mensaje.textContent).toContain('1 × 1');
  });

  it('pide el restablecer al exterior', () => {
    const { panel, alRestablecer } = crearPanel();
    panel.botonRestablecer.click();
    expect(alRestablecer).toHaveBeenCalledOnce();
  });
});

describe('presets', () => {
  it('cargar un preset incluido llena el formulario sin aplicar', () => {
    const { panel, alGenerar } = crearPanel();
    panel.selectPresets.value = 'incluido:Cacería';

    buscarBoton(panel.panel, 'Cargar en el formulario').click();

    expect(panel.campos['depredador.poblacionInicial'].value).toBe('80');
    expect(panel.campos['entidadesEstaticas.poblacionInicial'].value).toBe('1500');
    expect(panel.mensaje.textContent).toContain('presioná Aplicar y recargar');
    expect(alGenerar).not.toHaveBeenCalled();
  });

  it('guarda, lista y borra un preset del usuario', () => {
    const { panel } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { plantas: 100, herbivoros: 10, depredadores: 3 });
    panel.campos['terreno.umbralAgua'].value = '0.5';
    panel.nombrePreset.value = 'Mi isla';

    buscarBoton(panel.panel, 'Guardar como…').click();

    const guardados = JSON.parse(almacen.datos.get('ecosistemas.presets.v1'));
    expect(guardados['Mi isla'].terreno.umbralAgua).toBe(0.5);
    expect(panel.selectPresets.value).toBe('guardado:Mi isla');
    expect(panel.selectPresets.children.map((opcion) => opcion.value)).toContain(
      'guardado:Mi isla',
    );

    buscarBoton(panel.panel, 'Borrar').click();
    expect(JSON.parse(almacen.datos.get('ecosistemas.presets.v1'))['Mi isla']).toBeUndefined();
  });

  it('no permite guardar con un nombre de preset incluido ni borrar uno incluido', () => {
    const { panel } = crearPanel();
    panel.nombrePreset.value = 'Cacería';
    buscarBoton(panel.panel, 'Guardar como…').click();
    expect(panel.mensaje.textContent).toContain('incluido');

    panel.selectPresets.value = 'incluido:Cacería';
    buscarBoton(panel.panel, 'Borrar').click();
    expect(panel.mensaje.textContent).toContain('no se pueden borrar');
  });

  it('descarga el preset seleccionado y la colección completa en JSON', () => {
    const { panel } = crearPanel();
    panel.presets = { 'Mi isla': { terreno: { umbralAgua: 0.5 } } };
    panel.refrescarSelectPresets();

    panel.selectPresets.value = 'guardado:Mi isla';
    buscarBoton(panel.panel, 'Descargar seleccionado').click();
    expect(blobs).toHaveLength(1);
    const uno = JSON.parse(blobs[0].partes[0]);
    expect(uno.formato).toBe('ecosistemas-presets-v1');
    expect(Object.keys(uno.presets)).toEqual(['Mi isla']);

    buscarBoton(panel.panel, 'Descargar todos').click();
    const todos = JSON.parse(blobs[1].partes[0]);
    expect(Object.keys(todos.presets)).toEqual(['Mi isla']);
  });

  it('sube un JSON, fusiona presets e informa duplicados', () => {
    const { panel } = crearPanel();
    panel.presets = { 'Mi isla': { terreno: { umbralAgua: 0.4 } } };
    const json = JSON.stringify({
      formato: 'ecosistemas-presets-v1',
      presets: {
        'Mi isla': { terreno: { umbralAgua: 0.6 } },
        Bosque: { plantas: { probExpansion: 0.2 }, sprites: { padding: 'basura' } },
      },
    });

    panel.entradaJSON.despachar('change', { target: { files: [{ contenido: json }] } });

    expect(panel.mensaje.textContent).toContain('1 actualizados');
    expect(panel.presets['Mi isla'].terreno.umbralAgua).toBe(0.6);
    expect(panel.presets.Bosque.plantas.probExpansion).toBe(0.2);
    expect(panel.presets.Bosque.sprites).toBeUndefined();
  });

  it('ignora nombres que chocan con presets incluidos al importar', () => {
    const { panel } = crearPanel();
    const json = JSON.stringify({
      formato: 'ecosistemas-presets-v1',
      presets: { Cacería: { depredador: { velocidad: 9 } } },
    });

    panel.entradaJSON.despachar('change', { target: { files: [{ contenido: json }] } });

    expect(panel.presets.Cacería).toBeUndefined();
    expect(panel.mensaje.textContent).toContain('preset incluido');
  });

  it('rechaza un JSON con formato desconocido', () => {
    const { panel } = crearPanel();
    panel.entradaJSON.despachar('change', {
      target: { files: [{ contenido: '{"formato":"otro","presets":{}}' }] },
    });
    expect(panel.mensaje.textContent).toContain('Formato no reconocido');
  });
});
