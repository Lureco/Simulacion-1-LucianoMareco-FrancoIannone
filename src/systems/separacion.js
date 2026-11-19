/**
 * src/systems/separacion.js — Separación estilo boids
 * ===================================================
 *
 * Los bichos se amontonan cuando muchos convergen en la misma franja de agua
 * o en el mismo parche de comida. Acá se calcula un **steering de separación**:
 * cada entidad se aleja de los vecinos de su **misma especie** que tiene dentro
 * de `CONFIG.percepcion.radioSeparacion`.
 *
 * La fuerza de cada vecino crece al acercarse (máximo cuando está encima) y se
 * desvanece en el borde del radio, así un bicho lejano apenas inclina el rumbo
 * y uno muy cercano puede llegar a invertirlo. Se suma al rumbo que decidió la
 * IA y se normaliza: las prioridades (huir, cazar, comer) se conservan porque
 * la separación nunca cambia la velocidad ni detiene a la entidad.
 *
 * ⚠️ Se llama DESPUÉS de `pensar()` y ANTES de `mover()`. El hash que se
 * consulta es el que se reconstruyó al cierre del tick anterior (T24), así que
 * las posiciones son las del estado observable del mundo en ese momento.
 * Regla D9: sin `new` en el bucle; el array de vecinos se reutiliza.
 */

/**
 * Array reusable para las consultas de separación (no mezclarlo con el de
 * `perception.js`: `pensar()` todavía puede estar usándolo).
 * @param {object} ctx
 * @returns {number[]}
 */
function vecinosDe(ctx) {
  if (ctx._vecinosSeparacion === undefined) ctx._vecinosSeparacion = [];
  return ctx._vecinosSeparacion;
}

/**
 * Ajusta el rumbo de `id` para alejarlo de sus vecinos de especie.
 * No consume azar: es determinista para una misma seed y estado del mundo.
 *
 * @param {number} id
 * @param {object} ctx Contexto con `entidades`, `hash` y `config`.
 */
export function aplicarSeparacion(id, ctx) {
  const cfg = ctx.config?.percepcion;
  const radio = cfg?.radioSeparacion ?? 0;
  const fuerzaMaxima = cfg?.fuerzaSeparacion ?? 0;
  if (!ctx.hash || radio <= 0 || fuerzaMaxima <= 0) return;

  const a = ctx.entidades;
  // Quien se detuvo a comer/beber/reproducirse no se mueve: no lo empujamos.
  if (a.dirX[id] === 0 && a.dirY[id] === 0) return;

  const x = a.x[id];
  const y = a.y[id];
  const vecinos = ctx.hash.consultar(x, y, radio, vecinosDe(ctx), id);
  const radio2 = radio * radio;
  let sepX = 0;
  let sepY = 0;

  for (let i = 0; i < vecinos.length; i++) {
    const otro = vecinos[i];
    if (a.vivo[otro] !== 1) continue;
    if (a.moribundo && a.moribundo[otro] === 1) continue;
    // Solo se separa de su propia especie: la presa se caza y el depredador
    // se esquiva con la IA de huida, no con este steering.
    if (a.tipo[otro] !== a.tipo[id]) continue;

    const dx = x - a.x[otro];
    const dy = y - a.y[otro];
    const d2 = dx * dx + dy * dy;
    if (d2 <= 1e-8 || d2 >= radio2) continue;

    const d = Math.sqrt(d2);
    const fuerza = ((radio - d) / radio) * fuerzaMaxima;
    sepX += (dx / d) * fuerza;
    sepY += (dy / d) * fuerza;
  }

  const separacion = Math.hypot(sepX, sepY);
  if (separacion <= 1e-8) return;

  const rumboX = a.dirX[id] + sepX;
  const rumboY = a.dirY[id] + sepY;
  const longitud = Math.hypot(rumboX, rumboY);
  if (longitud <= 1e-8) return;

  a.dirX[id] = rumboX / longitud;
  a.dirY[id] = rumboY / longitud;
}
