# Decisiones Técnicas

> Documento vivo. Se actualiza en cada reunión de sincronización.
> Formato: una decisión, el porqué, y qué se descarta si nos equivocamos.

---

## D1 · Stack

| Elemento | Decisión | Porqué |
|---|---|---|
| Lenguaje | JavaScript ES2022, módulos ES nativos | Pedido en la consigna; Vite no necesita transpilar nada extra. |
| Render | **PixiJS v8** (WebGL, fallback Canvas) | Sprites, batching y `tint` gratis. Escala a muchas entidades. |
| Bundler | **Vite** | `npm run dev` con HMR; build a estáticos sin configuración. |
| Tests | **Vitest** | Corre los mismos tests que el dev server, cero config extra. |
| Calidad | **ESLint 9** (flat config) + **Prettier** | Formato uniforme entre los dos, se rompe solo en el hook. |
| Ruido | **Implementación propia** de Value/Perlin Noise | Requisito de la Unidad 1. Sin librerías externas. |
| Git | Ramas por fase, commits chicos | Trazabilidad + revisión cruzada real. |

**Descartado:** React/Phaser (no aportan para un canvas de muchas entidades),
Three.js (pesado y orientado a 3D). Canvas 2D puro se descarta por performance
con muchas entidades.

### Aviso sobre PixiJS v8

La v8 cambió dos cosas que rompen código escrito para v7:

- `app.init()` es **asíncrono** → hay que `await app.init({...})`.
- El canvas se accede como **`app.canvas`** (en v7 era `app.view`).

Revisamos siempre `node_modules/pixi.js` antes de asumir una API.

---

## D2 · Tamaño del mundo y resolución

| Parámetro | Valor | Nota |
|---|---|---|
| Mundo | **256 × 256 celdas** | 65.536 celdas. Conforma con `Uint8Array` sin problema. |
| Tamaño de celda | **8 px** | Mundo de 2048 × 2048 px. |
| Resolución de ventana | 1280 × 720 | El canvas se ajusta a la ventana (`resizeTo: window`). |
| `devicePixelRatio` | El del sistema | `autoDensity: true` para que se vea nítido en pantallas HiDPI. |

**Por qué 256×256 y no más:** con 8 px de celda, 256 celdas dan 2048 px —
suficiente para que el mundo sea más grande que la ventana (y justificar que
haga falta cámara) sin que el mapa sea inmanejable de renderizar. Si el
rendimiento se queda corto, se agranda `tileSize`, no el mapa.

**Descartado:** 512×512 (4× la memoria de la grilla y el costo de
regeneración) y 128×128 (entra entero en pantalla y la cámara no tiene
sentido).

---

## D3 · Cámara (T53 — adelantada por P2)

**Decisión:** la cámara se implementa en `src/render/camera.js` y la adelanta
Franco (P2) en la tanda de base de entidades, porque sin ella el mundo de
2048 px no entra en la ventana de 1280 px y solo se ve un recorte fijo.

**Estado:** ⚠️ **co-owned — P2 la escribe y P1 la revisa.** Se acuerda su API
exacta en la próxima reunión. Si P1 prefiere otra forma, se cambia el archivo
entero: no tiene dependientes fuera de `entityRenderer`.

Capacidades mínimas: pan (arrastrar), zoom (rueda) y límites al borde del
mundo.

---

## D4 · Semilla

- Semilla por defecto: **1337** (`CONFIG.mundo.seedPorDefecto`).
- La semilla es un **número de 32 bits** que se pasa al PRNG.
- **Todo** el azar de la simulación sale de un PRNG con esa semilla.
  `Math.random()` y `Date.now()` están **prohibidos** dentro de la simulación
  y ESLint lo bloquea con `no-restricted-properties`.

**Consecuencia:** misma seed + mismos parámetros ⇒ misma simulación, celda a
celda. Es un requisito del GDD, no una comodidad.

---

## D5 · Estructura de datos de la grilla (T19-T21)

**Decisión (implementada en `src/world/grid.js`):** la grilla es
**memoria contigua**, no un array de objetos. Cada capa es un typed array y
todas comparten el mismo índice plano `y * ancho + x`:

| Capa | Tipo | Contenido | Quién escribe |
|---|---|---|---|
| `terreno` | `Uint8Array` | `TERRENO.*` (0 agua, 1 arena, 2 tierra) | P1 |
| `planta` | `Uint8Array` | `PLANTA.*` (F3) | P1 |
| `ocupante` | `Int32Array` | id de entidad, `-1` = libre | P2 |
| `altura` | `Float32Array` | altura normalizada 0..1 | P1 |

**Consultas (T21):** `esAgua`, `esArena`, `esTierra`, `esBorde`, `estaLibre`,
`dentro`, `terrenoEn`. Fuera del mundo el terreno se reporta como `AGUA` para
que los vecindarios del borde no lean basura.

**Ocupación (contrato §2):** P2 escribe `ocupante` solo con `ocupar`/`liberar`.
La verificación (id + límites) vive en la grilla, no en cada llamador.

**Altura aparte de terreno:** guardamos la altura cruda en `altura` además del
tipo clasificado. Sirve para (a) sombrear el render y (b) testear la
clasificación sin volver a correr el ruido.

---

## D6 · Valores por celda (T13)

**Decisión (implementada en `src/world/terrain.js`):** la altura sale de un
**Value Noise fractal (fBm)** y se clasifica por umbrales.

| Terreno | Descripción | Valor | Umbral de altura |
|---|---|---|---|
| `AGUA` | Baja, no habitable sin costo extra | 0 | `altura < 0.32` |
| `ARENA` | Transición, consumo energético extra | 1 | `0.32 ≤ altura < 0.38` |
| `TIERRA` | Habitable, es donde crece la vegetación | 2 | `altura ≥ 0.38` |

Los umbrales viven en `CONFIG.terreno`, no hardcodeados. Con la seed 1337 el
mapa queda ~32% agua / 13% arena / 55% tierra.

**Caída de borde (`caidaBorde = 0.42`):** la altura se resta con una parábola
según la distancia al centro, así el borde tiende a agua y el mapa forma
**islas/continentes** en vez de costas cortadas a cuchillo (T18). Con
`caidaBorde = 0` el terreno es ruido plano.

**Balance elegido por prueba:** con caída agresiva (0.85) el mapa quedaba 65-76%
agua y la vida no tenía dónde vivir; con 0.42 la tierra es mayoría. Los cinco
seed de prueba (`1337, 9001, 42, 2024, 7`) dan entre 35% y 55% de tierra.

---

## D11 · Ruido: Value Noise, no Perlin (T11/T12)

**Decisión:** se implementa **Value Noise 2D** con curva `fade` (smootherstep)
+ **fBm** de 5 octavas (`src/core/noise.js`). **Se descarta Perlin.**

**Por qué:** el terreno es **decorativo y procedural** (riesgo "perder el tiempo
en el mapa perfecto", TAREAS §10). Value Noise interpolado con smootherstep da
gradientes suaves y sin aristas, es más corto de entender y de testear, y con
fBm produce la misma sensación de relieve que Perlin para este caso de uso.

**Determinismo:** el ruido es una **función pura** de `(x, y, seed)` basada en
el hash FNV-1a (`hashInts`). No consume el PRNG de la simulación, así generar o
regenerar el mapa no desplaza la secuencia de azar de los animales.

**Costo:** generar 256×256 tarda ~30-60 ms (medido con `scripts/verTerreno.mjs`).
Se hace una vez al arrancar y una vez por pulsación de `R`, fuera del bucle.

---

## D7 · Movimiento y coordenadas

- La **simulación** trabaja en **celdas** (unidades de mundo).
- El **render** trabaja en **píxeles** (multiplicando por `CONFIG.mundo.tileSize`).
- La posición de una entidad es un **float en celdas**, no un entero:
  `x = 10.4` significa "celda 10, offset 0.4". De ahí salen
  `celdaX`/`celdaY` (enteros) y `offsetX`/`offsetY` (fracción) por getters.
- Velocidades en **celdas por segundo** (`CONFIG.herbivoro.velocidad = 1.2`).

**Por qué float y no "celda entera + offset":** un solo float es más simple de
integrar y de interpolar; los getters dan la vista discreta cuando haga falta
(hacer queries a la grilla).

---

## D8 · Timestep fijo

- La simulación avanza en pasos fijos de **1/60 s** (`CONFIG.tiempo.pasoFijo`).
- `requestAnimationFrame` solo **acumula** tiempo real; nunca se usa el `dt`
  variable del frame para mover entidades.
- Máximo **5 pasos por frame** (`CONFIG.tiempo.maxPasosPorFrame`): si la
  pestaña se congela, la simulación no entra en un spiral of death.

**Por qué:** con `dt` variable, la simulación depende del framerate y deja de
ser reproducible. Y el test de determinismo (T42) no puede pasar.

---

## D9 · Sin `new` en el bucle

- Las entidades se crean y se reciclan con un **pool** (`src/systems/pool.js`).
- El render usa **sprites con `tint`**, no `Graphics` por celda ni por frame.
  La textura base se genera **una sola vez** al arrancar.
- El Spatial Hash devuelve un **array reutilizable** para las consultas, para
  no generar basura en cada búsqueda de vecinos.

---

## D10 · Formato y hook

- Prettier con `printWidth: 100`, comillas simples, punto y coma.
- ESLint 9 en flat config. Regla extra del proyecto:
  `no-restricted-properties` bloquea `Math.random()` y `Date.now()`.
- Hook `pre-commit` (husky) corre **`lint` + `test`**. Un commit que rompe
  el lint no entra.

---

## D12 · Render del terreno con pocos sprites (T15)

**Decisión (implementada en `src/render/terrainRenderer.js`):** el mapa entero
se pinta **una sola vez** en un canvas offscreen de **1 píxel por celda** y se
sube como **una única textura**. En pantalla es **un único `Sprite`** escalado
a `tileSize`, con `scaleMode: 'nearest'` para que quede nítido al hacer zoom.

**Por qué:** la regla del proyecto prohíbe `Graphics` por celda o por frame
(65.536 celdas serían 65.536 objetos). Un sprite de 1 píxel-mapa no rompe el
batch de Pixi y cuesta lo mismo con 256 celdas que con 4096.

**Sombreado:** cada celda se colorea por tipo modulado por la `altura` (más
alto = más claro) más un jitter mínimo determinista (derivado solo de `x, y`).
Da relieve sin generar una sola textura extra.

**Culling (T64):** pendiente. Con un solo sprite no aplica el culling por
celda; si el mundo crece mucho se evaluará partir el mapa en *chunks*.

---

## Registro de acuerdos pendientes

| # | Tema | Quién | Estado |
|---|---|---|---|
| 1 | API exacta de `camera.js` | P1 + P2 | Pendiente de reunión |
| 2 | Capas de la grilla y sus tipos | P1 | ✅ Resuelto (D5) |
| 3 | Interfaz `MundoAPI` para desacoplar los animales del terreno | P2 propone | Parcial: la `Grid` ya existe; ver CONTRATO §5 |
