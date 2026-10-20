# Simulación de Ecosistemas 2D

**Vida artificial + mundo procedural** — un ecosistema 2D donde plantas,
herbívoros y depredadores interactúan sobre un terreno generado por ruido.

- **Integrantes:** Luciano Mareco (P1 — mundo y render) · Franco Iannone (P2 — vida artificial)
- **Profesor:** Facundo Saiegh
- **Stack:** JavaScript ES2022 · [PixiJS v8](https://pixijs.com) · Vite · Vitest · ESLint + Prettier

> **Estado actual:** fase F3 completa. El mundo procedural está hecho (agua,
> arena y tierra por ruido con semilla, con render y regeneración en caliente)
> y la vegetación **crece y coloniza el mapa sola** por autómata celular.
> Falta la vida artificial: necesidades, comer, beber, reproducirse y morir
> (F4/F5). Ver [Estado](#estado-del-proyecto) para el detalle.

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

Scripts de verificación (corren la simulación **sin navegador**):

```bash
node scripts/verSimulacion.mjs 1337 240   # seed y segundos: poblaciones cada 5 s
node scripts/depurarSed.mjs 1337 0 90      # sigue a un herbívoro tick a tick
```

Son la forma rápida de probar un cambio de `config.js` sin abrir la
pantalla: imprimen las poblaciones y las muertes por causa.

> **Node.js:** hace falta **v20.19+ o v22.12+** (probado en v24.20.0).
> Si `node` no está en el PATH de Windows, agregá
> `C:\Program Files\nodejs` a las variables de entorno.

---

## Controles

| Tecla / ratón | Acción |
|---|---|
| **Arrastrar** | Mover la cámara (pan) |
| **Rueda** | Zoom in/out |
| **Clic** | Seleccionar un animal y ver sus necesidades (hambre, sed, energía) |
| **F** | Seguir a un herbívoro al azar |
| **G** | Volver al centro del mundo |
| **Espacio** | Pausar / reanudar |
| **1** / **2** / **4** | Velocidad de simulación (1× / 2× / 4×) |
| **D** | Modo depuración: el color de cada animal pasa a ser su estado de IA |
| **R** | Regenerar el mundo y la población con una seed nueva |
| **S** | Mostrar la seed actual en consola |
| **T** | Mostrar el conteo de terreno (agua/arena/tierra) en consola |

También hay una **barra de botones** arriba a la derecha: pausa y velocidad
(`1×` / `2×` / `4×`). Los atajos de teclado y los botones comparten el mismo
estado (`ESTADO` en `src/config.js`).

Abajo a la izquierda está la **leyenda** de colores (qué color es qué), y abajo
a la derecha el **gráfico de evolución de poblaciones** (plantas, herbívoros y
carnívoros a lo largo del tiempo).

---

## Estado del proyecto

Hitos según `TAREAS.md`:

| Fase | Estado | Nota |
|---|---|---|
| **F0** Setup y contrato | ✅ Hecho | Vite + Pixi v8 + ESLint/Prettier + hook + `config.js` + PRNG + tests |
| **F1** Mundo procedural | ✅ Hecho | Value Noise + fBm, grilla tipada, agua/arena/tierra, render y regeneración en caliente (T11-T18) |
| **F2** Datos y entidades base | ✅ Hecho | Entidad base, herbívoro, carnívoro, manager, pool, spatial hash, timestep fijo, render |
| **F3** Plantas y autómata | ✅ Hecho | Semillas → jóvenes → adultas, expansión celular, render por estado, pausa y velocidad (T27-T33) |
| **F4** IA del herbívoro | ⏳ Pendiente | Siguiente tanda de P2 (T34-T42) |
| **F5** Depredador y cadena | ⏳ Pendiente | De P2 (T43-T50) |

### Qué se ve hoy

Un **mundo 256×256** con agua, arena y tierra generados por ruido con
semilla: islas y continentes con costas naturales, reproducibles celda a
celda. La **vegetación coloniza el mapa sola** por autómata celular: se
sembran semillas, pasan a jóvenes, luego a adultas y estas se expanden a las
celdas de tierra vacías vecinas (unas 35.000 plantas a los 35 s de simulación).

Sobre ese mapa deambulan 145 animales (120 herbívoros verdes, 25 carnívoros
rojos) sembrados **en celdas de tierra**. Todavía **no** tienen necesidades:
no comen, no beben, no se reproducen y no mueren. Eso es F4/F5.

La simulación se puede **pausar** y acelerar a **1× / 2× / 4×** (botones o
teclas `1`/`2`/`4`), para ver la expansión vegetal sin esperar en tiempo real.

### Lo que ya está garantizado (y se puede romper de una forma detectable)

- **Determinismo**: misma seed ⇒ misma simulación, tick a tick. Hay un test
  (`tests/determinismo.test.js`) que corre la misma lógica que la pantalla.
- **Sin `Math.random()` ni `Date.now()`** dentro de la simulación: ESLint lo
  bloquea con `no-restricted-properties`.
- **Timestep fijo** de 1/60 s con acumulador: la simulación no depende del
  framerate.
- **Sin `new` en el bucle**: pool de objetos para entidades y para sprites.
- **Sin `Graphics` por celda o por frame**: una sola textura generada al
  arrancar, y sprites con `tint` por especie.

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
│  ├─ grid.js           # grilla tipada: terreno, planta, ocupante, altura
│  └─ terrain.js        # ruido → agua/arena/tierra + siembra habitable
├─ entities/
│  ├─ entity.js         # clase base: posición, energía, edad, estado
│  ├─ herbivore.js      # herbívoro
│  ├─ predator.js       # carnívoro
│  └─ entityManager.js  # alta/baja, separación por especie
├─ systems/
│  ├─ pool.js           # pool de objetos (T26)
│  ├─ spatialHash.js    # vecindario O(vecinos) (T24)
│  ├─ movement.js       # integración y rebote en los bordes
│  ├─ plantGrowth.js    # autómata celular de plantas (T27-T31)
│  ├─ simulacion.js     # el paso de simulación (usado por main y por tests)
├─ render/
│  ├─ camera.js         # pan, zoom, seguimiento  ⚠️ adelantada de P1 (T53)
│  ├─ terrainRenderer.js# el mapa entero en UNA textura + UN sprite (T15)
│  ├─ plantRenderer.js  # sprites de planta por estado, con pool (T32)
│  ├─ entityRenderer.js # sprites tintados, textura única
│  ├─ necesidadesRenderer.js # barras de necesidades del animal elegido (T56)
│  └─ paleta.js         # todos los colores en un solo lugar (T56)
└─ ui/
   ├─ hud.js            # contadores de población, tiempo, seed, FPS (T54)
   ├─ controles.js      # barra de pausa y velocidad 1×/2×/4× (T33)
   ├─ leyenda.js        # qué color es qué + conteo por estado (T56)
   └─ grafico.js        # evolución de poblaciones en el tiempo (T55)

scripts/
└─ verTerreno.mjs       # utilidad: genera el mapa en Node y reporta proporciones

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
