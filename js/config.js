/**
 * config.js - Configuración centralizada del proyecto
 * Proyecto: Super X Immersive Cards
 * 
 * Contiene todas las constantes y configuraciones globales
 * para facilitar el mantenimiento y personalización.
 */

/* =====================
   CONFIGURACIÓN DE IDIOMAS
===================== */
export const DEFAULT_LANG = "en";
export const LANG_PATH = "lang/";

/* =====================
   RUTAS DE RECURSOS
===================== */
export const IMAGE_PATH = "assets/images/";
export const MODEL_PATH = "assets/models/";
export const VIDEO_PATH = "assets/videos/";
export const CARDS_DATA_PATH = "data/cards.json";

/* =====================
   CONFIGURACIÓN DE INTERACCIÓN
===================== */
// Tiempo que debe mantenerse presionado para activar el video (ms)
export const HOLD_DURATION = 1000;

// Tiempo de espera adicional tras completar el hold antes de mostrar video (ms)
export const VIDEO_ACTIVATION_DELAY = 1000;

// Tiempo total para completar la barra de progreso (ms)
export const TOTAL_HOLD_TIME = HOLD_DURATION + VIDEO_ACTIVATION_DELAY;

// Distancia mínima para considerar que el usuario está haciendo drag (px)
export const DRAG_THRESHOLD = 10;

// Tiempo para determinar la intención del usuario (hold vs drag) (ms)
export const INTENTION_DETECTION_DELAY = 150;

/* =====================
   CONFIGURACIÓN VISUAL
===================== */
// Duración del efecto fade al cambiar entre modelo y video (ms)
// IMPORTANTE: Si se modifica, actualizar también la transición CSS en .fade-effect
export const FADE_DURATION = 400;

// Configuración de partículas
export const PARTICLE_SPAWN_INTERVAL = 80; // Intervalo entre spawns (ms)
export const PARTICLE_SPAWN_DURATION = 600; // Duración de vida de cada partícula (ms)

/* =====================
   CONFIGURACIÓN DE CÁMARA
===================== */
// Tiempo de espera antes de activar el snap automático (ms)
export const CAMERA_SNAP_DELAY = 800;

// Duración de la transición del snap de cámara (ms)
export const CAMERA_SNAP_TRANSITION = 1000;

// Ángulos permitidos para el snap (grados)
export const SNAP_ANGLES = [0, 180]; // Frontal y posterior

/* =====================
   ROTACIÓN AUTOMÁTICA
===================== */
export const AUTO_ROTATE_ENABLED = false; // Habilitar/deshabilitar rotación automática
export const AUTO_ROTATE_SPEED = 0.002;   // Velocidad en radianes por frame
export const AUTO_ROTATE_RESET_TIMEOUT = 3000; // Tiempo de espera tras interacción (ms)

/* =====================
   CONFIGURACIÓN PARA COMPARTIR
===================== */
export const SHARE_CONFIG = {
  // Configuración de imágenes pre-renderizadas
  shareImagePath: 'assets/images/',
  shareImageExtension: 'png',
  
  // Configuración de redes sociales
  hashtags: ['#SuperX', '#ARCards', '#Coleccionables', '#3D'],
  filename: 'super-x-card', // Nombre base para archivos descargados
  
  // Handles específicos por plataforma
  socialHandles: {
    instagram: '@superx_coleccionables',
    facebook: '@SuperXStore', 
    twitter: '@superx_coleccionables',
    whatsapp: '+543244121680',
    default: '@superx_coleccionables'
  }
};

/* =====================
   CONFIGURACIÓN DE DESARROLLO
===================== */
export const DEBUG_MODE = false;

// Configuración de timeouts para retry de operaciones
export const RETRY_CONFIG = {
  modelViewer: {
    maxAttempts: 50,
    interval: 100 // ms entre intentos
  },
  resourceValidation: {
    timeout: 5000 // ms
  }
};

/* =====================
   CONFIGURACIÓN DE DISPOSITIVOS
===================== */
export const DEVICE_CONFIG = {
  // Configuración de vibración para dispositivos móviles
  hapticFeedback: {
    enabled: true,
    duration: 50 // ms
  },
  
  // Breakpoints responsive
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1024
  }
};

/* =====================
   TEXTOS POR DEFECTO (FALLBACKS)
   Estos textos se usan cuando las traducciones no están disponibles
===================== */
export const DEFAULT_TEXTS = {
  en: {
    cardTitleFallback: "Unknown Card",
    resourceModel: "3D model",
    resourceVideo: "video",
    loadingModel: "Loading 3D model...",
    errorModelTimeout: "Model-viewer failed to load properly",
    warningModelNotReady: "Model-viewer is not ready to configure controls",
    videoSkip: "Skip",
    shareButton: "Share",
    sharePrepairing: "Preparing...",
    holdToPlay: "Hold the card to play the animation"
  },
  es: {
    cardTitleFallback: "Carta Desconocida", 
    resourceModel: "modelo 3D",
    resourceVideo: "video",
    loadingModel: "Cargando modelo 3D...",
    errorModelTimeout: "Model-viewer no se cargó correctamente",
    warningModelNotReady: "Model-viewer no está listo para configurar controles",
    videoSkip: "Saltar",
    shareButton: "Compartir", 
    sharePrepairing: "Preparando...",
    holdToPlay: "Mantén presionada la carta para reproducir la animación"
  }
};
