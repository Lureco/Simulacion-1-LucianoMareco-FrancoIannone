/**
 * src/entities/predator.js — Carnívoro / Depredador (P2) (F5 · T43-T50)
 * =====================================================================
 * Persigue herbívoros, se alimenta de ellos, bebe agua, se reproduce y muere.
 *
 * ⚠️ REFACTOR SoA (D13): esto ya **no es una entidad**, es una **especie**.
 * Hay UNA instancia de esta clase para todo el mundo; los datos de cada
 * depredador viven en `EntityManager`. Acá solo va el comportamiento.
 *
 * Decisión por prioridad (GDD §5.3):
 *
 *   hambre crítica > sed crítica > reproducirse > explorar
 *
 * La diferencia con el herbívoro (T44): el depredador es **más rápido** pero
 * **menos eficiente**. Gana la carrera, pero cada persecución consume tiempo
 * (`segundosPersecucion`) y puede cansarse antes de alcanzar la presa, así
 * que no puede cazar sin parar.
 *
 * La caza es **diferida** como todo lo demás: el depredador anota la muerte de
 * la presa (`anotarMuerte`) y `pasoDeSimulacion` la aplica al final del tick.
 * Las búsquedas viven en `systems/perception.js`; las necesidades, la muerte y
 * la reproducción, en `systems/needs.js`; las altas/bajas, en
 * `systems/eventos.js`.
 */

import { Especie, ESPECIE, ESTADO_IA } from './entity.js';
import { CONFIG, TICKS_POR_SEGUNDO } from '../config.js';
import { mover } from '../systems/movement.js';
import { aplicarSeparacion } from '../systems/separacion.js';
import {
  buscarPresa,
  buscarAgua,
  direccionAlAgua,
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

export class Depredador extends Especie {
  constructor() {
    super({ velocidad: CONFIG.depredador.velocidad });
  }

  /**
   * Un tick de un depredador (T43-T50).
   * @param {number} id
   * @param {number} dt
   * @param {object} ctx
   */
  actualizar(id, dt, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.depredador;
    a.edad[id] += 1;

    actualizarNecesidades(id, dt, ctx, cfg);

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
    const cfg = ctx.config.depredador;
    const x = a.x[id];
    const y = a.y[id];

    if (a.hambre[id] >= cfg.hambreCritica) {
      a.estado[id] = ESTADO_IA.PERSIGUIENDO;
      a.velocidad[id] = cfg.velocidad;
      if (this.buscarPresaYActuar(id, ctx, x, y)) return;
    }

    if (a.sed[id] >= cfg.sedCritica) {
      a.estado[id] = ESTADO_IA.BEBIENDO;
      a.velocidad[id] = cfg.velocidad;
      if (this.buscarAguaYActuar(id, ctx, x, y)) return;
    }

    if (quiereReproducir(id, ctx, cfg)) {
      a.estado[id] = ESTADO_IA.BUSCANDO_PAREJA;
      a.velocidad[id] = cfg.velocidad;
      if (this.buscarParejaYActuar(id, ctx, x, y)) return;
    }

    a.estado[id] = ESTADO_IA.VAGO;
    a.velocidad[id] = cfg.velocidad;
    this.deambular(id, dt, ctx);
  }

  /**
   * Persigue a la presa que tiene en memoria y la mata si la alcanza (T43).
   *
   * Si la presa se perdió (murió, la mató otro o se cansó de perseguirla)
   * busca una nueva, pero no en cada tick: la búsqueda en el hash se espacia
   * con `ticksBusqueda` (T36).
   *
   * @param {number} id
   * @param {object} ctx
   * @param {number} x
   * @param {number} y
   * @returns {boolean} `true` si tiene una presa a la vista y actuó.
   */
  buscarPresaYActuar(id, ctx, x, y) {
    const a = ctx.entidades;
    const cfg = ctx.config.depredador;

    // ¿Sigue viva la presa que perseguía? (y no la mató otro depredador antes)
    const actual = a.presa[id];
    if (
      actual >= 0 &&
      a.vivo[actual] === 1 &&
      a.moribundo[actual] === 0 &&
      a.tipo[actual] === ESPECIE.HERBIVORO
    ) {
      const dx = a.x[actual] - x;
      const dy = a.y[actual] - y;
      if (dx * dx + dy * dy <= cfg.radioAtaque * cfg.radioAtaque) {
        this.cazar(id, actual, ctx);
        this.detener(id, ctx);
        return true;
      }

      a.ticksPersecucion[id] += 1;
      if (a.ticksPersecucion[id] > cfg.segundosPersecucion * TICKS_POR_SEGUNDO) {
        // Se cansó de perseguirla: la abandona (anti-twitch, T43).
        a.presa[id] = -1;
        a.ticksPersecucion[id] = 0;
        return false;
      }

      this.apuntar(id, dx, dy, ctx);
      return true;
    }

    // Sin presa válida: busca una nueva, cada N ticks.
    a.presa[id] = -1;
    a.ticksPersecucion[id] = 0;
    a.ticksBusqueda[id] -= 1;
    if (a.ticksBusqueda[id] > 0) return false;
    a.ticksBusqueda[id] = ctx.config.percepcion.ticksEntreBusqueda;

    const presa = buscarPresa(ctx, x, y, cfg.radioVision * a.genPercepcion[id], vecinosDe(ctx));
    if (presa < 0) return false;

    a.presa[id] = presa;
    this.apuntar(id, a.x[presa] - x, a.y[presa] - y, ctx);
    return true;
  }

  /**
   * Mata a la presa (T43/T45).
   *
   * La muerte se **anota**, no se aplica acá: borrar la presa en medio del
   * recorrido de entidades correría el bucle. Se cuenta como `DEPREDADO` y se
   * aplica al final del tick. La bandera `moribundo` evita que dos
   * depredadores cuenten la misma muerte.
   *
   * @param {number} id
   * @param {number} presa
   * @param {object} ctx
   */
  cazar(id, presa, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.depredador;

    a.presa[id] = -1;
    a.ticksPersecucion[id] = 0;

    // Otro depredador ya la mató este tick: no se cuenta dos veces.
    if (a.vivo[presa] !== 1 || a.moribundo[presa] === 1) return;

    anotarMuerte(ctx, presa);
    registrarMuerte(ctx, CAUSA_MUERTE.DEPREDADO);

    a.hambre[id] = Math.max(0, a.hambre[id] - cfg.saciedadPorPresa);
  }

  /**
   * Va hacia el agua más cercana; si ya está al lado, bebe (T38). Si no ve
   * agua en el radio de visión, sigue el campo de dirección hacia el agua.
   * @param {number} id
   * @param {object} ctx
   * @param {number} x
   * @param {number} y
   * @returns {boolean} `true` si encontró agua y actuó.
   */
  buscarAguaYActuar(id, ctx, x, y) {
    const cfg = ctx.config.depredador;
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
        ctx.entidades.sed[id] = Math.max(0, ctx.entidades.sed[id] - cfg.saciedadAlBeber);
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
   * @param {number} id
   * @param {object} ctx
   * @param {number} x
   * @param {number} y
   * @returns {boolean} `true` si encontró pareja (y actuó).
   */
  buscarParejaYActuar(id, ctx, x, y) {
    if (!ctx.hash) return false;

    const a = ctx.entidades;
    const cfg = ctx.config.depredador;
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
      if (!quiereReproducir(otro, ctx, cfg)) continue;
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
   * Reproduce a dos depredadores: pone cooldown y anota la cría en una celda
   * de tierra adyacente (T46/T47). La cría se crea al final del tick.
   * @param {number} id
   * @param {number} pareja
   * @param {object} ctx
   */
  reproducir(id, pareja, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.depredador;

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
   * @param {object} ctx
   * @param {number} cx
   * @param {number} cy
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
   *
   * Mantiene la distancia al agua (`distanciaOrilla`, T38): si está más cerca
   * de la orilla de lo que quiere, se aleja; si está más lejos, se acerca.
   * Así los carnívoros se reparten por el mapa en vez de amontonarse en la
   * playa.
   * @param {number} id
   * @param {number} _dt
   * @param {object} ctx
   */
  deambular(id, _dt, ctx) {
    const a = ctx.entidades;
    const cfg = ctx.config.depredador;

    // El checkbox `mantenerDistanciaAgua` desactiva solo la franja de
    // deambulación: la sed crítica sigue llevándolo a beber (T38).
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
   * Frena la entidad (cuando está cazando/bebiendo/reproduciéndose).
   * @param {number} id
   * @param {object} ctx
   */
  detener(id, ctx) {
    const a = ctx.entidades;
    a.dirX[id] = 0;
    a.dirY[id] = 0;
  }
}
