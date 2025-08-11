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
export const HOLD_DURATION = 500;

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

// =====================
// CONFIGURACIONES PARA COMPARTIR
// =====================

// Configuraciones para la funcionalidad de compartir
export const SHARE_CONFIG = {
  // Texto predeterminado para compartir
  defaultText: "¡Mira esta increíble carta 3D inmersiva que conseguí!",
  
  // Hashtags para redes sociales
  hashtags: ["CartasAR", "SuperXCards", "Experiencia3D"],
  
  // Nombre de la tienda (personalizar según tu local)
  storeName: "Super X",
  
  // Instagram handle de tu tienda (PERSONALIZAR CON TU @)
  instagramHandle: "@superx_coleccionables",  // Cambia por tu handle real
  
  // Handles de redes sociales adicionales
  socialHandles: {
    instagram: "@superx_coleccionables",      // Tu Instagram
    tiktok: "@superxcoleccionables",         // Tu TikTok (opcional)
    twitter: "@superx_store"         // Tu Twitter/X (opcional)
  },
  
  // Calidad de la captura de pantalla (0.1 a 1.0)
  screenshotQuality: 0.9,
  
  // Formato de la imagen de captura
  screenshotFormat: "image/png",
  
  // Dimensiones del canvas para captura (optimizado para redes sociales)
  captureWidth: 1080,
  captureHeight: 1080,
  
  // Tiempo de espera antes de tomar la captura (para asegurar que el modelo esté bien posicionado)
  captureDelay: 500,
  
  // Posición óptima de la cámara para la captura (formato: "thetaRad phiRad radius")
  optimalCameraPosition: "0deg 90deg 2m"
};
