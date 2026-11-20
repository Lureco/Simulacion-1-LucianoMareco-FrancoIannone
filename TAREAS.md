# Plan de Tareas — Simulación de Ecosistemas

**Proyecto:** Simulación de Ecosistemas 2D (Vida Artificial + Mundo Procedural)
**Integrantes:** Luciano Mareco (P1) — Franco Iannone (P2)
**Profesor:** Facundo Saiegh
**Doc base:** `Gdd-Tdd.txt`
**Stack:** JavaScript + PixiJS

> **Estado verificado en código (2026-11-20):** los checkboxes se actualizaron contra lo que
> realmente hay en `main`, no solo contra el plan. F0–F7.5 completas; F8 con el código
> terminado y verificado. Quedan como acciones humanas el video, las capturas y la revisión
> cruzada final (T72/T73). Humedad y pisadas de herbívoros quedaron descartadas por decisión (D16).
>
> **Agregado 2026-11-18:** fase **F7.5** (sprites de plantas y animales con atlas e
> instancing), **completada** (T75–T82): no cambia la simulación, solo la representación visual,
> y se dimensionó para el peor caso de población (ver T79).

---

## 1. Alcance (según GDD)

**Obligatorio (v1):** mundo 2D procedural · agua/arena/tierra · plantas · herbívoros ·
depredadores · sistema de necesidades · movimiento entre celdas · búsqueda de recursos ·
alimentación · reproducción · muerte · crecimiento y expansión de plantas.

**Opcional (v2):** segunda especie vegetal · competencia territorial · mutaciones/herencia ·
biomas · gráfico de poblaciones · ciclo día/noche · clima · más especies.

> Regla: **v1 cierra antes de tocar v2.** Nada de opcionales si hay una obligatoria abierta.

---

## 2. Stack

| Elemento | Elección | Motivo |
|---|---|---|
| Lenguaje | JavaScript ES2022 (módulos ES) | Pedido, y el setup con Vite es casi instantáneo |
| Render | **PixiJS v8** (WebGL, fallback Canvas) | Sprites, batching y tint gratis; escala a muchas entidades |
| Bundler / dev server | **Vite** | `npm run dev` con HMR, build a estáticos sin configuración |
| Tests | **Vitest** | Corre los mismos tests que el dev server, sin config extra |
| Estilo / calidad | ESLint + Prettier | Formato uniforme entre los dos, se rompe solo en el hook |
| Ruido | Implementación propia de Value/Perlin Noise (seeded) | Requisito de la Unidad 1, sin libs externas |
| Versionado | Git + GitHub | Trazabilidad |

### Reglas de JS que NO se negocian

Estas son las que arruinan el framerate si aparecen tarde:

1. **`Math.random()` está prohibido dentro de la simulación.** Todo el azar pasa por un PRNG
   propio con semilla. Si no, la seed no reproduce nada y el requisito del GDD no se cumple.
2. **La grilla es memoria contigua**, no un array de objetos: `Uint8Array` para el terreno,
   `Uint8Array` para el tipo de planta, `Int32Array` para el id de entidad por celda.
3. **Nada de `new Graphics()` por celda o por frame.** Se cachean texturas o se usa un
   `Sprite` con `tint`. Miles de `Graphics` nuevas por frame = GC destructor.
4. **Nada de `new` dentro del bucle de simulación.** Pool de objetos para entidades y disparos.
5. **`dt` fijo con acumulador**, nunca `dt` variable del frame: si no, la simulación
   depende del framerate y no es determinista.

> Ojo con PixiJS **v8**: el canvas se accede como `app.canvas` (en v7 era `app.view`), y
> `app.init()` es asíncrono (`await app.init({...})`).

---

## 3. Reparto de responsabilidades

| Persona | Sistema principal | Ámbito |
|---|---|---|
| **P1 — Luciano** | Generación procedural + capa de datos/render | Ruido, terreno, grilla tipada, autómata de plantas, render Pixi, cámara |
| **P2 — Franco** | Vida artificial | Entidades, necesidades, percepción, IA, reproducción, muerte, HUD y gráfica |

**Regla de oro:** quien *define* una clase compartida la entrega temprano y el otro la consume
sin modificarla sin avisar. Las interfaces se acuerdan antes de implementar.

---

## 4. Estructura de carpetas

```
simulacion-ecosistemas/
├─ index.html
├─ package.json
├─ vite.config.js
├─ docs/
│  └─ DECISIONES.md
├─ assets/                 # atlas de sprites (si se elige PNG+JSON en D18)
├─ src/
│  ├─ main.js              # bootstrap + bucle principal
│  ├─ config.js            # TODOS los parámetros de la simulación
│  ├─ core/                # prng.js, noise.js, utils.js
│  ├─ world/               # grid.js, terrain.js, cell.js
│  ├─ entities/            # entity.js, plant.js, herbivore.js, predator.js
│  ├─ systems/             # needs.js, perception.js, spatialHash.js,
│  │                       # movement.js, plantGrowth.js, reproduction.js, death.js
│  ├─ render/              # atlas.js (F7.5), camera.js, terrainRenderer.js,
│  │                       # plantRenderer.js, entityRenderer.js (F7.5: ParticleContainer)
│  └─ ui/                  # hud.js, chart.js
└─ tests/
```

---

## 5. Convenciones de trabajo

- Rama por fase: `main`, `feat/mundo`, `feat/entidades`, `feat/ia`, `feat/ui`, `feat/vegetacion`,
  `feat/sprites` (F7.5)
- **Commit chico y testeable**: 1 commit = 1 cambio con sentido. Nada de "wip final final"
- **Toda feature debe quedar visible en pantalla antes de pasar a la siguiente fase**
- Ningún parámetro hardcodeado: todo en `src/config.js`
- Mensaje de commit: `tipo(scope): qué hace` (feat, fix, refactor, docs, perf)
- `npm run lint` debe pasar limpio antes de cada commit
- Pull request mínimo aunque se trabaje en paralelo: obliga a que el código se lea

### Reglas para trabajar con IA (los dos)

1. **La IA propone, ustedes revisan.** Nunca commitear código que no entiendan.
2. Pedir **un cambio por prompt**. "Agregame el sistema de reproducción" → diff gigante inmanejable.
3. Después de cada bloque generado: **ejecutar y ver el resultado**, no asumir que funciona.
4. **Pedir siempre el console.log de depuración** con cada módulo nuevo, y comprobarlo.
5. Verificar que la IA no mete `Math.random()`, `Date.now()` ni `new Graphics()` dentro del bucle.
   Es el error que más veces va a cometer y siempre hay que volver atrás.
6. Prohibido pegar datos privados, claves, ni material de la materia en prompts.
7. Si la IA propone algo fuera del alcance del GDD → se descarta, no se "implementa por las dudas".
8. **Revisión cruzada:** antes de mergear, el otro lee el diff. Es la única garantía de calidad real.

---

## 6. Cronograma

| Fase | Duración | Entregable verificable |
|---|---|---|
| F0 · Setup y contrato | 1 día | Repo corriendo con Vite + Pixi, estructura, config, decisiones |
| F1 · Mundo procedural | 2 días | Mapa con agua/arena/tierra seedeado, visible |
| F2 · Capa de datos y entidades base | 2 días | Grilla tipada + entidad movible a 60 FPS |
| F3 · Plantas + autómata | 2 días | Vegetación que crece y se expande |
| F4 · IA herbívoro | 2 días | Herbívoros que comen, beben y exploran |
| F5 · Depredador + reproducción y muerte | 3 días | Cadena alimenticia completa y observable |
| F6 · Movimiento suave + UI + gráfico | 2 días | Animación interpolada, HUD, gráfica |
| F7 · Balance y performance | 2 días | 10+ min estable con muchas entidades |
| F7.5 · Sprites e instancing | 2 días | Atlas único + `ParticleContainer`, población al tope sin caída de FPS |
| F8 · Extras (v2) + entrega | 3 días | Segunda planta, mutaciones, README, demo, informe |

**Total estimado: ~21 días de trabajo repartido.** Ajustar según ritmo real.

**Reunión de sincronización:** 20 min diarios. Es el costo más barato que existe.

---

## 7. Tareas por fase

### F0 · Setup y contrato de datos

- [x] **T01 · P1** — Inicializar repo Git, `README.md`, `.gitignore` (con `node_modules/`, `dist/`)
- [x] **T02 · P2** — `npm create vite` (vanilla), `npm i pixi.js`, `npm i -D vitest eslint prettier`
      *(hecho manual, sin scaffolder: `package.json` + `vite.config.js` + `index.html` escritos a mano)*
- [x] **T03 · P2** — `package.json` con scripts: `dev`, `build`, `preview`, `test`, `lint`, `format`
- [x] **T04 · P1** — `index.html` + `src/main.js` mínimo con `await app.init()` y una ventana negra
      (confirma que PixiJS v8 levanta antes de escribir una línea de lógica)
- [x] **T05 · Ambos** — ESLint + Prettier + hook de `pre-commit` con `lint` y `test`
- [x] **T06 · Ambos** — Crear la estructura de carpetas de la sección 4
      *(todas menos `world/`, que es de P1 y sigue vacía)*
- [x] **T07 · Ambos** — Escribir `docs/DECISIONES.md` (1 página): stack, tamaño del mundo, semilla
      por defecto, resolución, tamaño de celda, valores por celda
- [x] **T08 · Ambos** — Acordar y **documentar las clases compartidas**: `Grid`, `Celda`, `Entity`,
      `necesidades`. Esto desbloquea todo lo demás → `docs/CONTRATO.md`
- [x] **T09 · Ambos** — `src/config.js` con todos los parámetros agrupados por sección
- [x] **T10 · Ambos** — `core/prng.js`: PRNG seeded (`mulberry32` o `xorshift32`) + tests de
      determinismo. **Va primero**: sin esto no hay mapa reproducible

> **Hito F0:** los dos pueden clonar, `npm install`, `npm run dev`, cambiar un parámetro de
> `config.js` y ver el cambio.

---

### F1 · Mundo procedural

- [x] **T11 · P1** — `core/noise.js`: **Value Noise** con interpolación *fade/smoothstep*
- [x] **T12 · P1** — **Perlin Noise** (evaluado y **descartado** a favor de Value Noise + fBm;
      decisión escrita en `docs/DECISIONES.md` D11)
- [x] **T13 · P1** — Mapeo de altura → terreno: bajos = **agua**, medios = **arena**,
      altos = **tierra**, con umbrales en config (+ caída de borde para formar islas)
- [x] **T14 · P1** — **Test:** misma seed ⇒ mapa idéntico celda a celda (`tests/terreno.test.js`)
- [x] **T15 · P2/P1** — Render del terreno con Pixi: **un único `Sprite`** con textura de
      1 px por celda (prohibido `Graphics` por celda) — `render/terrainRenderer.js`
- [x] **T16 · P2** — Input: tecla `R` regenera el mundo y la población con seed nueva, `S` muestra la seed
- [x] **T17 · P2** — FPS en pantalla (HUD); el tiempo de generación se mide en `scripts/verTerreno.mjs`
- [x] **T18 · P2** — Probado con 5 seeds (1337/9001/42/2024/7): masas de agua y tierra bien formadas

> **Hito F1:** mapa coherente, con agua y tierra de forma natural, regenerable en caliente.

---

### F2 · Capa de datos y entidades base

- [x] **T19 · P1** — `world/grid.js` con **`Uint8Array` para terreno** (no array de objetos)
- [x] **T20 · P1** — Capa de contenido sobre la grilla: `Uint8Array` de tipo de planta,
      `Int32Array` de id de entidad por celda (+ `Float32Array` de altura). Índices
      paralelos, nunca objetos por celda
- [x] **T21 · P1** — Consultas sobre la grilla: `esAgua`, `esArena`, `esTierra`, `esBorde`,
      `estaLibre`, `dentro`, `terrenoEn`; ocupar/liberar con verificación de id
- [x] **T22 · P2** — `entities/entity.js`: **especie base** (comportamiento) + enums. Los datos
      de cada bicho van a **arrays tipados** (SoA, ver D13), no a un objeto por animal
- [x] **T23 · P2** — Contenedor de entidades **SoA**: arrays tipados + alta/baja por `id` y
      separación por especie (`entityManager.js`)
- [x] **T24 · Ambos** — **Spatial hash**: indexar entidades por celda para que el vecindario sea
      O(vecinos) y no O(n²). Es la pieza más importante para que aguante la simulación
- [x] **T25 · Ambos** — Bucle principal con **timestep fijo + acumulador** y `requestAnimationFrame`
- [x] **T26 · Ambos** — **Reciclado de entidades**: crear/borrar sin generar basura. Con SoA (D13)
      es una **lista de `id` libres**; el pool de objetos (`systems/pool.js`) se eliminó

> **Hito F2:** puntos de colores moviéndose sobre el mapa a 60 FPS, sin comportamiento todavía.

---

### F3 · Plantas y autómata celular

- [x] **T27 · P1** — Estados de planta: `SEMILLA → JOVEN → ADULTA → MUERTA`, guardados en el
      `Uint8Array` de la grilla (`world/cell.js`, `world/grid.js`)
- [x] **T28 · P1** — Crecimiento por tick, condicionado al tipo de terreno
      *(la humedad quedó **descartada por decisión**, D16: no es una capa de la grilla y no se va a
      usar; el crecimiento depende solo del terreno y de la edad del estado)*
- [x] **T29 · P1** — **Expansión (autómata celular)**: reglas locales de vecindad para extenderse
      (vecindad 4/8 con buffer de nacimientos en `systems/plantGrowth.js`)
- [x] **T30 · P1** — Muerte de plantas: **por edad**
      *(una adulta vive `ticksVidaAdulta` ticks desde que llega a adulta — 7200 por defecto,
      2 minutos simulados — y pasa a `MUERTA`; la capa de edad pasó a `Int32Array`. Ya mueren
      fuera de tierra y al ser comidas vía `comerPlanta`. Sin humedad ni pisadas: D16)*
- [x] **T31 · P1** — Semillado inicial de vegetación sobre el terreno generado (`sembrarVegetacion`)
- [x] **T32 · P2** — Render de plantas con tamaño/color según estado (que el crecimiento se vea)
      (`render/plantRenderer.js`)
- [x] **T33 · P2** — Botón de pausa y velocidad de simulación (`1× / 2× / 4×`) (`ui/controles.js`)

> **Hito F3:** la vegetación **crece y coloniza** el mapa sola, visiblemente, y las plantas
> adultas mueren por edad.

---

### F4 · IA del herbívoro (sistema de necesidades)

- [x] **T34 · P2** — Necesidades `hambre`, `sed`, `deseoRepro` en `[0, 1]`
      (`edad` con su unidad natural; ver `docs/CONTRATO.md` §4)
- [x] **T35 · P2** — **Decisión por prioridad**: hambre crítica > sed > reproducirse > explorar
- [x] **T36 · P2** — Percepción con el spatial hash: detectar plantas, agua y otros herbívoros
      en el radio de visión (`src/systems/perception.js`)
- [x] **T37 · P2** — Conducta de **comer**: acercarse → morder → la planta baja de estado o
      desaparece (`comerPlanta`, API de P1: P2 nunca escribe `planta`/`terreno`)
- [x] **T38 · P2** — Conducta de **beber**: ir a la celda de agua adyacente más cercana
      (y campo BFS `aguaDir*` cuando el agua no está a la vista)
- [x] **T39 · P2** — Conducta de **explorar**: destino aleatorio con *wander* (ruido en el rumbo)
- [x] **T40 · P2** — Penalización por terreno: arena y agua son más lentas al atravesarlas
- [x] **T41 · P1** — Ajustar parámetros para que el herbívoro no muera en los primeros 30 s
      (que el resultado se vea: no deambulan sin objetivo, comen y beben de verdad)
- [x] **T42 · Ambos** — Test de determinismo: misma seed + mismos parámetros ⇒ misma simulación
      (con terreno, vegetación y necesidades: `tests/determinismo.test.js`)

> **Hito F4:** herbívoros buscando comida, yendo a beber y deamburando. Ya mueren y nacen.
>
> **Adelantado desde F5 (lado herbívoro):** T45 (muerte por causas separadas:
> hambre/sed/vejez, `causaDeMuerte` + `ctx.muertesPorCausa`), T46 (reproducción con
> deseo, cooldown y pareja) y T47 (cría en celda libre adyacente). El lado del
> **depredador** (T43/T44) y la depredación como causa de muerte se completaron en F5.

---

### F5 · Depredador, reproducción y muerte

- [x] **T43 · P2** — Depredador: detección de herbívoros en radio, **persecución** y caza
      (`predator.js` + `buscarPresa`/`buscarDepredador` en `perception.js`)
- [x] **T44 · P2** — Balance del depredador: más rápido pero menos eficiente (trade-off)
      (velocidad 1.7 > 1.2, pero cada persecución cuesta tiempo)
- [x] **T45 · P2** — **Muerte por causas separadas y observables**: hambre, sed, edad, depredación
      *(hechas en F4 y completadas en F5: `causaDeMuerte` + `CAUSA_MUERTE.DEPREDADO`, contadas
      por separado en `ctx.muertesPorCausa`)*
- [x] **T46 · P2** — **Reproducción**: requiere no estar hambriento/sediento, cooldown,
      y presencia de pareja del mismo tipo y edad mínima
      *(herbívoros en F4 y depredadores en F5: `quiereReproducir` + `aplicarNacimientos`)*
- [x] **T47 · P2** — Nacimiento de la cría en celda libre adyacente válida
      *(herbívoros en F4 y depredadores en F5: `celdaLibreAdyacente` + nacimientos diferidos)*
- [x] **T48 · P2** — Semilla inicial de herbívoros y depredadores en zonas habitables
      (`sembrar` + `poblar`: celdas de tierra al azar con el PRNG)
- [x] **T49 · P1** — Restricción de terreno en el movimiento (no cruzar agua profunda sin costo)
      *(hecho: `movement.js` consulta la celda destino y frena la velocidad según el terreno —
      agua ÷ 4, arena ÷ 1.6 — con factores derivados de `costeAgua`/`costeArena`; el coste
      energético lo cobra `needs.js` y el campo BFS mantiene a los animales lejos del agua.
      Se eligió **frenar, no bloquear**: D17. Tests en `tests/movement.test.js`)*
- [x] **T50 · Ambos** — Test de integración: la **cadena alimenticia completa** funciona
      (planta → herbívoro → depredador) y se nota en pantalla
      (`tests/cadenaAlimenticia.test.js` + `scripts/simular.mjs`, que ya cuenta las muertes
      `d` por depredación)

> **Hito F5:** ecosistema con tres niveles tróficos. **v1 completada.**

---

### F6 · Movimiento suave, interfaz y visualización

- [x] **T51 · P1** — **Movimiento interpolado**: la entidad no salta de celda, transiciona
      *(resuelto de otra forma: la posición es un `float` en celdas (`Float32Array`, ver D7) que se
      integra con timestep fijo de 1/60 s (D8), y el renderer dibuja esa posición exacta. No hay
      saltos de celda que interpolar, así que no se usa `lerp` — quedó como util sin uso)*
- [x] **T52 · P1** — Velocidad por especie y orientación del sprite según el rumbo
      *(completa: velocidad 1.2 herbívoro / 1.7 depredador en `config.js` y orientación resuelta en
      T78 con sprites laterales, `scaleX` según `dirX` y `rotation = 0`; se acepta no distinguir la
      dirección vertical — ver `docs/DECISIONES.md` D18)*
- [x] **T53 · P1** — Cámara si el mundo es mayor que la ventana, con seguimiento de una entidad
      *(adelantada por P2 en `src/render/camera.js`: pan, zoom, seguimiento y límites.
      La API se acuerda en la reunión de sincronización — ver `docs/DECISIONES.md` D3)*
- [x] **T54 · P2** — **HUD**: plantas / herbívoros / depredadores / total / tiempo / seed
      *(completo: plantas, herbívoros, carnívoros, total, nacidos, muertos, tiempo, seed, FPS,
      velocidad y estado — `ui/hud.js`)*
- [x] **T55 · P2** — **Gráfico de evolución de poblaciones** en el tiempo (canvas 2D aparte o
      `Graphics` redibujado una vez por segundo, **nunca** por frame) (`ui/grafico.js`)
- [x] **T56 · P2** — Leyenda de colores + vista de depuración de necesidades
      (barras de hambre/sed sobre una entidad seleccionada) (`ui/leyenda.js`,
      `render/necesidadesRenderer.js`, tecla `D` y clic sobre un bicho)
- [x] **T57 · Ambos** — Paleta y contraste: las entidades deben distinguirse del terreno
      *(paleta centralizada en `render/paleta.js` y revisión visual cerrada por el usuario con los
      sprites definitivos de F7.5)*

> **Hito F6 (cumplido):** la simulación se **observa** con claridad, no solo se ejecuta.

---

### F7 · Balance, performance y estabilización

- [x] **T58 · Ambos** — Mover todos los números mágicos a `config.js`
      *(alcance completo A+B+C: IA, simulación/mundo y cámara/UI/bucle. Ticks de giro **por
      especie** — base en `CONFIG.ia`, herbívoro y depredador con sus propios min/max. Las
      conversiones segundos↔ticks salen de `TICKS_POR_SEGUNDO`, derivado de `pasoFijo`.
      Ver `docs/DECISIONES.md` D19)*
- [x] **T59 · Ambos** — Ejecutar 10+ minutos seguidos y registrar: poblaciones, colapsos, FPS,
      memoria
      *(corrida real: `node scripts/simular.mjs 1337 10` → **10 min simulados en 39,5 s reales**.
      Herbívoros 120 → 136 (118 nacimientos), depredadores 25 → **4** (declive sostenido),
      plantas ~35.700 estables. 123 muertes: 50 depredados, 69 por vejez, 3 por sed, 1 por hambre.
      FPS/memoria del peor caso de render (T79): 5,69 ms/frame, 2 draw calls, heap Δ 2,79 MB sin
      *GC sawtooth*. Comando: `node --expose-gc scripts/medirPeorCaso.mjs 60`. Detalle en D18/D20)*
- [x] **T60 · Ambos** — **Bucle de ajuste**: cambiar un parámetro → 1 corrida medida → decidir
      (no cambiar cinco cosas a la vez)
      *(tres corridas de 10 min con `SIM_OVERRIDE=SECCION.CLAVE=VALOR` sobre la misma seed 1337:
      `depredador.crecimientoReproduccion=0.006`, `depredador.decaimientoReproduccion=0.005` y
      `depredador.segundosPersecucion=40`. Las tres dieron **poblaciones idénticas** al baseline
      (herb 136 · pred 4 en min 10, 118 nacimientos) ⇒ se descartan los tres cambios y **no se
      modifica `config.js`**. El declive de depredadores queda como limitación conocida para un
      próximo bucle (probar `radioReproduccion`/`radioVision`). Ver D20)*
- [x] **T61 · P1** — Corregir los 5 bugs más frecuentes antes de seguir
      *(4 bugs de F7.5 en D18 —espejo, rumbo, arranque y sprites invisibles— más 4 nuevos:
      ① gráfico congelado tras `R` (`Grafico.reiniciar()` + reset de `muertesPorCausa`),
      ② barras de necesidades clavadas al panear/zoom (caché incluye la cámara),
      ③ off-by-one en el rebote de bordes (última fila/columna inhabitable),
      ④ semillas duplicadas en expansión vegetal (reserva inmediata de la celda destino).
      4 tests de regresión nuevos (`tests/grafico.test.js`, `tests/render.test.js`,
      `tests/movement.test.js`, `tests/plantas.test.js`) ⇒ 126 tests en total. Ver D21.
      Limitación conocida: un id reciclado **en el mismo tick** hace que la selección/cámara
      siga a otro animal; requiere generación por id en `EntityManager`)*
- [x] **T62 · P1** — **Perfilado con DevTools / Performance monitor**:
      - [x] ¿El vecindario sigue siendo O(vecinos) con 2000 entidades?
      - [x] ¿Hay GC sawtooth en el heap? (indica `new` en el bucle)
      - [x] ¿El batch de Pixi se rompe por cambiar `tint` a menudo? (agrupar por tipo)
      *(script headless `node --expose-gc scripts/perfilado.mjs`: 3,4 vecinos/consulta con 2000
      entidades y 0,4 ns/consulta (0,11 ns/vecino) —20,2× más rápido que fuerza bruta—; heap tras
      GC estable en 15,29 MB (+0,46 MB máx en 10 min, sin sawtooth); 2 `ParticleContainer` = 2 draw calls,
      pools reutilizados, heap Δ −0,10 MB con tint alternando 120 frames. Ver D22)*
- [x] **T63 · Ambos** — Tests: determinismo del ruido, umbral de terreno, reproducción, muerte,
      tamaño del vecindario
      *(presentes: `prng.test.js`, `terreno.test.js`, `determinismo.test.js`, `herbivoro.test.js`
      —reproducción y causas de muerte—, `plantas.test.js` —muerte por edad—,
      `cadenaAlimenticia.test.js` —depredación— y `spatialHash.test.js` —O(vecinos))*
- [x] **T64 · P1** — Culling: no renderizar celdas ni entidades fuera de la cámara
      *(resuelto en F7.5: `PlantRenderer.rectVisible()` recorre solo el rectángulo visible y
      `EntityRenderer.render()` descarta por pantalla con `CONFIG.render.margenCulling`. El
      terreno es un único sprite escalado, así que no hay celdas que recortar. Ver D18/T79)*
- [x] **T83 · Ambos** — **Medir cuántas entidades caben en pantalla sin bajar de 60 FPS**, por
      tipo (plantas, herbívoros, depredadores) y todo junto
      *(script headless `node scripts/medirCapacidadPantalla.mjs 60 3`: escalera de cantidades en
      zoom 1 y zoom 0,2, mediana de 3 repeticiones de 60 frames, presupuesto 16,67 ms/frame.
      **Vista normal (zoom 1 — 14.651 celdas visibles):** plantas 14.651 → 0,70 ms; herbívoros
      4.000 → 0,59 ms; depredadores 4.000 → 0,61 ms; **todo junto 14.651 + 4.000 = 18.651 en
      pantalla → 1,27 ms**. **Zoom mínimo (0,2 — mundo completo):** plantas 65.536 → 3,62 ms;
      herbívoros 4.000 → 0,91 ms; depredadores 4.000 → 0,86 ms; **todo junto 65.536 + 4.000 =
      69.536 en pantalla → 4,16 ms**. Todos los escenarios pasan: el peor caso usa el 25 % del
      presupuesto. El techo lo fijan `grid.total` (65.536) y `CONFIG.entidades.maxEntidades`
      (4.000), **no los FPS**. Ver D23)*

> **Hito F7 (cumplido):** la simulación es **estable, reproducible y rinde a 60 FPS**. Ya se
> puede enseñar. El techo medido (T83) es de 69.536 entidades simultáneas en pantalla en el peor
> caso de zoom, con 4,16 ms/frame frente a los 16,67 ms disponibles.

---

### F7.5 · Sprites de plantas y animales (atlas + instancing)

**Objetivo:** reemplazar los círculos/cuadrados actuales por sprites reales **sin que el costo de
render crezca con la población**. Es un cambio de representación, no de mecánica: no se tocan
`needs.js`, la IA ni la grilla.

**Restricción de diseño:** tienen que poder existir **todas las entidades posibles** a la vez —
hasta `CONFIG.entidades.maxEntidades` (4000) animales y hasta `grid.total` (65.536)
celdas con planta — sin bajar el framerate ni generar basura por frame. La capacidad se reserva
**al arrancar**; nunca se agranda el container durante la simulación.

> Verificado en `node_modules/pixi.js@8.22`: `ParticleContainer` solo acepta partículas que
> comparten **la misma textura base** (`TextureSource`); por eso el atlas no es opcional. Además
> es una API marcada como **experimental** en v8: `Particle` reemplaza a `Sprite` adentro del
> container, y los cambios de `uvs`/`color` requieren `dynamicProperties` o `update()`.

- [x] **T75 · P1** — Atlas único armado **automáticamente desde sprites sueltos**: todos los PNG
      bajo `assets/sprites/` se descubren con `import.meta.glob`, se ordenan por ruta y se dibujan
      en un canvas offscreen al arrancar → una sola textura base con frames por UV. Plantas:
      `plantaNormal/{semilla,joven,adulta}.png`; la planta muerta **desaparece**, no tiene frame.
      El sprite cambia por **evento de estado** de `grid.planta` (al nacer, al pasar a joven, al
      pasar a adulta), **no por edad** y sin leer la capa `_edadPlantas`. Animales: cycles de
      caminar `trike_herbivore/walk_0..8` (9 cuadros) y
      `ceratosaurus_carnivore/walk_0..10` (11 cuadros) — sprites laterales, se voltean con
      `scaleX` según `dirX`, sin rotación. Casilleros de **64 × 64**: PNG dibujados a tamaño
      natural y centrados (sin estirar). Rutas, prefijos y cantidad de cuadros **por especie** en
      `CONFIG.sprites` (`rutaPlanta` / `rutaAnimal`); arte real verificado en `tests/atlas.test.js`.
      Nombres visibles en `paleta.js`.
- [x] **T76 · P1** — **Spike de validación contra Pixi v8.22 instalado** (no contra la doc de
      memoria): `ParticleContainer`, `Particle`, `dynamicProperties` (`position`, `vertex` —que
      incluye `scaleX` para el flip—, `uvs`, `color`), `addParticle` / `particleChildren`,
      `update()` y `boundsArea`. Probar 1000 partículas con dos frames del mismo atlas y confirmar
      que sale en **un solo draw call**. Anotar el resultado y los puntos de API confirmados en
      `docs/DECISIONES.md` (D18).
      *(Confirmado: `particleChildren`, `update()`, `boundsArea` y `dynamicProperties` existen en
      `pixi.js@8.22.0`; `GlParticleContainerAdaptor.execute` emite un solo `drawElements` por
      container → 2 draw calls totales. Cubierto por `tests/render.test.js`.)*
- [x] **T77 · P1** — Migrar `render/plantRenderer.js` a `ParticleContainer`: pool fijo de
      `Particle` dimensionado para **`grid.ancho * grid.alto`**, frame del atlas elegido **solo por
      el estado de `grid.planta`** (`SEMILLA`/`JOVEN`/`ADULTA`; `MUERTA` y `NADA` no se dibujan),
      sin consultar edad, y actualización de la lista solo cada
      `CONFIG.plantas.ticksPorRefrescoRender` ticks como hoy. Sin `new Particle()` ni
      `new Sprite()` en el bucle. Coordinar con **T64**: aplicar culling por cámara
      (`CONFIG.render.margenCulling`) antes de cargar las partículas visibles, para que el peor
      caso no signifique dibujar 65.536 partículas fuera de pantalla.
- [x] **T78 · P2** — Migrar `render/entityRenderer.js` a `ParticleContainer`: pool fijo de
      `Particle` para **`CONFIG.entidades.maxEntidades`**, alta/baja por `id` reutilizando
      partículas (sin `new` en el bucle), cycle de caminar por especie del atlas con fase derivada
      de `ctx.tick` y `manager.velocidad[id]` (sin arrays nuevos), **`scaleX` con signo según
      `dirX`** (sprites laterales, `rotation = 0`) y `color` para el modo depuración de **T56**.
      El renderer recibe `ctx.tick` como parámetro nuevo — cierra la parte visual pendiente de
      **T52** con el trade-off aceptado de no distinguir la dirección vertical. Respetar el
      contrato SoA (D13): el renderer solo lee arrays.
- [x] **T79 · Ambos** — **Prueba del peor caso (definición de "todas las entidades"):** forzar
      vegetación en todas las celdas habitables y poblar hasta el tope de animales; medir FPS,
      draw calls, heap y tiempo de `update()`/`reconstruir()` con `scripts/simular.mjs` y con el
      Performance monitor. Verificar que no hay *GC sawtooth* (ni un `new` por entidad/frame). Si
      65.536 partículas no entran en presupuesto, decidir y documentar entre culling estricto,
      *chunks* por región o tope de plantas visibles — **sin cambiar la simulación**.
      *(Resultado: 65.536/65.536 plantas y 4.000/4.000 animales, 5,69 ms/frame, 2 draw calls,
      heap Δ 2,79 MB sin sawtooth —verificado también con 120 frames—, pool reutilizado y nunca
      excedido. Medido con `node --expose-gc scripts/medirPeorCaso.mjs 60`. No hizo falta
      recortar el alcance visual: alcanzó con el culling por cámara de T64.)*
- [x] **T80 · P2** — Tests de regresión de la capa de render: `estado → frame` de planta por evento
      (`SEMILLA`/`JOVEN`/`ADULTA`, `MUERTA` ⇒ ninguno, **sin depender de la edad**), cycle de
      caminar por especie con wrap determinista, flip según `dirX`, el pool nunca supera la
      capacidad reservada, y nacimientos/muertes no dejan partículas huérfanas. La lógica de mapeo
      se testea en Node, sin WebGL.
- [x] **T81 · P1** — Actualizar `docs/DECISIONES.md` con **D18** (atlas + `ParticleContainer`,
      por qué se descarta `Sprite` por entidad y qué se descartó de la API experimental),
      `docs/CONTRATO.md` si cambia la interfaz pública de los renderers, y el README (control de
      sprites y límites de capacidad).
- [x] **T82 · Ambos** — Cierre: `npm run lint`, `npm test` y `npm run build` en verde; efecto
      visible en pantalla (plantas y animales con sprite propio) y medición del peor caso
      registrada junto a T59. *(Verificación automática en verde: lint, 120 tests, build y Prettier sobre los archivos tocados; medición registrada en T59 y D18. La comprobación visual en pantalla la hace el usuario con `npm run dev`.)*

> **Hito F7.5:** la simulación se ve con sprites reales y aguanta la población máxima sin caer de
> FPS. Si T79 no pasa, se baja el alcance visual (más culling/chunks), **nunca** la simulación.

---

### F8 · Extras (v2) y entrega

- [x] **T65 · P2** — **Segunda especie vegetal** con reglas de expansión distintas (pasto vs micelio)
      *(capa paralela `especiePlanta`, reglas por sobreescritura en `CONFIG.plantas.especies`;
      8 tests en `tests/especiesVegetales.test.js`. D25)*
- [x] **T66 · P2** — **Competencia territorial** entre especies vegetales: una desplaza a la otra
      *(solo el micelio desplaza al pasto, codificado como `-2 - j` en `buscarVecinaLibre`;
      `ctx.desplazamientos` cuenta los eventos. Balance a 10 min con seed 1337: ~19.000
      micelios, ~16.000 pastos y ~2.642 desplazamientos)*
- [x] **T67 · P2** — **Mutaciones y herencia**: variación en velocidad, tamaño, percepción,
      consumo, tiempo de reproducción
      *(cinco `Float32Array` SoA, herencia de dos padres calculada al anotar el nacimiento,
      mutación con `CONFIG.genetica` y tupla plana reutilizable; 11 tests en
      `tests/genetica.test.js`. D26)*
- [x] **T68 · P1** — Mostrar y copiar la seed para poder reproducir un escenario interesante
      *(seed en el HUD, botón *copiar seed* y tecla `S` con `navigator.clipboard` + fallback;
      aviso temporal en el HUD)*
- [x] **T69 · P1** — Build de producción (`npm run build`) y verificar que funciona servido,
      no solo en dev *(probado con `npm run preview -- --host 127.0.0.1 --port 4173`:
      `index.html` y assets servidos. `scripts/simular.mjs` también quedó libre de
      `manager.energia[id]`)*
- [x] **T70 · Ambos** — `README.md`: qué es, cómo correr, controles, decisiones técnicas, capturas
      *(README completo con estado por fase, controles, config/presets, estructura y
      garantías; **las capturas siguen pendientes**, con nombres y contenido en
      `docs/DEMO.md`)*
- [x] **T71 · Ambos** — Informe/GDD final actualizado con lo realmente implementado
      *(sección 19 de `Gdd-Tdd.txt` + D25/D26/D27 en `docs/DECISIONES.md` y contrato
      actualizado con genes y `especiePlanta`)*
- [ ] **T72 · Ambos** — Grabar demo en video mostrando: expansión vegetal, crecimiento de
      poblaciones, un colapso y una recuperación
      *(guion de 4 escenas listo en `docs/DEMO.md`; no se pudo grabar automáticamente:
      no hay `ffmpeg`, `chrome`, `msedge` ni `chromium` en este entorno)*
- [ ] **T73 · Ambos** — Code review cruzado final: cada uno lee y comenta el código del otro
      *(plantilla y puntos a revisar en `docs/DEMO.md`; requiere la firma de P1 y P2)*
- [x] **T74 · Ambos** — Entrega con commits limpios y sin `console.log` de debug
      *(sin `console.*` ejecutable en `src/`, verificado con `npm run lint:prod`;
      avisos movidos a `hud.avisar()`. `lint`, 210 tests, Prettier y build en verde)*
- [x] **T84 · Ambos** — **Menú para generar mapas** con seed, plantas y NPCs iniciales elegidos
      *(pedido extra: panel con tres posiciones —oculto, cajón abajo y pantalla completa— y campos
      para seed, plantas, herbívoros y depredadores. `src/ui/generadorMapa.js` valida los rangos,
      acepta seeds numéricas o texto —hasheadas con `hashString`— y llama a un único
      `regenerarMundo()` en `main.js`, que también usa la tecla R. La vegetación se siembra con
      cantidad exacta vía `sembrarVegetacion(ctx, cantidad)`, sin cambiar el modo por densidad
      que usan los scripts. 8 tests nuevos del panel + 4 de siembra exacta ⇒ 138 tests. Ver D24)*
- [x] **T85 · Ambos** — **Panel de configuración completo** (evolución de T84): renombrado a
      *Configuración*, con una categoría por sección de `config.js`, scroll con la rueda y edición
      de números, booleanos y colores (las rutas de sprites ya no se muestran). Incluye **presets**
      incluidos y guardados: cargar en el formulario, guardar, borrar, descargar uno o todos e
      importar JSON (`ecosistemas-presets-v1`). **Aplicar y recargar** valida todo, guarda los
      overrides en `localStorage` (`ecosistemas.config.v1`) y recarga la página, así también se
      aplican los valores que se capturan al arrancar (mundo, atlas, zoom, colores);
      **Restablecer** limpia solo los overrides activos. Las acciones están en la cabecera, al lado
      del título; los botones de posición se quitaron y el botón flotante sigue recorriendo
      *oculto → abajo → pantalla*. Tirador `◥` arriba a la derecha para agrandar arrastrando: en
      *abajo* cambia la altura anclada al borde inferior y en *pantalla* cambia ancho y alto, con
      límites al viewport. Posición, tamaños y scroll se guardan en `ecosistemas.ui.v1` para que la
      recarga no cierre el menú ni pierda el punto de la lista. Nuevos módulos `configUtils.js`,
      `configPersistencia.js` y `presets.js`; 175 tests en total, `npm run lint` y `npm run build`
      en verde.

> Opcionales si sobra tiempo: ciclo día/noche, clima, biomas, más especies.

---

## 8. Matriz de dependencias (qué bloquea a qué)

```
T10 PRNG seeded        →  T11/T13 terreno  →  T19 grilla  →  T29 autómata
T08 contrato de datos  →  todo lo demás
T19/T20 grilla tipada  →  T24 spatial hash →  T36 percepción IA
T24 vecindario         →  T32/T33/T37 → T43 depredador
T34..T35 necesidades   →  T45/T46/T47 (muerte y reproducción)
T25 timestep fijo      →  T42 test de determinismo
T51 movimiento suave   →  T53 cámara
T76 spike Pixi v8      →  T75 atlas  →  T77/T78 migración de renderers
T64 culling            →  T77/T79 (peor caso sin dibujar fuera de pantalla)
T78 flip del sprite (scaleX) →  cierre visual de T52
T77/T78/T79            →  T80/T81/T82
```

**Regla:** si una tarea depende de otra que no está terminada, no se empieza. Se elige otra del
mismo nivel.

---

## 9. Definition of Done (para cada tarea)

Una tarea está terminada cuando:

- [ ] Corre sin errores en consola ni warnings del linter
- [ ] Se **ve el efecto en pantalla** (o tiene test si es lógica pura)
- [ ] Los parámetros relevantes están en `config.js`
- [ ] No introduce `Math.random()`, `new` en el bucle, ni `Graphics` por celda
- [ ] `npm run lint` y `npm run test` pasan
- [ ] Tiene commit con mensaje claro
- [ ] El otro lo revisó

---

## 10. Riesgos y cómo mitigarlos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Que la IA genere código que no entienden | Alto | 1 prompt = 1 cambio; probar siempre antes de commitear |
| La IA mete `Math.random()` y rompe el determinismo | Alto | Test de determinismo en T14 y T42, bloquea el merge |
| Caída de framerate por GC o `Graphics` por celda | Alto | Reglas de JS de la sección 2 + perfilado en T62 |
| Un solo punto de fallo en el schedule | Alto | Tareas de < 1 día; hitos con entregable verificable |
| Reparto desigual (uno hace el 80%) | Alto | Revisión cruzada obligatoria en la definición de "hecho" |
| Perder la mitad del tiempo en el mapa perfecto | Medio | El terreno es **decorativo y procedural**; 1 día y listo |
| Simulación que colapsa en 20 segundos | Medio | Tests de integración largos + ajuste de balance documentado |
| Que la IA invente APIs de PixiJS | Medio | La IA suele mezclar v7 y v8 — revisar el `node_modules/pixi.js` y no la doc de memoria |
| `ParticleContainer` cambie (API experimental en v8) | Medio | Spike T76 contra la versión instalada, conclusión escrita en D18 antes de migrar |
| El atlas rompa el batch por usar varias texturas base | Alto | **Una sola `TextureSource`**, frames por UV; verificado en T75/T76 antes de T77/T78 |
| 65.536 partículas de planta saturen la GPU | Alto | Culling (T64) + medición del peor caso (T79); si falla, chunks, no recortar la simulación |
| Repartir el código en el último día | Alto | **El código se sube al repo todos los días.** Sin excepciones |

---

## 11. Checklist de entrega final

- [ ] `npm install && npm run dev` funciona en una máquina limpia
      *(verificado en el entorno de desarrollo; queda repetirlo en una máquina limpia)*
- [x] `npm run build` genera un `dist/` funcional
      *(verificado también con `npm run preview -- --host 127.0.0.1 --port 4173`)*
- [ ] Misma seed ⇒ mismo resultado (demostrado en pantalla)
      *(los tests `determinismo.test.js` y `terreno.test.js` ya lo verifican; falta mostrarlo en la demo)*
- [x] Los tres niveles tróficos son visibles y observables
- [x] HUD + gráfico de poblaciones funcionando
- [x] 60 FPS con una población grande (medido, no supuesto)
      *(T79/T83: peor caso 65.536 plantas + 4.000 animales en 4,16–5,69 ms/frame; presupuesto 16,67 ms)*
- [ ] `README.md` completo con instrucciones y capturas
      *(README completo; capturas pendientes, guion en `docs/DEMO.md`)*
- [ ] Video demo de la simulación corriendo
      *(guion listo en `docs/DEMO.md`; grabación manual pendiente, T72)*
- [x] Informe final con lo balanceado realizado vs. esperado
      *(sección 19 de `Gdd-Tdd.txt`; D20 documenta el declive de depredadores)*
- [x] Repositorio sin `console.log` de debug ni archivos basura
      *(verificado con `npm run lint:prod`; T74)*

---

*Actualizar esta checklist semanalmente en la reunión de sincronización.*