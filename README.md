# Simulación de Ecosistemas 2D

**Vida artificial + mundo procedural** — un ecosistema 2D donde plantas,
herbívoros y depredadores interactúan sobre un terreno generado por ruido.

- **Integrantes:** Luciano Mareco (P1 — mundo y render) · Franco Iannone (P2 — vida artificial)
- **Profesor:** Facundo Saiegh
- **Stack:** JavaScript ES2022 · [PixiJS v8](https://pixijs.com) · Vite · Vitest · ESLint + Prettier

> **Estado actual:** fase F2 (base de entidades). El mundo procedural todavía
> no está: los animales deambulan sobre celdas vacías. Ver
> [Estado](#estado-del-proyecto) para el detalle.

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
| **R** | Regenerar la población con una seed nueva |

---

## Estado del proyecto

Hitos según `TAREAS.md`:

| Fase | Estado | Nota |
|---|---|---|
| **F0** Setup y contrato | ✅ Hecho | Vite + Pixi v8 + ESLint/Prettier + hook + `config.js` + PRNG + tests |
| **F1** Mundo procedural | ⏳ Pendiente | De Luciano (T11-T18) |
| **F2** Datos y entidades base | ✅ Hecho | Entidad base, herbívoro, carnívoro, manager, pool, spatial hash, timestep fijo, render |
| **F3** Plantas y autómata | ⏳ Pendiente | De Luciano (T27-T32) |
| **F4** IA del herbívoro | ⏳ Pendiente | Siguiente tanda de P2 (T34-T42) |
| **F5** Depredador y cadena | ⏳ Pendiente | De P2 (T43-T50) |

### Qué se ve hoy

145 animales (120 herbívoros verdes, 25 carnívoros rojos) deambuando por un
mundo de 256×256 celdas, a ~180 FPS. Todavía **no** tienen necesidades: no
comen, no beben, no se reproducen y no mueren. Eso es F4/F5.

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
│  ├─ contexto.js       # ctx: { prng, mundo, config, hash, entidades }
│  └─ utils.js          # clamp, lerp, índices de celda
├─ entities/
│  ├─ entity.js         # clase base: posición, energía, edad, estado
│  ├─ herbivore.js      # herbívoro
│  ├─ predator.js       # carnívoro
│  └─ entityManager.js  # alta/baja, separación por especie
├─ systems/
│  ├─ pool.js           # pool de objetos (T26)
│  ├─ spatialHash.js    # vecindario O(vecinos) (T24)
│  ├─ movement.js       # integración y rebote en los bordes
│  ├─ simulacion.js     # el paso de simulación (usado por main y por tests)
├─ render/
│  ├─ camera.js         # pan, zoom, seguimiento  ⚠️ adelantada de P1 (T53)
│  └─ entityRenderer.js # sprites tintados, textura única
└─ ui/
   └─ hud.js            # contadores de población, tiempo, seed, FPS

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
