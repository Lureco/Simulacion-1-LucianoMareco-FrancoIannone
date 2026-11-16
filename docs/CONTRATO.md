# Contrato de Datos Compartidos

> **T08.** Las clases que comparten los dos tienen que estar acordadas ANTES de
> implementarlas. Este documento es esa acuerdo.
>
> **Regla de oro:** quien define una clase compartida la entrega temprano y el
> otro la consume **sin modificarla sin avisar**. Si algo no cierra, se avisa
> en la reunión de sincronización y se cambia acá primero.

---

## 1 · Entidades — SoA en `src/entities/entityManager.js` (P2) — ✅ REFACTOR (D13)

> **Cambio de contrato.** La clase `Entity` (un objeto por animal) se reemplazó
> por un diseño **SoA** (arrays tipados), a pedido del profesor (ver D13). La
> identidad de un bicho es su **`id`** (entero); sus datos viven en arrays
> paralelos. El **comportamiento** sigue en clases, **una por especie**.

### Datos (`EntityManager`, arrays indexados por `id`)

| Array | Tipo | Unidad | Significado |
|---|---|---|---|
| `tipo` | `Int32Array` | — | `ESPECIE.HERBIVORO` / `ESPECIE.PREDADOR` |
| `x`, `y` | `Float32Array` | celdas | Posición (float) |
| `energia` | `Float32Array` | — | Energía actual |
| `edad` | `Int32Array` | ticks | Antigüedad en ticks |
| `velocidad` | `Float32Array` | celdas/s | Velocidad base (copiada de la especie al crear) |
| `dirX`, `dirY` | `Float32Array` | — | Rumbo normalizado (longitud ≈ 1) |
| `ticksParaGiro` | `Int32Array` | ticks | Cuánto falta para volver a sortear rumbo |
| `estado` | `Uint8Array` | — | Estado de la IA (`ESTADO_IA.*`, numérico) |
| `vivo` | `Uint8Array` | — | `1` viva, `0` liberada |

### Métodos del almacén

| Método | Firma | Contrato |
|---|---|---|
| `crear` | `(tipo) => number` | Da de alta y devuelve el `id` (recicla un `id` libre si hay). |
| `eliminar` | `(id) => void` | Da de baja y libera el `id`. |
| `especie` | `(id) => Especie` | Especie de esa entidad (para `pensar`). |
| `contar` / `deTipo` | `(tipo) => number \| number[]` | Población viva por tipo. |
| `celdaX/celdaY` | `(id) => number` | Índice de celda (para queries a la grilla). |
| `offsetX/offsetY` | `(id) => number` | Fracción dentro de la celda, en `[0,1)`. |
| `celda` | `(id, ancho) => number` | Índice plano `y * ancho + x`. |
| `total` | `number` (getter) | Total de entidades vivas. |
| `version` | `number` | Sube en cada alta/baja (el render lo usa). |

### Comportamiento (`Especie`, una instancia por especie)

| Método | Firma | Contrato |
|---|---|---|
| `pensar` | `(id, dt, ctx) => void` | Decide el rumbo. Escribe en `ctx.entidades`. |
| `velocidad` | `number` | Velocidad base de la especie. |

El paso por entidad (`edad++`, `pensar`, `mover`) vive en
`src/systems/simulacion.js` (`actualizarEntidad`).

### Invariantes

1. `vivo[id] === 0` ⇒ la entidad **no está** en `vivos` ni en el Spatial Hash.
   Nadie la consulta.
2. `dirX² + dirY² ≈ 1` salvo que la entidad esté parada.
3. `edad` solo crece (ticks), nunca se asigna a mano salvo al crear.
4. La especie **no conoce** el terreno, la grilla ni el render. Habla con el
   mundo a través de `ctx` (el contexto de simulación).

---

## 2 · `Grid` — `src/world/grid.js` (P1) — ✅ IMPLEMENTADA (F1)

Implementada en `src/world/grid.js`. Capas contiguas (índices paralelos:
`idx = y * ancho + x`):

```js
class Grid {
  constructor(ancho, alto);

  terreno: Uint8Array;   // TERRENO.*   (P1 escribe)
  planta:  Uint8Array;   // PLANTA.*    (P1 escribe, F3)
  ocupante: Int32Array;  // id de entidad por celda, -1 = libre (P2 escribe)
  altura:  Float32Array; // altura normalizada 0..1 (P1 escribe)

  indice(x, y): number;
  dentro(x, y): boolean;

  terrenoEn(x, y): number;   // TERRENO.*  (fuera del mundo ⇒ AGUA)
  esAgua(x, y): boolean;
  esArena(x, y): boolean;
  esTierra(x, y): boolean;
  esBorde(x, y): boolean;
  estaLibre(x, y): boolean;   // sin entidad (fuera del mundo ⇒ false)

  ocupar(x, y, id): boolean;  // false si no estaba libre
  liberar(x, y, id): boolean; // false si la ocupaba otro id

  contarTerreno(): { agua, arena, tierra };
}
```

**Lo que P2 necesita de la `Grid`** (y ya está garantizado):

- Preguntar el **tipo de terreno** de una celda → penalizar energía al cruzar
  arena/agua (T40, T49): `terrenoEn`, `esAgua`, `esArena`, `esTierra`.
- Preguntar si una celda está **libre** → dónde nace una cría (T47):
  `estaLibre`.
- **Ocupar y liberar** celdas → `ocupar` / `liberar` (verifican id y límites).

**Regla:** P2 **no** escribe en `terreno` ni en `planta`. Solo lee, y escribe
únicamente en `ocupante`.

---

## 3 · `Celda` — `src/world/cell.js` (P1) — ✅ IMPLEMENTADA (F1)

Constantes de tipo de terreno y de estado de planta, en un solo lugar:

```js
export const TERRENO = { AGUA: 0, ARENA: 1, TIERRA: 2 };
export const PLANTA = { NADA: 0, SEMILLA: 1, JOVEN: 2, ADULTA: 3, MUERTA: 4 };
```

Además de las constantes, `nombreTerreno(tipo)` y `nombrePlanta(estado)` dan
**nombres legibles** para el HUD y el log de depuración.

---

## 4 · Necesidades — `src/systems/needs.js` (P2)

Sistema de necesidades normalizadas. **Todas en `[0, 1]`**, donde `0` es
"satisfecha" y `1` es "crítica".

| Necesidad | Significado | Umbral crítico |
|---|---|---|
| `hambre` | Necesidad de comer | `CONFIG.herbivoro.hambreCritica` |
| `sed` | Necesidad de beber | `CONFIG.herbivoro.sedCritica` |
| `deseoReproduccion` | Necesidad de reproducirse | `CONFIG.herbivoro.umbralReproduccion` |
| `energia` | Energía física | `< CONFIG.entidades.energiaMinima` ⇒ muerte |
| `edad` | Edad normalizada | `> 1` ⇒ muerte por vejez |

**Por qué normalizadas:** las dos especies pueden tener escalas distintas
(una sedienta, otra hambrienta) y al normalizar, la **misma IA por prioridad**
sirve para las dos sin código duplicado.

---

## 5 · `MundoAPI` — interfaz para desacoplar los animales del terreno

*(Propuesta de P2 — se define cuando exista la `Grid`.)*

La idea: los animales **no** tocan la `Grid` directamente. Hablan con una
interfaz mínima, para poder probarlos contra un mundo de mentira hasta que el
terreno procedural exista.

```js
interface MundoAPI {
  ancho: number;
  alto: number;
  tipoTerreno(x, y): number;   // TERRENO.*
  hayAgua(x, y): boolean;
  hayPlanta(x, y): boolean;
  estaLibre(x, y): boolean;
  celdaValida(x, y): boolean;
}
```

Implementaciones previstas:

- `MundoVacio` — lo que usamos ahora: celdas vacías, todo `TIERRA`. Permite
  desarrollar y testear los animales sin el mapa.
- `MundoProcedural` — la `Grid` de Luciano, cuando esté lista.

---

## 6 · Protocolo de cambio

1. Quien propose el cambio lo avisa **antes** de escribir código.
2. Se actualiza **este documento** en la misma rama.
3. Se toca **un solo archivo por vez** y se commitea.
4. El otro lee el diff antes de mergear (revisión cruzada, T73).
