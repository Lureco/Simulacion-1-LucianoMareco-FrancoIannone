/**
 * src/systems/needs.js — Necesidades del herbívoro (T34/T35 · contrato §4)
 * ======================================================================
 *
 * Las necesidades son el "combustible" de la decisión por prioridad (T35):
 * el herbívoro mira primero el hambre, después la sed, después las ganas de
 * reproducirse, y si no hay nada urgente, explora.
 *
 * Escalas:
 * - `hambre`, `sed`, `deseoRepro`: **normalizadas en [0, 1]**, donde 0 es
 *   "satisfecha" y 1 es "crítica" (contrato §4).
 * - `energia`: NO está normalizada; se mantiene en `[0, energiaMaxima]`
 *   (config) porque así ya la usaban `energiaInicial`, `energiaPorPlanta`,
 *   etc. Comer la sube, el metabolismo la baja; a 0 se muere de hambre.
 * - `edad`: se mantiene en **ticks** (`Int32Array`), no normalizada. La vejez
 *   se evalúa contra `edadMaximaTicks`.
 *
 * Determinismo: estas funciones no consumen azar.
 */

import { TERRENO } from '../world/cell.js';

/**
 * Avanza las necesidades un tick: sube hambre/sed/deseo, baja el cooldown.
 *
 * El deseo de reproducirse solo sube si la entidad está **bien alimentada**
 * (sin hambre ni sed críticas); con hambre o sed encima, baja. Reproducirse
 * en mal momento no tiene sentido y así lo evita la IA (T46).
 *
 * @param {number} id
 * @param {number} dt Segundos del timestep fijo.
 * @param {object} ctx
 * @param {object} [cfg] Bloque de config de la especie (`CONFIG.herbivoro` o
 *   `CONFIG.depredador`). Por defecto, el del herbívoro.
 */
export function actualizarNecesidades(id, dt, ctx, cfg = ctx.config.herbivoro) {
  const a = ctx.entidades;

  a.hambre[id] = Math.min(1, a.hambre[id] + cfg.consumoHambre * dt);
  a.sed[id] = Math.min(1, a.sed[id] + cfg.consumoSed * dt);

  if (a.cooldown[id] > 0) a.cooldown[id] -= 1;

  // Las ganas de reproducirse recién suben al alcanzar la madurez.
  if (a.edad[id] >= cfg.edadMinimaReproduccion) {
    if (a.hambre[id] < cfg.hambreCritica && a.sed[id] < cfg.sedCritica) {
      a.deseoRepro[id] = Math.min(1, a.deseoRepro[id] + cfg.crecimientoReproduccion * dt);
    } else {
      a.deseoRepro[id] = Math.max(0, a.deseoRepro[id] - cfg.decaimientoReproduccion * dt);
    }
  }
}

/**
 * Causas de muerte (T45): separadas y observables.
 * @type {Record<string, number>}
 */
export const CAUSA_MUERTE = {
  NINGUNA: 0,
  HAMBRE: 1,
  SED: 2,
  VEJEZ: 3,
  DEPREDADO: 4,
};

/** Nombre legible de una causa de muerte (HUD / logs). */
export const NOMBRE_CAUSA_MUERTE = ['—', 'hambre', 'sed', 'vejez', 'depredado'];

/**
 * Suma una muerte al contador de su causa (T45). Los contadores viven en
 * `ctx.muertesPorCausa`.
 * @param {object} ctx
 * @param {number} causa Uno de `CAUSA_MUERTE`.
 */
export function registrarMuerte(ctx, causa) {
  const porCausa = ctx.muertesPorCausa;
  if (causa === CAUSA_MUERTE.HAMBRE) porCausa.hambre++;
  else if (causa === CAUSA_MUERTE.SED) porCausa.sed++;
  else if (causa === CAUSA_MUERTE.VEJEZ) porCausa.vejez++;
  else if (causa === CAUSA_MUERTE.DEPREDADO) porCausa.depredado++;
}

/**
 * ¿Por qué muere esta entidad? (T45) Causas observables y separadas:
 * hambre (energía agotada), sed (sed al máximo) y vejez (edad máxima).
 * @param {number} id
 * @param {object} ctx
 * @returns {number} Uno de `CAUSA_MUERTE` (0 = sigue viva).
 */
export function causaDeMuerte(id, ctx) {
  const a = ctx.entidades;
  const ent = ctx.config.entidades;
  if (a.energia[id] <= ent.energiaMinima) return CAUSA_MUERTE.HAMBRE;
  if (a.sed[id] >= 1) return CAUSA_MUERTE.SED;
  if (a.edad[id] >= ent.edadMaximaTicks) return CAUSA_MUERTE.VEJEZ;
  return CAUSA_MUERTE.NINGUNA;
}

/**
 * ¿Esta entidad debe morir? (T45)
 * @param {number} id
 * @param {object} ctx
 * @returns {boolean}
 */
export function debeMorir(id, ctx) {
  return causaDeMuerte(id, ctx) !== CAUSA_MUERTE.NINGUNA;
}

/**
 * ¿Está dispuesta a reproducirse? (T46) Requiere: no estar en cooldown, deseo
 * suficiente, energía suficiente y haber madurado.
 * @param {number} id
 * @param {object} ctx
 * @param {object} [cfg] Bloque de config de la especie. Por defecto, el del
 *   herbívoro.
 * @returns {boolean}
 */
export function quiereReproducir(id, ctx, cfg = ctx.config.herbivoro) {
  const a = ctx.entidades;
  return (
    a.cooldown[id] <= 0 &&
    a.deseoRepro[id] >= cfg.umbralReproduccion &&
    a.energia[id] >= cfg.energiaReproduccion &&
    a.edad[id] >= cfg.edadMinimaReproduccion
  );
}

/**
 * Cobra el gasto energético del tick, penalizando el terreno (T40): cruzar
 * agua o arena cuesta más que cruzar tierra.
 * @param {number} id
 * @param {number} dt
 * @param {object} ctx
 */
export function gastarEnergia(id, dt, ctx) {
  const a = ctx.entidades;
  const ent = ctx.config.entidades;

  let multiplicador = 1;
  if (ctx.grid) {
    const terreno = ctx.grid.terrenoEn(a.celdaX(id), a.celdaY(id));
    if (terreno === TERRENO.AGUA) multiplicador = ent.costeAgua;
    else if (terreno === TERRENO.ARENA) multiplicador = ent.costeArena;
  }

  a.energia[id] = Math.max(0, a.energia[id] - ent.gastoEnergiaBase * multiplicador * dt);
}
