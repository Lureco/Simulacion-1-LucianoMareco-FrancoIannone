/**
 * src/entities/herbivore.js — Herbívoro (P2) (F4 · T34-T41)
 * ==========================================================
 * Come plantas, bebe agua, se reproduce y muere de hambre, sed o vejez.
 *
 * ⚠️ REFACTOR SoA (D13): esto ya **no es una entidad**, es una **especie**.
 * Hay UNA instancia de esta clase para todo el mundo; los datos de cada
 * herbívoro viven en `EntityManager`. Acá va solo el comportamiento.
 *
 * Decisión por prioridad (T35):
 *
 *   hambre crítica > sed crítica > reproducirse > explorar
 *
 * Cada tick: se actualizan las necesidades, se decide el estado y el rumbo, y
 * se integra el movimiento. El terreno modula la velocidad de movimiento
 * (T40): cruzar agua o arena es más lento que cruzar tierra.
 *
 * Las búsquedas (plantas, agua, pareja) viven en `systems/perception.js`; las
 * necesidades y la muerte, en `systems/needs.js`; las altas/bajas diferidas,
 * en `systems/eventos.js`.
 */

import { Especie, ESTADO_IA } from './entity.js';
import { CONFIG } from '../config.js';
import { mover } from '../systems/movement.js';
import { aplicarSeparacion } from '../systems/separacion.js';
import { comerPlanta } from '../systems/plantGrowth.js';
import {
  buscarComida,
  buscarAgua,
  buscarDepredador,
  direccionAlAgua,
  direccionATierra,
  direccionAjustadaAlAgua,
  distanciaObjetivoAlAgua,
  objetivoDe,
  vecinosDe,
} from '../systems/perception.js';
import {
  actualizarNecesidades,
  causaDeMuerte,
  CAUSA_MUERTE,
  quiereReproducir,
  registrarMuerte,
} from '../systems/needs.js';
import { anotarMuerte, anotarNacimiento } from '../systems/eventos.js';
import { TERRENO } from '../world/cell.js';

/** Vecindad 8, en orden fijo, para buscar dónde nace la cría (T47). */
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

export class Herbivoro extends Especie {
  constructor() {
    super({ velocidad: CONFIG.herbivoro.velocidad });
  }

  /**
   * Un tick de un herbívoro (T34-T41).
   * @param {number} id
   * @param {number} dt
   * @param {object} ctx
   */
  actualizar(id, dt, ctx) {
    const a = ctx.entidades;
    a.edad[id] += 1;

    actualizarNecesidades(id, dt, ctx);

    // Muerte diferida: se anota la causa y se aplica al final del tick.
    const causa = causaDeMuerte(id, ctx);
    if (causa !== CAUSA_MUERTE.NINGUNA) {
      registrarMuerte(ctx, causa);
      anotarMuerte(ctx, id);
      return;
    }

    this.pensar(id, dt, ctx);
    aplicarSeparacion(id, ctx);
    mover(id, dt, ctx);
  }

  /**
   * Decide por prioridad (T35) y apunta el rumbo.
   * @param {number} id
   * @param {number} dt
   * @param {object} ctx
   */
  pensar(id, dt, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.herbivoro;
    const x = a.x[id];
    const y = a.y[id];

    // Huir tiene prioridad absoluta (T43): un herbívoro que muere no come.
    // Se detecta al depredador con el radio de visión de la especie cazadora.
    const depredador = buscarDepredador(
      ctx,
      x,
      y,
      ctx.config.depredador.radioVision * a.genPercepcion[id],
      vecinosDe(ctx),
    );
    if (depredador >= 0) {
      a.estado[id] = ESTADO_IA.HUYENDO;
      a.velocidad[id] = cfg.velocidad;
      this.huir(id, depredador, ctx);
      return;
    }

    if (a.hambre[id] >= cfg.hambreCritica) {
      a.estado[id] = ESTADO_IA.COMIENDO;
      a.velocidad[id] = cfg.velocidad * cfg.bonusVelocidadComer;
      if (this.buscarComidaYActuar(id, ctx, x, y)) return;
    }

    if (a.sed[id] >= cfg.sedCritica) {
      a.estado[id] = ESTADO_IA.BEBIENDO;
      a.velocidad[id] = cfg.velocidad;
      if (this.buscarAguaYActuar(id, ctx, x, y)) return;
    }

    if (quiereReproducir(id, ctx)) {
      a.estado[id] = ESTADO_IA.BUSCANDO_PAREJA;
      a.velocidad[id] = cfg.velocidad;
      if (this.buscarParejaYActuar(id, ctx, x, y)) return;
    }

    // Nada urgente (o nada a la vista): si quedó varado en agua o arena,
    // primero vuelve a tierra (donde está la comida); si no, explora (T39).
    a.estado[id] = ESTADO_IA.VAGO;
    a.velocidad[id] = cfg.velocidad;
    if (this.volverATierra(id, ctx, x, y)) return;
    this.deambular(id, dt, ctx);
  }

  /**
   * Si la celda actual no es tierra, apunta hacia la tierra más cercana
   * (campo precalculado). Evita que un herbívoro quede atrapado en un lago o
   * en la playa, donde no hay plantas y el terreno es más lento.
   * @returns {boolean} `true` si cambió el rumbo.
   */
  volverATierra(id, ctx, x, y) {
    const grid = ctx.grid;
    if (!grid) return false;

    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!grid.dentro(cx, cy)) return false;
    if (grid.terrenoEn(cx, cy) === TERRENO.TIERRA) return false;

    const rumbo = direccionATierra(ctx, x, y, objetivoDe(ctx));
    if (!rumbo.encontrado) return false;

    this.apuntar(id, rumbo.x - x, rumbo.y - y, ctx);
    return true;
  }

  /**
   * Va hacia la comida más cercana; si ya está encima, muerde (T37).
   * @returns {boolean} `true` si encontró algo y actuó.
   */
  buscarComidaYActuar(id, ctx, x, y) {
    const cfg = ctx.config.herbivoro;
    const objetivo = buscarComida(
      ctx,
      x,
      y,
      cfg.radioVision * ctx.entidades.genPercepcion[id],
      objetivoDe(ctx),
    );
    if (!objetivo.encontrado) return false;

    const dx = objetivo.x - x;
    const dy = objetivo.y - y;
    if (dx * dx + dy * dy <= cfg.radioComer * cfg.radioComer) {
      this.comer(id, ctx, objetivo.indice);
      this.detener(id, ctx);
      return true;
    }

    this.apuntar(id, dx, dy, ctx);
    return true;
  }

  /**
   * Muerde la planta de una celda y sacia el hambre (T37).
   * @param {number} id
   * @param {object} ctx
   * @param {number} indice
   */
  comer(id, ctx, indice) {
    const comio = comerPlanta(ctx, indice);
    if (!comio) return;

    const a = ctx.entidades;
    a.hambre[id] = 0;
  }

  /**
   * Va hacia el agua más cercana; si ya está al lado, bebe (T38). Si no ve
   * agua en el radio de visión, sigue el campo de dirección hacia el agua.
   * @returns {boolean} `true` si encontró agua y actuó.
   */
  buscarAguaYActuar(id, ctx, x, y) {
    const cfg = ctx.config.herbivoro;
    const objetivo = buscarAgua(
      ctx,
      x,
      y,
      cfg.radioVision * ctx.entidades.genPercepcion[id],
      objetivoDe(ctx),
    );

    if (objetivo.encontrado) {
      const dx = objetivo.x - x;
      const dy = objetivo.y - y;
      if (dx * dx + dy * dy <= cfg.radioBeber * cfg.radioBeber) {
        ctx.entidades.sed[id] = 0;
        this.detener(id, ctx);
        return true;
      }
      this.apuntar(id, dx, dy, ctx);
      return true;
    }

    // Sin agua a la vista: caminar hacia el agua con el campo precalculado.
    const lejos = direccionAlAgua(ctx, x, y, objetivoDe(ctx));
    if (lejos.encontrado) {
      this.apuntar(id, lejos.x - x, lejos.y - y, ctx);
      return true;
    }

    return false;
  }

  /**
   * Busca una pareja dispuesta con el Spatial Hash (T36) y se reproduce (T46).
   * @returns {boolean} `true` si encontró pareja (y actuó).
   */
  buscarParejaYActuar(id, ctx, x, y) {
    if (!ctx.hash) return false;

    const a = ctx.entidades;
    const cfg = ctx.config.herbivoro;
    const vecinos = ctx.hash.consultar(
      x,
      y,
      cfg.radioVision * a.genPercepcion[id],
      vecinosDe(ctx),
      id,
    );

    let mejorId = -1;
    let mejorD2 = Infinity;
    for (let k = 0; k < vecinos.length; k++) {
      const otro = vecinos[k];
      if (a.tipo[otro] !== a.tipo[id]) continue;
      if (!quiereReproducir(otro, ctx)) continue;
      const dx = a.x[otro] - x;
      const dy = a.y[otro] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < mejorD2) {
        mejorD2 = d2;
        mejorId = otro;
      }
    }

    if (mejorId < 0) return false;

    if (mejorD2 <= cfg.radioReproduccion * cfg.radioReproduccion) {
      this.reproducir(id, mejorId, ctx);
      this.detener(id, ctx);
      return true;
    }

    this.apuntar(id, a.x[mejorId] - x, a.y[mejorId] - y, ctx);
    return true;
  }

  /**
   * Reproduce a dos herbívoros: pone cooldown y anota la cría en una celda
   * de tierra adyacente (T46/T47). La cría se crea al final del tick.
   * @param {number} id
   * @param {number} pareja
   * @param {object} ctx
   */
  reproducir(id, pareja, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.herbivoro;

    // F8/T67: cada progenitor tiene su propio tiempo de reproducción.
    a.cooldown[id] = Math.round(cfg.cooldownReproduccion * a.genReproduccion[id]);
    a.cooldown[pareja] = Math.round(cfg.cooldownReproduccion * a.genReproduccion[pareja]);
    a.deseoRepro[id] = 0;
    a.deseoRepro[pareja] = 0;

    const indice = this.celdaLibreAdyacente(ctx, a.celdaX(id), a.celdaY(id));
    if (indice >= 0) anotarNacimiento(ctx, a.tipo[id], indice, id, pareja);
  }

  /**
   * Primera celda de tierra en la vecindad 8 de la madre (T47).
   * @returns {number} Índice plano, o -1 si no hay.
   */
  celdaLibreAdyacente(ctx, cx, cy) {
    const grid = ctx.grid;
    if (!grid) return -1;
    for (let k = 0; k < VECINOS_8.length; k++) {
      const nx = cx + VECINOS_8[k][0];
      const ny = cy + VECINOS_8[k][1];
      if (!grid.dentro(nx, ny)) continue;
      if (grid.terrenoEn(nx, ny) !== TERRENO.TIERRA) continue;
      return ny * grid.ancho + nx;
    }
    return -1;
  }

  /**
   * Explorar (T39): rumbo al azar que cambia cada tanto, con un pequeño ruido
   * por tick para que el camino no sea una recta perfecta.
   * @param {number} id
   * @param {number} _dt
   * @param {object} ctx
   */
  deambular(id, _dt, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.herbivoro;

    // T38: mantiene una franja alrededor del agua. Si está más lejos (o más
    // cerca) de lo que quiere según su sed, corrige el rumbo antes de
    // deambular al azar. Sin campo de agua (tests/mundo sin terreno) no hace
    // nada y sigue el wander de siempre. El checkbox `mantenerDistanciaAgua`
    // permite desactivar este pegote a la orilla sin quitar la bebida.
    if (ctx.config?.percepcion?.mantenerDistanciaAgua !== false) {
      const objetivoAgua = distanciaObjetivoAlAgua(a.sed[id], cfg);
      const rumboAgua = direccionAjustadaAlAgua(
        ctx,
        a.x[id],
        a.y[id],
        objetivoAgua,
        objetivoDe(ctx),
      );
      if (rumboAgua.encontrado) {
        this.apuntar(id, rumboAgua.x - a.x[id], rumboAgua.y - a.y[id], ctx);
        return;
      }
    }

    a.ticksParaGiro[id] -= 1;
    if (a.ticksParaGiro[id] <= 0) {
      a.ticksParaGiro[id] = ctx.prng.intInclusive(cfg.ticksGiroMin, cfg.ticksGiroMax);
      const angulo = ctx.prng.angle();
      a.dirX[id] = Math.cos(angulo);
      a.dirY[id] = Math.sin(angulo);
      return;
    }

    if (cfg.ruidoRumbo > 0) {
      const angulo =
        Math.atan2(a.dirY[id], a.dirX[id]) + ctx.prng.range(-cfg.ruidoRumbo, cfg.ruidoRumbo);
      a.dirX[id] = Math.cos(angulo);
      a.dirY[id] = Math.sin(angulo);
    }
  }

  /**
   * Huye de un depredador cercano (T43): apunta en dirección contraria.
   * @param {number} id
   * @param {number} depredador id del depredador a evitar.
   * @param {object} ctx
   */
  huir(id, depredador, ctx) {
    const a = ctx.entidades;
    const dx = a.x[id] - a.x[depredador];
    const dy = a.y[id] - a.y[depredador];
    this.apuntar(id, dx, dy, ctx);
    // Sostiene la huida unos ticks aunque el depredador salga del radio.
    a.ticksParaGiro[id] = ctx.config.herbivoro.ticksHuida;
  }

  /**
   * Apunta el rumbo normalizado hacia un desplazamiento.
   * @param {number} id
   * @param {number} dx
   * @param {number} dy
   * @param {object} ctx
   */
  apuntar(id, dx, dy, ctx) {
    const a = ctx.entidades;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-6) {
      a.dirX[id] = dx / d;
      a.dirY[id] = dy / d;
    }
  }

  /**
   * Frena la entidad (cuando está comiendo/bebiendo/reproduciéndose).
   * @param {number} id
   * @param {object} ctx
   */
  detener(id, ctx) {
    const a = ctx.entidades;
    a.dirX[id] = 0;
    a.dirY[id] = 0;
  }
}
