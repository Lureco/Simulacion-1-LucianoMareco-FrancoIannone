# Demo y revisión final (F8)

Guion para grabar la demostración pedida en **T72** y dejar constancia de la
**revisión cruzada (T73)**. La simulación ya corre; lo que falta acá es
mostrarla y que cada integrante revise el diff del otro.

## Antes de grabar

1. `npm install && npm run dev` y abrir `http://localhost:5173`.
2. En **⚙ Configuración → Restablecer** y **Aplicar y recargar** para arrancar
   sin overrides. La seed por defecto es `1337` (`CONFIG.mundo.seedPorDefecto`).
3. Maximizar la ventana y dejar visibles el HUD (arriba a la izquierda) y el
   gráfico de poblaciones. Ocultar el panel de configuración (**⚙ → Oculto**).
4. Apuntar la cámara al centro con **G**. Usar **F** para seguir un herbívoro
   cuando convenga enfocar el comportamiento individual.
5. **S** copia la seed; el HUD confirma `seed copiada ✓`. Anotarla en la
   descripción del video: con la misma seed y la misma configuración se reproduce
   el escenario.

> Las teclas y avisos van por el HUD, no por la consola (T74). Si se abre
> DevTools solo debe verse el arranque normal de Vite/Pixi, sin `console.log`
> propios (`npm run lint:prod`).

## Guion (6–8 minutos)

### 1. Expansión vegetal y competencia (T65/T66) — 0:00–2:00

1. Configuración → **Presets → Simulación rápida** → **Aplicar y recargar**.
   El preset acelera el reloj a 4× y reduce los ticks de semilla→joven→adulta.
2. Seed `1337`, **G** para volver al centro. Grabar la evolución del pasto
   (verde) y el micelio (lila): el pasto coloniza primero, el micelio avanza
   más despacio pero vive más.
3. Mostrar en el HUD las filas `pasto`, `micelio` y `desplaz.`. Explicar que
   `desplaz.` cuenta las celdas de pasto arrebatadas por micelio; el pasto nunca
   desplaza al micelio.
4. **Espacio** para pausar y acercar con la rueda: se ven los tres estados
   (semilla, joven y adulta) y el cambio de color por especie.

**Qué debe quedar claro:** dos especies conviven sobre la misma grilla tipada y
la competencia es emergente de reglas locales, no de un objeto por planta.

### 2. Crecimiento de poblaciones y cadena alimenticia (T54/T55) — 2:00–3:30

1. **Restablecer** + **Aplicar y recargar** para volver a los valores por
   defecto (seed `1337`).
2. **4** para ir a 4×, **D** para colorear por estado de IA. **F** para seguir un
   triceratops y mostrar `buscando comida / bebiendo / huyendo`.
3. Leer el gráfico: las curvas de plantas, triceratops y ceratosaurios se
   actualizan una vez por segundo; en el HUD aumentan `nacidos` y `muertos`.
4. Clic sobre un animal para ver sus barras de hambre y sed (sección de
   necesidades). Mover la cámara: las barras siguen al sprite (T61).

**Qué debe quedar claro:** la población cambia por nacimientos y muertes
observables; la depredación es una causa de muerte separada en el contador.

### 3. Colapso (T59/T60) — 3:30–5:30

1. Configuración → **Presets → Cacería** → **Aplicar y recargar**: 140
   herbívoros, 80 depredadores, depredadores más rápidos y con más visión.
2. Seed `1337`, velocidad 4× y **G**. Dejar correr 2–3 minutos reales.
3. Mostrar el gráfico cuando los ceratosaurios superan la oferta de presas y
   empiezan a caer; el HUD muestra cómo baja `ceratosaurios` mientras suben los
   `muertos`. **D** permite ver muchos animales en estado `buscando presa`.

**Qué debe quedar claro:** el exceso de depredadores agota presas y termina en
declive. Es el desequilibrio documentado en D20 como limitación conocida de v1,
no un bug: la corrida sigue siendo determinista.

### 4. Recuperación y determinismo (T42/T72) — 5:30–7:30

1. Configuración → **Presets → Isla tranquila** → **Aplicar y recargar**: 40
   herbívoros, 0 depredadores y consumo bajo.
2. Misma seed `1337`, 4×. Mostrar que la población de herbívoros se recupera y
   que la vegetación vuelve a cubrir la tierra sin presión de caza.
3. **Espacio** para pausar, **S** para copiar la seed y **R** para generar otra:
   el HUD cambia la seed y el gráfico vuelve a cero (`Grafico.reiniciar()`).
4. Volver a poner la seed anotada en el panel (**mundo.seedPorDefecto**),
   **Aplicar y recargar** y comparar el estado inicial: mismo terreno, mismas
   cantidades y misma secuencia de azar.

**Qué debe quedar claro:** una misma seed + mismos parámetros reproduce el
escenario; la recuperación se observa al quitar la presión depredadora.

## Cierre de la grabación

- Texto final en pantalla: `seed 1337 · F8 · pasto + micelio · herencia de 5 genes`.
- Duración sugerida: 60–90 s por escena si se edita el video, o 6–8 min sin
  cortes. Grabar a 60 FPS para que se aprecie el movimiento suave.
- Guardar el archivo como `demo-ecosistema.mp4` junto al README o subirlo al
  repositorio/Zip de entrega. **No se grabó automáticamente**: en este entorno
  no hay `ffmpeg`, `chrome`, `msedge` ni `chromium`; el video requiere acción
  humana.

## Capturas y evidencia

Tomar una captura por escena del guion y guardarlas en `docs/capturas/`:

| Archivo | Contenido |
|---|---|
| `01-vegetacion.png` | Pasto y micelio juntos, con HUD y `desplaz. > 0`. |
| `02-poblaciones.png` | Gráfico con las tres curvas y el HUD completo. |
| `03-colapso.png` | Caída de ceratosaurios en el preset *Cacería*. |
| `04-recuperacion.png` | Herbívoros recuperándose en *Isla tranquila*. |

Luego agregarlas al README con `![...](docs/capturas/01-vegetacion.png)`.

## Revisión cruzada (T73)

Cada integrante completa su columna antes del merge/entrega final:

| Revisor | Archivos que revisa | Resultado | Observaciones |
|---|---|---|---|
| Luciano (P1) | `src/systems/needs.js`, `src/entities/*`, `src/systems/genetica.js`, `src/systems/eventos.js`, `src/systems/simulacion.js` (P2) | ☐ OK ☐ Observaciones | |
| Franco (P2) | `src/world/*`, `src/systems/plantGrowth.js`, `src/render/atlas*.js`, `src/render/plantRenderer.js`, `src/ui/hud.js` (P1) | ☐ OK ☐ Observaciones | |

Puntos a revisar explícitamente:

- [ ] No aparece `Math.random()`, `Date.now()` ni `new` dentro del bucle.
- [ ] La seed y los parámetros salen de `CONFIG`; las tuplas de nacimiento
      incluyen los cinco genes y no reciclan padres muertos.
- [ ] La grilla sigue siendo memoria contigua (`especiePlanta` es un
      `Uint8Array` paralelo).
- [ ] `npm run lint`, `npm run lint:prod`, `npm test -- --run`,
      `npx prettier --check .` y `npm run build` pasan.
- [ ] `npm run preview -- --host 127.0.0.1 --port 4173` sirve `index.html` y
      los assets sin errores.

## Verificación automática de la entrega (T74)

Ejecutada sobre el estado final de F8:

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ |
| `npm run lint:prod` | ✅ (sin `console.*` en `src/`) |
| `npm test -- --run` | ✅ 21 archivos, 210 tests |
| `npx prettier --check .` | ✅ |
| `npm run build` | ✅ `dist/` generado |
| `npm run preview -- --host 127.0.0.1 --port 4173` | ✅ `index.html` y assets servidos |
| `node scripts/simular.mjs 1337 10` | ✅ 10 min simulados; ambas especies y desplazamientos reportados |
