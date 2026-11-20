/**
 * src/config.js — Parámetros de la simulación
 * ==========================================
 * Regla del proyecto: NINGÚN número mágico fuera de este archivo.
 * Si necesitás un valor nuevo, va acá con una sección y un comentario.
 *
 * Secciones marcadas como [P1] son de Luciano.
 * Secciones marcadas como [P2] son de Franco.
 * Las marcadas como [AMBOS] se acuerdan en la reunión de sincronización.
 */

import { ESPECIE } from './entities/entity.js';
import { ESPECIE_PLANTA, PLANTA } from './world/cell.js';
import { cargarOverrides } from './core/configPersistencia.js';
import { clonarConfig, copiarValidos } from './core/configUtils.js';

export const CONFIG = {
  // ─────────────────────────────────────────────────────────────
  // MUNDO [AMBOS]
  // ─────────────────────────────────────────────────────────────
  mundo: {
    /** Ancho del mundo en celdas. */
    ancho: 256,
    /** Alto del mundo en celdas. */
    alto: 256,
    /** Semilla por defecto. Cambiarla regenera TODO el mapa de forma reproducible. */
    seedPorDefecto: 1337,
    /** Tamaño de celda en píxeles de pantalla. */
    tileSize: 8,
    /** Tamaño base de una textura de celda (para sprites tintados). */
    tileBaseSize: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // RENDER [P1]
  // ─────────────────────────────────────────────────────────────
  render: {
    colorFondo: 0x0b0d10,
    anchoVentana: 1280,
    altoVentana: 720,
    /** Culling: margen extra alrededor de la cámara en píxeles. */
    margenCulling: 64,
    /** Píxeles por unidad de mundo (1 celda = tileSize px). */
    escala: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // SPRITES / ATLAS [P1] — F7.5
  // ─────────────────────────────────────────────────────────────
  sprites: {
    /**
     * Casillero del atlas, en píxeles. Los PNG se dibujan a su tamaño natural,
     * centrados en el casillero (sin estirar) y se recortan si lo exceden.
     */
    tamanoFrame: 64,
    /** Separación entre casilleros para que no se "sangren" los UV al hacer zoom. */
    padding: 2,
    /**
     * Tamaño en pantalla del **casillero** del atlas, medido en tiles de mundo.
     * El arte real ocupa solo una parte del casillero (32/64 en plantas,
     * ~58/64 en animales), así que el sprite visible es más chico que esto.
     */
    escalaPlanta: 1.2,
    escalaAnimal: 1.6,
    /**
     * Cuadros de animación que avanzan por cada celda de mundo recorrida.
     * Multiplica la velocidad BASE de la especie (no la efectiva del terreno),
     * así que el ceratosaurio anima más rápido que el triceratops.
     */
    cuadrosPorCelda: 4,
    /**
     * Clave del atlas para cada estado de planta (ruta relativa a `assets/sprites/`,
     * sin extensión). La planta muerta no tiene frame: desaparece.
     * @type {Record<number, string>}
     */
    rutaPlanta: {
      [PLANTA.SEMILLA]: 'plantas/plantaNormal/semilla',
      [PLANTA.JOVEN]: 'plantas/plantaNormal/joven',
      [PLANTA.ADULTA]: 'plantas/plantaNormal/adulta',
    },
    /**
     * F8/T65: segunda especie vegetal. No hay PNG propio para el micelio: estas claves
     * caen en el frame de prueba del atlas, dibujado con la paleta del hongo.
     * Si se agregan PNG con estas rutas, se usan automáticamente.
     */
    rutaPlantaPorEspecie: {
      [ESPECIE_PLANTA.MICELIO]: {
        [PLANTA.SEMILLA]: 'plantas/micelio/semilla',
        [PLANTA.JOVEN]: 'plantas/micelio/joven',
        [PLANTA.ADULTA]: 'plantas/micelio/adulta',
      },
    },
    /**
     * Cycle de caminar por especie. Cada una tiene su propia carpeta, prefijo
     * de archivo y cantidad de cuadros (las cantidades salieron del arte real).
     */
    rutaAnimal: {
      [ESPECIE.HERBIVORO]: {
        carpeta: 'animales/trike_herbivore',
        prefijo: 'walk',
        cuadros: 9,
      },
      [ESPECIE.PREDADOR]: {
        carpeta: 'animales/ceratosaurus_carnivore',
        prefijo: 'walk',
        cuadros: 11,
      },
    },
    /**
     * Si falta un PNG, se dibuja un frame de prueba en el casillero correspondiente.
     * Se puede desactivar cuando esté todo el arte cargado.
     */
    generarFallback: true,
  },

  // ─────────────────────────────────────────────────────────────
  // TIEMPO / BUCLE PRINCIPAL [AMBOS]
  // ─────────────────────────────────────────────────────────────
  tiempo: {
    /** Timestep fijo de la simulación, en segundos. 60 Hz lógicos. */
    pasoFijo: 1 / 60,
    /** Máximo de pasos fijos por frame. Evita la "spiraling death" si la pestaña se congela. */
    maxPasosPorFrame: 5,
    /** Multiplicador de velocidad del usuario: 1, 2 o 4. */
    escalaSimulacion: 1,
    /** Delta máximo de tiempo real por frame (evita saltos al volver de otra pestaña). */
    deltaMaximo: 0.25,
    /** Suavizado del indicador de FPS del HUD. */
    suavizadoFps: 0.05,
  },

  // ─────────────────────────────────────────────────────────────
  // IA BASE [P2]
  // ─────────────────────────────────────────────────────────────
  ia: {
    /** Ticks mínimos entre giros al deambular (clase `Especie`, sin especie asignada). */
    ticksGiroMin: 40,
    /** Ticks máximos entre giros al deambular (clase `Especie`, sin especie asignada). */
    ticksGiroMax: 110,
  },

  // ─────────────────────────────────────────────────────────────
  // TERRENO [P1]
  // ─────────────────────────────────────────────────────────────
  terreno: {
    /** Altura normalizada 0..1. Por debajo de esto: AGUA. */
    umbralAgua: 0.32,
    /** Entre umbralAgua y este: ARENA. */
    umbralArena: 0.38,
    /** Frecuencia base del ruido de altura. Más alto = más detalle. */
    frecuenciaAltura: 0.018,
    /** Octavas del ruido fractal. */
    octavasAltura: 5,
    /** Persistencia: cuánto pesa cada octava respecto de la anterior. */
    persistenciaAltura: 0.55,
    /** Cuánto multiplica la frecuencia en cada octava (lacunaridad). */
    lacunaridadAltura: 2,
    /**
     * Caída de altura hacia los bordes: cuánto se hunde el mapa en la
     * esquina más lejana. 0 = ruido plano (sin isla), 0.9 = isla marcada.
     * Forma masas de agua cerradas en vez de costas cortadas (T18).
     */
    caidaBorde: 0.42,
    /** Semilla offset para que altura y humedad no se correlacionen. */
    offsetSemillaHumedad: 7919,
    /** Colores 0xRRGGBB de cada tipo de terreno (sombreado por altura). */
    colorAgua: 0x2a4d8f,
    colorArena: 0xd8c596,
    colorTierra: 0x4b7a3a,
    /** Intentos máximos para encontrar una celda habitable al generar el mundo. */
    maxIntentosHabitable: 64,
  },

  // ─────────────────────────────────────────────────────────────
  // PLANTAS [P1] — autómata celular
  // ─────────────────────────────────────────────────────────────
  plantas: {
    /** Estados: 0 = NADA, 1 = SEMILLA, 2 = JOVEN, 3 = ADULTA, 4 = MUERTA. */
    estadoNada: 0,
    estadoSemilla: 1,
    estadoJoven: 2,
    estadoAdulta: 3,
    estadoMuerta: 4,
    /** Ticks de simulación entre estados de crecimiento. */
    ticksSemillaAJoven: 20,
    ticksJovenAAdulta: 60,
    /** Ticks que vive una planta ADULTA antes de morir por edad (T30). Se empieza a contar al llegar a adulta. */
    ticksVidaAdulta: 500, // 2 minutos de simulación
    /** Probabilidad por tick de que una planta adulta se reproduzca en una celda vacía vecina. */
    probExpansion: 0.08,
    /** Vecindad usada por el autómata: 4 (ortogonal) u 8 (incluye diagonales). */
    radioExpansion: 1,
    /** Umbral de `radioExpansion` a partir del cual se incluyen las diagonales. */
    umbralVecindadDiagonal: 8,
    /** Densidad inicial de semilla al generar el mundo (0..1 sobre celdas de tierra). */
    densidadSemilla: 0.06,
    /**
     * Semillas exactas al generar un mapa desde el menú o con R (T84). Corresponde
     * al resultado de `densidadSemilla` sobre la isla de la seed por defecto,
     * medido en 2247 celdas, para que el mapa inicial no cambie de aspecto.
     */
    poblacionInicial: 2247,
    /** Colores de cada estado de planta para el render (0xRRGGBB). */
    colorSemilla: 0x6f7f4a,
    colorJoven: 0x6fae52,
    colorAdulta: 0x3f8f3a,
    /** Tamaño del sprite de una planta adulta en fracción del tile. */
    escalaSprite: 0.55,
    /** Actualizar el render de plantas cada N ticks (la vegetación cambia lento). */
    ticksPorRefrescoRender: 10,

    // ── F8/T65-T66: segunda especie y competencia territorial ──
    /** Fracción de la siembra inicial que nace como micelio (0..1). */
    fraccionMicelio: 0.12,
    /**
     * Reglas por especie. Solo se guarda lo que DIFIERE de las reglas base de
     * arriba: `pasto` hereda todo ({}), `micelio` crece más despacio, vive más
     * y puede desplazar al pasto (T66). No se hardcodea nada en `plantGrowth.js`.
     */
    especies: {
      [ESPECIE_PLANTA.PASTO]: {},
      [ESPECIE_PLANTA.MICELIO]: {
        probExpansion: 0.05,
        ticksVidaAdulta: 900,
        /** Probabilidad de colonizar una celda vecina ocupada por pasto. */
        probDesplazamiento: 0.25,
      },
    },
    /** Colores del micelio en el frame de prueba del atlas (0xRRGGBB). */
    colorMicelioSemilla: 0x9a7bc0,
    colorMicelioJoven: 0xb38ed6,
    colorMicelioAdulta: 0xd2b3ed,
  },

  // ─────────────────────────────────────────────────────────────
  // ENTIDADES [P2]
  // ─────────────────────────────────────────────────────────────
  entidades: {
    /** Máximo de entidades vivas simultáneas (evita colapso de memoria). */
    maxEntidades: 4000,
    /** Vida máxima en ticks antes de morir por edad. */
    edadMaximaTicks: 60 * 60 * 12, // 12 minutos de simulación
    /** Multiplicador de lentitud al cruzar agua (movement.js, T40). */
    costeAgua: 4,
    /** Multiplicador de lentitud al cruzar arena (movement.js, T40). */
    costeArena: 1.6,
    /** Fracción de la vida máxima con la que se reparten edades iniciales (T42). */
    fraccionEdadInicial: 0.5,
  },

  // ─────────────────────────────────────────────────────────────
  // GENÉTICA [P2 · T67]
  // ─────────────────────────────────────────────────────────────
  genetica: {
    /** Probabilidad de que cada gen mute al nacer. */
    probMutacion: 0.15,
    /** Magnitud del salto cuando un gen muta (multiplicador aditivo). */
    deltaMutacion: 0.12,
    /** Probabilidad de que el salto sea positivo (si no, es negativo). */
    probMutacionPositiva: 0.5,
    /** Peso del primer progenitor en el promedio; el segundo usa 1 - pesoPadre. */
    pesoPadre: 0.5,
    /** Valor mínimo permitido para cualquier gen. */
    minRasgo: 0.5,
    /** Valor máximo permitido para cualquier gen. */
    maxRasgo: 1.5,
  },

  // ─────────────────────────────────────────────────────────────
  // HERBÍVORO [P2]
  // ─────────────────────────────────────────────────────────────
  herbivoro: {
    poblacionInicial: 120,
    /** Velocidad en celdas por segundo. */
    velocidad: 1.2,
    /** Radio de visión en celdas. */
    radioVision: 6,
    /** Umbral de hambre a partir del cual se prioriza comer. */
    hambreCritica: 0.7,
    /** Umbral de sed a partir del cual se prioriza beber. */
    sedCritica: 0.7,
    /**
     * Umbral de sed a partir del cual el animal **sesga su deambulación**
     * hacia el agua (T38), sin abandonar lo que estaba haciendo: así llega
     * a la orilla antes de que la sed sea crítica.
     */
    sedBusqueda: 0.3,
    /**
     * Distancia (en celdas) a la que se mantiene del agua al deambular (T38).
     * Evita que la población se amontone en la playa: se reparte en una
     * franja alrededor del agua, lo bastante cerca para beber rápido.
     */
    distanciaOrilla: 10,
    /** Umbral de deseo de reproducción. */
    umbralReproduccion: 0.6,
    /** Velocidad a la que sube el hambre por segundo (T34). */
    consumoHambre: 0.01,
    /** Velocidad a la que sube la sed por segundo (T34). */
    consumoSed: 0.004,
    /** Ticks entre reproducción y el siguiente intento. */
    cooldownReproduccion: 60 * 8,
    /** Edad mínima (en ticks) para reproducirse. */
    edadMinimaReproduccion: 60 * 15,
    /** Multiplicador de velocidad al ir a comer. */
    bonusVelocidadComer: 1.15,
    /** Distancia (celdas) a la que se puede morder una planta (T37). */
    radioComer: 0.7,
    /** Distancia (celdas) a la que se considera que está bebiendo (T38). */
    radioBeber: 1.5,
    /** Fracción de sed que se satisface de una vez al beber (T38). */
    saciedadAlBeber: 1,
    /** Distancia (celdas) a la que dos herbívoros dispuestos se reproducen (T46). */
    radioReproduccion: 1.2,
    /** Velocidad a la que sube el deseo de reproducirse si está bien alimentado (T46). */
    crecimientoReproduccion: 0.004,
    /** Velocidad a la que baja el deseo de reproducirse si tiene hambre o sed (T46). */
    decaimientoReproduccion: 0.02,
    /**
     * Ruido (radianes) que se le suma al rumbo por tick al explorar (T39).
     * Es un random walk: con 0.15 se giraba ~60° por segundo y el animal parecía
     * dar vueltas sin parar. 0.02 mantiene el camino orgánico (~9°/s) sin que
     * el rumbo cambie de golpe (bug reportado después de F7.5).
     */
    ruidoRumbo: 0.02,
    /** Ticks mínimos entre giros al deambular (T58). */
    ticksGiroMin: 40,
    /** Ticks máximos entre giros al deambular (T58). */
    ticksGiroMax: 110,
    /** Ticks que el herbívoro sigue huyendo tras perder de vista al depredador. */
    ticksHuida: 20,
  },

  // ─────────────────────────────────────────────────────────────
  // DEPREDADOR [P2]
  // ─────────────────────────────────────────────────────────────
  depredador: {
    poblacionInicial: 25,
    /** Más rápido que el herbívoro, pero menos eficiente (T44). */
    velocidad: 1.7,
    radioVision: 9,
    hambreCritica: 0.6,
    /** Umbral de sed a partir del cual se prioriza beber. */
    sedCritica: 0.7,
    /** Umbral de sed a partir del cual sesga su rumbo hacia el agua (T38). */
    sedBusqueda: 0.3,
    /** Distancia al agua que mantiene al deambular, en celdas (T38). */
    distanciaOrilla: 10,
    /** Umbral de deseo de reproducción. */
    umbralReproduccion: 0.6,
    /** Velocidad a la que sube el hambre por segundo. */
    consumoHambre: 0.008,
    /** Velocidad a la que sube la sed por segundo. */
    consumoSed: 0.013,
    /** Fracción de hambre que se satisface al comer una presa (T43). */
    saciedadPorPresa: 0.8,
    /** Fracción de sed que se satisface de una vez al beber (T38). */
    saciedadAlBeber: 1,
    /** Distancia (celdas) a la que el depredador alcanza y mata a la presa (T43). */
    radioAtaque: 0.6,
    /** Distancia (celdas) a la que se considera que está bebiendo (T38). */
    radioBeber: 1.5,
    cooldownReproduccion: 60 * 15,
    edadMinimaReproduccion: 60 * 25,
    /** Distancia (celdas) a la que dos depredadores dispuestos se reproducen (T46). */
    radioReproduccion: 1.5,
    /** Velocidad a la que sube el deseo de reproducirse si está bien alimentado (T46). */
    crecimientoReproduccion: 0.003,
    /** Velocidad a la que baja el deseo de reproducirse si tiene hambre o sed (T46). */
    decaimientoReproduccion: 0.02,
    /**
     * Segundos de persecución máxima antes de abandonar la presa
     * (anti-twitch, T43). Tiene que ser **mayor** que el tiempo que tarda
     * el depredador en alcanzarla: con radio de visión 9 y una ventaja de
     * velocidad de 0.5 celdas/s hacen falta ~18 s. Con 12 s abandonaba
     * siempre antes de cazar y la población de carnívoros se extinguía.
     */
    segundosPersecucion: 30,
    /** Ruido (radianes) por tick al explorar. Acumulativo: se mantiene bajo (ver herbívoro). */
    ruidoRumbo: 0.02,
    /** Ticks mínimos entre giros al deambular (T58). */
    ticksGiroMin: 40,
    /** Ticks máximos entre giros al deambular (T58). */
    ticksGiroMax: 110,
  },

  // ─────────────────────────────────────────────────────────────
  // PERCEPCIÓN / SPATIAL HASH [P2]
  // ─────────────────────────────────────────────────────────────
  percepcion: {
    /** Tamaño de celda del hash espacial, en celdas del mundo. */
    celdaHash: 8,
    /** Celdas a la redonda que se consultan por hash para un radio dado. */
    margenConsulta: 1,
    /**
     * Cada cuántos ticks un depredador vuelve a buscar presa cuando no
     * tiene ninguna a la vista. Buscar en el hash en cada tick es caro y
     * la memoria del objetivo alcanza para varios ticks.
     */
    ticksEntreBusqueda: 6,
    /**
     * Cada cuántos ticks una entidad sin agua a la vista vuelve a seguir
     * el campo BFS hacia el agua (T38). El agua no se mueve, así que se
     * busca menos seguido que la comida.
     */
    ticksEntreBusquedaAgua: 20,
    /** Distancia objetivo al agua cuando la sed es crítica: la orilla (T38). */
    distanciaBebida: 1,
    /** Fracción de `distanciaOrilla` usada como objetivo con sed media (T38). */
    factorDistanciaSedMedia: 0.5,
    /**
     * Mantiene la franja de distancia al agua al deambular (T38). Si se
     * desactiva, los animales vagan libremente; con sed crítica SIGUEN yendo
     * a beber (T38), lo que se quita es el "pegarse a la orilla".
     */
    mantenerDistanciaAgua: true,
    /**
     * Separación estilo boids: radio (en celdas) en el que un animal siente a
     * los demás de su especie y ajusta el rumbo para no amontonarse.
     */
    radioSeparacion: 1,
    /**
     * Intensidad de la separación cuando el vecino está prácticamente encima
     * (0 = desactivada). Decae linealmente hasta 0 en `radioSeparacion`; con
     * el valor default un vecino a ~0.7 celdas puede invertir el rumbo.
     */
    fuerzaSeparacion: 2,
  },

  // ─────────────────────────────────────────────────────────────
  // INTERFAZ [P1] — HUD, controles, gráfico, leyenda y barras
  // ─────────────────────────────────────────────────────────────
  // Regla del proyecto: los componentes de UI no hardcodean sus
  // constantes; las leen de acá (T55/T56).
  ui: {
    /** Historial del gráfico: muestras guardadas (1 por segundo → 5 min). */
    graficoMaxMuestras: 300,
    /** Cada cuántos ticks se guarda una muestra y se redibuja el gráfico (1 s). */
    graficoIntervaloTicks: 60,
    /** Tamaño del canvas del gráfico, en píxeles. */
    graficoAncho: 260,
    graficoAlto: 120,
    /** Colores CSS de cada serie del gráfico (plantas, herbívoros, carnívoros). */
    graficoColorPlantas: '#4f9d4f',
    graficoColorHerbivoros: '#6bdc7a',
    graficoColorDepredadores: '#ff5d5d',
    /** Barras de necesidades del animal seleccionado, en píxeles de mundo. */
    barraAncho: 16,
    barraAlto: 3,
    barraSeparacion: 1,
    /** Distancia (píxeles de mundo) a la que se dibujan las barras sobre el bicho. */
    barraOffsetY: 10,
    /** Radio (en celdas) alrededor del clic para seleccionar un bicho. */
    radioSeleccion: 1.5,
    /** Movimiento del puntero (px) que separa un clic de un arrastre de cámara. */
    umbralArrastrePx: 3,
    /** Cada cuántos ms se refresca el texto del HUD. */
    hudIntervaloMs: 200,
    /** Segmentos de las barras de necesidades de la leyenda. */
    barraSegmentos: 8,
  },

  // ─────────────────────────────────────────────────────────────
  // CÁMARA [P1]
  // ─────────────────────────────────────────────────────────────
  camara: {
    /** Suavizado del seguimiento (0 = instantáneo, 1 = muy lento). */
    suavizado: 0.12,
    /** Zoom mínimo y máximo (rueda del mouse). */
    zoomMin: 0.2,
    zoomMax: 4,
    /** Factor por el que se multiplica/divide el zoom en cada paso de rueda. */
    factorZoom: 1.12,
    /** Segundos de transición al enfocar una entidad con la tecla F (main.js). */
    dtEnfocar: 0.5,
    /** Límite de la cámara dentro de los bordes del mundo. */
    limiteMundo: true,
  },
};

/**
 * Valores originales, sin los cambios del menú. Se usan como referencia para
 * validar lo que se guarda y para que los presets arranquen siempre desde lo
 * mismo (aunque haya overrides activos).
 */
export const CONFIG_BASE = clonarConfig(CONFIG);

/** Overrides guardados desde el menú Configuración. Se aplican ANTES de
 * derivar `TICKS_POR_SEGUNDO` y `ESTADO`, así todo el arranque los respeta. */
copiarValidos(CONFIG_BASE, cargarOverrides(), CONFIG);

/**
 * Presets incluidos: solo overrides parciales sobre `CONFIG_BASE` (la regla
 * del proyecto sigue cumplida: los números viven en este archivo).
 */
export const PRESETS = {
  'Por defecto': {},
  'Bosque frondoso': {
    plantas: { densidadSemilla: 0.12, probExpansion: 0.14, poblacionInicial: 4000 },
    herbivoro: { poblacionInicial: 160 },
    depredador: { poblacionInicial: 12 },
  },
  Cacería: {
    plantas: { poblacionInicial: 1500 },
    herbivoro: { poblacionInicial: 140 },
    depredador: {
      poblacionInicial: 80,
      velocidad: 2,
      radioVision: 12,
      segundosPersecucion: 40,
    },
  },
  'Isla tranquila': {
    herbivoro: { poblacionInicial: 40, consumoHambre: 0.005, consumoSed: 0.002 },
    depredador: { poblacionInicial: 0 },
    tiempo: { escalaSimulacion: 1 },
  },
  'Simulación rápida': {
    tiempo: { escalaSimulacion: 4 },
    plantas: { ticksSemillaAJoven: 8, ticksJovenAAdulta: 24, ticksPorRefrescoRender: 4 },
  },
};

/** Ticks de simulación por segundo, derivado de `pasoFijo` (no hardcodear 60). */
export const TICKS_POR_SEGUNDO = Math.round(1 / CONFIG.tiempo.pasoFijo);

/** Helper: semilla actual. En runtime lo puede sobreescribir el usuario (tecla R). */
export const ESTADO = {
  seed: CONFIG.mundo.seedPorDefecto,
  pausa: false,
  escalaSimulacion: CONFIG.tiempo.escalaSimulacion,
  /** Modo depuración (T56): el color de las entidades es su estado de IA. */
  depuracion: false,
  /**
   * Población inicial elegida para (re)generar el mapa (T84). La actualiza el
   * menú y la usa también la tecla R, para cambiar solo la seed y conservar
   * las cantidades elegidas.
   */
  inicial: {
    plantas: CONFIG.plantas.poblacionInicial,
    herbivoros: CONFIG.herbivoro.poblacionInicial,
    depredadores: CONFIG.depredador.poblacionInicial,
  },
};
