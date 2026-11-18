# Contrato de Datos Compartidos

> **T08.** Las clases que comparten los dos tienen que estar acordadas ANTES de
> implementarlas. Este documento es esa acuerdo.
>
> **Regla de oro:** quien define una clase compartida la entrega temprano y el
> otro la consume **sin modificarla sin avisar**. Si algo no cierra, se avisa
> en la reunión de sincronización y se cambia acá primero.

---

## 1 · Entidades — SoA en `src/entities/entityManager.js` (P2) — ✅ REFACTOR (D13)

> **Cambio de contrato.** La clase `Entity` (un objeto por animal) se reemplazó
> por un diseño **SoA** (arrays tipados), a pedido del profesor (ver D13). La
> identidad de un bicho es su **`id`** (entero); sus datos viven en arrays
> paralelos. El **comportamiento** sigue en clases, **una por especie**.

### Datos (`EntityManager`, arrays indexados por `id`)

| Array | Tipo | Unidad | Significado |
|---|---|---|---|
| `tipo` | `Int32Array` | — | `ESPECIE.HERBIVORO` / `ESPECIE.PREDADOR` |
| `x`, `y` | `Float32Array` | celdas | Posición (float) |
| `energia` | `Float32Array` | — | Energía actual (`[0, energiaMaxima]`) |
| `hambre` | `Float32Array` | — | Hambre normalizada `[0, 1]` (F4) |
| `sed` | `Float32Array` | — | Sed normalizada `[0, 1]` (F4) |
| `deseoRepro` | `Float32Array` | — | Deseo de reproducirse `[0, 1]` (F4) |
| `cooldown` | `Int32Array` | ticks | Ticks que faltan para poder volver a reproducirse (F4) |
| `edad` | `Int32Array` | ticks | Antigüedad en ticks |
| `velocidad` | `Float32Array` | celdas/s | Velocidad base (copiada de la especie al crear) |
| `dirX`, `dirY` | `Float32Array` | — | Rumbo normalizado (longitud ≈ 1) |
| `ticksParaGiro` | `Int32Array` | ticks | Cuánto falta para volver a sortear rumbo |
| `estado` | `Uint8Array` | — | Estado de la IA (`ESTADO_IA.*`, numérico) |
| `vivo` | `Uint8Array` | — | `1` viva, `0` liberada |

### Métodos del almacén

| Método | Firma | Contrato |
|---|---|---|
| `crear` | `(tipo) => number` | Da de alta y devuelve el `id` (recicla un `id` libre si hay). |
| `eliminar` | `(id) => void` | Da de baja y libera el `id`. |
| `especie` | `(id) => Especie` | Especie de esa entidad (para `pensar`). |
| `contar` / `deTipo` | `(tipo) => number \| number[]` | Población viva por tipo. |
| `celdaX/celdaY` | `(id) => number` | Índice de celda (para queries a la grilla). |
| `offsetX/offsetY` | `(id) => number` | Fracción dentro de la celda, en `[0,1)`. |
| `celda` | `(id, ancho) => number` | Índice plano `y * ancho + x`. |
| `total` | `number` (getter) | Total de entidades vivas. |
| `version` | `number` | Sube en cada alta/baja (el render lo usa). |

### Comportamiento (`Especie`, una instancia por especie)

| Método | Firma | Contrato |
|---|---|---|
| `actualizar` | `(id, dt, ctx) => void` | Paso completo de la entidad: envejece, decide (`pensar`) y se mueve. La base solo deambula; el herbívoro (F4) la sobreescribe. |
| `pensar` | `(id, dt, ctx) => void` | Decide el rumbo/estado. Escribe en `ctx.entidades`. |
| `velocidad` | `number` | Velocidad base de la especie. |

El paso por entidad lo orquesta `src/systems/simulacion.js`
(`actualizarEntidad`), que además clasifica muertes y aplica nacimientos
diferidos (F4).

### Invariantes

1. `vivo[id] === 0` ⇒ la entidad **no está** en `vivos` ni en el Spatial Hash.
   Nadie la consulta.
2. `dirX² + dirY² ≈ 1` salvo que la entidad esté parada.
3. `edad` solo crece (ticks). Solo se asigna al crear, al repartir edades
   iniciales (`repartirEdadesIniciales`, para que la primera generación no
   muera toda a la vez) y a la cría recién nacida (`edad = 0`).
4. La especie **no conoce** el terreno, la grilla ni el render. Habla con el
   mundo a través de `ctx` (el contexto de simulación).

---

## 2 · `Grid` — `src/world/grid.js` (P1) — ✅ IMPLEMENTADA (F1)

Implementada en `src/world/grid.js`. Capas contiguas (índices paralelos:
`idx = y * ancho + x`):

```js
class Grid {
  constructor(ancho, alto);

  terreno: Uint8Array;   // TERRENO.*   (P1 escribe)
  planta:  Uint8Array;   // PLANTA.*    (P1 escribe, F3)
  ocupante: Int32Array;  // id de entidad por celda, -1 = libre (P2 escribe)
  altura:  Float32Array; // altura normalizada 0..1 (P1 escribe)

  // Campos derivados del terreno (P1 escribe UNA vez, al generar el mapa):
  aguaDist:  Int32Array; // distancia en celdas al agua más cercana, -1 = sin dato
  aguaDirX:  Int8Array;  // paso {-1,0,1} en X hacia el agua más cercana
  aguaDirY:  Int8Array;  // paso {-1,0,1} en Y hacia el agua más cercana
  tierraDist: Int32Array; // distancia en celdas a la tierra más cercana
  tierraDirX: Int8Array;  // paso {-1,0,1} en X hacia la tierra más cercana
  tierraDirY: Int8Array;  // paso {-1,0,1} en Y hacia la tierra más cercana

  indice(x, y): number;
  dentro(x, y): boolean;

  terrenoEn(x, y): number;   // TERRENO.*  (fuera del mundo ⇒ AGUA)
  esAgua(x, y): boolean;
  esArena(x, y): boolean;
  esTierra(x, y): boolean;
  esBorde(x, y): boolean;
  estaLibre(x, y): boolean;   // sin entidad (fuera del mundo ⇒ false)

  ocupar(x, y, id): boolean;  // false si no estaba libre
  liberar(x, y, id): boolean; // false si la ocupaba otro id

  contarTerreno(): { agua, arena, tierra };
}
```

**Lo que P2 necesita de la `Grid`** (y ya está garantizado):

- Preguntar el **tipo de terreno** de una celda → penalizar energía al cruzar
  arena/agua (T40, T49): `terrenoEn`, `esAgua`, `esArena`, `esTierra`.
- Preguntar si una celda está **libre** → dónde nace una cría (T47):
  `estaLibre`.
- **Ocupar y liberar** celdas → `ocupar` / `liberar` (verifican id y límites).
- **Navegar de largo alcance** leyendo los campos derivados
  (`aguaDirX/Y`, `tierraDirX/Y`): un herbívoro sediento que no ve agua camina
  hacia ella, y uno varado en agua o arena vuelve a tierra. Los calcula
  `calcularCampos(grid)` de `terrain.js` **una sola vez** por BFS multi-fuente
  (el terreno no cambia durante la simulación).

**Regla:** P2 **no** escribe en `terreno` ni en `planta`. Solo lee, y escribe
únicamente en `ocupante`.

---

## 3 · `Celda` — `src/world/cell.js` (P1) — ✅ IMPLEMENTADA (F1)

Constantes de tipo de terreno y de estado de planta, en un solo lugar:

```js
export const TERRENO = { AGUA: 0, ARENA: 1, TIERRA: 2 };
export const PLANTA = { NADA: 0, SEMILLA: 1, JOVEN: 2, ADULTA: 3, MUERTA: 4 };
```

Además de las constantes, `nombreTerreno(tipo)` y `nombrePlanta(estado)` dan
**nombres legibles** para el HUD y el log de depuración.

---

## 4 · Necesidades — `src/systems/needs.js` (P2) — ✅ IMPLEMENTADA (F4)

Sistema de necesidades. **Normalizadas en `[0, 1]`**: `hambre`, `sed` y
`deseoRepro`, donde `0` es "satisfecha" y `1` es "crítica". `energia` y `edad`
**no** se normalizan porque tienen unidad propia (`energia` en
`[0, energiaMaxima]`, `edad` en **ticks**).

| Necesidad | Rango | Significado | Umbral |
|---|---|---|---|
| `hambre` | `[0, 1]` | Necesidad de comer | `CONFIG.herbivoro.hambreCritica` |
| `sed` | `[0, 1]` | Necesidad de beber | `CONFIG.herbivoro.sedCritica` |
| `deseoRepro` | `[0, 1]` | Necesidad de reproducirse | `CONFIG.herbivoro.umbralReproduccion` |
| `energia` | `[0, 100]` | Energía física | `<= CONFIG.entidades.energiaMinima` ⇒ muerte por hambre |
| `edad` | ticks | Edad | `>= CONFIG.entidades.edadMaximaTicks` ⇒ muerte por vejez |

Además de actualizar las necesidades, el módulo expone:

- `causaDeMuerte(id, ctx)` → `CAUSA_MUERTE.*` (`HAMBRE`, `SED`, `VEJEZ`,
  `DEPREDADO`) o `NINGUNA` si sigue viva (T45); `NOMBRE_CAUSA_MUERTE` da el
  nombre legible.
- `debeMorir(id, ctx)` → atajo booleano.
- `registrarMuerte(ctx, causa)` → suma la muerte al contador de su causa
  (`ctx.muertesPorCausa`), compartido por las dos especies (T45).
- `quiereReproducir(id, ctx, cfg?)` → si el deseo supera el umbral, la energía
  alcanza y el cooldown terminó. `cfg` permite usar la config de la especie
  (`herbivoro` o `depredador`); por defecto, la del herbívoro.

**Deseo de reproducción (F5):** tras madurar, `deseoRepro` sube
(`crecimientoReproduccion`) **solo si el animal está bien alimentado** (hambre y
sed por debajo de sus umbrales críticos); con hambre o sed encima, **baja**
(`decaimientoReproduccion`). Reproducirse en mal momento no tiene sentido.
- `gastarEnergia(id, dt, ctx)` → descuenta energía según el terreno que pisa
  (T40): `costeAgua`, `costeArena` multiplican el gasto base.

**Por qué normalizadas:** las dos especies pueden tener escalas distintas
(una sedienta, otra hambrienta) y al normalizar, la **misma IA por prioridad**
sirve para las dos sin código duplicado.

**Desviación documentada:** el contrato original (§4, primera versión) pedía
`energía` y `edad` también en `[0, 1]`. Se implementaron con su unidad natural
para no introducir divisiones por tick en el bucle caliente; la IA solo compara
contra umbrales, así que la escala es indistinta.

---

## 5 · `MundoAPI` — interfaz para desacoplar los animales del terreno

*(Propuesta de P2 — se define cuando exista la `Grid`.)*

La idea: los animales **no** tocan la `Grid` directamente. Hablan con una
interfaz mínima, para poder probarlos contra un mundo de mentira hasta que el
terreno procedural exista.

```js
interface MundoAPI {
  ancho: number;
  alto: number;
  tipoTerreno(x, y): number;   // TERRENO.*
  hayAgua(x, y): boolean;
  hayPlanta(x, y): boolean;
  estaLibre(x, y): boolean;
  celdaValida(x, y): boolean;
}
```

Implementaciones previstas:

- `MundoVacio` — lo que usamos ahora: celdas vacías, todo `TIERRA`. Permite
  desarrollar y testear los animales sin el mapa.
- `MundoProcedural` — la `Grid` de Luciano, cuando esté lista.

---

## 6 · Renderers — `src/render/` (P1 + P2) — ✅ F7.5

Los renderers son **consumidores** de datos: no escriben la grilla ni el `EntityManager`.
Comparten una única textura base (`atlas.textura`) creada por `crearAtlas()` al arrancar.

| Renderer | Constructor | API pública |
|---|---|---|
| `PlantRenderer` | `(app, { atlas, tileSize, capacidad })` | `reconstruir(grid, tick, cadaTicks, camara)`, `render(camara)`, `invalidar()`, `activas` (getter), `destruir()` |
| `EntityRenderer` | `(app, { atlas, tileSize, capacidad? })` | `render(manager, camara, tick = 0)`, `setDepuracion(valor)`, `activas` (getter), `destruir()` |
| `TerrainRenderer` | `(app, { tileSize, colores })` | Sin cambios (F1) |

Contratos:

- `atlas` es `{ textura, frames: Map<clave, Texture>, claves, ancho, alto }`, resultado de
  `crearAtlas()` (`render/atlas.js`). Las claves y el mapeo estado/especie → frame viven en
  `render/atlasDatos.js`, módulo puro importable desde Node (sin `import.meta.glob`).
- La `capacidad` se reserva **al arrancar**: `grid.total` para plantas y
  `CONFIG.entidades.maxEntidades` para animales. El pool nunca se agranda durante la simulación.
- `PlantRenderer.reconstruir()` lee **solo el estado** de `grid.planta` (nunca la edad):
  `SEMILLA`/`JOVEN`/`ADULTA` dibujan; `MUERTA`/`NADA` no. Se ejecuta cada
  `CONFIG.plantas.ticksPorRefrescoRender` ticks o cuando cambia el rectángulo visible;
  `invalidar()` la fuerza tras regenerar la grilla.
- `EntityRenderer.render()` solo lee arrays SoA del manager (`x`, `y`, `dirX`, `tipo`,
  `velocidad`, `estado`, `vivos`). El nuevo parámetro `tick` alimenta la animación y no avanza
  en pausa. El sprite se voltea con `scaleX` según `dirX`, sin rotación.
- Ambos usan `camara` (`x`, `y`, `zoom`, `vistaAnchoPx`, `vistaAltoPx`) y
  `CONFIG.render.margenCulling` para no cargar partículas fuera de pantalla.
- Cada renderer aporta **un** `ParticleContainer` (un draw call); no se hace `new` en el bucle.

---

## 7 · Protocolo de cambio

1. Quien propose el cambio lo avisa **antes** de escribir código.
2. Se actualiza **este documento** en la misma rama.
3. Se toca **un solo archivo por vez** y se commitea.
4. El otro lee el diff antes de mergear (revisión cruzada, T73).
