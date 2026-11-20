/**
 * src/render/atlasDatos.js — Mapeo puro estado/especie → frame (T75/T80)
 * ======================================================================
 *
 * Parte del atlas que **no depende de Vite ni del DOM**: claves, Rutas
 * configuradas, wrap de cycles y fase de animación. Vive separada de
 * `atlas.js` para que los renderers y los scripts de medición puedan
 * importarla en Node (donde `import.meta.glob` no existe).
 */

import { CONFIG } from '../config.js';
import { ESPECIE } from '../entities/entity.js';
import { ESPECIE_PLANTA, PLANTA } from '../world/cell.js';

/** Cache de claves de animación por especie (se llena una sola vez). @type {Map<number, string[]>} */
const cacheCycles = new Map();

/**
 * Normaliza una ruta de Vite a una clave estable: `plantas/plantaNormal/semilla`.
 * La clave sale de la **ruta relativa**, no del nombre de archivo, para que
 * no choquen `walk_0.png` de carpetas distintas.
 * @param {string} ruta
 * @returns {string}
 */
export function claveDe(ruta) {
  const normalizada = ruta.replace(/\\/g, '/');
  const marca = '/sprites/';
  const i = normalizada.indexOf(marca);
  const relativa = i >= 0 ? normalizada.slice(i + marca.length) : normalizada.split('/').pop();
  return relativa.replace(/\.png$/i, '');
}

/**
 * Cantidad de cuadros del cycle de una especie.
 * @param {number} tipo Uno de `ESPECIE`.
 * @returns {number}
 */
export function cuadrosDe(tipo) {
  return CONFIG.sprites.rutaAnimal[tipo]?.cuadros ?? 0;
}

/**
 * Claves que siempre deben existir: las tres etapas de planta y los cycles
 * de caminar de las dos especies. Sirven de fallback cuando falta arte.
 * @returns {string[]}
 */
export function clavesBase() {
  const claves = Object.values(CONFIG.sprites.rutaPlanta);
  // F8/T65: las claves del micelio también reservan casillero en el atlas,
  // aunque caigan al frame de prueba (no hay PNG propio).
  for (const rutas of Object.values(CONFIG.sprites.rutaPlantaPorEspecie ?? {})) {
    claves.push(...Object.values(rutas));
  }
  for (const tipo of [ESPECIE.HERBIVORO, ESPECIE.PREDADOR]) {
    for (let i = 0; i < cuadrosDe(tipo); i++) {
      claves.push(frameAnimal(tipo, i));
    }
  }
  return claves;
}

/**
 * Sprite de una planta según su **estado**, no según su edad.
 * `NADA` y `MUERTA` devuelven `null` → la celda no se dibuja.
 * @param {number} estado Uno de `PLANTA`.
 * @returns {string|null} clave del frame.
 */
export function framePlanta(estado, especie = ESPECIE_PLANTA.PASTO) {
  const porEspecie = CONFIG.sprites.rutaPlantaPorEspecie?.[especie];
  return (
    (porEspecie !== undefined ? porEspecie[estado] : undefined) ??
    CONFIG.sprites.rutaPlanta[estado] ??
    null
  );
}

/**
 * Claves del cycle de una especie, calculadas UNA vez.
 * Evita construir un string por entidad y por frame (T79: sin GC sawtooth).
 * @param {number} tipo Uno de `ESPECIE`.
 * @returns {string[]}
 */
export function clavesCaminar(tipo) {
  const existentes = cacheCycles.get(tipo);
  if (existentes !== undefined) return existentes;

  const ruta = CONFIG.sprites.rutaAnimal[tipo];
  const claves = [];
  if (ruta !== undefined) {
    for (let i = 0; i < cuadrosDe(tipo); i++) claves.push(`${ruta.carpeta}/${ruta.prefijo}_${i}`);
  }
  cacheCycles.set(tipo, claves);
  return claves;
}

/**
 * Frame del cycle de caminar de una especie. El módulo hace que el cuadro
 * "de vuelta" al principio, sin importar si la fase viene creciendo.
 * @param {number} tipo Uno de `ESPECIE`.
 * @param {number} cuadro Fase del cycle (puede ser negativa o muy grande).
 * @param {number} [cuadros] Cantidad de cuadros; por defecto la de la especie.
 * @returns {string|null} clave del frame.
 */
export function frameAnimal(tipo, cuadro, cuadros = cuadrosDe(tipo)) {
  if (CONFIG.sprites.rutaAnimal[tipo] === undefined || cuadros <= 0) return null;
  const claves = clavesCaminar(tipo);
  const i = ((Math.trunc(cuadro) % cuadros) + cuadros) % cuadros;
  return claves[i] ?? null;
}

/**
 * Fase del cycle de caminar en un tick dado. Deriva del tiempo simulado y de
 * la **velocidad base** de la especie (`manager.velocidad[id]`), no de la
 * velocidad efectiva según el terreno. Como `ctx.tick` no avanza en pausa, la
 * animación se frena sola con la simulación.
 *
 * @param {number} tick Tick actual de la simulación.
 * @param {number} velocidad Velocidad base de la especie, en celdas/segundo.
 * @param {number} [cuadrosPorCelda]
 * @returns {number} Fase (puede crecer sin límite; `frameAnimal()` hace el wrap).
 */
export function faseCaminar(tick, velocidad, cuadrosPorCelda = CONFIG.sprites.cuadrosPorCelda) {
  return Math.floor(tick * CONFIG.tiempo.pasoFijo * velocidad * cuadrosPorCelda);
}

/** Reexportado para que los consumidores del atlas no cambien de import. */
export { PLANTA };
