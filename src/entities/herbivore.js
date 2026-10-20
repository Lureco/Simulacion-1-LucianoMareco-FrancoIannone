/**
 * src/entities/herbivore.js — Herbívoro (P2)
 * =============================================
 *
 * Come plantas, bebe agua y huye de los depredadores.
 *
 * La IA es una **máquina de estados por prioridad** (GDD §6):
 *
 *   ¿Hay depredador cerca?  → HUIR
 *   ¿Hambre crítica?        → BUSCAR PLANTA → COMER
 *   ¿Sed crítica?           → BUSCAR AGUA   → BEBER
 *   ¿Quiere reproducirse?   → BUSCAR PAREJA (F5)
 *   (ninguna urgente)       → EXPLORAR
 *
 * La prioridad la decide `necesidadDominante()` (en `systems/needs.js`).
 * Cada estado tiene su propia acción y su propia **memoria del objetivo**,
 * para no re-buscar recursos en cada tick (lo más caro de la IA).
 *
 * Ninguna acción crea objetos: los objetivos viven en la entidad, que sale
 * del pool. Todo el azar sale de `ctx.prng`.
 */

import { Entity, ESPECIE, ESTADO_IA } from './entity.js';
import { CONFIG } from '../config.js';
import { consumirPlanta } from '../systems/plantGrowth.js';
import {
  buscarPlanta,
  buscarDepredador,
  objetivoPlantaValido,
  plantaEnCeldaActual,
} from '../systems/perception.js';
import { buscarPareja, intentarReproducir } from '../systems/reproduction.js';
import { estaEnOrillaDeAgua, direccionHaciaAgua } from '../systems/mapaAgua.js';

export class Herbivore extends Entity {
  constructor() {
    super(ESPECIE.HERBIVORO);
    this.velocidad = CONFIG.herbivoro.velocidad;
  }

  reiniciar() {
    super.reiniciar();
    this.velocidad = CONFIG.herbivoro.velocidad;

    /** Objetivo de comida: celda de la planta buscada. */
    this.objetivoPlantaX = -1;
    this.objetivoPlantaY = -1;
    /** Estado de planta que se busca (adulta o joven). */
    this.objetivoPlantaEstado = 0;

    /** Ticks que faltan para volver a buscar comida. */
    this.ticksParaBuscarPlanta = 0;
    /** Ticks que faltan para volver a buscar agua. */
    this.ticksParaBuscarAgua = 0;
    /** Ticks desde la última reproducción. */
    this.ticksDesdeReproduccion = 0;
  }

  /**
   * Decide qué hacer este tick. Es el override del `pensar()` base.
   * @param {number} dt
   * @param {object} ctx
   */
  pensar(dt, ctx) {
    // 1 · Huir tiene prioridad absoluta: un herbívoro que muere no come.
    const depredador = buscarDepredador(this, ctx, ctx.vecinos);
    if (depredador !== null) {
      this.estado = ESTADO_IA.HUYENDO;
      this.huir(depredador);
      return;
    }

    // 2 · Seguir con la necesidad dominante.
    switch (this.necesidadActual) {
      case 'hambre':
        this.pensarComer(dt, ctx);
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

    // Se acerca a la pareja y se reproduce si están lo bastante cerca.
    const distancia = Math.hypot(pareja.x - this.x, pareja.y - this.y);
    if (distancia > CONFIG.herbivoro.radioReproduccion) {
      this.caminarHacia(pareja.x, pareja.y);
      return;
    }

    intentarReproducir(this, ctx);
  }

  /**
   * Busca una planta y camina hacia ella. Si ya está encima, come.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarComer(_dt, ctx) {
    this.estado = ESTADO_IA.COMIENDO;

    // Si ya está sobre una planta comestible, come sin buscar nada más.
    if (plantaEnCeldaActual(this, ctx)) {
      this.comer(ctx);
      return;
    }

    // El objetivo sigue vivo: camina hacia él.
    if (objetivoPlantaValido(this, ctx)) {
      this.caminarHacia(this.objetivoPlantaX + 0.5, this.objetivoPlantaY + 0.5);
      return;
    }

    // Sin objetivo (o se lo comieron): busca uno nuevo, cada N ticks.
    this.ticksParaBuscarPlanta -= 1;
    if (this.ticksParaBuscarPlanta > 0) {
      this.pensarExplorar(_dt, ctx);
      return;
    }
    this.ticksParaBuscarPlanta = ctx.config.percepcion.ticksEntreBusqueda;

    if (buscarPlanta(this, ctx)) {
      this.caminarHacia(this.objetivoPlantaX + 0.5, this.objetivoPlantaY + 0.5);
    } else {
      // No hay comida en el radio: deambula para buscarla en otro lado.
      this.pensarExplorar(_dt, ctx);
    }
  }

  /**
   * Come la planta de la celda actual: la retire y llena al herbívoro.
   *
   * La escritura en la capa `planta` la hace `consumirPlanta()`: ese módulo
   * es su dueño (contrato §2). Acá solo se pide y se cobra el resultado.
   * @param {object} ctx
   */
  comer(ctx) {
    const energia = consumirPlanta(ctx, this.celdaX, this.celdaY);
    if (energia === 0) return;

    const n = this.necesidades;
    n.energia = Math.min(CONFIG.entidades.energiaMaxima, n.energia + energia);
    n.hambre = Math.max(0, n.hambre - CONFIG.herbivoro.saciedadPorPlanta);

    // El objetivo se consumió: hay que buscar otro.
    this.objetivoPlantaX = -1;
    this.objetivoPlantaY = -1;
  }

  /**
   * Busca agua y camina hacia ella. Si ya está en una celda de agua, bebe.
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarBeber(_dt, ctx) {
    this.estado = ESTADO_IA.BEBIENDO;

    // Si ya está en el agua o en su orilla, bebe.
    if (estaEnOrillaDeAgua(this, ctx)) {
      this.beber();
      return;
    }

    // Camina cuesta abajo por el gradiente de distancia al agua (T38).
    // Así encuentra la orilla aunque esté lejos: no depende del radio
    // de visión, sino de la pendiente del terreno.
    const direccion = direccionHaciaAgua(this, ctx);
    if (direccion !== null) {
      this.dirX = direccion.x;
      this.dirY = direccion.y;
      this.ticksParaBuscarAgua = ctx.config.percepcion.ticksEntreBusquedaAgua;
      return;
    }

    // Sin gradiente (mundo sin agua): deambula y vuelve a intentar.
    this.ticksParaBuscarAgua -= 1;
    if (this.ticksParaBuscarAgua > 0) {
      this.pensarExplorar(_dt, ctx);
      return;
    }
    this.ticksParaBuscarAgua = ctx.config.percepcion.ticksEntreBusquedaAgua;
    this.pensarExplorar(_dt, ctx);
  }

  /**
   * Bebe: llena la sed.
   */
  beber() {
    const n = this.necesidades;
    n.sed = Math.max(0, n.sed - CONFIG.herbivoro.saciedadAlBeber);
  }

  /**
   * Deambula: cambia de rumbo al azar cada tanto.
   *
   * Pero si tiene sed (por encima de `sedBusqueda`, sin ser crítica todavía),
   * **sesga el rumbo hacia el agua** en vez de deambular al azar. Es lo que
   * hace que el animal llegue a la orilla a tiempo: si solo buscara agua
   * cuando la sed ya es crítica, moriría de sed en el camino.
   *
   * @param {number} _dt
   * @param {object} ctx
   */
  pensarExplorar(_dt, ctx) {
    this.estado = ESTADO_IA.VAGO;

    // ¿Tiene sed pero no es crítica? Entonces deriva hacia el agua.
    if (this.necesidades.sed >= CONFIG.herbivoro.sedBusqueda) {
      const direccion = direccionHaciaAgua(this, ctx);
      if (direccion !== null) {
        this.dirX = direccion.x;
        this.dirY = direccion.y;
        return;
      }
    }

    this.ticksParaGiro -= 1;
    if (this.ticksParaGiro <= 0) {
      this.ticksParaGiro = ctx.prng.intInclusive(40, 110);
      const angulo = ctx.prng.angle();
      this.dirX = Math.cos(angulo);
      this.dirY = Math.sin(angulo);
    }
  }

  /**
   * Huye de un depredador: se aleja en la dirección opuesta.
   * @param {object} depredador
   */
  huir(depredador) {
    const dx = this.x - depredador.x;
    const dy = this.y - depredador.y;
    const largo = Math.hypot(dx, dy);
    if (largo > 0) {
      this.dirX = dx / largo;
      this.dirY = dy / largo;
    }
    this.ticksParaGiro = 20;
  }
}
