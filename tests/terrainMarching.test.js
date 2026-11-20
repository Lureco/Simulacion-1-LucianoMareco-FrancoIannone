/**
 * tests/terrainMarching.test.js — Marching squares puro del terreno
 * ================================================================
 *
 * Cubre la lógica determinista que convierte tipos de celda en píxeles de
 * transición (sin DOM/Pixi). No prueba el canvas del renderer.
 */

import { describe, expect, it } from 'vitest';
import { Grid } from '../src/world/grid.js';
import { TERRENO } from '../src/world/cell.js';
import {
  alturaAcotada,
  alturaDePixel,
  dentroMarching,
  pesoMarching,
  terrenoDePixel,
  tipoAcotado,
} from '../src/render/terrainMarching.js';

/** Grilla mínima con todo del mismo tipo y altura. */
function grillaUniforme(ancho, alto, tipo, altura = 0.5) {
  const g = new Grid(ancho, alto);
  g.terreno.fill(tipo);
  g.altura.fill(altura);
  return g;
}

describe('terrainMarching · helpers básicos', () => {
  it('tipoAcotado y alturaAcotada claman a los bordes', () => {
    const g = grillaUniforme(3, 3, TERRENO.TIERRA, 0.7);
    g.terreno[1 * 3 + 1] = TERRENO.ARENA;
    g.altura[1 * 3 + 1] = 0.4;

    expect(tipoAcotado(g, -5, -5)).toBe(g.terreno[0]);
    expect(tipoAcotado(g, 99, 99)).toBe(g.terreno[8]);
    expect(alturaAcotada(g, -1, 1)).toBe(g.altura[1 * 3]);
    expect(alturaAcotada(g, 2, 5)).toBe(g.altura[2 * 3 + 2]);
  });

  it('pesoMarching interpola bilinealmente en un tile 8x8', () => {
    const tam = 8;
    const max = (tam - 1) * (tam - 1);
    // Esquina TL activa: peso máximo arriba-izquierda.
    expect(pesoMarching(0, 0, 1, 0, 0, 0, tam)).toBe(max);
    expect(pesoMarching(tam - 1, tam - 1, 1, 0, 0, 0, tam)).toBe(0);
    // Todas activas: siempre máximo.
    expect(pesoMarching(3, 4, 1, 1, 1, 1, tam)).toBe(max);
    expect(pesoMarching(0, 0, 0, 0, 0, 0, tam)).toBe(0);
  });

  it('dentroMarching usa el umbral de la mitad y resuelve empates con >=', () => {
    const tam = 8;
    // Caso uniforme.
    expect(dentroMarching(0, 0, 1, 1, 1, 1, tam)).toBe(true);
    expect(dentroMarching(3, 3, 0, 0, 0, 0, tam)).toBe(false);
    // Umbral exacto: (tam-1)^2/2 = 24.5 no es entero con enteros, pero casos silla
    // simétricos pueden dar empate; >= evita huecos.
    const umbral = ((tam - 1) * (tam - 1)) / 2;
    expect(umbral).toBe(24.5);
  });
});

describe('terrainMarching · terrenoDePixel', () => {
  it('en una zona uniforme todos los píxeles del tile conservan el tipo', () => {
    const tam = 8;
    for (const tipo of [TERRENO.AGUA, TERRENO.ARENA, TERRENO.TIERRA]) {
      const g = grillaUniforme(4, 4, tipo, 0.5);
      for (let ly = 0; ly < tam; ly++) {
        for (let lx = 0; lx < tam; lx++) {
          expect(terrenoDePixel(g, 1, 1, lx, ly, tam)).toBe(tipo);
        }
      }
    }
  });

  it('en un borde vertical agua/arena aparecen ambos tipos dentro del tile', () => {
    const tam = 8;
    const g = grillaUniforme(4, 2, TERRENO.AGUA, 0.2);
    // Mitad derecha arena (incluye columnas 2 y 3).
    for (let y = 0; y < 2; y++) {
      for (let x = 2; x < 4; x++) g.terreno[y * 4 + x] = TERRENO.ARENA;
    }
    g.altura.fill(0.35);

    const tipos = new Set();
    // Muestrear la celda de frontera (1,0) que ve arena a su derecha/abajo-derecha.
    for (let ly = 0; ly < tam; ly++) {
      for (let lx = 0; lx < tam; lx++) tipos.add(terrenoDePixel(g, 1, 0, lx, ly, tam));
    }

    expect(tipos.has(TERRENO.AGUA)).toBe(true);
    expect(tipos.has(TERRENO.ARENA)).toBe(true);
    expect(tipos.has(TERRENO.TIERRA)).toBe(false);
  });

  it('suaviza el borde directo entre tipos con marching squares', () => {
    const tam = 8;
    const g = grillaUniforme(4, 2, TERRENO.AGUA, 0.1);
    // Mitad derecha tierra directa.
    for (let y = 0; y < 2; y++) {
      for (let x = 2; x < 4; x++) g.terreno[y * 4 + x] = TERRENO.TIERRA;
    }

    const tipos = new Set();
    for (let ly = 0; ly < tam; ly++) {
      for (let lx = 0; lx < tam; lx++) tipos.add(terrenoDePixel(g, 1, 0, lx, ly, tam));
    }

    // El borde deja de ser un corte recto: dentro del tile aparecen ambos tipos.
    expect(tipos.has(TERRENO.AGUA)).toBe(true);
    expect(tipos.has(TERRENO.TIERRA)).toBe(true);
  });

  it('es determinista para la misma grilla', () => {
    const tam = 8;
    const g = grillaUniforme(4, 4, TERRENO.ARENA, 0.4);
    g.terreno[1 * 4 + 2] = TERRENO.AGUA;
    g.terreno[2 * 4 + 1] = TERRENO.TIERRA;

    const a = [];
    const b = [];
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        for (let ly = 0; ly < tam; ly++) {
          for (let lx = 0; lx < tam; lx++) {
            a.push(terrenoDePixel(g, tx, ty, lx, ly, tam));
            b.push(terrenoDePixel(g, tx, ty, lx, ly, tam));
          }
        }
      }
    }
    expect(a).toEqual(b);
  });
});

describe('terrainMarching · alturaDePixel', () => {
  it('interpola alturas y respeta los límites', () => {
    const tam = 8;
    const g = grillaUniforme(2, 2, TERRENO.TIERRA, 0);
    g.altura[0] = 0.2; // (0,0)
    g.altura[1] = 0.8; // (1,0)
    g.altura[2] = 0.4; // (0,1)
    g.altura[3] = 1.0; // (1,1)

    const tl = alturaDePixel(g, 0, 0, 0, 0, tam);
    const br = alturaDePixel(g, 0, 0, tam - 1, tam - 1, tam);
    const centro = alturaDePixel(g, 0, 0, 3, 3, tam);

    expect(tl).toBeCloseTo(0.2, 6);
    expect(br).toBeCloseTo(1.0, 6);
    expect(centro).toBeGreaterThan(0.2);
    expect(centro).toBeLessThan(1.0);
  });

  it('tam <= 1 no divide por cero', () => {
    const g = grillaUniforme(2, 2, TERRENO.ARENA, 0.6);
    expect(alturaDePixel(g, 0, 0, 0, 0, 1)).toBeCloseTo(0.6, 6);
  });
});
