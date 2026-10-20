/**
 * src/systems/death.js — Muerte por causas separadas (T45)
 * =========================================================
 *
 * Cada causa de muerte se registra **por separado**, para que se pueda
 * observar en pantalla y en el log por qué murió cada entidad (GDD §10):
 *
 *   HAMBRE    → se quedó sin comida demasiado tiempo
 *   SED       → se quedó sin agua demasiado tiempo
 *   ENERGIA   → se agotó (hambre + sed + movimiento)
 *   EDAD      → llegó a la edad máxima
 *   DEPREDADO → lo cazó un depredador
 *
 * **Por qué la muerte se aplaza al final del tick:** si una entidad muere
 * mientras se la está cazando y se la borra del array en el momento, el
 * bucle de entidades se corre y salta una. Peor: el orden de las operaciones
 * cambiaría según quién murió primero, y la simulación dejaría de ser
 * determinista. Por eso la muerte se **marca** durante el tick (`porMorir`)
 * y se aplica al final, siempre en el mismo orden.
 *
 * Sin `new` en el bucle: los contadores de causa viven en el contexto.
 */

/** Causas de muerte. */
export const CAUSA = {
  HAMBRE: 'hambre',
  SED: 'sed',
  ENERGIA: 'energia',
  EDAD: 'edad',
  DEPREDADO: 'depredado',
};

/**
 * Inicializa (o reinicia) los contadores de muertes por causa.
 * @param {object} ctx
 */
export function reiniciarMuertes(ctx) {
  if (ctx.muertes === undefined) {
    ctx.muertes = { hambre: 0, sed: 0, energia: 0, edad: 0, depredado: 0, total: 0 };
    return;
  }
  ctx.muertes.hambre = 0;
  ctx.muertes.sed = 0;
  ctx.muertes.energia = 0;
  ctx.muertes.edad = 0;
  ctx.muertes.depredado = 0;
  ctx.muertes.total = 0;
}

/**
 * Determina por qué debe morir una entidad, por sus necesidades.
 *
 * La prioridad de las causas es fija (para que sea determinista):
 *   1 · Edad
 *   2 · Hambre
 *   3 · Sed
 *   4 · Energía agotada
 *
 * Hambre y sed solo matan si llegan al máximo (1.0): una entidad hambrienta
 * pero alimentada todavía aguanta, como en la vida real.
 *
 * @param {object} entidad
 * @param {object} ctx
 * @returns {string|null} Una de `CAUSA`, o `null` si sigue viva.
 */
export function causaDeMuerte(entidad, ctx) {
  const n = entidad.necesidades;
  const cfg = ctx.config;

  if (entidad.edad >= cfg.entidades.edadMaximaTicks) return CAUSA.EDAD;
  if (n.hambre >= 1) return CAUSA.HAMBRE;
  if (n.sed >= 1) return CAUSA.SED;
  if (n.energia <= cfg.entidades.energiaMinima) return CAUSA.ENERGIA;

  return null;
}

/**
 * Marca una entidad para morir. No la borra todavía: el borrado real
 * ocurre en `aplicarMuertes()`, al final del tick.
 * @param {object} entidad
 * @param {string} causa Una de `CAUSA`.
 */
export function marcarMuerte(entidad, causa) {
  entidad.porMorir = causa;
}

/**
 * Elimina las entidades que deben morir. Corre al final del tick.
 * @param {object} ctx
 * @returns {number} Cuántas murieron en este tick.
 */
export function aplicarMuertes(ctx) {
  const manager = ctx.entidades;
  if (manager === null) return 0;

  let muertas = 0;
  const vivas = manager.vivas;

  // Se recorre hacia atrás porque `eliminar()` quita elementos del array.
  for (let i = vivas.length - 1; i >= 0; i--) {
    const entidad = vivas[i];

    // Ya marcada (por un depredador): la causa ya está decidida.
    let causa = entidad.porMorir;
    if (causa === null || causa === undefined) {
      causa = causaDeMuerte(entidad, ctx);
    }
    if (causa === null) continue;

    // `eliminar()` ya se encarga de marcar `vivo = false` y de sacar la
    // entidad del manager. Si se marcara acá antes, `eliminar()` cortaría
    // con su guarda `if (!entidad.vivo) return;` y la entidad muerta
    // quedaría en el array: se contaría como muerte en cada tick.
    manager.eliminar(entidad);

    if (ctx.muertes !== undefined) {
      ctx.muertes[causa]++;
      ctx.muertes.total++;
    }
    muertas++;
  }

  return muertas;
}
