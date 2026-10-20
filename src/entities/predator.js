/**
 * src/entities/predator.js — Carnívoro / Depredador (P2)
 * ======================================================
 *
 * Persigue herbívoros, se alimenta de ellos, bebe agua y deambula.
 *
 * La diferencia con el herbívoro (T44): el depredador es **más rápido**
 * pero **menos eficiente**. Gana la carrera, pero la presa le cuesta más
 * energía y se recupera más despacio, así que no puede cazar sin parar.
 *
 * Prioridad (GDD §5.3):
 *   hambre crítica → sed → reproducirse → explorar
 */

import { Entity, ESPECIE, ESTADO_IA } from './entity.js';
import { CONFIG } from '../config.js';
import { buscarPresa, buscarAgua, objetivoAguaValido } from '../systems/perception.js';
import { buscarPareja, intentarReproducir } from '../systems/reproduction.js';
import { marcarMuerte, CAUSA } from '../systems/death.js';

export class Predator extends Entity {
  constructor() {
    super(ESPECIE.PREDADOR);
    this.velocidad = CONFIG.depredador.velocidad;
  }

  reiniciar() {
    super.reiniciar();
    this.velocidad = CONFIG.depredador.velocidad;

    /** Presa que se está persiguiendo. */
    this.presa = null;
    /** Ticks que lleva persiguiendo la presa actual. */
    this.ticksPersecucion = 0;

    /** Objetivo de agua: celda de agua buscada. */
    this.objetivoAguaX = -1;
    this.objetivoAguaY = -1;
    /** Ticks que faltan para volver a buscar agua. */
    this.ticksParaBuscarAgua = 0;
    /** Ticks desde la última reproducción. */
    this.ticksDesdeReproduccion = 0;
  }

  /**
   * Decide qué hacer este tick.
   * @param {number} dt
   * @param {object} ctx
   */
  pensar(dt, ctx) {
    switch (this.necesidadActual) {
      case 'hambre':
        this.pensarCazar(dt, ctx);
        break;
      case 'sed':
        this.pensarBeber(dt, ctx);
        break;
      case 'reproduccion':
        this.pensarReproducirse(dt, ctx);
        break;
      case 'explorar':
      default:
        this.pensarExplorar(dt, ctx);
        break;
    }
  }

  /**
   * Busca pareja y se reproduce. Si no hay pareja disponible, deambula.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarReproducirse(_dt, ctx) {
    this.estado = ESTADO_IA.BUSCANDO_PAREJA;

    const pareja = buscarPareja(this, ctx, ctx.vecinos);
    if (pareja === null) {
      this.pensarExplorar(_dt, ctx);
      return;
    }

    const distancia = Math.hypot(pareja.x - this.x, pareja.y - this.y);
    if (distancia > CONFIG.depredador.radioReproduccion) {
      this.caminarHacia(pareja.x, pareja.y);
      return;
    }

    intentarReproducir(this, ctx);
  }

  /**
   * Busca una presa y la persigue. Si la alcanza, la mata y come.
   * @param {number} dt
   * @param {object} ctx
   */
  pensarCazar(dt, ctx) {
    this.estado = ESTADO_IA.PERSIGUIENDO;

    // ¿La presa actual sigue viva y al alcance?
    if (this.presa !== null && this.presa.vivo) {
      const dx = this.presa.x - this.x;
      const dy = this.presa.y - this.y;
      const distancia = Math.hypot(dx, dy);

      if (distancia < CONFIG.depredador.radioAtaque) {
        this.cazar(ctx);
        return;
      }

      this.ticksPersecucion += 1;
      const maxTicks = CONFIG.depredador.segundosPersecucion * 60;
      if (this.ticksPersecucion > maxTicks) {
        // Se cansó de perseguir: la abandona (anti-twitch).
        this.presa = null;
        this.ticksPersecucion = 0;
        this.pensarExplorar(dt, ctx);
        return;
      }

      this.caminarHacia(this.presa.x, this.presa.y);
      return;
    }

    // Sin presa: busca una con el spatial hash.
    this.presa = buscarPresa(this, ctx, ctx.vecinos);
    this.ticksPersecucion = 0;
    if (this.presa !== null) {
      this.caminarHacia(this.presa.x, this.presa.y);
    } else {
      this.pensarExplorar(dt, ctx);
    }
  }

  /**
   * Marca la presa para morir y se alimenta de ella.
   *
   * La muerte se **marca** (`marcarMuerte`), no se borra acá: si el
   * depredador eliminara a la presa del array en medio del bucle de
   * entidades, el bucle se correría. El borrado real ocurre al final del
   * tick, en `aplicarMuertes()`.
   * @param {object} _ctx
   */
  cazar(_ctx) {
    const presa = this.presa;
    if (presa === null || !presa.vivo) {
      this.presa = null;
      return;
    }

    marcarMuerte(presa, CAUSA.DEPREDADO);

    const n = this.necesidades;
    n.energia = Math.min(
      CONFIG.entidades.energiaMaxima,
      n.energia + CONFIG.depredador.energiaPorPresa,
    );
    n.hambre = Math.max(0, n.hambre - CONFIG.depredador.saciedadPorPresa);

    this.presa = null;
    this.ticksPersecucion = 0;
  }

  /**
   * Busca agua y camina hacia ella. Si ya está en una celda de agua, bebe.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarBeber(_dt, ctx) {
    this.estado = ESTADO_IA.BEBIENDO;

    if (this.estaEnAgua(ctx)) {
      const n = this.necesidades;
      n.sed = Math.max(0, n.sed - CONFIG.depredador.saciedadAlBeber);
      return;
    }

    if (objetivoAguaValido(this, ctx)) {
      this.caminarHacia(this.objetivoAguaX + 0.5, this.objetivoAguaY + 0.5);
      return;
    }

    this.ticksParaBuscarAgua -= 1;
    if (this.ticksParaBuscarAgua > 0) {
      this.pensarExplorar(_dt, ctx);
      return;
    }
    this.ticksParaBuscarAgua = ctx.config.percepcion.ticksEntreBusquedaAgua;

    if (buscarAgua(this, ctx)) {
      this.caminarHacia(this.objetivoAguaX + 0.5, this.objetivoAguaY + 0.5);
    } else {
      this.pensarExplorar(_dt, ctx);
    }
  }

  /**
   * Deambula: cambia de rumbo al azar cada tanto.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarExplorar(_dt, ctx) {
    this.estado = ESTADO_IA.VAGO;
    this.ticksParaGiro -= 1;
    if (this.ticksParaGiro <= 0) {
      this.ticksParaGiro = ctx.prng.intInclusive(40, 110);
      const angulo = ctx.prng.angle();
      this.dirX = Math.cos(angulo);
      this.dirY = Math.sin(angulo);
    }
  }

  /**
   * ¿Está la entidad sobre una celda de agua?
   * @param {object} ctx
   * @returns {boolean}
   */
  estaEnAgua(ctx) {
    const grid = ctx.grid;
    if (!grid) return false;
    return grid.esAgua(this.celdaX, this.celdaY);
  }
}
