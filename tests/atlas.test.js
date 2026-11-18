/** Tests de la capa pura del atlas (T75/T80). No necesitan WebGL. */

import { describe, expect, it } from 'vitest';
import {
  clavesAtlas,
  clavesBase,
  claveDe,
  cuadrosDe,
  frameAnimal,
  framePlanta,
  urlsSprites,
} from '../src/render/atlas.js';
import { ESPECIE } from '../src/entities/entity.js';
import { PLANTA } from '../src/world/cell.js';
import { CONFIG } from '../src/config.js';

describe('claves del atlas', () => {
  it('derive la clave de la ruta relativa, no del nombre de archivo', () => {
    expect(claveDe('../../assets/sprites/plantas/plantaNormal/semilla.png')).toBe(
      'plantas/plantaNormal/semilla',
    );
    expect(claveDe('..\\..\\assets\\sprites\\animales\\trike_herbivore\\walk_0.PNG')).toBe(
      'animales/trike_herbivore/walk_0',
    );
  });

  it('usa las rutas configuradas y la cantidad de cuadros de cada especie', () => {
    const claves = clavesBase();
    for (const ruta of Object.values(CONFIG.sprites.rutaPlanta)) expect(claves).toContain(ruta);
    expect(claves.some((c) => c.includes('muerta'))).toBe(false);

    for (const tipo of [ESPECIE.HERBIVORO, ESPECIE.PREDADOR]) {
      const ruta = CONFIG.sprites.rutaAnimal[tipo];
      expect(claves.filter((c) => c.startsWith(`${ruta.carpeta}/${ruta.prefijo}_`))).toHaveLength(
        cuadrosDe(tipo),
      );
    }
    expect(cuadrosDe(ESPECIE.HERBIVORO)).not.toBe(cuadrosDe(ESPECIE.PREDADOR));
  });

  it('descubre los PNG reales y la configuración coincide con el arte', () => {
    const descubiertas = urlsSprites().map(claveDe);
    expect(descubiertas).toContain('plantas/plantaNormal/semilla');
    expect(descubiertas).toContain('animales/trike_herbivore/walk_0');
    expect(descubiertas).toContain('animales/ceratosaurus_carnivore/walk_10');

    for (const tipo of [ESPECIE.HERBIVORO, ESPECIE.PREDADOR]) {
      const ruta = CONFIG.sprites.rutaAnimal[tipo];
      const cantidad = descubiertas.filter((c) =>
        c.startsWith(`${ruta.carpeta}/${ruta.prefijo}_`),
      ).length;
      expect(cuadrosDe(tipo)).toBe(cantidad);
    }
    for (const clave of clavesBase()) expect(clavesAtlas()).toContain(clave);
  });

  it('suma PNG nuevos y mantiene el orden estable sin duplicados', () => {
    const urls = {
      '../../assets/sprites/plantas/plantaNormal/semilla.png': '/assets/semilla.png',
      '../../assets/sprites/plantas/plantaNormal/vieja.png': '/assets/vieja.png',
    };
    const claves = clavesAtlas(urls);
    expect(claves).toContain('plantas/plantaNormal/vieja');
    expect(claves.filter((c) => c === 'plantas/plantaNormal/semilla')).toHaveLength(1);
    expect(claves).toEqual([...claves].sort());
    expect(clavesAtlas(urls)).toEqual(claves);
  });
});

describe('frame de planta por evento de estado', () => {
  it('cambia solo con el estado', () => {
    expect(framePlanta(PLANTA.SEMILLA)).toBe(CONFIG.sprites.rutaPlanta[PLANTA.SEMILLA]);
    expect(framePlanta(PLANTA.JOVEN)).toBe(CONFIG.sprites.rutaPlanta[PLANTA.JOVEN]);
    expect(framePlanta(PLANTA.ADULTA)).toBe(CONFIG.sprites.rutaPlanta[PLANTA.ADULTA]);
  });

  it('no dibuja plantas muertas ni celdas vacías', () => {
    expect(framePlanta(PLANTA.MUERTA)).toBeNull();
    expect(framePlanta(PLANTA.NADA)).toBeNull();
  });
});

describe('cycle de caminar de los animales', () => {
  it('usa la carpeta y el prefijo de cada especie y envuelve con su cantidad', () => {
    for (const tipo of [ESPECIE.HERBIVORO, ESPECIE.PREDADOR]) {
      const ruta = CONFIG.sprites.rutaAnimal[tipo];
      const cuadros = cuadrosDe(tipo);
      expect(frameAnimal(tipo, 0)).toBe(`${ruta.carpeta}/${ruta.prefijo}_0`);
      expect(frameAnimal(tipo, cuadros)).toBe(`${ruta.carpeta}/${ruta.prefijo}_0`);
      expect(frameAnimal(tipo, -1)).toBe(`${ruta.carpeta}/${ruta.prefijo}_${cuadros - 1}`);
      expect(frameAnimal(tipo, cuadros + 1)).toBe(`${ruta.carpeta}/${ruta.prefijo}_1`);
    }
  });

  it('devuelve null para especies desconocidas', () => {
    expect(frameAnimal(99, 0)).toBeNull();
  });
});
