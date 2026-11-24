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

**Culling (T64):** resuelto en F7.5. Con un solo sprite no aplica el culling por celda en el
terreno; el culling real está en `PlantRenderer.rectVisible()` (solo el rectángulo visible de la
grilla) y en `EntityRenderer.render()` (descarte por pantalla), ambos con
`CONFIG.render.margenCulling`. No hizo falta partir el mapa en *chunks* (ver T79/D18).

---

## D13 · Entidades con arrays tipados (SoA) — refactor

**Contexto.** Facundo (profesor) observó que con muchos animales un diseño
orientado a objetos "se pone lento" y recomendó guardar los datos en arrays
tipados. Franco lo resumió: *"sigo usando clases, pero los datos vienen de
arrays tipados"*.

**Decisión (implementada):** los datos de las entidades usan el patrón
**Structure of Arrays (SoA)**:

- `src/entities/entityManager.js` guarda **un array tipado por propiedad**
  (`Float32Array x`, `y`, `dirX`, `dirY`, `velocidad`; `Int32Array`
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
   `hambre`, `sed` y `deseoRepro` en `[0, 1]`. `edad` se mantiene en **ticks**
   (no se normaliza: es una magnitud con unidad propia).
2. **Decisión por prioridad** (T35), en `herbivore.js`, con `if` encadenados y
   *fallthrough*:
   `hambre crítica > sed crítica > reproducirse > explorar`. No hay puntajes:
   el orden del código **es** la política.
3. **Comer** (T37) no toca la capa de plantas directamente: el herbívoro llama
   `comerPlanta(ctx, indice)` de `src/systems/plantGrowth.js`, que devuelve si
   se pudo comer y baja el estado de la planta (o la borra). Así **P2 nunca
   escribe `planta` ni `terreno`**: todo pasa por la API de vegetación.
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
   eficiente: cada persecución cuesta tiempo.
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

## D16 · Alcance de las plantas: sin humedad, sin pisadas, muerte por edad (F3)

**Contexto.** T28 pedía crecimiento condicionado por "tipo de terreno y humedad" y T30 pedía
muerte por "edad, falta de agua y pisadas de herbívoros". Al revisar el código con la
simulación andando (2026-11-18), la grilla no tiene capa de humedad y el único contacto
herbívoro → planta es `comerPlanta()`.

**Decisión (alcance cerrado):**

1. **Sin humedad.** El crecimiento sigue dependiendo solo del tipo de celda (`TIERRA`) y del
   contador de ticks del estado. No se agrega una capa de humedad.
2. **Sin pisadas.** La interacción herbívoro → planta es **comer**: `comerPlanta()` baja el
   estado o borra la planta y devuelve si se pudo comer. Pisar no produce un comportamiento observable
   ni encaja con las reglas del autómata, así que se descarta.
3. **Muerte por edad (implementada, T30).** `pasoVegetacion()` cuenta los ticks de la adulta en
   la capa de edad; al llegar a `CONFIG.plantas.ticksVidaAdulta` (7200 ticks = 2 min por defecto)
   pasa a `MUERTA` y al tick siguiente a `NADA`. La cuenta arranca al llegar a adulta, no desde
   la semilla. No consume azar nuevo (determinismo) ni crea objetos en el bucle.
4. **Ancho de la capa de edad (corregido).** Era un `Uint8Array` (tope 255 ticks): suficiente
   para los 20/60 ticks por estado, pero no para una vida de minutos, donde el contador
   desbordaba a 0 (verificado: un `Uint8Array` vuelve a 0 tras 256 incrementos). Ahora es
   `Int32Array` y `tests/plantas.test.js` cubre el caso de más de 255 ticks.

**Por qué:** cerrar el alcance de F3 evita agregar sistemas que no se van a usar y deja una sola
tarea concreta para terminar v1, con la corrección del contador incluida.

---

## D17 · Restricción de terreno en el movimiento (T49)

**Contexto.** T49 pedía que no se cruzara agua profunda "sin costo". En `main` ya estaban el
coste energético de 4× (`needs.js`) y el campo BFS que mantiene a los animales en una franja
alrededor del agua (D14), pero `movement.js` no miraba la grilla: el factor de velocidad de la
rama `master` se había perdido en el refactor SoA.

**Decisión (implementada):**

1. **Frenar, no bloquear.** La celda **destino** modula la velocidad: agua ÷ 4, arena ÷ 1.6.
   No hay un muro infranqueable: los animales ya evitan el agua al deambular y solo entran a
   beber o si persiguen una presa. Un bloqueo duro exigiría definir "profundidad" (hoy el
   terreno solo tiene el tipo `AGUA`, sin niveles) y podría dejar animales aislados en islas.
2. **Sin parámetros nuevos.** El factor se deriva de los costes que ya existen:
   `factorVelocidad = 1 / coste*` (`costeAgua = 4`, `costeArena = 1.6`). Así no se duplica un
   número de balance en dos lugares.
3. **Coste y velocidad se aplican en sitios distintos.** `movement.js` mira la celda destino para
   frenar; el terreno solo afecta la velocidad (T40). Es un desfase de un tick en
   la transición entre terrenos, aceptable y determinista.
4. **Sin grilla = sin factor.** Los tests de entidades corren en un mundo vacío (`ctx.grid ===
   null`) y siguen moviéndose a velocidad plena.

**Por qué:** cierra F5 recuperando el comportamiento que ya tenía `master`, sin agregar capas de
datos ni reglas de navegación nuevas.

**Verificación:** `tests/movement.test.js` cubre tierra/arena/agua y `tests/determinismo.test.js`
sigue pasando con el factor activo.

---

## D18 · Sprites sueltos + atlas automático (F7.5 / T75)

**Contexto.** Se quiere reemplazar los círculos/cuadrados del render por sprites reales sin
pagar un `Sprite` por entidad. En PixiJS v8 `ParticleContainer` solo admite partículas que
comparten **la misma textura base**, así que el atlas no es opcional.

**Decisión:**

1. **Fuente suelta, atlas automático.** Los PNG fuente viven bajo `assets/sprites/` en carpetas
   por tipo: `plantas/plantaNormal/` (3 archivos) y `animales/trike_herbivore/` (9) /
   `animales/ceratosaurus_carnivore/` (11). El casillero del atlas es de **64 × 64 px**, pero los
   PNG se dibujan **a su tamaño natural y centrados** (32 × 32, 58 × 35 y 60 × 35), sin estirar.
   `render/atlas.js` los descubre con `import.meta.glob`, los ordena por ruta y los dibuja **una
   vez** en un canvas offscreen → una sola `CanvasSource` con sub-texturas por frame
   (`new Texture({ source, frame: Rectangle })`). No se commitea un atlas generado (evita
   artefactos *stale*) y no se agrega ninguna dependencia de build.
2. **Claves por ruta relativa** (`plantas/plantaNormal/semilla`,
   `animales/trike_herbivore/walk_0`), no por nombre de archivo, para que no choquen
   `walk_0.png` de distintas carpetas. Las rutas y cantidades viven en `CONFIG.sprites`, no se
   hardcodean en `render/atlas.js`.
3. **Plantas por evento de estado, no por edad.** `framePlanta()` lee solo `grid.planta`:
   nace `SEMILLA` → sprite semilla; pasa a `JOVEN` → sprite joven; pasa a `ADULTA` → sprite
   adulta. `MUERTA` y `NADA` **no se dibujan** (la planta desaparece). No se consulta
   `ctx._edadPlantas`.
4. **Animales: un cycle de caminar por especie.** La cantidad de cuadros **varía por especie** y
   vive en `CONFIG.sprites.rutaAnimal[tipo].cuadros`: **9** para el triceratops
   (`trike_herbivore/walk_0..8`) y **11** para el ceratosaurio
   (`ceratosaurus_carnivore/walk_0..10`, el más rápido). Estos valores salen del arte real y
   `tests/atlas.test.js` verifica que coincidan con los PNG descubiertos. Fase derivada de
   `ctx.tick` y `manager.velocidad[id]` (sin arrays nuevos, determinista, se frena con la pausa).
   Sprites **laterales**: se voltean con `scaleX` según `dirX`, sin rotación.
5. **Nombres de display.** `NOMBRE_ESPECIE` pasa a decir *Triceratops* / *Ceratosaurio* en la
   leyenda, el HUD y el gráfico; los ids internos siguen siendo `HERBIVORO`/`PREDADOR`.
6. **Fallback temporal.** Si falta un PNG, se dibuja un frame de prueba en el mismo canvas, así
   el juego corre mientras se carga el arte. Se desactiva con `CONFIG.sprites.generarFallback`.

**Descartado:** editar un atlas a mano (coordenadas frágiles), frames de planta por edad, sprite
de planta muerta (dura 1 tick y el refresh es cada 10: no se vería), rotar el sprite según el
rumbo (se eligió flip lateral) y renombrar el enum completo de especies.

**Trade-off aceptado:** con sprites laterales no se distingue si el animal camina hacia arriba o
hacia abajo; se usa solo el signo de `dirX`.

### Spike de `ParticleContainer` (T76) — API confirmada en `pixi.js@8.22.0`

- `ParticleContainer` y `Particle` se instancian en Node sin WebGL, lo que permite tests headless
  del pool (`tests/render.test.js`).
- `particleChildren` es el array vivo: se rellena por índice y se recorta con `.length = usados`.
  No se usa `addParticle()` (crea/pide espacio y es innecesario con un pool reservado).
- `dynamicProperties` confirma `position`, `vertex` (incluye `scaleX`/`scaleY` → flip lateral),
  `uvs` (frame del atlas), `color` (tint de depuración) y `rotation`. Los atributos `uvs`/`color`
  son estáticos en plantas y se vuelven a subir con `container.update()` al reconstruir; en
  animales son dinámicos (cada frame cambia el cuadro y el tint).
- `boundsArea` es obligatorio: `ParticleContainer` no calcula bounds por su cuenta. Se actualiza
  al tamaño de la vista en cada `render()`.
- `GlParticleContainerAdaptor.execute()` emite **un solo `drawElements`** por container, sin
  importar cuántas partículas tenga ⇒ **2 draw calls por frame** (plantas + animales).

**Descartado de la API experimental / de `Sprite`:** un `Sprite` por entidad (objeto por bicho y
pérdida del batch), `new Particle()`/`new Sprite()` dentro del bucle (rompe el pool y genera
basura), `addParticle()` (innecesario con el array pre-reservado) y `rotation` dinámico (los
sprites son laterales: solo `scaleX` con signo según `dirX`).

### Medición del peor caso (T79)

Comando: `node --expose-gc scripts/medirPeorCaso.mjs 60` (forza 65.536 plantas y 4.000 animales
con zoom mínimo, es decir sin culling efectivo).

| Métrica | Resultado |
|---|---|
| Celdas con planta | 65.536 / 65.536 |
| Animales en pantalla | 4.000 / 4.000 |
| Tiempo por frame | **5,69 ms** (5,21 ms con 120 frames) |
| Draw calls por frame | 2 (uno por `ParticleContainer`) |
| Heap Δ | 2,79 MB — idéntico con 60 y 120 frames ⇒ sin *GC sawtooth* |
| Pool | reutilizado, nunca excedido |

No hizo falta bajar el alcance visual ni partir en *chunks*: alcanzó con el culling por cámara
(T64), que limita el barrido de la grilla al rectángulo visible.

**Verificación final:** `tests/atlas.test.js` cubre claves, mapeo por estado de planta, wrap del
cycle y coincidencia con los PNG reales (9/11); `tests/render.test.js` cubre pool, culling, flip,
frames y depuración. `npm run lint`, `npm test`, `npm run build` y Prettier sobre los archivos
tocados pasan. La medición T79 está registrada además junto a T59. La comprobación
visual en pantalla la realiza el usuario con `npm run dev`.

### Correcciones tras el commit de F7.5 (bugs 1 y 2)

1. **Espejo invertido (bug 1).** Los PNG fuente miran hacia la **izquierda**, así que el signo es
   el contrario del inicial: `dirX < 0` → `scaleX` positivo (sin espejo) y `dirX > 0` → `scaleX`
   negativo. Antes el dibujo miraba al revés del movimiento. Lo cubre `tests/render.test.js`.
2. **Rumbo que giraba sin parar (bug 2).** `deambular()` suma `ruidoRumbo` **en cada tick** (60 por
   segundo), un random walk que con 0.15 rad producía ~60° de giro por segundo. Se bajó a
   **0.02 rad** en herbívoro y carnívoro (~9°/s), conservando el camino orgánico sin el giro
   frenético. El giro aleatorio programado cada 40-110 ticks (T39) se deja igual. Lo cubre
   `tests/rumbo.test.js` para ambas especies.
3. **Arranque lento (bug 3).** `crearAtlas()` decodificaba los 23 PNG **en serie** (`await
   imagen.decode()` dentro del bucle de dibujo) y `main.js` esperaba el atlas antes de generar el
   mundo y poblarlo, así que todo —incluidos los animales— tardaba en aparecer. Ahora las imágenes
   se decodifican en paralelo con `Promise.all` y la carga arranca antes de `app.init()` para
   solaparse con la inicialización de Pixi. El orden de `claves` no cambia, así que los UV siguen
   siendo reproducibles.
4. **Plantas primero, dinos varios segundos después (bug 4).** No era culling ni densidad (con la
   seed 1337 hay 52 animales dentro de la cámara inicial) ni frames vacíos (`walk_0` tiene ~49 % y
   ~38 % de píxeles opacos). La causa era un `GL_INVALID_OPERATION: Vertex buffer is not big enough
   for the draw call`. Pixi crea `_staticBuffer` y `_dynamicBuffer` con `new Float32Array(1)` (4
   bytes) y **solo los redimensiona dentro de `ParticleBuffer.update()`**. Ese update sube lo
   estático únicamente si `_childrenDirty === true`. `plantRenderer.reconstruir()` llama a
   `contenedor.update()`, pero `entityRenderer` nunca lo hacía: su buffer estático se quedó en 4
   bytes para siempre y `gl.drawElements` fallaba, dejando a los animales invisibles. Además, el
   ticker de Pixi hace un render inicial **antes** del primer `bucle()`, cuando el container de
   plantas todavía tiene las 65.536 partículas del pool y aún no se reconstruyó: por eso las
   plantas también fallaban en ese primer frame. Arreglo: `contenedor.update()` en el constructor
   de ambos renderers (una sola vez; la rotación nunca cambia y las UV de plantas se remarcan en
   `reconstruir()`) y `particles: pool.slice()` para reservar la capacidad completa desde el
   inicio. Instrumentando el pipe se pasó de `staticData=4` en animales a `staticData=64000`, y
   Chrome headless pasó de 5-9 `GL_INVALID_OPERATION` por corrida a **0**.

## D19 · Números mágicos a `config.js` (T58)

**Contexto.** T58 pedía que no quede ningún número de balance suelto fuera de `config.js`. El
inventario se relevó antes de tocar código y se acordó el **alcance completo** en tres bloques:
A (IA), B (simulación/mundo) y C (cámara/UI/bucle).

**Decisión:**

1. **Ticks de giro por especie.** La clase base (`Especie.pensar`) usa
   `CONFIG.ia.ticksGiroMin/Max`; herbívoro y depredador tienen **sus propios** `ticksGiroMin/Max`
   en su sección, con los mismos valores iniciales (40–110). Así se puede ajustar el deambular de
   cada especie sin afectar a la otra. La huida del herbívoro usa `CONFIG.herbivoro.ticksHuida`
   (20).
2. **Segundos → ticks, derivado.** Se exporta `TICKS_POR_SEGUNDO = Math.round(1 / pasoFijo)` y se
   usa en persecución (`segundosPersecucion * TICKS_POR_SEGUNDO`), HUD, gráfico, suavizado de la
   cámara y FPS inicial. No se escribió `60` en ningún consumidor: si cambia `pasoFijo`, todo
   convierte junto.
3. **Resto del inventario.** `fraccionEdadInicial`,
   `umbralVecindadDiagonal`, `distanciaBebida`, `factorDistanciaSedMedia`, `zoomMin/zoomMax`,
   `factorZoom`, `dtEnfocar`, `hudIntervaloMs`, `barraSegmentos`, `deltaMaximo` y `suavizadoFps`
   pasan a su sección correspondiente. `CONFIG.camara.suavizado` **se usa ahora** en
   `Camera.seguir()` (antes estaba en config pero el método repetía el valor como default).

**Descartado:** mover a config los números de maquetado CSS del HUD/leyenda, los *epsilons*
numéricos (`0.0001`) y los códigos de tecla: no son parámetros de simulación y ensuciarían la
config sin ningún beneficio de balance.

**Verificación:** `npm run lint`, `npm test` (122 tests en ese momento; 126 tras los tests de
regresión de T61), `npm run build` y Prettier sobre los 13 archivos tocados pasan. Los valores
originales ya no aparecen fuera de `config.js`.

---

## D20 · Bucle de ajuste de balance (T60)

**Contexto.** La corrida larga de T59 mostró herbívoros estables (120 → 136) pero un declive
sostenido de depredadores (25 → 4 en 10 min), con 50 presas depredadas. T60 pide cambiar **un**
parámetro por corrida, medir y decidir, en vez de tocar cinco cosas a la vez.

**Mecanismo.** `scripts/simular.mjs` acepta `SIM_OVERRIDE=SECCION.CLAVE=VALOR` y lo aplica a
`CONFIG` antes de generar el mundo, así toda la corrida usa el mismo valor. La semilla (1337) y
el resto de parámetros quedan fijos; el override se registra en la salida.

| Corrida | Parámetro (baseline → override) | Población min 10 | Nacimientos | Decisión |
|---|---|---|---|---|
| 1 | `depredador.crecimientoReproduccion` 0.003 → 0.006 | herb 136 · pred 4 | 118 | Descartado |
| 2 | `depredador.decaimientoReproduccion` 0.02 → 0.005 | herb 136 · pred 4 | 118 | Descartado |
| 3 | `depredador.segundosPersecucion` 30 → 40 | herb 136 · pred 4 | 118 | Descartado |

**Decisión.** No se adoptó ningún cambio: las tres corridas son **idénticas al baseline** hasta
el último minuto (solo varía ligeramente en la corrida 3, sin efecto en la población). El
deseo reproductivo no parece ser el cuello: crece a 0.003/s y decae a 0.02/s, pero duplicar el
crecimiento o cuadruplicar el tiempo de decaimiento no cambia ningún nacimiento. Tampoco ayuda
dar más tiempo de persecución.

**Queda para el próximo bucle.** No se probaron `radioReproduccion` ni `radioVision`: cada uno
debe ser su propia corrida (regla de un parámetro por experimento). El declive de depredadores
queda documentado como **limitación conocida de v1**, no como bug: la simulación sigue siendo
reproducible y los herbívoros no colapsan. La corrida final de F8 (con genes y dos especies
vegetales) terminó con 0 depredadores al minuto 10, así que el desequilibrio persiste y debe
revisarse en un próximo bucle de balance.

**Verificación:** logs `t60-run1.log`, `t60-run2.log` y `t60-run3.log` en
`C:\Users\Admin\AppData\Local\Temp\opencode\`.

---

## D21 · Corrección de bugs frecuentes (T61)

**Contexto.** T61 pedía los 5 bugs más frecuentes antes de seguir. Ya había 4 corregidos y
documentados en D18 (espejo del sprite, rumbo frenético, arranque lento y sprites invisibles por
buffer estático). Se relevó el código con un agente de exploración y se corrigieron **4 más**,
priorizando fallos observables y con prueba determinista:

1. **Gráfico congelado tras `R`.** El handler reiniciaba `ctx.tick` a 0 pero no el historial del
   gráfico: `registrar(1, …)` se descartaba porque `1 − 5941 < 60` y el canvas seguía con las
   curvas viejas hasta que la nueva simulación alcanzaba el tick anterior (~100 s). Arreglo:
   `Grafico.reiniciar()` (limpia muestras, índice y canvas) llamado desde el handler de `R`, más
   una defensa en `registrar()` para aceptar ticks menores al último. El mismo handler reinicia
   ahora también `ctx.muertesPorCausa` (otro contador que quedaba del seed anterior).
2. **Barras de necesidades clavadas al panear.** La clave de caché de `NecesidadesRenderer`
   incluía posición de mundo y valores, pero no la cámara; con la simulación en pausa y el animal
   quieto, `render()` hacía *early return* y las barras quedaban en el píxel viejo, separadas del
   sprite. Arreglo: la clave incluye `camara.x/y/zoom`.
3. **Off-by-one en el rebote de bordes.** `movement.js` reflejaba en `ancho − 1` / `alto − 1`
   (borde izquierdo de la última celda), pero el centro de la última celda es `ancho − 0.5`:
   cualquier entidad sembrada ahí era reflejada en el primer `mover()` y la franja exterior del
   mapa quedaba inhabitable. Arreglo: rebote en `0`/`ancho` con un margen de `1e-4` para que
   `Math.floor()` no devuelva `ancho`. Tests de borde actualizados.
4. **Semillas duplicadas en expansión vegetal.** El buffer de nacimientos se aplicaba al final
   del tick sin reservar la celda: dos adultas podían elegir la misma vecina, `nacimientos`
   contaba 2 y el mapa terminaba con 1 semilla. Arreglo: reserva inmediata
   (`planta[destino] = SEMILLA`) al elegir la vecina, para que la siguiente adulta la vea ocupada.

**Tests de regresión.** `tests/grafico.test.js` (reinicio + tick menor), `tests/render.test.js`
(caché con cámara), `tests/movement.test.js` (última celda) y `tests/plantas.test.js` (dos
adultas → dos semillas). Total: **126 tests**.

**Limitación conocida (no corregida).** `EntityManager.crear()` recicla ids con `libres.pop()` y
`aplicarMuertes()` corre antes que `aplicarNacimientos()` en el mismo tick. Si el animal
seleccionado (o seguido con `F`) muere y en ese tick nace otro, el id se reasigna, `vivo[id]`
vuelve a ser 1 y la selección/cámara saltan silenciosamente a un animal distinto. El arreglo
correcto es una generación por id (o un `version` en el manager) comparada al seleccionar. Se
descarta parchear solo `NecesidadesRenderer` porque `Camera.seguir()` tiene el mismo problema.

**Por qué estos cuatro.** Son fallos visibles (gráfico, barras, selección) o que invalidan
mediciones (conteo de semillas y franja inhabitable), y ninguno estaba cubierto por tests.

---

## D22 · Perfilado de performance (T62)

**Contexto.** T62 pedía tres respuestas medidas, no impresiones: complejidad del vecindario con
2000 entidades, GC sawtooth y rotura del batch por `tint`. Se agregó `scripts/perfilado.mjs`
(`node --expose-gc scripts/perfilado.mjs`), headless y repetible.

| Pregunta | Medición | Respuesta |
|---|---|---|
| ¿O(vecinos)? | 500/1000/2000 entidades con densidad constante → 3,4 vecinos/consulta; a 2000: **0,4 ns/consulta** (0,11 ns/vecino) frente a 7,3 ns con barrido O(n) (**20,2×**) | Sí: el `SpatialHash` escala con vecinos, no con población |
| ¿GC sawtooth? | Heap tras GC: 14,83 → 15,20/15,27/15,28/15,29 MB en min 2/4/6/8/10; subida máx **+0,46 MB**, meseta desde el min 4 | No: los arrays/buffers se crean una vez y se reutilizan |
| ¿Rompe el batch el `tint`? | 120 frames alternando modo depuración, 4096 plantas / 652 animales: 2 `ParticleContainer`, pools reutilizados, heap Δ **−0,10 MB** tras GC | No: el tint es `dynamicProperties.color`, no crea texturas ni objetos |

**Nota sobre la medición 1.** Los tiempos absolutos con 500 entidades son ruidosos en Node (JIT
calentándose); la comparación válida es la misma consulta contra fuerza bruta con la misma
densidad. En las tres escalas el hash gana y la ventaja crece con `n` (5,6× → 7,1× → 20,2×).

**Nota sobre la medición 3.** `PlantRenderer` no tiene `setDepuracion()`: el tint dinámico es el
de los animales (estado de IA). El script alterna solo ese; las plantas mantienen UV/color
estáticos y se remarcan en `reconstruir()`. La verificación de "pools reutilizados" comprueba que
cada partícula del container pertenece al pool pre-reservado, no que sea la índice 0 (por el
culling, la primera visible no suele ser la primera del pool).

**Descartado:** perfiles interactivos del DevTools (no son repetibles ni versionables) y medir FPS
en un navegador headless como prueba de rendimiento (T79 ya cubre el peor caso de render con
5,69 ms/frame y 2 draw calls).

**Verificación:** `npm run lint`, `npm test` (126) y `npm run build` pasan; Prettier sobre los
archivos tocados pasa. El `npm run format:check` global avisa sobre `index.html` y
`tests/cadenaAlimenticia.test.js`: son dos archivos preexistentes, ajenos a F7, que no se
modificaron (sus finales de línea y líneas largas vienen del commit base).

---

## D23 · Capacidad de entidades en pantalla a 60 FPS (T83)

**Contexto.** Pedido extra sobre F7: medir cuántas entidades pueden estar en pantalla sin bajar
de 60 FPS, probando cada tipo por separado y todo junto. Se agregó
`scripts/medirCapacidadPantalla.mjs` (`node scripts/medirCapacidadPantalla.mjs 60 3`), headless y
repetible, con el mismo enfoque que T79/T62.

**Método.** Para cada escenario se prepara una grilla con N plantas adultas y N animales
**dentro del rectángulo visible** (sin margen de culling, con un paso primo para repartirlos),
se calientan 15 frames y se cronometran 60 frames × 3 repeticiones, reportando la mediana. Se
fuerza la reconstrucción de UV en cada frame con un tick **global monotónico** (`tick*10` contra
`cadaTicks = 10`): al reutilizar el renderer entre escenarios, reiniciar el tick habría hecho que
`PlantRenderer.reconstruir()` saltara el trabajo por su caché y diera cifras 2× más baratas. El
presupuesto es 1000/60 = **16,67 ms/frame**.

| Escenario | Vista normal (zoom 1, 14.651 celdas) | Zoom mínimo (0,2, mundo completo) |
|---|---|---|
| Solo plantas (tope) | 14.651 → **0,70 ms** | 65.536 → **3,62 ms** |
| Solo herbívoros (4.000) | **0,59 ms** | **0,91 ms** |
| Solo depredadores (4.000) | **0,61 ms** | **0,86 ms** |
| Todo junto | 14.651 + 4.000 = **18.651 → 1,27 ms** | 65.536 + 4.000 = **69.536 → 4,16 ms** |

**Conclusión.** Todos los escenarios entran en presupuesto. El peor caso (todo el mundo visible
con todas las plantas y los 4.000 animales) consume **4,16 ms, el 25 % de los 16,67 ms**;
equivaldría a ~240 FPS si el render CPU fuera lo único que cuenta. **El límite lo ponen los
topes configurados** —`grid.total` (65.536 celdas) y `CONFIG.entidades.maxEntidades` (4.000)—,
no el framerate. Entre herbívoros y depredadores no hay diferencia apreciable: el renderer hace
el mismo trabajo por partícula y solo cambia el frame del cycle de caminar (D18).

**Por qué median y no una sola corrida.** T79 reportó 5,69 ms para el mismo escenario límite;
acá da 4,16 ms. La variación está dentro del ruido del JIT y de la carga de la máquina, y se
reduce tomando la mediana de tres repeticiones. En ambos casos sobra más del 65 % del
presupuesto, así que la conclusión no cambia.

**Descartado:** subir `CONFIG.entidades.maxEntidades` o agrandar la grilla para "buscar" el techo
real de FPS. Los topes actuales son decisiones de diseño de D2/D18 (memoria y capacidad
reservada al arrancar); el objetivo de T83 era verificar que se alcanzan sin caer de FPS, no
redefinir el tamaño del mundo.

**Alcance de la medición.** Igual que T79/T62, esto mide el trabajo de **render en CPU**
(reconstrucción de UV, proyección y actualización de atributos del `ParticleContainer`). El lado
GPU son 2 draw calls fijos (D18) y 4 vértices por partícula, así que no introduce un costo
variable oculto. La simulación se mide por separado en T59 (10 min en 39,5 s) y T62 (hash
O(vecinos), heap sin sawtooth); un FPS de navegador real requiere el `npm run dev` del usuario.

---

## D24 · Panel de generación de mapas (F8 · T84)

**Contexto.** Pedido extra: poder generar mapas poniendo una seed y las poblaciones iniciales, en
un panel con tres posiciones (oculto, parte de abajo y pantalla completa) y dos campos separados
para herbívoros y depredadores. Se agregó `src/ui/generadorMapa.js`.

**Decisión.**

1. **Tres posiciones, un botón que cicla.** `oculto → abajo → pantalla → oculto`. La cabecera del
   panel tiene además acceso directo a las tres, para no tener que recorrer el ciclo. El botón
   flotante queda debajo de la barra de pausa (arriba a la derecha) para no tapar HUD, gráfico ni
   leyenda. En `abajo` el panel es un cajón del 38 % de la altura y se sigue viendo la
   simulación; en `pantalla` cubre toda la ventana.
2. **El panel no sabe generar.** Valida rangos y llama a `alGenerar({ seed, plantas, herbivoros,
   depredadores })`. `main.js` tiene una sola función `regenerarMundo()` que reinicia PRNG, tick,
   contadores, gráfico y selección, regenera terreno, vegetación y poblaciones. Antes la tecla R
   tenía ese código duplicado; ahora R usa la misma función con una seed nueva y **conserva las
   cantidades elegidas**, así no se pierde la configuración al explorar seeds.
3. **Plantas por cantidad exacta.** `sembrarVegetacion(ctx, cantidad)` elige ese número de celdas
   de tierra con un Fisher-Yates parcial sobre un array cacheado en `ctx`, sin repetir celdas.
   Si no se pasa cantidad, usa `CONFIG.entidadesEstaticas.poblacionInicial`.
   `CONFIG.entidadesEstaticas.poblacionInicial = 2247` es el valor medido que producía la densidad
   original con la seed por defecto, así el mapa inicial mantiene la misma cantidad de plantas.
4. **Seed flexible.** Número decimal entero → `>>> 0` (32 bits sin signo). Cualquier otra cadena →
   `hashString(texto)`, que ya existía para este fin. Vacía → seed por defecto. Resultado: frases
   como `isla feliz` son reproducibles.
5. **Atajos de teclado con guardia.** El `keydown` global ignora eventos cuyo `target` sea
   `input`/`textarea`/`select` o editable. Sin esto, escribir una `r` en la seed regeneraría el
   mundo y un espacio pausaría la simulación. Enter dentro de un campo dispara la generación.

**Descartado:** un `<select>` con presets (no permite seeds arbitrarias) y un panel siempre
visible (tapa el canvas). También se descartó agregar los pixeles del cajón a `CONFIG`: D19 ya
acordó que el maquetado CSS de la UI no es un parámetro de balance.

**Verificación:** `npm run lint`, `npm test` (138) y `npm run build` pasan; Prettier sobre los
archivos tocados pasa. 8 tests del panel (posiciones, validación, seeds y callback) y 4 de
siembra exacta (cantidad, tope de tierra, determinismo y compatibilidad por densidad).

---

## D25 · Dos especies vegetales y competencia territorial (F8 · T65/T66)

**Contexto.** El GDD proponía como extensión una segunda especie vegetal con reglas distintas y
competencia por el territorio. La grilla ya guardaba el *estado* de la planta en una capa
`Uint8Array`; hacía falta distinguir *qué* planta ocupa la celda sin convertir 65.536 celdas en
objetos.

**Decisión.**

1. **Capa paralela, no objetos.** `Grid.especiePlanta` es otro `Uint8Array` con el mismo índice
   plano que `planta`/`terreno`. `planta` sigue diciendo `SEMILLA/JOVEN/ADULTA/MUERTA` y
   `especiePlanta` dice `PASTO` (0) o `MICELIO` (1). Una grilla vieja sin la capa se lee como
   todo pasto, así que no hubo migración.
2. **Configuración separada.** `CONFIG.entidadesEstaticas` concentra los parámetros globales de la
   vegetación en grilla; `CONFIG.plantas` (pasto) y `CONFIG.micelio` definen por especie, con la
   misma forma, su fracción de siembra y reglas de crecimiento/expansión/desplazamiento.
   `plantGrowth` resuelve la regla por celda según la especie sin asignar nada en el bucle. El
   micelio expande menos (`0.05` contra `0.08`), vive más (`900` contra `500` ticks) y tiene
   `probDesplazamiento` efectivo, mientras el pasto lo tiene en `0`.
3. **Competencia sin asignaciones.** `buscarVecinaLibre()` prefiere celdas vacías; si no hay,
   solo el micelio puede arrebatar una celda al pasto. El retorno codifica el desplazamiento como
   `-2 - j` (un entero negativo no puede confundirse con un índice), evitando objetos temporales
   por intento. El conteo acumulado vive en `ctx.desplazamientos`.
4. **Sin PNG propio.** El atlas reserva claves sintéticas `plantas/micelio/{semilla,joven,adulta}`
   y dibuja un frame de prueba con colores fijos en `atlas.js`. El
   renderer elige la clave con `framePlanta(estado, especie)`. Cuando haya arte propio basta
   reemplazar esas entradas del atlas: el simulador no cambia.

**Balance medido.** `node scripts/simular.mjs 1337 10` con `micelio.fraccionInicial = 0.08` y
`micelio.probDesplazamiento = 0.0002`: al minuto 1 hay ~3.500 micelios sobre ~35.000 plantas; al
minuto 10 conviven ~19.000 micelios y ~16.000 pastos con ~2.600 desplazamientos. Valores más altos
(0.001) extinguían el pasto antes del minuto 5; valores más bajos (0.0005 con expansión reducida)
extinguían el micelio. Los parámetros quedaron en `CONFIG.entidadesEstaticas`, `CONFIG.plantas` y
`CONFIG.micelio`, y el HUD muestra ambas poblaciones y los desplazamientos.

**Descartado:** dar reglas distintas por especie en `plantGrowth.js` con `if (especie === …)`
(duplicaba la lógica y rompía la regla de "ningún número fuera de `config.js`"), y models de
competencia con objetos por planta (memoria y GC).

**Verificación:** `tests/especiesVegetales.test.js` (8 tests: capa, siembra determinista, reglas
por especie, desplazamiento, no retroceso del pasto y selección del frame) y el script de balance
headless. Total en este hito: 196 tests.

---

## D26 · Herencia y mutación de rasgos (F8 · T67)

**Contexto.** El GDD lista como extensión la herencia de velocidad, tamaño, percepción, consumo
y tiempo de reproducción. Hoy solo la velocidad era dato por individuo; el resto eran constantes
de especie.

**Decisión.**

1. **Cinco genes SoA.** `EntityManager` agrega `genVelocidad`, `genTamano`, `genPercepcion`,
   `genConsumo` y `genReproduccion` (`Float32Array`). Todos valen 1 al nacer: son multiplicadores
   del rasgo base de la especie, no valores absolutos. Los arrays crecen con `reservar()` y se
   reinician al reciclar un id.
2. **Herencia de dos padres con mutación.** `anotarNacimiento()` recibe los ids de ambos
   progenitores y calcula los genes **en el momento de anotar** con `genesDeCria()`. Calcularlos
   al aplicar el evento sería incorrecto: `aplicarMuertes()` corre antes que
   `aplicarNacimientos()` y el id de un padre muerto podría ser reutilizado por otra cría. El
   promedio usa `CONFIG.genetica.pesoPadre`; cada gen muta con `probMutacion`, suma/resta
   `deltaMutacion` y se limita a `[minRasgo, maxRasgo]`. Todo sale de `ctx.prng` en orden fijo.
3. **Buffer reutilizable.** La tupla de nacimiento pasó de `(tipo, indice)` a
   `(tipo, indice, 5 genes)`. `bufferGenes(ctx)` se crea una vez y se rellena en sitio: cero
   objetos nuevos por nacimiento. Las llamadas sin padres siguen generando genes neutrales sin
   consumir azar, para no romper tests ni corridas anteriores.
4. **Efectos observables.** El gen de velocidad escala el paso en `movement.js` y la fase de la
   animación; el de tamaño escala `scaleX/scaleY` del sprite; el de percepción multiplica los
   radios de búsqueda de comida, agua, pareja y presa; el de consumo escala hambre y sed; el de
   reproducción escala el cooldown de ambos padres. Así la evolución es visible en pantalla, no
   solo un número en un array.
5. **Tolerancia Float32.** Los tests comparan genes con `toBeCloseTo`, porque los arrays son
   `Float32Array` (D13) y `1.2` se guarda como `1.2000000476837158`.

**Descartado:** un objeto `Genotipo` por animal (rompe SoA), `Math.random()` para mutar (rompe
determinismo) y guardar solo un padre (perdía la mitad de la información genética).

**Verificación:** `tests/genetica.test.js` (11 tests) y la huella de `tests/determinismo.test.js`
incluye ahora los cinco genes. Total en este hito: 207 tests.

---

## D27 · Entrega: seed copiable, build servido y cero logs (F8 · T68/T69/T74)

**Contexto.** Para cerrar F8 hacían falta tres cosas de entrega, no de simulación:
poder copiar la seed, comprobar el build fuera de Vite dev y sacar los `console.log`
de depuración que quedaron durante el desarrollo.

**Decisión.**

1. **Seed en el HUD y copiable.** El botón *copiar seed* y la tecla `S` llaman a
   `copiarSeed()` en `main.js`: `navigator.clipboard.writeText` con fallback a
   `document.execCommand('copy')`. El HUD solo recibe un callback que devuelve
   `Promise<boolean>`, así no conoce la seed ni el simulador. El resultado se
   muestra debajo del botón durante `CONFIG.ui.avisoCopiaMs` (1800 ms).
2. **El aviso es reutilizable.** `Hud.avisar(texto)` reemplaza el antiguo
   `avisarCopia(ok)` como método base; `avisarCopia()` es un wrapper. Lo usan
   también los atajos `D`, espacio, `1/2/4`, `F`, `R` y `T`, y el mensaje de
   arranque. Así no se pierde información al quitar la consola.
3. **Build verificado servido.** `npm run build` genera `dist/` y
   `npm run preview -- --host 127.0.0.1 --port 4173` sirve `index.html` y
   `assets/index-*.js` sin errores. La comprobación se repite en T74; el script
   `scripts/simular.mjs` dejó de leer el array eliminado `manager.energia[id]` y
   reporta `hambre`/`sed`, conteo por especie y desplazamientos.
4. **Sin logs de debug.** `npm run lint:prod` (`eslint src --rule
   "no-console:error"`) bloquea cualquier `console.*` en `src/`. Quedan solo
   comentarios que explican la decisión, no llamadas ejecutables.

**Descartado:** dejar los avisos en la consola "por si acaso" (rompía la
definition of done de T74), depender solo de Clipboard API sin fallback y dar
por bueno el build sin servirlo.

**Verificación:** `npm run lint`, `npm run lint:prod`, `npm test -- --run`
(22 archivos, 219 tests tras D28/D29), `npx prettier --check .`,
`npm run build`, `npm run preview` y `node scripts/simular.mjs 1337 10`. La corrida final de
10 min con seed 1337 terminó en 156 herbívoros, 0 depredadores, 19.287
micelios, 16.470 pastos y 2.642 desplazamientos. El guion de demo y la revisión
cruzada pendiente están en `docs/DEMO.md`.

---

## D28 · Inspector de genes del animal seleccionado

**Contexto.** T67 hizo que los cinco rasgos fueran observables en la simulación
(velocidad de movimiento, tamaño del sprite, radios de percepción, consumo y
cooldown), pero no había forma de ver el **valor numérico** de cada gen: solo se
intuía su efecto. El GDD pide observar la evolución de características, y para
eso hace falta poder inspeccionar un individuo.

**Decisión.**

1. **La vista plana ya existente se extiende.** `NecesidadesRenderer.crearVista()`
   agrega `genes` con los cinco multiplicadores. La leyenda sigue sin conocer
   los arrays tipados: recibe el mismo objeto plano de siempre y solo muestra
   una sección nueva debajo de hambre/sed/edad.
2. **Módulo puro para la vista.** `src/ui/geneticaVista.js` concentra
   `leerGenes`, `normalizarGen`, `indicadorGen` y `filasGenes`. Es testeable en
   Node, sin DOM ni WebGL, y evita repetir los nombres de los arrays en dos
   lugares.
3. **Barra con referencia explícita.** Cada barra va de `minRasgo` a `maxRasgo`
   y se rotula con `1.00 = base`; `↑`/`↓`/`=` indican si el rasgo está por
   encima, por debajo o en el valor de la especie. Así no se confunde "barra
   llena" con "gen bueno": un gen de consumo alto puede ser perjudicial.
4. **Sin cambios en la simulación.** No se agregó estado ni azar: la vista se arma
   solo para el animal seleccionado, fuera de la lógica de simulación. La leyenda
   ya se actualiza una vez por frame y conserva su early-return por HTML idéntico.

**Descartado:** colorear todos los animales por gen en modo permanente (se
perdería la distinción por especie y por estado de IA, que ya cumple T56), y un
panel nuevo con los genes promedio de la población (no permite seguir la
historia de un individuo).

**Verificación:** `tests/geneticaVista.test.js` (6 tests) y un test nuevo en
`tests/render.test.js` confirman la lectura SoA, la normalización, los marcadores
y el HTML de la leyenda. `npm run lint`, `npm test -- --run` (22 archivos,
219 tests tras D29), Prettier y build en verde.

---

## D29 · Overlay sobre el animal, desactivado por defecto

**Contexto.** Las barras de necesidades y genes que aparecen justo encima del
sprite al hacer clic tapan parte del dibujo y del terreno. La leyenda ya muestra
los mismos datos abajo a la izquierda, así que el overlay es duplicativo para
quien solo quiere mirar la simulación.

**Decisión.**

1. `CONFIG.ui.mostrarBarrasSobreEntidad = false` en el estado inicial. Como el
   panel de configuración recorre `CONFIG_BASE`, aparece solo como un checkbox
   en la categoría `ui` y se guarda con el resto de overrides.
2. `NecesidadesRenderer.render()` sigue armando `seleccionada` (la vista plana
   que lee la leyenda) aunque el overlay esté apagado; solo salta el dibujo de
   `Graphics`/`Sprite` sobre el animal. Así el clic sigue teniendo efecto.
3. Al estar apagado se ocultan también los sprites de las barras, que antes
   podían quedar en `(0,0)` antes del primer clic.
4. Para que el clic no parezca ignorado, queda un **triángulo** amarillo con
   borde oscuro apuntando al animal. Se dibuja con el mismo `Graphics` que las
   barras y con la misma conversión a coordenadas de pantalla, así que sigue al
   sprite al panear/zoom. El tamaño y el offset son configurables
   (`marcadorSeleccionTamano`, `marcadorSeleccionOffsetY`). La clave de cache
   incluye un prefijo de modo (`marcador`/`barras`) para que el cambio de flag
   fuerce redibujar aunque la geometría no cambie.

**Descartado:** no dibujar nada con el overlay apagado (el usuario pidió "aunque
sea un triangulito"), un marcador con textura propia (sumaría draw calls y
texturas) y poner el overlay en `true` por defecto (el pedido era lo contrario).

**Verificación:** `tests/render.test.js` comprueba que con el valor por defecto
el marcador se dibuja una sola vez siguiendo a la cámara, `seleccionada` sigue
trayendo hambre y genes, y que al activar el flag las barras vuelven a hacerse
visibles.

---

## D30 · Terreno con marching squares en estilo pixel art

**Contexto.** El terreno se renderizaba como una textura de 1 píxel por celda
escalada al tamaño de tile, lo que producía bordes rectos entre agua, arena y
tierra. Se pidió suavizar esas transiciones con marching squares manteniendo un
aspecto pixel art.

**Decisión.**

1. **Lógica pura separada.** `src/render/terrainMarching.js` concentra el
   muestreo acotado, la interpolación bilineal por tile y la resolución del tipo
   por píxel (`terrenoDePixel`/`alturaDePixel`) en capas `AGUA < ARENA < TIERRA`.
   Es determinista y testeable en Node, sin DOM ni Pixi.
2. **Texturas divididas en chunks.** Con marching squares activo, el
   `TerrainRenderer` genera el terreno a resolución `ancho*detalle × alto*detalle`
   (`detalle = CONFIG.terreno.pixelesPorCeldaMarching`, por defecto 4) y lo divide
   en texturas-chunk de como máximo
   `CONFIG.terreno.maxTamanoTexturaMarching × maxTamanoTexturaMarching` px (por
   defecto 1024). Cada chunk es un `Sprite` con `scaleMode: 'nearest'` dentro de un
   único `Container`, así no se crea un canvas/ImageData gigante que pueda disparar
   `Out of Memory`. La escala del contenedor compensa `tileSize/detalle` para cubrir
   el mundo. Se conserva el sombreado por altura y el jitter determinista por celda;
   en píxeles de transición se usa altura interpolada.
3. **Configurable, reversible y seguro.** `CONFIG.terreno.marchingSquares`
   (booleano), `CONFIG.terreno.pixelesPorCeldaMarching` (píxeles por celda) y
   `CONFIG.terreno.maxTamanoTexturaMarching` (límite de chunk) controlan el modo
   desde Configuración. Al desactivar `marchingSquares` se usa el render clásico de
   1 px por celda escalado a `zoom*tileSize`; si alguna asignación de textura-chunk
   falla por memoria, el renderer hace fallback automático al modo clásico.
4. **Sin trabajo por frame.** La textura se genera solo en `generar(grid)` (carga
   o regeneración); el bucle solo posiciona el sprite, respetando "sin `Graphics`
   ni objetos por celda o por frame".

**Descartado:** generar geometría/sprites por celda o por borde (rompe la regla
de draw calls y el presupuesto), antialiasing suave (choca con el pixel art) y
hardcodear el umbral de marching squares fuera de la lógica derivada del tamaño
de tile.

**Verificación:** `tests/terrainMarching.test.js` cubre muestreo acotado,
interpolación, uniformidad, suavizado de bordes, determinismo y altura. `npm run
lint`, `npm run lint:prod`, `npm test -- --run` (23 archivos, 228 tests),
`npx prettier --check .` y `npm run build` en verde.

---

## D31 · Lista precalculada de celdas habitables para la siembra

**Contexto.** `celdaHabitableAlAzar` elegía una celda de tierra por muestreo con rechazo (hasta N
intentos) y caía a una posición cualquiera si no encontraba tierra. Eso no garantizaba
uniformidad y podía devolver celdas no habitables en mapas con poca tierra.

**Decisión.**
- `generarTerreno` registra, durante la misma pasada de clasificación del terreno, los índices
  planos de las celdas `TIERRA` en `grid.celdasHabitables` (opción A: buffer temporal de tamaño
  `total` y vista `subarray(0, n)`, sin pasadas extra). `construirCeldasHabitables(grid)` queda
  disponible para recalcular la lista a partir de `grid.terreno`.
- `celdaHabitableAlAzar` selecciona en O(1) un índice uniforme de esa lista usando el PRNG
  (1 sorteo por selección). Si no hay grid, si la lista falta (se construye bajo demanda) o si
  está vacía, conserva el fallback a una posición aleatoria dentro del mundo para no dejar la
  población en cero.
- Se elimina `terreno.maxIntentosHabitable`, que ya no aplica.

**Nota:** el terreno sigue siendo determinista, pero cambia el patrón de consumo del PRNG al
sembrar entidades: para una misma seed/config, las posiciones iniciales (y la evolución
posterior) pueden diferir respecto a versiones anteriores.

---

## D32 · Preset «Máximo estable»: tope de población dentro del presupuesto de 60 FPS

**Contexto.** Los presets existentes priorizaban ya sea pocos animales o vegetación, pero
ninguno llevaba la simulación al límite de `maxEntidades = 4000` sin arriesgar una extinción
o pasar el presupuesto de frame. Con la configuración del preset «Bosque frondoso»-like
(4.000 animales, visión 11 del depredador), la IA del herbívoro costaba **12,3 ms/tick**
y el autómata de vegetación **4,2 ms/tick**: 17,5 ms solo de simulación, antes de renderizar.

**Medición del cuello.** `Herbivoro.pensar` llama a `buscarDepredador` con el radio de visión
del depredador en cada tick y para cada herbívoro. Con 3.800 herbívoros y radio 11 eso son
~3.800 consultas al hash por tick. El barrido de 65.536 celdas de `pasoVegetacion` y el
conteo de plantas en `main.js` (otras 65.536 celdas **por frame**, aunque el HUD se refresca
5 veces/s) sumaban el resto.

**Decisión.**
- Nuevo preset incluido `Máximo estable`: 3.850 herbívoros + 150 depredadores = 4.000
  (tope exacto), 6.000 semillas, `radioVision` 4/5, `celdaHash` 4, cadencias de búsqueda 4
  ticks y reproducción/necesidades aceleradas para compensar la mortalidad por vejez.
- `percepcion.ticksEntreBusquedaDepredador` (default **1**, comportamiento original) permite
  espaciar la detección sin tocar el flag `moribundo` ni la idempotencia de las muertes.
  El preset lo usa en 4; `ticksHuida = 20` sostiene el rumbo entre revisiones.
- `main.js` cachea `contarPlantasPorEspecie` con la cadencia del HUD (`hudIntervaloMs = 200`)
  e invalida la caché al regenerar (`ctx.tick` menor que el cacheado). El gráfico sigue
  muestreando 1 vez/s con el mismo dato.
- `scripts/validarPreset.mjs` aplica un preset completo antes de generar el mundo (a diferencia
  de `simular.mjs`, que solo admite un override): varios parámetros cambian el consumo del
  PRNG desde el tick 1, así que probarlos por separado no reproduce el resultado.

**Resultado** (seed 1337, 10 min, `node scripts/validarPreset.mjs 'Máximo estable' 10 1337`):

| | Sin optimizar | Con preset + optimizaciones |
|---|---|---|
| Herbívoros / depredadores al min 10 | 3.897 / 103 | **3.869 / 131** |
| Mínimo poblacional en toda la corrida | 3.719 / 103 | **3.704 / 131** |
| Simulación (media) | 14,82 ms/tick | **10,92 ms/tick** |
| Simulación (pico) | 410,32 ms | 248,90 ms |
| IA del herbívoro (muestra de 600 ticks) | 6,63 ms/tick | **5,55 ms/tick** |
| Conteo de plantas en `main.js` | 0,121 ms × 60/s = 7,26 ms/s | 0,121 ms × 5/s = 0,61 ms/s |

Con los datos de render de D18/D23 (1,27 ms en zoom 1 y 4,16 ms con el mundo completo),
el frame queda entre **12,2 y 15,1 ms**, dentro de los 16,67 ms de 60 FPS. El límite sigue
siendo `maxEntidades` y no el framerate, como en D23.

**Pendiente / no hecho:** el pico de 249 ms sigue apareciendo en la corrida larga (JIT/GC de Node
bajo carga, no del bucle de render). Queda como optimización futura el autómata de vegetación
por conjunto activo de adultos, en vez de barrer las 65.536 celdas cada tick.

**Verificación:** `npm test -- --run` (23 archivos, 232 tests), `npm run lint` y
`npm run build` en verde; `tests/presets.test.js` valida que el preset usa el tope de
entidades y que todos sus valores sobreviven `limpiarValores`.

---

## D33 · «Máximo estable ×2»: comprimir el tiempo por tick sin mover el reloj

**Contexto.** El pedido era que todo pasara más rápido sin aumentar la cantidad de ticks: no
servía subir `tiempo.escalaSimulacion` (tope 4) ni `maxPasosPorFrame` (tope 5), porque con
4.000 animales el coste por tick ya es el límite (D32). «Simulación rápida» acelera el reloj
y las etapas vegetales, pero no acelera hambre, sed, movimiento ni reproducción.

**Decisión.** Nuevo preset incluido `Máximo estable ×2`, derivado directamente de D32 con un
factor **F = 2** aplicado al modelo, no al reloj:

- **Tasas por segundo ×2:** `velocidad` (1,2 → 2,4 en herbívoro; 2 → 4 en depredador),
  `consumoHambre`, `consumoSed`, `crecimientoReproduccion`, `decaimientoReproduccion` y
  `ruidoRumbo` (mismo giro angular en la mitad de ticks).
- **Probabilidades por tick ×2:** `probExpansion` (0,01 → 0,02; 0,008 → 0,016) y
  `probDesplazamiento` del micelio (0,0002 → 0,0004).
- **Duraciones en ticks ÷2:** `edadMaximaTicks` (43.200 → 21.600), etapas de las plantas
  (20/60 → 10/30), `ticksVidaAdulta` (700 → 350 y 900 → 450), cooldowns y edades de
  reproducción, `ticksGiroMin/Max`, `ticksHuida`, `ticksEntreBusqueda*`,
  `segundosPersecucion` (30 → 15), `graficoIntervaloTicks` (60 → 30) y
  `ticksPorRefrescoRender` (10 → 5).
- **Sin cambios:** `tiempo` (ni `escalaSimulacion`, ni `pasoFijo`, ni `maxPasosPorFrame`),
  radios de visión, radios de ataque/comer/beber/reproducirse, `celdaHash`, umbrales de
  hambre/sed/deseo, `saciedadPorPresa`, `fraccionEdadInicial` y las poblaciones iniciales
  (3.850 + 150 = 4.000). «Multiplicar todo por 2» habría alargado vidas y cooldowns, es
  decir, habría hecho la simulación **más lenta**: por eso las duraciones se dividen.

Con 60 ticks/s sin cambios, un minuto real equivale a 2 min del modelo: lo que D32 mostraba
a los 10 min debería verse a los 5 min reales.

**Verificación parcial** (seed 1337, corrida detenida en el minuto 4 a pedido del usuario;
por eso no hay media de ms/tick final):

| Tiempo real | Herbívoros | Depredadores | Plantas | Nacimientos | Muertes |
|---|---|---|---|---|---|
| 1 min | 3.850 | 150 | 33.172 | 0 | 0 |
| 2 min | 3.850 | 150 | 33.479 | 167 | 167 |
| 3 min | 3.821 | 179 | 34.293 | 354 | 354 |
| 4 min | 3.850 | 150 | 34.486 | 1.667 | 1.667 |

La población se mantiene en el tope y el recambio (1.667 muertes en 4 min, mitad por vejez
y mitad por depredación) ya es visible en el tramo medido, contra 167 muertes en los primeros
4 min de D32.

**Limitaciones.** No se registró el coste medio de CPU porque la medición se interrumpió antes
de la línea final; con el mismo número de entidades y cadencias de búsqueda más frecuentes,
el coste debería ser comparable al de D32 (10,92 ms/tick) o algo mayor, dentro del
presupuesto de 16,67 ms/frame. Tampoco se verificó el equivalente completo a 10 min del
modelo (5 min reales).

**Verificación estática:** `tests/presets.test.js` comprueba que el preset sobrevive
`limpiarValores`, que no incluye `tiempo`, que las tasas son el doble de D32, que las
duraciones son la mitad y que los radios y el tope de 4.000 no cambian. `npm test -- --run`
(23 archivos, 233 tests) y `npm run lint` en verde.

---

## Registro de acuerdos pendientes

| # | Tema | Quién | Estado |
|---|---|---|---|
| 1 | API exacta de `camera.js` | P1 + P2 | Pendiente de reunión |
| 2 | Capas de la grilla y sus tipos | P1 | ✅ Resuelto (D5) |
| 3 | Interfaz `MundoAPI` para desacoplar los animales del terreno | P2 propone | Parcial: la `Grid` ya existe; ver CONTRATO §5 |
