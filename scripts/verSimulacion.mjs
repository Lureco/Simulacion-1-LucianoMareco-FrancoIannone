/**
 * scripts/verSimulacion.mjs — Depuración de la simulación sin navegador
 * ====================================================================
 *
 * Corre la MISMA lógica que la pantalla (`src/systems/simulacion.js`) y
 * reporta el estado de las poblaciones cada N segundos de simulación.
 *
 * Sirve para dos cosas:
 * - Verificar el balance (¿comer, beber, reproducirse y morir funcionan?).
 * - Depurar sin abrir el navegador.
 *
 * Uso: `node scripts/verSimulacion.mjs [seed] [segundos]`
 */

import { PRNG } from '../src/core/prng.js';
import { crearContexto } from '../src/core/contexto.js';
import { EntityManager } from '../src/entities/entityManager.js';
import { ESPECIE } from '../src/entities/entity.js';
import { Herbivore } from '../src/entities/herbivore.js';
import { Predator } from '../src/entities/predator.js';
import { SpatialHash } from '../src/systems/spatialHash.js';
import { pasoDeSimulacion, sembrar, prepararMundo } from '../src/systems/simulacion.js';
import { generarTerreno } from '../src/world/terrain.js';
import { sembrarVegetacion, contarPlantas } from '../src/systems/plantGrowth.js';
import { CONFIG } from '../src/config.js';

const seed = Number(process.argv[2] ?? 1337);
const segundos = Number(process.argv[3] ?? 120);

/** Arma una simulación completa con terreno. */
function armar() {
  const prng = new PRNG(seed);
  const manager = new EntityManager();
  manager.registrar(ESPECIE.HERBIVORO, () => new Herbivore());
  manager.registrar(ESPECIE.PREDADOR, () => new Predator());

  const ctx = crearContexto({
    prng,
    mundo: { ancho: CONFIG.mundo.ancho, alto: CONFIG.mundo.alto },
    config: CONFIG,
  });
  ctx.entidades = manager;
  ctx.hash = new SpatialHash(CONFIG.mundo.ancho, CONFIG.mundo.alto, CONFIG.percepcion.celdaHash);
  ctx.grid = generarTerreno({
    ancho: CONFIG.mundo.ancho,
    alto: CONFIG.mundo.alto,
    seed,
    config: CONFIG.terreno,
  });
  prepararMundo(ctx);
  sembrarVegetacion(ctx);
  sembrar(ctx, CONFIG.herbivoro.poblacionInicial, ESPECIE.HERBIVORO);
  sembrar(ctx, CONFIG.depredador.poblacionInicial, ESPECIE.PREDADOR);

  return { ctx, manager };
}

const { ctx, manager } = armar();
const dt = CONFIG.tiempo.pasoFijo;
const ticks = Math.round(segundos / dt);
const cadaTicks = Math.round(5 / dt);

/** Promedio de una necesidad entre todas las entidades de un tipo. */
function promedio(manager, tipo, clave) {
  const lista = manager.deTipo(tipo);
  if (lista.length === 0) return 0;
  let suma = 0;
  for (const e of lista) suma += e.necesidades[clave];
  return suma / lista.length;
}

/** Cuenta entidades por estado de IA. */
function porEstado(manager) {
  const cuenta = {};
  for (const e of manager.vivas) {
    cuenta[e.estado] = (cuenta[e.estado] ?? 0) + 1;
  }
  return cuenta;
}

console.log(`seed ${seed} · ${segundos}s de simulación`);
console.log('tiempo | plantas | herb | carn | total | H:hambre H:sed H:ener | estados');
console.log('       |         |      |      |      |  (carnívoros)         |');

for (let t = 0; t < ticks; t++) {
  pasoDeSimulacion(ctx, dt);

  if (t % cadaTicks === 0 || t === ticks - 1) {
    const estados = porEstado(manager);
    const resumen = Object.entries(estados)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    console.log(
      [
        (t * dt).toFixed(0).padStart(6),
        String(contarPlantas(ctx)).padStart(7),
        String(manager.contar(ESPECIE.HERBIVORO)).padStart(4),
        String(manager.contar(ESPECIE.PREDADOR)).padStart(4),
        String(manager.total).padStart(5),
        promedio(manager, ESPECIE.PREDADOR, 'hambre').toFixed(2).padStart(8),
        promedio(manager, ESPECIE.PREDADOR, 'sed').toFixed(2).padStart(5),
        promedio(manager, ESPECIE.PREDADOR, 'energia').toFixed(1).padStart(6),
        resumen,
      ].join(' | '),
    );
  }
}

console.log('\nmuertes:', JSON.stringify(ctx.muertes));
