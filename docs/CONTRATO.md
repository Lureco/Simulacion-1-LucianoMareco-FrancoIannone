# Contrato de Datos Compartidos

> **T08.** Las clases que comparten los dos tienen que estar acordadas ANTES de
> implementarlas. Este documento es esa acuerdo.
>
> **Regla de oro:** quien define una clase compartida la entrega temprano y el
> otro la consume **sin modificarla sin avisar**. Si algo no cierra, se avisa
> en la reunión de sincronización y se cambia acá primero.

---

## 1 · `Entity` — `src/entities/entity.js` (P2)

Clase base de todo ser vivo. La define Franco y la consumen herbívoros,
depredadores y, más adelante, las crías.

### Campos

| Campo | Tipo | Unidad | Significado |
|---|---|---|---|
| `tipo` | `number` | — | `ESPECIE.HERBIVORO` / `ESPECIE.PREDADOR` |
| `x` | `number` | celdas | Posición horizontal (float) |
| `y` | `number` | celdas | Posición vertical (float) |
| `energia` | `number` | — | Energía actual |
| `edad` | `number` | ticks | Antigüedad en ticks de simulación |
| `velocidad` | `number` | celdas/s | Velocidad base |
| `dirX`, `dirY` | `number` | — | Rumbo normalizado (longitud ≈ 1) |
| `vivo` | `boolean` | — | `false` cuando la entidad fue liberada |
| `estado` | `string` | — | Estado de la IA (`'vago'`, `'comiendo'`, …) |

### Getters

| Getter | Devuelve | Uso |
|---|---|---|
| `celdaX` | `number` entero | Índice de celda en X (para queries a la grilla) |
| `celdaY` | `number` entero | Índice de celda en Y |
| `offsetX` | `number` en [0,1) | Fracción dentro de la celda |
| `offsetY` | `number` en [0,1) | Fracción dentro de la celda |

### Métodos

| Método | Firma | Contrato |
|---|---|---|
| `actualizar` | `(dt, ctx) => void` | Avanza la entidad un paso. **Nunca** recibe el `dt` del frame, sino el del timestep fijo. |
| `reiniciar` | `() => void` | Deja la entidad como recién salida del pool, sin reasignar el objeto. |
| `celda` | `() => number` | Índice plano `y * ancho + x` de su celda actual. |

### Invariantes

1. `vivo === false` ⇒ la entidad **no está** en el `EntityManager` ni en el
   Spatial Hash. Nadie la consulta.
2. `dirX² + dirY² ≈ 1` salvo que la entidad esté parada.
3. `edad` solo crece (ticks), nunca se asigna a mano salvo al crear.
4. La entidad **no conoce** el terreno, la grilla ni el render. Habla con el
   mundo a través de `ctx` (el contexto de simulación).

---

## 2 · `Grid` — `src/world/grid.js` (P1) — *PENDIENTE*

Todavía no está escrita. Propuesta de Luciano a discutir en la reunión:

```js
class Grid {
  constructor(ancho, alto);

  // Capas contiguas (índices paralelos: idx = y * ancho + x)
  terreno: Uint8Array;   // 0 = AGUA, 1 = ARENA, 2 = TIERRA
  planta:  Uint8Array;   // 0 = NADA, 1 = SEMILLA, 2 = JOVEN, 3 = ADULTA, 4 = MUERTA
  ocupante: Int32Array;  // id de entidad por celda, -1 = libre

  esAgua(x, y): boolean;
  esArena(x, y): boolean;
  esTierra(x, y): boolean;
  esBorde(x, y): boolean;
  estaLibre(x, y): boolean;   // sin entidad
}
```

**Lo que P2 necesita de la `Grid`** (y por lo tanto debe estar garantizado):

- Poder preguntar el **tipo de terreno** de una celda → para penalizar
  energía al cruzar arena/agua (T40, T49).
- Poder preguntar si una celda está **libre** → para decidir dónde nace una
  cría (T47).
- Poder **ocupar y liberar** celdas → `ocupante[idx] = id` / `= -1`.

**Regla:** P2 **no** escribe en `terreno` ni en `planta`. Solo lee, y escribe
únicamente en `ocupante`.

---

## 3 · `Celda` — `src/world/cell.js` (P1) — *PENDIENTE*

Constantes de tipo de terreno y de estado de planta, en un solo lugar:

```js
export const TERRENO = { AGUA: 0, ARENA: 1, TIERRA: 2 };
export const PLANTA = { NADA: 0, SEMILLA: 1, JOVEN: 2, ADULTA: 3, MUERTA: 4 };
```

Además de las constantes, P2 necesita **nombres legibles** para el HUD y el
log de depuración: `nombreTerreno(tipo)` y `nombrePlanta(tipo)`.

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
