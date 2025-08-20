/**
 * config.js - Configuración centralizada del proyecto
 * Proyecto: Super X Immersive Cards
 */

/* ===================== CONFIGURACIÓN DE IDIOMAS ===================== */
export const DEFAULT_LANG = "es";
export const LANG_PATH = "lang/";

/* ===================== RUTAS DE RECURSOS ===================== */
export const IMAGE_PATH = "assets/images/";
export const MODEL_PATH = "assets/models/";
export const VIDEO_PATH = "assets/videos/";
export const CARDS_DATA_PATH = "data/cards.json";

/* ===================== CONFIGURACIÓN DE INTERACCIÓN ===================== */
export const HOLD_DURATION = 1000;
export const VIDEO_ACTIVATION_DELAY = 1000;
export const DRAG_THRESHOLD = 10;
export const INTENTION_DETECTION_DELAY = 150;
/* ===================== CONFIGURACIÓN MÓVIL OPTIMIZADA ===================== */
export const MOBILE_INTERACTION_CONFIG = {
  dragThresholdMobile: 15,        // Píxeles - más tolerante que desktop
  holdDetectionDelay: 200,        // ms - tiempo antes de considerar "hold intent"
  cameraMovementThreshold: 0.05,  // Radianes - muy tolerante para permitir micro-movimientos
  stabilityWindow: 100,           // ms - ventana para verificar si el dedo está quieto
  intentionDetectionDelay: 150,   // ms - tiempo para decidir entre drag vs hold
};

/* ===================== CONFIGURACIÓN VISUAL ===================== */
export const FADE_DURATION = 400;
export const PARTICLE_SPAWN_INTERVAL = 80;

/* ===================== CONFIGURACIÓN DE PARTÍCULAS ===================== */
export const PARTICLE_CONFIG = {
  duration: 2000,  // PARTICLE_SPAWN_DURATION renombrado para consistencia
  defaultCount: 5,
  minDistance: 20,
  maxDistance: 80,
  cleanup: {
    delay: 2000,
    batchSize: 10
  }
};

/* ===================== CONFIGURACIÓN DE CÁMARA ===================== */
export const CAMERA_SNAP_DELAY = 800;
export const CAMERA_SNAP_TRANSITION = 1000;

/* ===================== ROTACIÓN AUTOMÁTICA ===================== */
export const AUTO_ROTATE_ENABLED = false;
export const AUTO_ROTATE_SPEED = 0.002;
export const AUTO_ROTATE_RESET_TIMEOUT = 3000;

// Configuraciones adicionales para rotación
export const ROTATION_CONFIG = {
  enabled: AUTO_ROTATE_ENABLED,
  speed: 0.0005, // Velocidad por defecto en utils.js
  customSpeed: AUTO_ROTATE_SPEED,
  resetTimeout: AUTO_ROTATE_RESET_TIMEOUT,
  snapAngles: [0, 180],
  defaultPhi: 90, // Ángulo horizontal por defecto
  normalizeAngle: true
};

/* ===================== CONFIGURACIÓN PARA COMPARTIR ===================== */
export const SHARE_CONFIG = {
  shareImagePath: 'assets/images/',
  shareImageExtension: 'png',
  hashtags: ['#SuperX', '#ARCards', '#Coleccionables', '#3D'],
  filename: 'super-x-card',
  socialHandles: {
    instagram: '@superx_coleccionables',
    facebook: '@superxcoleccionables', 
    tiktok: '@superxcoleccionables',
    twitter: '@superx_store',
    whatsapp: '+543244121680',
    default: '@superx_coleccionables'
  }
};

/* ===================== CONFIGURACIÓN DE VALIDACIÓN DE RECURSOS ===================== */
export const RESOURCE_VALIDATION = {
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
  methods: {
    default: 'HEAD',
    fallback: 'GET'
  },
  cacheTime: 300000 // 5 minutos
};

/* ===================== CONFIGURACIÓN DE DESARROLLO ===================== */
export const DEBUG_MODE = true;
export const RETRY_CONFIG = {
  modelViewer: { maxAttempts: 50, interval: 100 },
  resourceValidation: { timeout: 5000 }
};

/* ===================== CONFIGURACIÓN DE DISPOSITIVOS ===================== */
export const DEVICE_CONFIG = {
  hapticFeedback: { 
    enabled: true, 
    duration: 50,
    patterns: {
      light: 50,
      medium: 100,
      heavy: 200
    }
  },
  breakpoints: { 
    mobile: 480, 
    tablet: 768, 
    desktop: 1024 
  }
};

/* ===================== CONFIGURACIÓN GEOMÉTRICA ===================== */
export const GEOMETRY_CONFIG = {
  angleNormalization: {
    degrees: { min: 0, max: 360 },
    radians: { min: 0, max: 2 * Math.PI }
  },
  snapTolerance: 5, // Grados de tolerancia para snap
  defaultSnapAngles: [0, 90, 180, 270]
};

/* ===================== CONFIGURACIÓN DE PERFORMANCE ===================== */
export const PERFORMANCE_CONFIG = {
  debounce: {
    default: 300,
    search: 500,
    resize: 250,
    scroll: 100
  },
  throttle: {
    default: 100,
    animation: 16, // 60fps
    touch: 50,
    mouse: 16
  },
  cleanup: {
    urlRevokeDelay: 1000,
    particleCleanupBatch: 10
  }
};

/* ===================== CONFIGURACIÓN DE PLATAFORMAS ===================== */
export const PLATFORM_DETECTION = {
  apps: [
    ['instagram', 'instagram'],
    ['tiktok', 'tiktok'],
    ['twitter', 'twitter'],
    ['x.com', 'twitter'],
    ['facebook', 'facebook'],
    ['whatsapp', 'whatsapp'],
    ['linkedin', 'linkedin'],
    ['telegram', 'telegram']
  ],
  os: [
    [/iphone|ipad|ios/i, 'ios'],
    [/android/i, 'android'],
    [/mac/i, 'macos'],
    [/win/i, 'windows'],
    [/linux/i, 'linux']
  ],
  fallback: 'web'
};

/* ===================== TEXTOS POR DEFECTO ===================== */
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
    shareButtonPreparing: "Preparing...",
    holdToPlay: "Hold the card to play the animation",
    // Nuevos textos para utils
    notifications: {
      imageCopied: "Image copied to clipboard",
      imageDownloaded: "Image downloaded",
      shareSuccess: "Shared successfully",
      shareError: "Could not share",
      resourceValidated: "Resource validated",
      resourceError: "Resource not available"
    }
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
    shareButtonPreparing: "Preparando...",
    holdToPlay: "Mantén presionada la carta para reproducir la animación",
    // Nuevos textos para utils
    notifications: {
      imageCopied: "Imagen copiada al portapapeles",
      imageDownloaded: "Imagen descargada",
      shareSuccess: "Compartido exitosamente",
      shareError: "No se pudo compartir",
      resourceValidated: "Recurso validado",
      resourceError: "Recurso no disponible"
    }
  }
};

/* ===================== CONFIGURACIONES BASE DE NOTIFICACIONES ===================== */

// Configuración base compartida
const BASE_NOTIFICATION_STYLES = {
  padding: '12px 20px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  zIndex: 10000,
  minWidth: '200px',
  maxWidth: '90vw',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  transition: 'all 0.3s ease'
};

const BASE_COLORS = {
  info: { bg: '#3498db', text: '#ffffff' },
  success: { bg: '#2ecc71', text: '#ffffff' },
  error: { bg: '#e74c3c', text: '#ffffff' },
  warning: { bg: '#f39c12', text: '#ffffff' }
};

/* ===================== CONFIGURACIONES ESPECÍFICAS ===================== */

// Notificación INFO
export const NOTIFICATION_INFO_CONFIG = {
  type: 'info',
  duration: 3000,
  position: { top: '20px', left: '50%' },
  styles: BASE_NOTIFICATION_STYLES,
  colors: BASE_COLORS,
  animation: { duration: 300 },
  removeExisting: true
};

// Notificación SUCCESS
export const NOTIFICATION_SUCCESS_CONFIG = {
  type: 'success',
  duration: 3000,
  position: { top: '20px', left: '50%' },
  styles: BASE_NOTIFICATION_STYLES,
  colors: BASE_COLORS,
  animation: { duration: 300 },
  removeExisting: true
};

// Notificación ERROR
export const NOTIFICATION_ERROR_CONFIG = {
  type: 'error',
  duration: 4000, // un poco más de tiempo para que se lea bien el error
  position: { top: '20px', left: '50%' },
  styles: BASE_NOTIFICATION_STYLES,
  colors: BASE_COLORS,
  animation: { duration: 300 },
  removeExisting: true
};

// Notificación WARNING
export const NOTIFICATION_WARNING_CONFIG = {
  type: 'warning',
  duration: 3500,
  position: { top: '20px', left: '50%' },
  styles: BASE_NOTIFICATION_STYLES,
  colors: BASE_COLORS,
  animation: { duration: 300 },
  removeExisting: true
};
