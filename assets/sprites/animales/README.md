# Sprites de animales

Cada especie tiene **una sola animación de caminar**, en su propia carpeta. Los
PNG se numeran desde 0:

| Especie | Carpeta | Archivos |
|---|---|---|
| Triceratops | `trike_herbivore/` | `walk_0.png` … `walk_8.png` (9 cuadros) |
| Ceratosaurio | `ceratosaurus_carnivore/` | `walk_0.png` … `walk_10.png` (11 cuadros) |

La cantidad de cuadros **es distinta por especie** y se define en
`CONFIG.sprites.rutaAnimal[tipo].cuadros` (clave `ESPECIE.HERBIVORO` /
`ESPECIE.PREDADOR`). La fase avanza con `ctx.tick` y la velocidad base de la
especie (`manager.velocidad[id]`), así que el ceratosaurio camina más rápido que
el triceratops.

Los sprites son **laterales**: se voltean con `scaleX` según `dirX`, sin
rotación. El atlas usa casilleros de 64 × 64 px (`CONFIG.sprites.tamanoFrame`) y
dibuja cada PNG **a su tamaño natural y centrado** (los actuales son 58 × 35 y
60 × 35), sin estirar. Si falta alguno, `src/render/atlas.js` dibuja un frame de
prueba en su lugar.
