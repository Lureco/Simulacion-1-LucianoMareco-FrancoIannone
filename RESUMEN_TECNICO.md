# Resumen técnico — Simulación de Ecosistemas 2D

> **En una frase:** un ecosistema 2D determinista donde 65.536 celdas procedurales, un autómata
> celular de plantas y hasta 4.000 animales con genes y necesidades conviven en un solo atlas de
> texturas y **2 draw calls por frame**, con render del peor caso en ~5 ms.

Stack: **JavaScript ES2022 · PixiJS v8 · Vite · Vitest**. Hay dos frentes bien separados por un
contrato (`docs/CONTRATO.md`): mundo + render (P1) y vida artificial (P2).

---

## 1. Lo más impresionante, con números

| Logro | Cifra verificada | Dónde |
|---|---|---|
| Mundo procedural reproducible | **256 × 256 = 65.536 celdas**, seed `1337`, costas suavizadas con marching squares a 4 px/celda en chunks de 1024 px | `src/config.js:21-41,140-170` · `src/render/terrainMarching.js` |
| Peor caso de render | **65.536 plantas + 4.000 animales en pantalla → 5,69 ms/frame, 2 draw calls, heap Δ 2,79 MB sin GC sawtooth** | `docs/DECISIONES.md:474-489` |
| Capacidad a 60 FPS | Todo visible (69.536 entidades) → **4,16 ms = 25 % del presupuesto de 16,67 ms** (mediana de 60 frames × 3) | `docs/DECISIONES.md:672-704` |
| Búsqueda de vecinos | Hash espacial **20,2× más rápido** que fuerza bruta a 2.000 entidades (0,4 ns vs 7,3 ns por consulta); crece con vecinos, no con `n` | `docs/DECISIONES.md:641-653` |
| Simulación desacoplada del render | **10 minutos simulados en 39,5 s reales** (`node scripts/simular.mjs 1337 10`) | `TAREAS.md:335-339` |
| Cero azar espontáneo | Sin `Math.random()` en todo el código: mulberry32 + FNV-1a; misma seed ⇒ mapa, genes y posiciones idénticos | `src/core/prng.js:9-65` · `tests/determinismo.test.js` |
| Calidad del código | **231 tests en 23 archivos**, todos pasando (verificado con `npm test -- --run`); ESLint + Prettier + Husky + build de producción | `package.json:7-31` |

---

## 2. Datos: Structure of Arrays en vez de objetos

No hay un objeto por animal. La identidad es un `id` entero y cada atributo vive en su propio
`Float32Array` / `Int32Array` / `Uint8Array` (~25 arrays: `x`, `y`, `dirX`, `hambre`, `sed`,
`presa`, `moribundo`, 5 genes…). `EntityManager` reserva 256 ids, duplica la capacidad cuando hace
falta, mantiene una pila de ids libres y un `version` que invalida sprites al alta/baja
(`src/entities/entityManager.js:49-119`). El comportamiento es un singleton por especie, no una
copia por entidad (`src/entities/especies.js:17-21`).

El truco más lindo: **`moribundo`**. Marcar una muerte no la ejecuta; la pone en un buffer de
eventos diferidos. Así dos depredadores no pueden contar dos veces la misma presa, y los genes de
una cría se calculan al *anotar* el nacimiento porque los padres todavía existen (si se reciclara
su id antes, se perdería la herencia) — `src/systems/eventos.js:53-81`, `src/systems/simulacion.js:123-150`,
`docs/DECISIONES.md:816-821`.

El tick va en orden fijo: entidades → muertes → nacimientos (tope 4.000) → reconstrucción del
hash → vegetación. Tiempo con **paso fijo 1/60 s**, acumulador, máximo 5 pasos por frame y
`deltaMax=0,25` para que un tab en segundo plano no explote la simulación (`src/config.js:114-125`,
`src/main.js:371-386`). Las edades iniciales se reparten hasta el 50 % de una vida para evitar
muertes sincronizadas en oleadas (`src/systems/simulacion.js:52-60`).

---

## 3. Mundo: ruido propio, navegación precalculada y costas suavizadas

- **Value Noise 2D propio** (se descartó Perlin) con `smootherstep`, 4 octavas, persistencia 0,5 y
  lacunaridad 2 para la altura; cada octava usa `seed + o * 0x9e3779b9` y se normaliza por la suma
  de amplitudes. Función pura de `(x, y, seed)` — `src/core/noise.js:28-111`.
- **Caída radial** (`altura -= caidaBorde * d²`) hunde los bordes y genera islas/continentes; umbrales
  0,32 (agua) y 0,38 (arena) clasifican el resto como tierra. Seed 1337 da ~32 % agua / 13 % arena /
  55 % tierra; generación en 30–60 ms (`src/world/terrain.js:127-176`, `docs/DECISIONES.md:120-149`).
- **BFS multi-fuente** calculado *una sola vez* al generar el mapa: dos campos (`aguaDist`/`aguaDirX`/
  `aguaDirY` y los equivalentes a tierra) sobre vecindad 4. La IA lee **2 bytes por tick** para ir a
  beber desde cualquier punto del mundo, en vez de barrer la grilla — `src/world/terrain.js:44-100`,
  `src/systems/perception.js:220-229`.
- **Marching squares** bilineal entero con umbral `(tam-1)²/2` y `>=` para empates, dos capas
  (tierra, luego arena) que producen playas interpoladas. Se renderiza a texturas-chunk de hasta
  1024 px con `scaleMode: 'nearest'` estético pixel art, con *flag* de tile uniforme para saltar
  interpolaciones y fallback a 1 px/celda si falla la textura. En tiempo de render solo se
  reubica/escala un contenedor: **cero trabajo por celda por frame** (`src/render/terrainMarching.js:45-133,155-315`).

---

## 4. IA: prioridades, memoria y separación estilo boids

La percepción es búsqueda circular con hash espacial y desempate por id más bajo (no hay
raycasting ni cono de visión); reutiliza el array de vecinos y el objeto objetivo para no generar
basura (`src/systems/perception.js:35-45,157-181`).

- **Herbívoro:** huir > comer > beber > reproducirse > volver a tierra > deambular. Huida sostenida
  20 ticks, ruido de rumbo ~0,02 rad y giro cada 40–110 ticks (`src/entities/herbivore.js:97-143,334-388`).
- **Depredador:** hambre > sed > reproducción > deambular, con **memoria de presa** (id, ticks de
  persecución, búsqueda cada 6 ticks, abandono a los 30 s). Ataca a 0,6 celdas; es más rápido que el
  herbívoro (1,7 vs 1,2 celdas/s) pero la persecución le cuesta tiempo (`src/entities/predator.js:140-213`).
- **Movimiento:** integra `velocidad * genVelocidad * dt`; el agua frena a 1/4 y la arena a 1/1,6 —
  frenar, no bloquear (`src/systems/movement.js:34-40`).
- **Separación:** boids sobre vecinos de la *misma* especie en radio 1, fuerza lineal
  `((radio-d)/radio)*2`; ignora muertos y quien está comiendo/bebiendo (`src/systems/separacion.js:40-85`).

Las causas de muerte —hambre, sed, vejez, depredación— se cuentan por separado
(`src/systems/needs.js:55-94`).

---

## 5. Genética y vegetación: dos sistemas con alma de bit

**Cinco genes** (velocidad, tamaño, percepción, consumo, reproducción) en un `Float32Array(5)`:
herencia `padre*0,5 + madre*0,5`, mutación con p = 0,15 y salto ±0,12, acotados a [0,5; 1,5].
Cada gen se siente de verdad: altera la velocidad, el tamaño del sprite, los radares de percepción,
el consumo de necesidades y el cooldown reproductivo. Se puede inspeccionar al hacer clic en un
animal (`src/systems/genetica.js:23-89`, `src/ui/geneticaVista.js`).

**Plantas como bytes:** la capa vegetal de 65.536 celdas ocupa ~64 KiB. Siembra exacta con
Fisher-Yates parcial (2.247 semillas, 92 % pasto / 8 % micelio) y autómata
NADA → SEMILLA(20t) → JOVEN(60t) → ADULTA(500t/900t). El micelio desplaza al pasto con p = 0,0002
codificando el desplazamiento como `-2-j` en la capa de especie; la reserva inmediata evita que dos
adultas siembren la misma celda. La edad terminó en `Int32Array` porque un `Uint8Array` desbordaba a
los 256 ticks (`src/systems/plantGrowth.js:100-305`, `tests/especiesVegetales.test.js`).

---

## 6. Render: un atlas, pools y culling agresivo

- `import.meta.glob` descubre **23 PNG reales** (9 frames de caminar del triceratops, 11 del
  ceratosaurio, 3 de plantas). Se decodifican en `Promise.all`, se empaquetan en un canvas offscreen
  de casilleros 64×64 con padding 2, y se exponen como **una única `CanvasSource`** con `nearest`
  y una `Texture` por frame → requisito para batching. Arranca en paralelo a `app.init()`, con
  fallback procedural si falta arte (`src/render/atlas.js:48-250`).
- `ParticleContainer` con `dynamicProperties` mínimos: posición y UV/color solo donde cambian;
  `rotation: false` (los sprites son laterales, se voltea con `scaleX` según `dirX`). Pool de
  65.536 partículas de plantas y 4.000 de animales **reservado al arrancar**, sin `new` en el bucle
  y sin `addParticle()`. `boundsArea` manual y culling al rectángulo visible + 64 px de margen
  (`src/render/plantRenderer.js:46-92,127-192`, `src/render/entityRenderer.js:47-85,127-168`).
- `NecesidadesRenderer` usa **un solo `Graphics`** más 4 sprites con `tint` y dirty-check por
  posición/cámara/zoom/valores redondeados; la cámara hace zoom anclado al cursor con suavizado
  exponencial (`src/render/necesidadesRenderer.js`, `src/render/camera.js:62-211`).
- Antes del primer frame se reservan los buffers GPU de partículas (`src/main.js:455-459`), para
  que el primer frame no pague la subida de datos.

La conclusión de las mediciones es notable: **el límite lo ponen los topes configurados, no el
framerate**. Con 4.000 animales y todo el mundo visible sobra más del 65 % del presupuesto de frame
(`docs/DECISIONES.md:694-704`).

---

## 7. Ingeniería alrededor del código

- **PRNG determinista:** mulberry32 semilla 1337, `hashInts`/`hashString` FNV-1a, Box–Muller con
  caché para gaussianos, `fork(salt)` para derivar streams hijos sin alterar el padre
  (`src/core/prng.js:21-219`). Tests de huella completa: mismos genes, necesidades y posiciones
  para la misma seed (`tests/determinismo.test.js:150`).
- **Scripts de medición versionables:** `perfilado.mjs`, `medirPeorCaso.mjs`,
  `medirCapacidadPantalla.mjs`, `benchmarkCargaTerreno.mjs`, `simular.mjs`, `verTerreno.mjs` —
  headless y repetibles, en vez de fiarse de un profiler interactivo.
- **Documentación de decisiones:** `docs/DECISIONES.md` registra D1–D31 con el *por qué* de cada
  decisión arquitectónica (y las limitaciones asumidas); `docs/CONTRATO.md` fija la interfaz entre ambos
  frentes, incluida la regla de que P2 solo escribe `ocupante` en la grilla.
- **Config en vivo:** panel con una categoría por sección de `config.js`, 6 presets incluidos
  (el nuevo ***Máximo estable*** llega a 4.000 animales a 60 FPS: 10,92 ms/tick de simulación,
  3.869 herbívoros y 131 depredadores a los 10 min — `docs/DECISIONES.md` D32),
  import/export JSON y persistencia en `localStorage` (`ecosistemas.config.v1`, `.presets.v1`,
  `.ui.v1`). La seed acepta texto y se hashea de forma determinista (`src/ui/generadorMapa.js:365-433,780-850`).

---

## 8. Notas honestas (limitaciones documentadas)

- Los depredadores **decaen** en corridas largas (25 → 4 a los 10 min; en la corrida final F8, 0).
  Está registrado como D20, no ocultado (`docs/DECISIONES.md:562-589`).
- No hay humedad, biomas, ciclo día/noche ni clima: se descartaron explícitamente (D16).
- La percepción es circular, sin cono de visión ni raycasting; el "ruido de rumbo" simula
  incertidumbre.
- No hay persistencia de configuración en URL; solo en `localStorage` y portapapeles.

---

### Referencia rápida

```bash
npm install && npm run dev      # jugar
npm test -- --run               # 231 tests
node --expose-gc scripts/medirPeorCaso.mjs 60
node scripts/medirCapacidadPantalla.mjs 60 3
node scripts/simular.mjs 1337 10
```

Documentación base: `README.md` (controles y estado F0–F8), `docs/CONTRATO.md`,
`docs/DECISIONES.md`, `docs/DEMO.md` (guion de demo de 6–8 min) y `TAREAS.md`.
