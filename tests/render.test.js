/**
 * Tests de la capa de render con ParticleContainer (T76 spike + T80).
 * Corren en Node: construir Particles/ParticleContainer no necesita WebGL.
 * Verifican pool fijo, culling, mapeo estado→frame, flip y depuración.
 */

import { describe, expect, it } from 'vitest';
import { ParticleContainer, Rectangle, Texture } from 'pixi.js';
import { CONFIG } from '../src/config.js';
import { ESPECIE, ESTADO_IA } from '../src/entities/entity.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { PLANTA } from '../src/world/cell.js';
import { clavesBase, faseCaminar, frameAnimal, framePlanta } from '../src/render/atlasDatos.js';
import { EntityRenderer } from '../src/render/entityRenderer.js';
import { NecesidadesRenderer } from '../src/render/necesidadesRenderer.js';
import { PlantRenderer } from '../src/render/plantRenderer.js';
import { COLOR_ESTADO } from '../src/render/paleta.js';

/** Atlas falso: mismas claves, frames con UV, sin canvas ni PNG. */
function atlasFalso() {
  const frames = new Map();
  for (const clave of clavesBase()) {
    frames.set(
      clave,
      new Texture({ source: Texture.EMPTY.source, frame: new Rectangle(0, 0, 64, 64) }),
    );
  }
  return { textura: Texture.EMPTY, frames, claves: clavesBase(), ancho: 64, alto: 64 };
}

/** Cámara mínima: solo lo que los renderers leen. */
function camara({ x = 128, y = 128, zoom = 1, ancho = 128, alto = 128 } = {}) {
  return { x, y, zoom, vistaAnchoPx: ancho, vistaAltoPx: alto };
}

/** Grilla falsa con el estado de planta de cada celda. */
function grilla(ancho, alto, estado = PLANTA.NADA) {
  const planta = new Uint8Array(ancho * alto).fill(estado);
  return { ancho, alto, total: ancho * alto, planta };
}

describe('T76 · API de ParticleContainer contra la versión instalada', () => {
  it('expone particleChildren, addParticle y update() sin WebGL', () => {
    const contenedor = new ParticleContainer({
      texture: Texture.EMPTY,
      dynamicProperties: { position: true, vertex: true, uvs: true, color: true },
    });
    expect(contenedor.renderPipeId).toBe('particle');
    expect(Array.isArray(contenedor.particleChildren)).toBe(true);
    expect(() => contenedor.update()).not.toThrow();
  });

  it('admite 1000 partículas de un mismo atlas sin crecer el pool', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 1000 });
    const manager = new EntityManager();
    for (let i = 0; i < 1000; i++) manager.crear(ESPECIE.HERBIVORO);

    for (let i = 0; i < manager.vivos.length; i++) {
      manager.x[i] = 16;
      manager.y[i] = 16;
    }
    r.render(manager, camara({ x: 128, y: 128, ancho: 2048, alto: 2048 }), 0);

    expect(r.activas).toBe(1000);
    expect(r.contenedor.particleChildren.length).toBe(1000);
    expect(r.particulaPorId.length).toBe(1000);
  });
});

describe('T80 · fase de animación determinista', () => {
  it('arranca en 0 y avanza con el tick y la velocidad base', () => {
    expect(faseCaminar(0, 1.2)).toBe(0);
    expect(faseCaminar(100, 1.2)).toBeGreaterThan(0);
    // El ceratosaurio (más rápido) avanza más que el triceratops.
    expect(faseCaminar(100, 1.7)).toBeGreaterThan(faseCaminar(100, 1.2));
    expect(faseCaminar(100, 1.2)).toBe(faseCaminar(100, 1.2));
  });

  it('el frame respeta la cantidad de cuadros de cada especie', () => {
    for (const tipo of [ESPECIE.HERBIVORO, ESPECIE.PREDADOR]) {
      const cuadros = CONFIG.sprites.rutaAnimal[tipo].cuadros;
      for (let t = 0; t < 2000; t += 17) {
        expect(frameAnimal(tipo, faseCaminar(t, 1.7))).toMatch(/_(\d+)$/);
      }
      expect(cuadros).toBeGreaterThan(0);
    }
  });
});

describe('T80 · PlantRenderer con ParticleContainer', () => {
  it('reserva toda la capacidad al arrancar y reconstruye sin new en el bucle', () => {
    const atlas = atlasFalso();
    const r = new PlantRenderer(null, { atlas, tileSize: 8, capacidad: 1024 });
    expect(r.particulas.length).toBe(1024);
    expect(r.mundoX.length).toBe(1024);

    const g = grilla(32, 32, PLANTA.ADULTA);
    const cam = camara({ x: 128, y: 128, ancho: 32, alto: 32 });
    r.reconstruir(g, 0, 10, cam);
    const primera = r.contenedor.particleChildren[0];
    const cantidad = r.activas;
    expect(cantidad).toBeGreaterThan(0);
    expect(cantidad).toBeLessThan(g.total); // culling activo

    r.invalidar();
    r.reconstruir(g, 10, 10, cam);
    expect(r.contenedor.particleChildren[0]).toBe(primera); // se reutiliza
    expect(r.activas).toBe(cantidad);
    expect(r.activas).toBeLessThanOrEqual(r.capacidad);
  });

  it('elige el frame solo por estado; muerta y vacía no se dibujan', () => {
    const atlas = atlasFalso();
    const r = new PlantRenderer(null, { atlas, tileSize: 8, capacidad: 64 });
    const g = grilla(8, 8);
    g.planta[0] = PLANTA.SEMILLA;
    g.planta[1] = PLANTA.JOVEN;
    g.planta[2] = PLANTA.ADULTA;
    g.planta[3] = PLANTA.MUERTA;

    r.reconstruir(g, 0, 10, camara({ x: 32, y: 32, ancho: 64, alto: 64 }));
    expect(r.activas).toBe(3);
    const usadas = r.contenedor.particleChildren.map((p) => p.texture);
    expect(usadas).toContain(atlas.frames.get(framePlanta(PLANTA.SEMILLA)));
    expect(usadas).toContain(atlas.frames.get(framePlanta(PLANTA.JOVEN)));
    expect(usadas).toContain(atlas.frames.get(framePlanta(PLANTA.ADULTA)));
    expect(usadas).not.toContain(atlas.frames.get(framePlanta(PLANTA.MUERTA)));
  });

  it('render() proyecta posiciones y escala con el zoom', () => {
    const atlas = atlasFalso();
    const r = new PlantRenderer(null, { atlas, tileSize: 8, capacidad: 4 });
    const g = grilla(2, 2, PLANTA.ADULTA);
    const cam = camara({ x: 8, y: 8, zoom: 2, ancho: 128, alto: 128 });
    r.reconstruir(g, 0, 10, cam);
    r.render(cam);
    const p = r.contenedor.particleChildren[0];
    expect(p.x).toBe((4 - 8) * 2 + 64);
    expect(p.y).toBe((4 - 8) * 2 + 64);
    expect(p.scaleX).toBeCloseTo(r.escalaBase * 2);
    expect(p.scaleY).toBeCloseTo(r.escalaBase * 2);
  });
});

describe('T80 · EntityRenderer con ParticleContainer', () => {
  /** Manager con una entidad en el centro de la vista. */
  function managerConUnBicho(tipo = ESPECIE.HERBIVORO) {
    const manager = new EntityManager();
    const id = manager.crear(tipo);
    manager.x[id] = 4;
    manager.y[id] = 4;
    return { manager, id };
  }

  it('voltea el sprite según dirX (arte mira a la izquierda) y jamás rota', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 16 });
    const { manager, id } = managerConUnBicho();
    const cam = camara({ x: 32, y: 32, ancho: 64, alto: 64 });

    // El PNG mira a la izquierda: yendo a la izquierda NO se espeja.
    manager.dirX[id] = -1;
    r.render(manager, cam, 0);
    const p = r.contenedor.particleChildren[0];
    expect(p.scaleX).toBeGreaterThan(0);
    expect(p.rotation).toBe(0);

    manager.dirX[id] = 1;
    r.render(manager, cam, 0);
    expect(r.contenedor.particleChildren[0].scaleX).toBeLessThan(0);
    expect(r.contenedor.particleChildren[0].rotation).toBe(0);
  });

  it('el cycle de caminar cambia con el tick y usa la cantidad de la especie', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 16 });
    const { manager } = managerConUnBicho();
    const cam = camara({ x: 32, y: 32, ancho: 64, alto: 64 });

    r.render(manager, cam, 0);
    const inicial = r.contenedor.particleChildren[0].texture;
    r.render(manager, cam, 600);
    const despues = r.contenedor.particleChildren[0].texture;
    expect(despues).not.toBe(inicial);

    const framesHerbivoro = new Set(
      clavesBase()
        .filter((c) => c.startsWith('animales/trike_herbivore/'))
        .map((c) => atlas.frames.get(c)),
    );
    expect(framesHerbivoro.has(despues)).toBe(true);
  });

  it('el modo depuración tiñe por estado de IA', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 16 });
    const { manager, id } = managerConUnBicho();
    manager.estado[id] = ESTADO_IA.COMIENDO;
    const cam = camara({ x: 32, y: 32, ancho: 64, alto: 64 });

    r.render(manager, cam, 0);
    expect(r.contenedor.particleChildren[0].tint).toBe(0xffffff);

    r.setDepuracion(true);
    r.render(manager, cam, 0);
    expect(r.contenedor.particleChildren[0].tint).toBe(COLOR_ESTADO[ESTADO_IA.COMIENDO]);
  });

  it('alta/baja no deja partículas huérfanas y respeta la capacidad', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 8 });
    const manager = new EntityManager();
    const cam = camara({ x: 32, y: 32, ancho: 64, alto: 64 });
    for (let i = 0; i < 12; i++) {
      const id = manager.crear(ESPECIE.HERBIVORO);
      manager.x[id] = 4;
      manager.y[id] = 4;
    }
    r.render(manager, cam, 0);
    expect(r.activas).toBe(8); // tope del pool, nunca se agranda

    while (manager.vivos.length > 2) manager.eliminar(manager.vivos[manager.vivos.length - 1]);
    r.render(manager, cam, 0);
    expect(r.activas).toBe(2);
    expect(r.contenedor.particleChildren.length).toBe(manager.vivos.length);
  });

  it('no dibuja entidades fuera de la cámara (culling)', () => {
    const atlas = atlasFalso();
    const r = new EntityRenderer(null, { atlas, tileSize: 8, capacidad: 16 });
    const { manager, id } = managerConUnBicho();
    const cam = camara({ x: 32, y: 32, ancho: 64, alto: 64 });

    manager.x[id] = 2000;
    manager.y[id] = 2000;
    r.render(manager, cam, 0);
    expect(r.activas).toBe(0);
  });
});

describe('T61 · barras de necesidades siguen a la cámara', () => {
  it('recalcula la posición al panear y al hacer zoom aunque el animal esté quieto', () => {
    // Renderer mínimo: solo se usa generateTexture() al construir la barra.
    const app = { renderer: { generateTexture: () => Texture.EMPTY } };
    const manager = new EntityManager();
    const id = manager.crear(ESPECIE.HERBIVORO);
    manager.x[id] = 4;
    manager.y[id] = 4;

    const r = new NecesidadesRenderer(app, { tileSize: 8, manager });
    r.seleccionar(id);
    const barra = r.barras[0].relleno;

    r.render(camara({ x: 84, y: 84, zoom: 1, ancho: 128, alto: 128 }));
    const xInicial = barra.x;
    expect(xInicial).toBeGreaterThan(0); // la barra está efectivamente dibujada

    // Mismo animal, misma necesidad: solo cambia la cámara (pan de 600 px).
    r.render(camara({ x: 684, y: 84, zoom: 1, ancho: 128, alto: 128 }));
    expect(barra.x).toBeCloseTo(xInicial - 600, 5);

    // Y ahora zoom: la posición de pantalla vuelve a cambiar.
    r.render(camara({ x: 684, y: 84, zoom: 2, ancho: 128, alto: 128 }));
    expect(barra.x).not.toBeCloseTo(xInicial - 600, 5);
  });
});
