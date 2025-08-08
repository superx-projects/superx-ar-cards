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
export const VIDEO_ACTIVATION_DELAY = 2000;

// Tiempo que debe mantenerse presionado para activar el video (en milisegundos)
export const HOLD_DURATION = 1000;

// Duración del spawn de partículas o efectos visuales (si aplica)
export const PARTICLE_SPAWN_DURATION = 500;

// Ajustes de rotación automática
export const AUTO_ROTATE_SPEED = 0.002;  // radianes por frame (aproximado)
export const AUTO_ROTATE_RESET_TIMEOUT = 3000; // tiempo de espera tras interacción (en ms)

// Habilitar debug mode
export const DEBUG_MODE = false;

