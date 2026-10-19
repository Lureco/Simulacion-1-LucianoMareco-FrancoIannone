/**
 * src/main.js — Bootstrap de la aplicación
 * =========================================
 * T04: confirmar que PixiJS v8 levanta antes de escribir lógica.
 *
 * Recordatorio PixiJS v8:
 *   - `app.init()` es ASÍNCRONO → hay que awaitsarlo.
 *   - El canvas se accede como `app.canvas` (en v7 era `app.view`).
 */

import { Application } from 'pixi.js';
import { CONFIG, ESTADO } from './config.js';

const app = new Application();

await app.init({
  background: CONFIG.render.colorFondo,
  resizeTo: window,
  antialias: false,
  resolution: window.devicePixelRatio ?? 1,
  autoDensity: true,
});

const contenedor = document.getElementById('app');
if (!contenedor) throw new Error('Falta el div #app en index.html');
contenedor.appendChild(app.canvas);

console.log('[main] PixiJS v8 inicializado');
console.log(`[main] Mundo: ${CONFIG.mundo.ancho}x${CONFIG.mundo.alto} celdas`);
console.log(`[main] Seed: ${ESTADO.seed}`);

// TODO(F0-F1): reemplazar por la generación procedural del mundo (P1).

export { app };
