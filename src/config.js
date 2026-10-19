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
  // TIEMPO / BUCLE PRINCIPAL [AMBOS]
  // ─────────────────────────────────────────────────────────────
  tiempo: {
    /** Timestep fijo de la simulación, en segundos. 60 Hz lógicos. */
    pasoFijo: 1 / 60,
    /** Máximo de pasos fijos por frame. Evita la "spiraling death" si la pestaña se congela. */
    maxPasosPorFrame: 5,
    /** Multiplicador de velocidad del usuario: 1, 2 o 4. */
    escalaSimulacion: 1,
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
    /** Probabilidad por tick de que una planta adulta se reproduzca en una celda vacía vecina. */
    probExpansion: 0.08,
    /** Vecindad usada por el autómata: 4 (ortogonal) u 8 (incluye diagonales). */
    radioExpansion: 1,
    /** Densidad inicial de semilla al generar el mundo (0..1 sobre celdas de tierra). */
    densidadSemilla: 0.06,
    /** Energía que aporta una planta adulta al ser comida. */
    energiaPorPlanta: 12,
    /** Colores de cada estado de planta para el render (0xRRGGBB). */
    colorSemilla: 0x6f7f4a,
    colorJoven: 0x6fae52,
    colorAdulta: 0x3f8f3a,
    /** Tamaño del sprite de una planta adulta en fracción del tile. */
    escalaSprite: 0.55,
    /** Actualizar el render de plantas cada N ticks (la vegetación cambia lento). */
    ticksPorRefrescoRender: 10,
  },

  // ─────────────────────────────────────────────────────────────
  // ENTIDADES [P2]
  // ─────────────────────────────────────────────────────────────
  entidades: {
    /** Máximo de entidades vivas simultáneas (evita colapso de memoria). */
    maxEntidades: 4000,
    /** Vida máxima en ticks antes de morir por edad. */
    edadMaximaTicks: 60 * 60 * 20, // 20 minutos de simulación
    /** Energía inicial de una entidad recién nacida. */
    energiaInicial: 70,
    /** Energía mínima para seguir vivo. */
    energiaMinima: 0,
    /** Multiplicador de coste energético al atravesar agua. */
    costeAgua: 4,
    /** Multiplicador de coste energético al atravesar arena. */
    costeArena: 1.6,
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
    /** Umbral de deseo de reproducción. */
    umbralReproduccion: 0.6,
    /** Velocidad a la que baja el hambre por segundo. */
    consumoHambre: 0.01,
    /** Velocidad a la que baja la sed por segundo. */
    consumoSed: 0.013,
    /** Energía mínima para reproducirse. */
    energiaReproduccion: 55,
    /** Ticks entre Reproduction y el siguiente intento. */
    cooldownReproduccion: 60 * 8,
    /** Edad mínima (en ticks) para reproducirse. */
    edadMinimaReproduccion: 60 * 15,
    /** Multiplicador de velocidad al perseguir comida. */
    bonusVelocidadComer: 1.15,
  },

  // ─────────────────────────────────────────────────────────────
  // DEPREDADOR [P2]
  // ─────────────────────────────────────────────────────────────
  depredador: {
    poblacionInicial: 25,
    /** Más rápido que el herbívoro, pero menos eficiente. */
    velocidad: 1.7,
    radioVision: 9,
    hambreCritica: 0.6,
    consumoHambre: 0.008,
    energiaPorPresa: 35,
    energiaReproduccion: 70,
    cooldownReproduccion: 60 * 15,
    edadMinimaReproduccion: 60 * 25,
    /** Segundos de persecución máxima antes de abandonar (anti-twitch). */
    segundosPersecucion: 12,
  },

  // ─────────────────────────────────────────────────────────────
  // PERCEPCIÓN / SPATIAL HASH [P2]
  // ─────────────────────────────────────────────────────────────
  percepcion: {
    /** Tamaño de celda del hash espacial, en celdas del mundo. */
    celdaHash: 8,
    /** Celdas a la redonda que se consultan por hash para un radio dado. */
    margenConsulta: 1,
  },

  // ─────────────────────────────────────────────────────────────
  // CÁMARA [P1]
  // ─────────────────────────────────────────────────────────────
  camara: {
    /** Suavizado del seguimiento (0 = instantáneo, 1 = muy lento). */
    suavizado: 0.12,
    /** Límite de la cámara dentro de los bordes del mundo. */
    limiteMundo: true,
  },
};

/** Helper: semilla actual. En runtime lo puede sobreescribir el usuario (tecla R). */
export const ESTADO = {
  seed: CONFIG.mundo.seedPorDefecto,
  pausa: false,
  escalaSimulacion: CONFIG.tiempo.escalaSimulacion,
};
