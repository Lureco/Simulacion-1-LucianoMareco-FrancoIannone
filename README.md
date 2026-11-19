# Simulación de Ecosistemas 2D

**Vida artificial + mundo procedural** — un ecosistema 2D donde plantas,
herbívoros y depredadores interactúan sobre un terreno generado por ruido.

- **Integrantes:** Luciano Mareco (P1 — mundo y render) · Franco Iannone (P2 — vida artificial)
- **Profesor:** Facundo Saiegh
- **Stack:** JavaScript ES2022 · [PixiJS v8](https://pixijs.com) · Vite · Vitest · ESLint + Prettier

> **Estado actual:** F5 hecha. La cadena alimenticia completa funciona: los
> herbívoros comen, beben, se reproducen y **huyen**; los carnívoros los
> **cazan**. El mundo procedural y las plantas ya están. Ver
> [Estado](#estado-del-proyecto).

---

## Cómo correrlo

```bash
npm install     # instala dependencias
npm run dev     # abre http://localhost:5173
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm test` | Corre los tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run lint:prod` | ESLint forbids `console.log` en `src/` (para la entrega) |
| `npm run format` | Prettier aplica formato |

> **Node.js:** hace falta **v20.19+ o v22.12+** (probado en v24.20.0).
> Si `node` no está en el PATH de Windows, agregá
> `C:\Program Files\nodejs` a las variables de entorno.

---

## Controles

| Tecla / ratón | Acción |
|---|---|
| **Arrastrar** | Mover la cámara (pan) |
| **Rueda** | Zoom in/out |
| **F** | Seguir a un herbívoro al azar |
| **G** | Volver al centro del mundo |
| **Espacio** | Pausar / reanudar |
| **R** | Regenerar el mundo y la población con una seed nueva |
| **S** | Mostrar la seed actual en consola |
| **T** | Mostrar el conteo de terreno (agua/arena/tierra) en consola |
| **⚙ Configuración** | Abrir el panel para editar los valores de `config.js` por categorías y administrar presets (tres posiciones: oculto, abajo, pantalla completa, con scroll con la rueda) |

El panel tiene una categoría por sección de `config.js` (`mundo`, `render`, `sprites`,
`tiempo`, `ia`, `terreno`, `plantas`, `entidades`, `herbivoro`, `depredador`,
`percepcion`, `ui` y `camara`) más una categoría **Presets**. Se pueden editar números,
booleanos y colores; las rutas de sprites no se muestran porque el atlas se arma al
iniciar y no se pueden cambiar desde el panel. El contenido scrollea con la rueda y el
tirador `◥` de la esquina superior derecha permite agrandar el panel arrastrando: en
**abajo** cambia la altura (anclado al borde inferior, arrastrá hacia arriba) y en
**pantalla** cambia ancho y alto. El panel recuerda su posición, tamaño y punto del scroll en
`localStorage` (`ecosistemas.ui.v1`), así que **Aplicar y recargar** lo reabre donde estaba —y en
la misma parte de la lista— en vez de cerrarlo.

Cargá los valores y apretá **Aplicar y recargar** (o **Enter** en un campo): se guardan
los cambios y la página recarga para que todo se lea desde cero. **Restablecer** vuelve
a los valores por defecto sin borrar tus presets. La seed acepta un número o cualquier
texto (se hashea de forma determinista); las cantidades de NPCs se limitan a
`CONFIG.entidades.maxEntidades` en total. **R** genera una seed nueva manteniendo las
cantidades elegidas en el panel.

En **Presets** hay incluidos (*Por defecto*, *Bosque frondoso*, *Cacería*, *Isla
tranquila*, *Simulación rápida*) y los tuyos. Elegir uno **llena el formulario** para
que lo revises y recién apliques. Podés guardar el estado actual con **Guardar como…**,
borrar tus presets, descargar el seleccionado o la colección completa en JSON y subirlos
con **Subir JSON** (los nombres repetidos se actualizan). Todo se guarda en `localStorage`.

---

## Estado del proyecto

Hitos según `TAREAS.md`:

| Fase | Estado | Nota |
|---|---|---|
| **F0** Setup y contrato | ✅ Hecho | Vite + Pixi v8 + ESLint/Prettier + hook + `config.js` + PRNG + tests |
| **F1** Mundo procedural | ✅ Hecho | Value Noise + fBm, grilla tipada, agua/arena/tierra, render y regeneración en caliente (T11-T18) |
| **F2** Datos y entidades base | ✅ Hecho | Entidad base, herbívoro, carnívoro, manager SoA, spatial hash, timestep fijo, render |
| **F3** Plantas y autómata | ✅ Hecho | Crecimiento, estados, expansión, muerte por edad y `comerPlanta` (T27-T33). Sin humedad ni pisadas (D16) |
| **F4** IA del herbívoro | ✅ Hecho | Necesidades, prioridad, comer/beber, penalización de terreno, reproducción y muerte (T34-T42 + T45-T47 lado herbívoro) |
| **F5** Depredador y cadena | ✅ Hecho | Caza y persecución, depredación, reproducción del carnívoro, restricción de terreno (D17) y test de la cadena (T43-T50) |
| **F7.5** Sprites y atlas | ✅ Hecho | Atlas único de PNG reales + `ParticleContainer`: plantas por estado y animales con cycle de caminar (T75-T82); peor caso medido en 5,69 ms/frame |

### Qué se ve hoy

Un **mundo 256×256** con agua, arena y tierra generados por ruido con
semilla: islas y continentes con costas naturales, reproducibles celda a
celda. Las plantas cubren la tierra y crecen por un autómata celular. Sobre
ese mapa, **120 herbívoros** y **25 carnívoros**. Los herbívoros **comen**
cuando tienen hambre, **van a beber** a la costa cuando tienen sed (y si no
ven agua, caminan hacia ella siguiendo un campo precalculado), **se
reproducen** cuando juntan energía y encuentran pareja, **huyen** si un
carnívoro se acerca, y **mueren** de hambre, sed, vejez o **depredación** —
cada causa contada por separado. Los carnívoros **persiguen y cazan** a los
herbívoros (más rápidos, pero cada presa les cuesta energía), beben,
deambulan manteniendo la distancia al agua y también se reproducen. Todo se ve con
**sprites reales**: las plantas pasan de semilla a joven a adulta (y desaparecen al morir), y los
animales son sprites laterales de **Triceratops** y **Ceratosaurio** que se voltean según su
dirección y animan su caminata a velocidad distinta por especie.

### Lo que ya está garantizado (y se puede romper de una forma detectable)

- **Determinismo**: misma seed ⇒ misma simulación, tick a tick. Hay tests
  (`tests/determinismo.test.js`) que corren la misma lógica que la pantalla,
  incluso con terreno y vegetación.
- **Sin `Math.random()` ni `Date.now()`** dentro de la simulación: ESLint lo
  bloquea con `no-restricted-properties`.
- **Timestep fijo** de 1/60 s con acumulador: la simulación no depende del
  framerate.
- **Sin `new` en el bucle**: entidades en **arrays tipados (SoA)** con lista de
  `id` libres; el render reserva su pool de partículas al arrancar y nunca lo agranda.
- **Sin `Graphics` por celda o por frame**: un atlas único generado al arrancar desde los PNG de
  `assets/sprites/` (sin atlas commiteado ni dependencias nuevas). Cada renderer es un
  `ParticleContainer` → **2 draw calls por frame** sin importar la población.
- **Capacidad tope garantizada**: hasta `grid.total` (65.536) celdas con planta y
  `CONFIG.entidades.maxEntidades` (4.000) animales simultáneos: 5,69 ms/frame y 2,79 MB de heap
  sin *sawtooth* en `node --expose-gc scripts/medirPeorCaso.mjs 60` (D18).
- **Culling por cámara**: la vegetación solo se barre en el rectángulo visible más
  `CONFIG.render.margenCulling`, y los animales fuera de pantalla no se cargan.

Ver `docs/DECISIONES.md` D18 para la API de Pixi confirmada y las alternativas descartadas.

---

## Estructura del proyecto

```
src/
├─ main.js              # bootstrap + bucle principal (timestep fijo)
├─ config.js            # TODOS los parámetros de la simulación
├─ core/
│  ├─ prng.js           # PRNG con semilla (mulberry32)
│  ├─ noise.js          # Value Noise + fBm con semilla (T11/T12)
│  ├─ contexto.js       # ctx: { prng, mundo, grid, config, hash, entidades }
│  └─ utils.js          # clamp, lerp, índices de celda
├─ world/
│  ├─ cell.js           # constantes TERRENO / PLANTA (contrato §3)
│  ├─ grid.js           # grilla tipada: terreno, planta, ocupante, altura + campos agua/tierra
│  └─ terrain.js        # ruido → agua/arena/tierra + campos BFS de navegación
├─ entities/
│  ├─ entity.js         # Especie base (comportamiento) + enums ESPECIE/ESTADO_IA
│  ├─ herbivore.js      # especie herbívoro: IA de necesidades (F4)
│  ├─ predator.js       # especie carnívoro: caza, persecución, beber (F5)
│  ├─ especies.js       # registro tipo → especie
│  └─ entityManager.js  # almacén SoA: arrays tipados + alta/baja por id
├─ systems/
│  ├─ spatialHash.js    # vecindario O(vecinos) (T24)
│  ├─ movement.js       # integración y rebote en los bordes
│  ├─ plantGrowth.js    # autómata de vegetación + `comerPlanta` (T27-T32)
│  ├─ needs.js          # hambre/sed/deseoRepro + causas de muerte (T34/T45)
│  ├─ perception.js     # buscar plantas/agua/pareja en el radio de visión (T36)
│  ├─ eventos.js        # nacimientos y muertes diferidos (T46/T47)
│  └─ simulacion.js     # el paso de simulación (usado por main y por tests)
├─ render/
│  ├─ camera.js         # pan, zoom, seguimiento  ⚠️ adelantada de P1 (T53)
│  ├─ atlas.js          # atlas único desde PNG sueltos (import.meta.glob + canvas)
│  ├─ atlasDatos.js     # mapeo puro estado/especie → frame (sin Vite, para Node)
│  ├─ terrainRenderer.js# el mapa entero en UNA textura + UN sprite (T15)
│  ├─ plantRenderer.js  # ParticleContainer de plantas por estado + culling
│  ├─ entityRenderer.js # ParticleContainer de animales: walk, flip y tint
│  └─ necesidadesRenderer.js # vista plana de necesidades para la selección
└─ ui/
   └─ hud.js            # contadores de población, tiempo, seed, FPS, nacidos/muertos

scripts/
├─ verTerreno.mjs       # genera el mapa en Node y reporta proporciones
├─ simular.mjs          # corre la simulación sin navegador (balance/rendimiento)
└─ medirPeorCaso.mjs    # peor caso de render: 65.536 plantas + 4.000 animales (T79)

docs/
├─ DECISIONES.md        # decisiones técnicas y por qué
└─ CONTRATO.md          # contrato de datos compartidos entre P1 y P2

tests/                   # Vitest
```

---

## Convenciones

- **Ningún parámetro hardcodeado**: todo vive en `src/config.js`.
- **Cero `Math.random()`** dentro de la simulación. Todo el azar sale del
  PRNG con semilla.
- **Commits chicos y testeables**: `tipo(scope): qué hace`
  (`feat`, `fix`, `refactor`, `docs`, `perf`).
- **`npm run lint` y `npm test` pasan antes de cada commit** (lo exige el
  hook de pre-commit).
- **Rama por fase**: `main`, `feat/mundo`, `feat/entidades`, `feat/ia`,
  `feat/ui`, `feat/vegetacion`.
- **Revisión cruzada**: el otro lee el diff antes de mergear.

---

## Documentación

- [`docs/DECISIONES.md`](docs/DECISIONES.md) — stack, tamaño del mundo, seed,
  estructura de datos, por qué de cada decisión.
- [`docs/CONTRATO.md`](docs/CONTRATO.md) — las clases compartidas entre P1 y
  P2 y cómo se acuerdan los cambios.
- [`TAREAS.md`](TAREAS.md) — el plan de tareas completo.
- [`Gdd-Tdd.txt`](Gdd-Tdd.txt) — el documento de diseño de la cátedra.
