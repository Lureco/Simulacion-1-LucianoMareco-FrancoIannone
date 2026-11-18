/**
 * tests/generadorMapa.test.js — Panel de generación de mapas (F8 · T84)
 * =====================================================================
 *
 * No se necesita jsdom: se stubea `document.createElement` con un elemento
 * mínimo (appendChild/addEventListener/style/textContent). Se verifican las
 * tres posiciones, la validación de campos y los valores que llegan al
 * callback, que es lo único que después usa `main.js` para regenerar el mundo.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { hashString } from '../src/core/prng.js';
import { GeneradorMapa, POSICIONES } from '../src/ui/generadorMapa.js';

function crearElemento(tagName) {
  const escuchas = new Map();
  return {
    tagName: tagName.toUpperCase(),
    type: '',
    value: '',
    min: '',
    max: '',
    textContent: '',
    className: '',
    style: { cssText: '' },
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
    remove() {},
  };
}

function crearPanel(opciones = {}) {
  const contenedor = crearElemento('div');
  const alGenerar = vi.fn();
  vi.stubGlobal('document', { createElement: crearElemento });
  const panel = new GeneradorMapa(contenedor, { alGenerar, ...opciones });
  return { panel, alGenerar, contenedor };
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

afterEach(() => vi.unstubAllGlobals());

describe('T84 · posiciones del panel', () => {
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

  it('los botones de la cabecera van directo a cada posición', () => {
    const { panel } = crearPanel();
    expect(POSICIONES).toEqual(['oculto', 'abajo', 'pantalla']);

    buscarBoton(panel.panel, 'Pantalla').click();
    expect(panel.posicion).toBe('pantalla');

    buscarBoton(panel.panel, 'Abajo').click();
    expect(panel.posicion).toBe('abajo');

    buscarBoton(panel.panel, 'Oculto').click();
    expect(panel.posicion).toBe('oculto');
  });

  it('ignora posiciones desconocidas', () => {
    const { panel } = crearPanel();
    panel.setPosicion('mitad');
    expect(panel.posicion).toBe('oculto');
  });
});

describe('T84 · validación y callback', () => {
  it('genera con una seed numérica y los cuatro parámetros', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    panel.campos.seed.value = '42';
    panel.campos.plantas.value = '100';
    panel.campos.herbivoros.value = '10';
    panel.campos.depredadores.value = '3';

    panel.botonGenerar.click();

    expect(alGenerar).toHaveBeenCalledOnce();
    expect(alGenerar).toHaveBeenCalledWith({
      seed: 42,
      plantas: 100,
      herbivoros: 10,
      depredadores: 3,
    });
  });

  it('acepta seeds en texto y las hashea de forma determinista', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { seed: 'isla feliz', plantas: 100, herbivoros: 10, depredadores: 3 });

    panel.campos.seed.presionar('Enter');

    expect(alGenerar).toHaveBeenCalledOnce();
    expect(alGenerar.mock.calls[0][0].seed).toBe(hashString('isla feliz'));
  });

  it('usa la seed por defecto si el campo está vacío', () => {
    const { panel, alGenerar } = crearPanel({ maxPlantas: 1000, maxNpcs: 100 });
    llenar(panel, { seed: '', plantas: 100, herbivoros: 10, depredadores: 3 });

    panel.botonGenerar.click();

    expect(alGenerar.mock.calls[0][0].seed).toBe(CONFIG.mundo.seedPorDefecto);
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
});
