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
    maxPasosPorFrame: 10,
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
    /** Energía máxima: el techo de la barra de energía. */
    energiaMaxima: 100,
    /** Energía mínima para seguir vivo. */
    energiaMinima: 0,
    /** Energía que se consume por segundo solo por existir (metabolismo). */
    consumoMetabolico: 0.02,
    /** Energía extra que se consume por segundo mientras se mueve. */
    consumoMovimiento: 0.01,
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
    /**
     * Distancia (en celdas) a la que el animal se mantiene del agua cuando
     * **deambula**.
     *
     * Por qué existe: si el animal va hasta la orilla a beber y después
     * sigue paseando por la orilla, se amontona en la playa y no se
     * distribuye por el mapa. Con esta distancia, el herbívoro se queda en
     * una franja alrededor del agua: lo bastante cerca para beber rápido,
     * lo bastante lejos para repartir la población.
     *
     * 0 = puede meterse al agua. 10 = deambula a 10 celdas del agua.
     */
    distanciaOrilla: 10,
    /**
     * Umbral de sed a partir del cual el animal **sesga su deambulación**
     * hacia el agua, sin abandonar lo que estaba haciendo.
     *
     * Por qué existe: si el animal solo busca agua cuando la sed ya es
     * crítica, spends esos últimos segundos caminando y muere antes de
     * llegar. Con este umbral, empieza a derivar hacia la orilla mucho
     * antes y llega a tiempo.
     */
    sedBusqueda: 0.3,
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
    /** Cuánto se le baja el hambre al comer una planta (0..1). */
    saciedadPorPlanta: 0.45,
    /** Cuánto se le baja la sed al beber (0..1). */
    saciedadAlBeber: 1,
    /** Distancia (en celdas) a la que se reproducen dos herbívoros. */
    radioReproduccion: 1.5,
    /** Energía que cuesta criar una cría (la paga la madre y la pareja). */
    energiaPorCria: 25,
    /** Cuánto sube el deseo de reproducirse por segundo (si está bien alimentado). */
    crecimientoReproduccion: 0.004,
    /** Cuánto baja el deseo de reproducirse por segundo (si tiene hambre o sed). */
    decaimientoReproduccion: 0.02,
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
    sedCritica: 0.7,
    /** Umbral de sed a partir del cual sesga su rumbo hacia el agua. */
    sedBusqueda: 0.3,
    /** Distancia al agua que mantiene el carnívoro al deambular (celdas). */
    distanciaOrilla: 10,
    umbralReproduccion: 0.6,
    consumoHambre: 0.008,
    consumoSed: 0.013,
    energiaPorPresa: 35,
    energiaReproduccion: 70,
    cooldownReproduccion: 60 * 15,
    edadMinimaReproduccion: 60 * 25,
    /**
     * Segundos de persecución máxima antes de abandonar (anti-twitch).
     *
     * Tiene que ser MAYOR que el tiempo que tarda el depredador en alcanzar
     * a la presa: con radio de visión 9 y velocidad relativa 0,5 celdas/s,
     * se tardan ~18 s. Con 12 s el depredador abandonaba SIEMPRE antes de
     * cazar, y la población de carnívoros se extinguía.
     */
    segundosPersecucion: 30,
    /** Distancia (en celdas) a la que el depredador alcanza a matar a la presa. */
    radioAtaque: 0.6,
    /** Cuánto se le baja el hambre al comer una presa (0..1). */
    saciedadPorPresa: 0.8,
    /** Cuánto se le baja la sed al beber (0..1). */
    saciedadAlBeber: 1,
    /** Distancia (en celdas) a la que se reproducen dos depredadores. */
    radioReproduccion: 1.5,
    /** Energía que cuesta criar una cría (la paga la madre y la pareja). */
    energiaPorCria: 35,
    /** Cuánto sube el deseo de reproducirse por segundo (si está bien alimentado). */
    crecimientoReproduccion: 0.003,
    /** Cuánto baja el deseo de reproducirse por segundo (si tiene hambre o sed). */
    decaimientoReproduccion: 0.02,
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
     * Cada cuántos ticks una entidad vuelve a buscar comida.
     * Buscar en cada tick es caro (recorre el vecindario de la grilla);
     * la memoria de "dónde estaba la comida" alcanza para varios ticks.
     */
    ticksEntreBusqueda: 6,
    /**
     * Cada cuántos ticks una entidad vuelve a buscar agua.
     * El agua no se mueve, así que se busca menos seguido que la comida.
     */
    ticksEntreBusquedaAgua: 20,
  },

  // ─────────────────────────────────────────────────────────────
  // ESPECIES [P2]
  // ─────────────────────────────────────────────────────────────
  tipos: {
    /** Id de la especie herbívoro. Debe coincidir con `ESPECIE.HERBIVORO`. */
    herbivoro: 1,
    /** Id de la especie depredador. Debe coincidir con `ESPECIE.PREDADOR`. */
    depredador: 2,
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
  /** Modo depuración (T56): el color de las entidades es su estado de IA. */
  depuracion: false,
};
