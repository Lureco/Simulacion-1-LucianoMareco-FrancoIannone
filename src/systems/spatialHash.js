/**
 * src/systems/spatialHash.js — Spatial Hash (T24)
 * ==============================================
 *
 * Indexa las entidades por celda para que el vecindario sea **O(vecinos)**
 * y no O(n²). Es la pieza más importante para que la simulación aguante.
 *
 * Diseño:
 * - El mundo se divide en celdas de `celdaHash` × `celdaHash` celdas.
 * - Cada celda del hash guarda la lista de entidades que la cruzan.
 * - `consultar()` devuelve un **array reutilizable** (el que le pasa el
 *   llamador), para no generar basura en cada búsqueda de vecinos.
 */

export class SpatialHash {
  /**
   * @param {number} ancho Ancho del mundo en celdas.
   * @param {number} alto Alto del mundo en celdas.
   * @param {number} celdaHash Tamaño del bucket, en celdas del mundo.
   */
  constructor(ancho, alto, celdaHash) {
    this.ancho = ancho;
    this.alto = alto;
    this.celdaHash = celdaHash;
    this.celdasX = Math.ceil(ancho / celdaHash);
    this.celdasY = Math.ceil(alto / celdaHash);

    /** @type {object[][]} Un array por bucket. Los arrays se reutilizan. */
    this.buckets = new Array(this.celdasX * this.celdasY);
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i] = [];
    }
  }

  /**
   * Índice del bucket para una celda del mundo.
   * @param {number} cx
   * @param {number} cy
   * @returns {number}
   */
  indiceBucket(cx, cy) {
    const bx = Math.min(this.celdasX - 1, Math.max(0, Math.floor(cx / this.celdaHash)));
    const by = Math.min(this.celdasY - 1, Math.max(0, Math.floor(cy / this.celdaHash)));
    return by * this.celdasX + bx;
  }

  /** Vacía todos los buckets (sin reasignar los arrays). */
  limpiar() {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i].length = 0;
    }
  }

  /**
   * Inserta una entidad en su bucket.
   * @param {object} entidad
   */
  insertar(entidad) {
    this.buckets[this.indiceBucket(entidad.celdaX, entidad.celdaY)].push(entidad);
  }

  /**
   * Reconstruye el hash completo desde una lista de entidades.
   * @param {object[]} entidades
   */
  reconstruir(entidades) {
    this.limpiar();
    for (let i = 0; i < entidades.length; i++) {
      this.insertar(entidades[i]);
    }
  }

  /**
   * Busca las entidades dentro de un radio (en celdas).
   *
   * @param {number} x Centro en X (celdas).
   * @param {number} y Centro en Y (celdas).
   * @param {number} radio Radio en celdas.
   * @param {object[]} salida Array reutilizable donde se acumulan los
   *   resultados. Se vacía antes de empezar.
   * @param {object} [excluir] Entidad a no incluir en el resultado.
   * @returns {object[]} La misma array `salida`.
   */
  consultar(x, y, radio, salida, excluir) {
    salida.length = 0;

    const minX = Math.max(0, Math.floor(x - radio));
    const maxX = Math.min(this.ancho - 1, Math.ceil(x + radio));
    const minY = Math.max(0, Math.floor(y - radio));
    const maxY = Math.min(this.alto - 1, Math.ceil(y + radio));

    const bxMin = Math.floor(minX / this.celdaHash);
    const bxMax = Math.floor(maxX / this.celdaHash);
    const byMin = Math.floor(minY / this.celdaHash);
    const byMax = Math.floor(maxY / this.celdaHash);

    const radio2 = radio * radio;

    for (let by = byMin; by <= byMax; by++) {
      for (let bx = bxMin; bx <= bxMax; bx++) {
        const bucket = this.buckets[by * this.celdasX + bx];
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          if (e === excluir) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= radio2) {
            salida.push(e);
          }
        }
      }
    }

    return salida;
  }

  /**
   * Cantidad total de entidades indexadas.
   * @returns {number}
   */
  get total() {
    let n = 0;
    for (let i = 0; i < this.buckets.length; i++) {
      n += this.buckets[i].length;
    }
    return n;
  }
}
