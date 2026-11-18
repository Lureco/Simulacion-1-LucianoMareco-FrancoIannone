# Sprites de plantas

Los PNG van en `plantaNormal/` con estos nombres (exactos):

| Archivo | Cuándo se ve |
|---|---|
| `plantaNormal/semilla.png` | Al aparecer la semilla |
| `plantaNormal/joven.png` | Cuando la planta pasa a JOVEN |
| `plantaNormal/adulta.png` | Cuando la planta pasa a ADULTA |

La planta **muerta no tiene sprite**: desaparece. El cambio es por evento de
estado (`grid.planta`), no por edad.

Las rutas se configuran en `CONFIG.sprites.rutaPlanta`, no se hardcodean. El
atlas usa casilleros de 64 × 64 px (`CONFIG.sprites.tamanoFrame`) y dibuja cada
PNG **a su tamaño natural y centrado** (los actuales son 32 × 32), sin estirar.
Si falta alguno, `src/render/atlas.js` dibuja un frame de prueba en su lugar.
No hace falta generar ni editar ningún atlas: se arma solo al arrancar.
