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
| **F5** Depredador y cadena | ✅ Hecho | Caza y persecución, depredación como causa de muerte, reproducción del carnívoro y test de la cadena (T43-T50) |

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
deambulan manteniendo la distancia al agua y también se reproducen.

### Lo que ya está garantizado (y se puede romper de una forma detectable)

- **Determinismo**: misma seed ⇒ misma simulación, tick a tick. Hay tests
  (`tests/determinismo.test.js`) que corren la misma lógica que la pantalla,
  incluso con terreno y vegetación.
- **Sin `Math.random()` ni `Date.now()`** dentro de la simulación: ESLint lo
  bloquea con `no-restricted-properties`.
- **Timestep fijo** de 1/60 s con acumulador: la simulación no depende del
  framerate.
- **Sin `new` en el bucle**: entidades en **arrays tipados (SoA)** con lista de
  `id` libres, y pool de sprites en el render.
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
│  ├─ terrainRenderer.js# el mapa entero en UNA textura + UN sprite (T15)
│  ├─ plantRenderer.js  # sprites de plantas por estado (F3)
│  └─ entityRenderer.js # sprites tintados, textura única
└─ ui/
   └─ hud.js            # contadores de población, tiempo, seed, FPS, nacidos/muertos

scripts/
├─ verTerreno.mjs       # genera el mapa en Node y reporta proporciones
└─ simular.mjs          # corre la simulación sin navegador (balance/rendimiento)

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
