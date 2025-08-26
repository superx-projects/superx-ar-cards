/**
 * config.js - Configuración centralizada del proyecto
 * Proyecto: Super X Immersive Cards
 * VERSIÓN LIMPIA - Solo configuraciones utilizadas
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

/* ===================== CONFIGURACIÓN VISUAL ===================== */
export const FADE_DURATION = 400;
export const PARTICLE_SPAWN_INTERVAL = 80;

/* ===================== CONFIGURACIÓN DE PARTÍCULAS ===================== */
export const PARTICLE_CONFIG = {
  count: 5,
  minDistance: 20,
  maxDistance: 80,
  duration: 2000
};

/* ===================== CONFIGURACIÓN DE CÁMARA ===================== */
export const CAMERA_SNAP_DELAY = 800;

/* ===================== CONFIGURACIÓN DE ROTACIÓN ===================== */
export const ROTATION_CONFIG = {
  snapAngles: [0, 180],
  defaultPhi: 90
};

/* ===================== CONFIGURACIÓN PARA COMPARTIR ===================== */
export const SHARE_CONFIG = {
  storeUrl: "https://www.superx.com.ar",
  socialHandle: "@superx_coleccionables",
  filename: "super-x-card"
};

/* ===================== CONFIGURACIÓN DE VALIDACIÓN DE RECURSOS ===================== */
export const RESOURCE_VALIDATION = {
  resourceType: 'resource',
  timeout: 5000,
  method: 'HEAD'
};

/* ===================== CONFIGURACIÓN DE DESARROLLO ===================== */
export const DEBUG_MODE = true;

/* ===================== CONFIGURACIÓN DE DISPOSITIVOS ===================== */
export const DEVICE_CONFIG = {
  hapticFeedback: { 
    enabled: true, 
    pattern: 50
  }
};

/* ===================== CONFIGURACIÓN DE PERFORMANCE ===================== */
export const PERFORMANCE_CONFIG = {
  cleanup: {
    urlRevokeDelay: 1000
  }
};

/* ===================== CONFIGURACIONES DE NOTIFICACIONES ===================== */

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
  textAlign: 'center',  
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease'
};

const BASE_COLORS = {
  info: { bg: '#3498db', text: '#ffffff' },
  success: { bg: '#2ecc71', text: '#ffffff' },
  error: { bg: '#e74c3c', text: '#ffffff' },
  warning: { bg: '#f39c12', text: '#ffffff' }
};

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
  duration: 4000,
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

