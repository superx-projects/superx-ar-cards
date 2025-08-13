// config.js

// Idioma por defecto si no se detecta o falla el fetch
export const DEFAULT_LANG = "en";

// Carpeta donde se encuentran los archivos de idioma
export const LANG_PATH = "lang/";

// Carpeta donde se encuentran las imagenes
export const IMAGE_PATH = "assets/images/";

// Carpeta donde se encuentran los modelos 3D (.glb)
export const MODEL_PATH = "assets/models/";

// Carpeta donde se encuentran los videos (.mp4)
export const VIDEO_PATH = "assets/videos/";

// Archivo de datos de las cartas (id -> title, modelo, video)
export const CARDS_DATA_PATH = "data/cards.json";

// Tiempo de espera para iniciar el video tras mostrar el modelo (en milisegundos)
export const VIDEO_ACTIVATION_DELAY = 1000;

// Tiempo que debe mantenerse presionado para activar el video (en milisegundos)
export const HOLD_DURATION = 1000;

// Tiempo de duracion del efecto fade al iniciar o finalizar el video (en milisegundos)
// Si se modifica, actualizar tambien la linea "transition: opacity 0.4s ease" en card.css#fade_effect
export const FADE_DURATION = 400;

// Duración del spawn de partículas o efectos visuales (si aplica)
export const PARTICLE_SPAWN_DURATION = 500;

// Intervalo de generación de partículas durante el hold (en milisegundos)
export const PARTICLE_SPAWN_INTERVAL = 80;

// Tiempo de espera para el snap automático de cámara (en milisegundos)
export const CAMERA_SNAP_DELAY = 800;

// Duración de la transición del snap de cámara (en milisegundos)
export const CAMERA_SNAP_TRANSITION = 1000;

// Ajustes de rotación automática
export const AUTO_ROTATE_ENABLED = false; // habilitar o deshabilitar la rotacion automatica custom
export const AUTO_ROTATE_SPEED = 0.002;  // radianes por frame (aproximado)
export const AUTO_ROTATE_RESET_TIMEOUT = 3000; // tiempo de espera tras interacción (en ms)

// Habilitar debug mode
export const DEBUG_MODE = false;

// Configuración para compartir cartas en redes sociales
export const SHARE_CONFIG = {
  // Configuración de imágenes pre-renderizadas
  shareImagePath: 'assets/images/', // Carpeta donde están las imágenes de share
  shareImageExtension: 'png', // Extensión de las imágenes de share
  allowPlaceholder: true, // Permitir generar placeholder si no existe la imagen
  
  // Configuración de imagen generada (para placeholder)
  width: 1080,
  height: 1920,
  backgroundColor: '#1a1a2e',
  imageFormat: 'image/png',
  imageQuality: 0.9,
  
  // Configuración de redes sociales
  hashtags: ['#SuperX', '#ARCards', '#Coleccionables', '#3D'],
  filename: 'super-x-card', // Nombre base para archivos descargados
  
  // Handles específicos por plataforma
  socialHandles: {
    instagram: '@superx_coleccionables',
    facebook: '@SuperXStore',
    twitter: '@superx_coleccionables',
    whatsapp: '@+543244121680',
    default: '@superx_coleccionables' // Handle por defecto para plataformas no especificadas
  }
};