/**
 * src/ui/grafico.js — Gráfico de evolución de poblaciones (T55)
 * ============================================================
 *
 * Canvas 2D **aparte** del de Pixi, en HTML plano sobre el canvas de la
 * simulación. Es la opción que dice el GDD §14 ("gráfico que muestre la
 * evolución de las poblaciones a lo largo del tiempo").
 *
 * **Regla clave (TAREAS §2):** el gráfico se redibuja **una vez por
 * segundo**, nunca por frame. Con 60 FPS, dibujar el gráfico en cada
 * frame sería 60 veces el trabajo para un dato que cambia una vez por
 * segundo.
 *
 * Cada serie se **normaliza por su propio máximo**: si las plantas están
 * en 36.000 y los depredadores en 5, graficarlos en la misma escala los
 * dejaría pegados al eje. Normalizando, se ve la forma de cada curva.
 * El valor real de cada serie se escribe en la leyenda del gráfico.
 *
 * Las muestras se guardan en un array circular de tamaño fijo: la
 * memoria no crece aunque la simulación corra horas.
 */

/** Muestras que caben en el historial (1 por segundo → 5 minutos). */
const MAX_MUESTRAS = 300;

/** Series que se grafican, en orden de dibujo. */
const SERIES = [
  { clave: 'plantas', etiqueta: 'plantas', color: '#4f9d4f' },
  { clave: 'herbivoros', etiqueta: 'herbívoros', color: '#6bdc7a' },
  { clave: 'depredadores', etiqueta: 'carnívoros', color: '#ff5d5d' },
];

export class Grafico {
  /**
   * @param {HTMLElement} contenedor
   * @param {{ancho?: number, alto?: number}} [opciones]
   */
  constructor(contenedor, { ancho = 260, alto = 120 } = {}) {
    this.ancho = ancho;
    this.alto = alto;

    this.canvas = document.createElement('canvas');
    this.canvas.width = ancho;
    this.canvas.height = alto;
    this.canvas.style.cssText = `
      position: absolute;
      right: 10px;
      bottom: 10px;
      width: ${ancho}px;
      height: ${alto}px;
      background: rgba(11, 13, 16, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      font: 11px/1.4 ui-monospace, "Cascadia Code", Consolas, monospace;
      color: #e6e6e6;
      pointer-events: none;
      /* El gráfico va detrás del HUD para que nunca tape los contadores. */
      z-index: 0;
    `;
    contenedor.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    /**
     * Historial de muestras. Array circular: se sobrescribe el más viejo
     * en vez de crecer sin límite.
     * @type {{tick: number, plantas: number, herbivoros: number, depredadores: number}[]}
     */
    this.muestras = [];
    /** Índice de escritura en el array circular. @type {number} */
    this.indiceMuestras = 0;
    /** Cuántas muestras hay guardadas. @type {number} */
    this.cantidadMuestras = 0;

    /** Último tick dibujado (para no redibujar de más). @type {number} */
    this.ultimoTick = -1;
  }

  /**
   * Registra una muestra. Solo guarda **una por segundo**: entre medio se
   * descarta, porque el gráfico no llega a mostrar esa resolución.
   * @param {number} tick Tick de simulación.
   * @param {object} datos Poblaciones actuales.
   */
  registrar(tick, datos) {
    const ultimo = this.cantidadMuestras > 0 ? this.muestras[this.ultimoIndice()] : null;
    if (ultimo !== null && tick - ultimo.tick < 60) return;

    const muestra = {
      tick,
      plantas: datos.plantas,
      herbivoros: datos.herbivoros,
      depredadores: datos.depredadores,
    };

    if (this.cantidadMuestras < MAX_MUESTRAS) {
      this.muestras[this.indiceMuestras] = muestra;
      this.cantidadMuestras++;
    } else {
      // Circular: pisa la más vieja.
      this.muestras[this.indiceMuestras] = muestra;
    }
    this.indiceMuestras = (this.indiceMuestras + 1) % MAX_MUESTRAS;
  }

  /** Índice de la muestra más reciente. @returns {number} */
  ultimoIndice() {
    return (this.indiceMuestras - 1 + MAX_MUESTRAS) % MAX_MUESTRAS;
  }

  /**
   * Redibuja el gráfico. Se llama **una vez por segundo**, no por frame.
   * @param {object} [datosActuales] Para la leyenda de valores actuales.
   */
  renderizar(datosActuales) {
    const ctx = this.ctx;
    const ancho = this.ancho;
    const alto = this.alto;

    ctx.clearRect(0, 0, ancho, alto);

    // ── Leyenda de valores actuales ────────────────────────────────
    // Dos filas de tres: si no, el texto se sale del canvas.
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'top';
    const textos = SERIES.map((serie) => ({
      color: serie.color,
      texto: `${serie.etiqueta} ${datosActuales ? datosActuales[serie.clave] : 0}`,
    }));

    for (let i = 0; i < textos.length; i++) {
      const item = textos[i];
      const x = 8 + (i % 3) * 82;
      const y = 5 + Math.floor(i / 3) * 13;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y + 2, 7, 7);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillText(item.texto, x + 10, y);
    }

    // ── Área del gráfico ───────────────────────────────────────────
    const margenIzq = 6;
    const margenDer = 6;
    const margenSup = 34;
    const margenInf = 14;
    const areaX = margenIzq;
    const areaY = margenSup;
    const areaAncho = ancho - margenIzq - margenDer;
    const areaAlto = alto - margenSup - margenInf;

    if (this.cantidadMuestras < 2) {
      ctx.fillStyle = '#6b7280';
      ctx.fillText('recolectando…', areaX + 4, areaY + areaAlto / 2);
      return;
    }

    // Máximo de cada serie (para normalizar).
    const maximos = {};
    for (const serie of SERIES) {
      let max = 1;
      for (let i = 0; i < this.cantidadMuestras; i++) {
        const v = this.muestras[i][serie.clave];
        if (v > max) max = v;
      }
      maximos[serie.clave] = max;
    }

    // ── Rejilla y ejes ─────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = areaY + (areaAlto * i) / 3;
      ctx.beginPath();
      ctx.moveTo(areaX, y);
      ctx.lineTo(areaX + areaAncho, y);
      ctx.stroke();
    }

    // ── Curvas ─────────────────────────────────────────────────────
    const total = this.cantidadMuestras;
    for (const serie of SERIES) {
      const max = maximos[serie.clave];
      ctx.strokeStyle = serie.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < total; i++) {
        // Las muestras están en orden circular: se leen desde la más vieja.
        const indice = (this.indiceMuestras - total + i + MAX_MUESTRAS) % MAX_MUESTRAS;
        const muestra = this.muestras[indice];
        const x = areaX + (areaAncho * i) / Math.max(total - 1, 1);
        const y = areaY + areaAlto - (areaAlto * muestra[serie.clave]) / max;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Eje de tiempo ──────────────────────────────────────────────
    const primero = this.muestras[(this.indiceMuestras - total + MAX_MUESTRAS) % MAX_MUESTRAS];
    const ultimo = this.muestras[this.ultimoIndice()];
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${(primero.tick / 60).toFixed(0)}s`, areaX, alto - 12);
    const textoFin = `${(ultimo.tick / 60).toFixed(0)}s`;
    ctx.fillText(textoFin, areaX + areaAncho - ctx.measureText(textoFin).width, alto - 12);
  }

  /** Saca el gráfico del DOM. */
  destruir() {
    this.canvas.remove();
  }
}
