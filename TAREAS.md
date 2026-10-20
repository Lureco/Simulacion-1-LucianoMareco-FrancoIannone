# Plan de Tareas — Simulación de Ecosistemas

**Proyecto:** Simulación de Ecosistemas 2D (Vida Artificial + Mundo Procedural)
**Integrantes:** Luciano Mareco (P1) — Franco Iannone (P2)
**Profesor:** Facundo Saiegh
**Doc base:** `Gdd-Tdd.txt`
**Stack:** JavaScript + PixiJS

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
├─ src/
│  ├─ main.js              # bootstrap + bucle principal
│  ├─ config.js            # TODOS los parámetros de la simulación
│  ├─ core/                # prng.js, noise.js, utils.js
│  ├─ world/               # grid.js, terrain.js, cell.js
│  ├─ entities/            # entity.js, plant.js, herbivore.js, predator.js
│  ├─ systems/             # needs.js, perception.js, spatialHash.js,
│  │                       # movement.js, plantGrowth.js, reproduction.js, death.js
│  ├─ render/              # renderer.js, camera.js, assets.js
│  └─ ui/                  # hud.js, chart.js
└─ tests/
```

---

## 5. Convenciones de trabajo

- Rama por fase: `main`, `feat/mundo`, `feat/entidades`, `feat/ia`, `feat/ui`, `feat/vegetacion`
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
| F8 · Extras (v2) + entrega | 3 días | Segunda planta, mutaciones, README, demo, informe |

**Total estimado: ~19 días de trabajo repartido.** Ajustar según ritmo real.

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
- [x] **T22 · P2** — `entities/entity.js`: posición (celda + offset), energía, edad, velocidad, estado
- [x] **T23 · P2** — Contenedor de entidades con alta/baja y separación por especie
- [x] **T24 · Ambos** — **Spatial hash**: indexar entidades por celda para que el vecindario sea
      O(vecinos) y no O(n²). Es la pieza más importante para que aguante la simulación
- [x] **T25 · Ambos** — Bucle principal con **timestep fijo + acumulador** y `requestAnimationFrame`
- [x] **T26 · Ambos** — **Pool de objetos** para entidades: crear/borrar sin generar basura

> **Hito F2:** puntos de colores moviéndose sobre el mapa a 60 FPS, sin comportamiento todavía.

---

### F3 · Plantas y autómata celular

- [x] **T27 · P1** — Estados de planta: `SEMILLA → JOVEN → ADULTA → MUERTA`, guardados en el
      `Uint8Array` de la grilla
- [x] **T28 · P1** — Crecimiento por tick, condicionado al tipo de terreno y humedad
- [x] **T29 · P1** — **Expansión (autómata celular)**: reglas locales de vecindad para extenderse
- [x] **T30 · P1** — Muerte de plantas: edad, falta de agua, pisadas de herbívoros
- [x] **T31 · P1** — Semillado inicial de vegetación sobre el terreno generado
- [x] **T32 · P2** — Render de plantas con tamaño/color según estado (que el crecimiento se vea)
      *(`render/plantRenderer.js`: 3 texturas + pool de sprites, refresco cada N ticks)*
- [x] **T33 · P2** — Botón de pausa y velocidad de simulación (`1× / 2× / 4×`)
      *(`ui/controles.js`: barra de botones + atajos `1`/`2`/`4` y `espacio`)*

> **Hito F3:** la vegetación **crece y coloniza** el mapa sola, visiblemente.

---

### F4 · IA del herbívoro (sistema de necesidades)

- [ ] **T34 · P2** — Necesidades normalizadas: `hambre`, `sed`, `deseo_repro`, `energía`, `edad`
      en `[0, 1]`
- [ ] **T35 · P2** — **Decisión por prioridad**: hambre crítica > sed > reproducirse > explorar
- [ ] **T36 · P2** — Percepción con el spatial hash: detectar plantas, agua y otros herbívoros
      en el radio de visión
- [ ] **T37 · P2** — Conducta de **comer**: acercarse → morder → la planta baja de estado o desaparece
- [ ] **T38 · P2** — Conducta de **beber**: ir a la celda de agua adyacente más cercana
- [ ] **T39 · P2** — Conducta de **explorar**: destino aleatorio con *wander* (ruido en el rumbo)
- [ ] **T40 · P2** — Penalización por terreno: arena y agua consumen más energía al atravesarlas
- [ ] **T41 · P1** — Ajustar parámetros para que el herbívoro no muera en los primeros 30 s
      (que el resultado se vea: no deambulan sin objetivo, comen y beben de verdad)
- [ ] **T42 · Ambos** — Test de determinismo: misma seed + mismos parámetros ⇒ misma simulación

> **Hito F4:** herbívoros buscando comida, yendo a beber y deamburando. Ya mueren y nacen.

---

### F5 · Depredador, reproducción y muerte

- [ ] **T43 · P2** — Depredador: detección de herbívoros en radio, **persecución** y caza
- [ ] **T44 · P2** — Balance del depredador: más rápido pero menos eficiente (trade-off)
- [ ] **T45 · P2** — **Muerte por causas separadas y observables**: hambre, sed, edad, depredación
- [ ] **T46 · P2** — **Reproducción**: requiere energía, no estar hambriento/sediento, cooldown,
      y presencia de pareja del mismo tipo y edad mínima
- [ ] **T47 · P2** — Nascimento de la cría en celda libre adyacente válida
- [ ] **T48 · P2** — Semilla inicial de herbívoros y depredadores en zonas habitables
- [ ] **T49 · P1** — Restricción de terreno en el movimiento (no cruzar agua profunda sin costo)
- [ ] **T50 · Ambos** — Test de integración: la **cadena alimenticia completa** funciona
      (planta → herbívoro → depredador) y se nota en pantalla

> **Hito F5:** ecosistema con tres niveles tróficos. **v1 completada.**

---

### F6 · Movimiento suave, interfaz y visualización

- [ ] **T51 · P1** — **Movimiento interpolado**: la entidad no salta de celda, transiciona
      (lerp de la posición visual hacia el destino)
- [ ] **T52 · P1** — Velocidad por especie y orientación del sprite según el rumbo
- [x] **T53 · P1** — Cámara si el mundo es mayor que la ventana, con seguimiento de una entidad
      *(adelantada por P2 en `src/render/camera.js`: pan, zoom, seguimiento y límites.
      La API se acuerda en la reunión de sincronización — ver `docs/DECISIONES.md` D3)*
- [x] **T54 · P2** — **HUD**: plantas / herbívoros / depredadores / total / tiempo / seed
      *(completo: también muestra FPS, velocidad de simulación y estado pausa/corriendo)*
- [ ] **T55 · P2** — **Gráfico de evolución de poblaciones** en el tiempo (canvas 2D aparte o
      `Graphics` redibujado una vez por segundo, **nunca** por frame)
- [ ] **T56 · P2** — Leyenda de colores + vista de depuración de necesidades
      (barras de hambre/sed sobre una entidad seleccionada)
- [ ] **T57 · Ambos** — Paleta y contraste: las entidades deben distinguirse del terreno

> **Hito F6:** la simulación se **observa** con claridad, no solo se ejecuta.

---

### F7 · Balance, performance y estabilización

- [ ] **T58 · Ambos** — Mover todos los números mágicos a `config.js`
- [ ] **T59 · Ambos** — Ejecutar 10+ minutos seguidos y registrar: poblaciones, colapsos, FPS,
      memoria
- [ ] **T60 · Ambos** — **Bucle de ajuste**: cambiar un parámetro → 1 corrida medida → decidir
      (no cambiar cinco cosas a la vez)
- [ ] **T61 · P1** — Corregir los 5 bugs más frecuentes antes de seguir
- [ ] **T62 · P1** — **Perfilado con DevTools / Performance monitor**:
      - [ ] ¿El vecindario sigue siendo O(vecinos) con 2000 entidades?
      - [ ] ¿Hay GC sawtooth en el heap? (indica `new` en el bucle)
      - [ ] ¿El batch de Pixi se rompe por cambiar `tint` a menudo? (agrupar por tipo)
- [ ] **T63 · Ambos** — Tests: determinismo del ruido, umbral de terreno, reproducción, muerte,
      tamaño del vecindario
- [ ] **T64 · P1** — Culling: no renderizar celdas ni entidades fuera de la cámara

> **Hito F7:** la simulación es **estable, reproducible y rinde a 60 FPS**. Ya se puede enseñar.

---

### F8 · Extras (v2) y entrega

- [ ] **T65 · P2** — **Segunda especie vegetal** con reglas de expansión distintas (pasto vs micelio)
- [ ] **T66 · P2** — **Competencia territorial** entre especies vegetales: una desplaza a la otra
- [ ] **T67 · P2** — **Mutaciones y herencia**: variación en velocidad, tamaño, percepción,
      consumo, tiempo de reproducción
- [ ] **T68 · P1** — Mostrar y copiar la seed para poder reproducir un escenario interesante
- [ ] **T69 · P1** — Build de producción (`npm run build`) y verificar que funciona servido,
      no solo en dev
- [ ] **T70 · Ambos** — `README.md`: qué es, cómo correr, controles, decisiones técnicas, capturas
- [ ] **T71 · Ambos** — Informe/GDD final actualizado con lo realmente implementado
- [ ] **T72 · Ambos** — Grabar demo en video mostrando: expansión vegetal, crecimiento de
      poblaciones, un colapso y una recuperación
- [ ] **T73 · Ambos** — Code review cruzado final: cada uno lee y comenta el código del otro
- [ ] **T74 · Ambos** — Entrega con commits limpios y sin `console.log` de debug

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
| Repartir el código en el último día | Alto | **El código se sube al repo todos los días.** Sin excepciones |

---

## 11. Checklist de entrega final

- [ ] `npm install && npm run dev` funciona en una máquina limpia
- [ ] `npm run build` genera un `dist/` funcional
- [ ] Misma seed ⇒ mismo resultado (demostrado en pantalla)
- [ ] Los tres niveles tróficos son visibles y observables
- [ ] HUD + gráfico de poblaciones funcionando
- [ ] 60 FPS con una población grande (medido, no supuesto)
- [ ] `README.md` completo con instrucciones y capturas
- [ ] Video demo de la simulación corriendo
- [ ] Informe final con lo balanceado realizado vs. esperado
- [ ] Repositorio sin `console.log` de debug ni archivos basura

---

*Actualizar esta checklist semanalmente en la reunión de sincronización.*