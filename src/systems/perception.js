/**
 * src/systems/perception.js — Percepción sobre la grilla (T36)
 * ============================================================
 *
 * Los herbívoros no ven el mundo entero: miran un **radio de visión** de
 * celdas a la redonda. Como las plantas y el agua viven en la grilla (no son
 * entidades), la búsqueda recorre las celdas del radio en **orden fijo**
 * (determinista) y se queda con la más cercana.
 *
 * Para **otras entidades** (pareja) se usa el Spatial Hash, que es O(vecinos)
 * en vez de O(n²) — ver `spatialHash.js`.
 *
 * Regla del proyecto (D9): nada de `new` en el bucle. El resultado se escribe
 * en un objeto **reusable** (`ctx._objetivo`) y los vecinos en un array
 * reusable (`ctx._vecinos`), ambos creados una sola vez.
 */

import { PLANTA, TERRENO } from '../world/cell.js';
import { ESPECIE } from '../entities/entity.js';

/** Vecindad 8, en orden fijo (determinista), para el ajuste de distancia al agua. */
const VECINOS_8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** ¿La celda tiene una planta comestible sobre tierra? */
function esComida(grid, indice) {
  const planta = grid.planta[indice];
  return (
    (planta === PLANTA.JOVEN || planta === PLANTA.ADULTA) && grid.terreno[indice] === TERRENO.TIERRA
  );
}

/** ¿La celda es agua? */
function esAgua(grid, indice) {
  return grid.terreno[indice] === TERRENO.AGUA;
}

/**
 * Objetivo reusable donde se escribe el resultado de una búsqueda.
 * @param {object} ctx
 * @returns {{encontrado: boolean, x: number, y: number, indice: number}}
 */
export function objetivoDe(ctx) {
  if (ctx._objetivo === undefined) {
    ctx._objetivo = { encontrado: false, x: 0, y: 0, indice: -1 };
  }
  return ctx._objetivo;
}

/**
 * Array reusable para las consultas al Spatial Hash.
 * @param {object} ctx
 * @returns {number[]}
 */
export function vecinosDe(ctx) {
  if (ctx._vecinos === undefined) ctx._vecinos = [];
  return ctx._vecinos;
}

/**
 * Busca la celda más cercana dentro del radio que cumpla `predicado`.
 * Devuelve el centro de la celda (`x + 0.5`, `y + 0.5`), que es hacia donde
 * conviene apuntar.
 *
 * @param {object} grid
 * @param {number} ox Posición X del observador (celdas, float).
 * @param {number} oy Posición Y del observador (celdas, float).
 * @param {number} radio Radio de visión en celdas.
 * @param {(grid: object, indice: number) => boolean} predicado
 * @param {{encontrado: boolean, x: number, y: number, indice: number}} salida
 * @returns {typeof salida}
 */
function celdaMasCercana(grid, ox, oy, radio, predicado, salida) {
  salida.encontrado = false;
  salida.indice = -1;
  if (!grid) return salida;

  const ancho = grid.ancho;
  const alto = grid.alto;
  const cx = Math.floor(ox);
  const cy = Math.floor(oy);
  const r = Math.ceil(radio);
  const radio2 = radio * radio;

  // Empezamos con el radio como "mejor distancia": sólo aceptamos celdas
  // dentro del radio (d² ≤ radio²).
  let mejor = radio2;

  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 0 || y >= alto) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= ancho) continue;
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const d2 = dx * dx + dy * dy;
      if (d2 > mejor) continue;
      const indice = y * ancho + x;
      if (!predicado(grid, indice)) continue;
      mejor = d2;
      salida.encontrado = true;
      salida.x = x + 0.5;
      salida.y = y + 0.5;
      salida.indice = indice;
    }
  }

  return salida;
}

/**
 * Busca la planta comestible más cercana en el radio de visión (T36/T37).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} radio
 * @param {object} salida
 */
export function buscarComida(ctx, ox, oy, radio, salida) {
  return celdaMasCercana(ctx.grid, ox, oy, radio, esComida, salida);
}

/**
 * Busca la celda de agua más cercana en el radio de visión (T36/T38).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} radio
 * @param {object} salida
 */
export function buscarAgua(ctx, ox, oy, radio, salida) {
  return celdaMasCercana(ctx.grid, ox, oy, radio, esAgua, salida);
}

/**
 * Busca la entidad **viva** más cercana de un tipo, con el Spatial Hash
 * (O(vecinos), T36). Se saltean las entidades ya marcadas para morir.
 *
 * El desempate es determinista: a igual distancia gana el `id` más bajo.
 *
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} radio Radio de visión en celdas.
 * @param {number} tipo Uno de `ESPECIE`.
 * @param {number[]} salida Array reutilizable de vecinos.
 * @returns {number} El `id` más cercano, o -1 si no hay ninguno.
 */
function entidadMasCercanaDeTipo(ctx, ox, oy, radio, tipo, salida) {
  if (!ctx.hash) return -1;

  const vecinos = ctx.hash.consultar(ox, oy, radio, salida);
  const a = ctx.entidades;
  let mejorId = -1;
  let mejorD2 = Infinity;

  for (let i = 0; i < vecinos.length; i++) {
    const id = vecinos[i];
    if (a.tipo[id] !== tipo) continue;
    if (a.vivo[id] !== 1) continue;
    if (a.moribundo && a.moribundo[id] === 1) continue;

    const dx = a.x[id] - ox;
    const dy = a.y[id] - oy;
    const d2 = dx * dx + dy * dy;
    if (d2 < mejorD2 || (d2 === mejorD2 && id < mejorId)) {
      mejorD2 = d2;
      mejorId = id;
    }
  }

  return mejorId;
}

/**
 * Busca el herbívoro vivo más cercano dentro del radio (presa, T43).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} radio
 * @param {number[]} salida Array reutilizable de vecinos.
 * @returns {number} `id` de la presa, o -1.
 */
export function buscarPresa(ctx, ox, oy, radio, salida) {
  return entidadMasCercanaDeTipo(ctx, ox, oy, radio, ESPECIE.HERBIVORO, salida);
}

/**
 * Busca el carnívoro vivo más cercano dentro del radio (para huir, T43).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} radio
 * @param {number[]} salida Array reutilizable de vecinos.
 * @returns {number} `id` del depredador, o -1.
 */
export function buscarDepredador(ctx, ox, oy, radio, salida) {
  return entidadMasCercanaDeTipo(ctx, ox, oy, radio, ESPECIE.PREDADOR, salida);
}

/**
 * Distancia objetivo al agua según cuán sediento está el animal (T38):
 *
 * - Sed crítica → va a la orilla (1 celda) a beber.
 * - Sed media → se acerca a la orilla, pero no la toca.
 * - Tranquilo → mantiene la distancia de deambulación (`distanciaOrilla`).
 *
 * @param {number} sed Sed normalizada (0..1).
 * @param {object} cfg Configuración de la especie (`CONFIG.herbivoro`/`depredador`).
 * @returns {number} Distancia objetivo en celdas.
 */
export function distanciaObjetivoAlAgua(sed, cfg) {
  if (sed >= cfg.sedCritica) return 1;
  if (sed >= cfg.sedBusqueda) return Math.max(1, Math.floor(cfg.distanciaOrilla / 2));
  return cfg.distanciaOrilla;
}

/**
 * Dirección para **ajustar** la distancia al agua leyendo el campo BFS
 * `aguaDist` de la grilla (T38). Acerca al animal si está más lejos de lo
 * que quiere, o lo aleja si está más cerca.
 *
 * Es la función que implementa la "distancia de deambulación": el animal
 * mantiene una franja alrededor del agua en vez de amontonarse en la orilla.
 *
 * Escribe en `salida` un **paso** desde `(ox, oy)` hacia la celda vecina
 * elegida (mismo formato que `direccionAlAgua`).
 *
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} distanciaObjetivo Distancia deseada al agua, en celdas.
 * @param {{encontrado: boolean, x: number, y: number, indice: number}} salida
 * @returns {typeof salida}
 */
export function direccionAjustadaAlAgua(ctx, ox, oy, distanciaObjetivo, salida) {
  salida.encontrado = false;
  salida.indice = -1;

  const grid = ctx.grid;
  if (!grid || !grid.aguaDist) return salida;

  const x = Math.floor(ox);
  const y = Math.floor(oy);
  if (!grid.dentro(x, y)) return salida;

  const aguaDist = grid.aguaDist;
  const ancho = grid.ancho;
  const actual = aguaDist[y * ancho + x];
  if (actual < 0) return salida; // no hay agua alcanzable
  if (actual === distanciaObjetivo) return salida; // ya está en la zona

  let mejorX = -1;
  let mejorY = -1;
  let mejorDistancia = actual;

  if (actual > distanciaObjetivo) {
    // Está más lejos de lo que quiere: busca la vecina más cerca del agua,
    // sin entrar en la zona prohibida (nunca baja del objetivo).
    for (let n = 0; n < VECINOS_8.length; n++) {
      const nx = x + VECINOS_8[n][0];
      const ny = y + VECINOS_8[n][1];
      if (!grid.dentro(nx, ny)) continue;
      const d = aguaDist[ny * ancho + nx];
      if (d < 0 || d < distanciaObjetivo) continue;
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejorX = nx;
        mejorY = ny;
      }
    }
  } else {
    // Está más cerca de lo que quiere: busca la vecina más lejos del agua.
    for (let n = 0; n < VECINOS_8.length; n++) {
      const nx = x + VECINOS_8[n][0];
      const ny = y + VECINOS_8[n][1];
      if (!grid.dentro(nx, ny)) continue;
      const d = aguaDist[ny * ancho + nx];
      if (d > mejorDistancia) {
        mejorDistancia = d;
        mejorX = nx;
        mejorY = ny;
      }
    }
  }

  if (mejorX < 0) return salida; // no se puede mejorar

  salida.encontrado = true;
  salida.x = ox + (mejorX - x);
  salida.y = oy + (mejorY - y);
  return salida;
}

/**
 * Dirección hacia la fuente más cercana de un campo precalculado de la grilla
 * (`aguaDirX/Y` o `tierraDirX/Y`). Sirve cuando la fuente no está a la vista:
 * la entidad camina "cuesta abajo" hasta encontrarla (T38).
 *
 * @param {object} grid
 * @param {Int8Array} campoDirX
 * @param {Int8Array} campoDirY
 * @param {number} ox
 * @param {number} oy
 * @param {object} salida Se escribe `x`/`y` como un paso en esa dirección.
 */
function direccionACampo(grid, campoDirX, campoDirY, ox, oy, salida) {
  salida.encontrado = false;
  salida.indice = -1;
  if (!grid || !campoDirX) return salida;

  const x = Math.floor(ox);
  const y = Math.floor(oy);
  if (!grid.dentro(x, y)) return salida;

  const i = y * grid.ancho + x;
  const dx = campoDirX[i];
  const dy = campoDirY[i];
  if (dx === 0 && dy === 0) return salida;

  salida.encontrado = true;
  salida.x = ox + dx;
  salida.y = oy + dy;
  return salida;
}

/**
 * Dirección hacia el agua más cercana (T38).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {object} salida
 */
export function direccionAlAgua(ctx, ox, oy, salida) {
  const grid = ctx.grid;
  return direccionACampo(grid, grid && grid.aguaDirX, grid && grid.aguaDirY, ox, oy, salida);
}

/**
 * Dirección hacia la tierra más cercana: un herbívoro varado en agua o arena
 * la usa para volver a donde está la comida (T37/T40).
 * @param {object} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {object} salida
 */
export function direccionATierra(ctx, ox, oy, salida) {
  const grid = ctx.grid;
  return direccionACampo(grid, grid && grid.tierraDirX, grid && grid.tierraDirY, ox, oy, salida);
}
