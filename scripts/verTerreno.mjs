/**
 * scripts/verTerreno.mjs — Vistazo rápido del terreno generado (utilidad de dev)
 * ==============================================================================
 * No forma parte de la simulación: corre en Node, genera el mapa con varias
 * seeds y reporta proporciones. Sirve para ajustar umbrales sin abrir el
 * navegador.
 *
 *   node scripts/verTerreno.mjs
 */

import { CONFIG } from '../src/config.js';
import { generarTerreno } from '../src/world/terrain.js';

const seeds = [1337, 9001, 42, 2024, 7];
const ancho = CONFIG.mundo.ancho;
const alto = CONFIG.mundo.alto;

for (const seed of seeds) {
  const t0 = performance.now();
  const grid = generarTerreno({ ancho, alto, seed, config: CONFIG.terreno });
  const ms = (performance.now() - t0).toFixed(1);
  const { agua, arena, tierra } = grid.contarTerreno();
  const pct = (n) => ((n / grid.total) * 100).toFixed(1).padStart(5) + '%';
  console.log(
    `seed ${String(seed).padStart(5)} · ${ms.padStart(5)} ms · ` +
      `agua ${pct(agua)} · arena ${pct(arena)} · tierra ${pct(tierra)}`,
  );
}

// Mini mapa ASCII de la seed por defecto (muestreado cada 4 celdas).
const grid = generarTerreno({
  ancho,
  alto,
  seed: CONFIG.mundo.seedPorDefecto,
  config: CONFIG.terreno,
});
console.log('\nMapa (seed por defecto), ~ = agua  . = arena  # = tierra\n');
const paso = 4;
const paleta = ['~', '.', '#'];
for (let y = 0; y < alto; y += paso) {
  let linea = '';
  for (let x = 0; x < ancho; x += paso) {
    linea += paleta[grid.terreno[y * ancho + x]];
  }
  console.log(linea);
}
