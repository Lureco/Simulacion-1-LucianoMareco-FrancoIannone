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

- Las entidades se reciclan **reutilizando `id`**: no hay un objeto por animal
  (ver D13). Cuando una muere, su `id` vuelve a la lista de libres.
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

## D13 · Entidades con arrays tipados (SoA) — refactor

**Contexto.** Facundo (profesor) observó que con muchos animales un diseño
orientado a objetos "se pone lento" y recomendó guardar los datos en arrays
tipados. Franco lo resumió: *"sigo usando clases, pero los datos vienen de
arrays tipados"*.

**Decisión (implementada):** los datos de las entidades usan el patrón
**Structure of Arrays (SoA)**:

- `src/entities/entityManager.js` guarda **un array tipado por propiedad**
  (`Float32Array x`, `y`, `dirX`, `dirY`, `energia`, `velocidad`; `Int32Array`
  `edad`, `tipo`, `ticksParaGiro`; `Uint8Array` `estado`, `vivo`).
- La identidad de un bicho es su **`id`** (entero), que indexa todos los arrays.
- El **comportamiento** sigue en **clases**, una por **especie** (no por
  animal): `src/entities/entity.js` (`Especie`), `herbivore.js`, `predator.js`
  y el registro `especies.js`. `especie.pensar(id, dt, ctx)` lee/escribe los
  arrays vía `ctx.entidades`.
- El reciclado ya no es un pool de objetos: es una **lista de `id` libres**.
- El `SpatialHash` indexa **ids** y lee posiciones del almacén.
- Los `Float32Array` pierden algo de precisión (p. ej. `1.2` → `1.200000047`):
  es esperable y determinista; los tests comparan con tolerancia.

**Por qué:** recorrer las posiciones de 5000 animales es recorrer 5000 floats
contiguos en memoria (buena localidad de caché, cero basura por entidad), en
vez de saltar entre 5000 objetos con punteros. Es la base para escalar a mapas
grandes y a más especies (F8) sin que el recolector se ahogue.

**Archivos eliminados:** `src/systems/pool.js` (reemplazado por la lista de
`id` libres).

---

## D14 · IA del herbívoro: necesidades, comer/beber y muerte (F4)

**Contexto.** El hito F4 pide que el herbívoro *viva*: que tenga necesidades,
decida por prioridad, coma, beba, se reproduzca y muera. Y que todo eso se vea
en pantalla, sin romper el determinismo ni el presupuesto de `new` por tick.

**Decisión (implementada):**

1. **Necesidades normalizadas.** `src/systems/needs.js` actualiza por tick
   `hambre`, `sed` y `deseoRepro` en `[0, 1]`. `energia` se mantiene en
   `[0, energiaMaxima]` (100) y `edad` en **ticks** (no se normalizan: son
   magnitudes con unidad propia, normalizarlas solo agregaría una división).
2. **Decisión por prioridad** (T35), en `herbivore.js`, con `if` encadenados y
   *fallthrough*:
   `hambre crítica > sed crítica > reproducirse > explorar`. No hay puntajes:
   el orden del código **es** la política.
3. **Comer** (T37) no toca la capa de plantas directamente: el herbívoro llama
   `comerPlanta(ctx, indice)` de `src/systems/plantGrowth.js`, que devuelve la
   energía y baja el estado de la planta (o la borra). Así **P2 nunca escribe
   `planta` ni `terreno`**: todo pasa por la API de vegetación.
4. **Beber** (T38) usa una celda de agua adyacente: con `radioBeber` un poco
   mayor que 1 el animal bebe **desde la orilla**, sin tener que meterse.
5. **Navegación de largo alcance sin búsquedas grandes.** `terrain.js` calcula
   **una vez** (el terreno no cambia) dos campos por BFS multi-fuente:
   `aguaDist/aguaDirX/aguaDirY` (hacia el agua) y
   `tierraDist/tierraDirX/tierraDirY` (hacia la tierra). Un herbívoro sediento
   que no ve agua sigue el campo; uno varado en agua o arena vuelve a tierra
   (donde está la comida) leyendo **2 bytes por tick**.
6. **Altas y bajas diferidas.** Nacer y morir dentro del bucle de entidades
   rompería el recorrido (y el determinismo): `src/systems/eventos.js` acumula
   `ctx._nacimientos` (pares `tipo, indice`) y `ctx._muertos` (ids), y
   `simulacion.js` los aplica **después** del bucle, en orden fijo.
7. **Causas de muerte separadas y observables** (T45, adelantado de F5):
   `causaDeMuerte` clasifica `hambre`, `sed` o `vejez`; `ctx.muertesPorCausa`
   las cuenta y el HUD las muestra.

**Por qué:** separar "percibir" (`perception.js`), "necesitar" (`needs.js`) y
"decidir" (`herbivore.js`) deja la lógica testeable en unidades chicas, y el
determinismo queda garantizado porque ninguna de esas rutas usa `Math.random()`
ni `Date.now()`: todo sale del PRNG del `ctx`.

**Nota de balance (queda para F7):** con la comida saturando el mapa
(`probExpansion` llena casi toda la tierra), el crecimiento poblacional es
exponencial hasta el tope `maxEntidades`; la única muerte frecuente es la vejez.
La regulación por competencia es una tarea de balance posterior, no de F4.

---

## D15 · Unificación con `main` e IA del carnívoro (F5)

**Contexto.** El repo tenía **dos historias huérfanas** con el mismo árbol en
F3: `main` (versión OOP, un objeto por bicho, con la UI y la IA de las dos
especies) y `master` (refactor SoA + IA del herbívoro). Había que dejar una
sola rama con todo.

**Decisión (implementada):**

1. **Base `master` (SoA).** El refactor SoA (D13) es el que pidió el profesor,
   así que la arquitectura que manda es la de `master`; de `main` se **trae lo
   que faltaba**, no al revés.
2. **Historia unificada.** `unificacion` arranca de `master` y hace un merge
   `-s ours` de `origin/main`: el árbol queda intacto (base SoA) pero las dos
   historias quedan emparentadas, así que los merges futuros ya tienen base.
3. **UI portada de `main`** (T33, T55, T56): `src/ui/controles.js` (pausa y
   1×/2×/4×), `src/ui/grafico.js` (poblaciones), `src/ui/leyenda.js`,
   `src/render/paleta.js` y `src/render/necesidadesRenderer.js`. Se adaptaron a
   los arrays tipados: la vista de necesidades recorre `vivos` (ids) y expone
   una **vista plana** para que la leyenda no sepa de SoA.
4. **IA del carnívoro reescrita en SoA** (`predator.js`, F5/T43-T44): prioridad
   `hambre crítica > sed > reproducir > explorar`, detección de presa
   (`buscarPresa` sobre el spatial hash), persecución con timeout
   (`segundosPersecucion`, en arrays `presa`/`ticksPersecucion`), ataque a
   `radioAtaque` y comida de la presa. El carnívoro es más rápido pero menos
   eficiente: cada presa cuesta energía.
5. **Depredación como causa de muerte** (T45): `CAUSA_MUERTE.DEPREDADO`, contada
   en `ctx.muertesPorCausa.depredado`. `anotarMuerte` es **idempotente** (flag
   `moribundo`) para que dos cazadores no cuenten la misma presa dos veces ni
   se sume otra causa en el mismo tick.
6. **El herbívoro huye** (T43) con **prioridad absoluta** (un herbívoro muerto
   no come) y ambos **mantienen distancia al agua al deambular** (T38), leyendo
   el campo BFS de `terrain.js`.
7. **Lo que NO se trajo de `main`:** los módulos OOP que `master` ya reemplazó
   (`death.js`, `mapaAgua.js`, `reproduction.js`, `pool.js`, `tests/needs.test.js`
   y los scripts de depuración viejos). Traerlos habría dejado código muerto y
   duplicado; su comportamiento ya está cubierto por `needs.js`, `eventos.js`,
   los campos BFS de `terrain.js` y `tests/cadenaAlimenticia.test.js`.

**Por qué:** una sola rama que corre, con la arquitectura que pidió el profesor
y todo lo que aportaba la versión anterior, sin arrastrar dos implementaciones
de lo mismo.

**Verificación:** `tests/cadenaAlimenticia.test.js` cubre caza, no-duplicación de
la presa, huida y T38; `scripts/simular.mjs` muestra las muertes `d` por
depredación; y en pantalla se ven los estados `persiguiendo` / `huyendo`.

---

## Registro de acuerdos pendientes

| # | Tema | Quién | Estado |
|---|---|---|---|
| 1 | API exacta de `camera.js` | P1 + P2 | Pendiente de reunión |
| 2 | Capas de la grilla y sus tipos | P1 | ✅ Resuelto (D5) |
| 3 | Interfaz `MundoAPI` para desacoplar los animales del terreno | P2 propone | Parcial: la `Grid` ya existe; ver CONTRATO §5 |
