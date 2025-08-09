import { loadLang, applyTranslations } from "./lang.js";
import * as config from "./config.js";
import {
  spawnParticles,
  customAutoRotate,
  snapToNearestSide,
  validateResource
} from "./utils.js";

(async function () {
  // --- Inicialización y carga ---

  // Obtener parámetro "id" desde URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // Determinar idioma (por defecto español o inglés)
  const userLang = navigator.language.startsWith("es") ? "es" : "en";
  const lang = userLang || config.DEFAULT_LANG;

  // Cargar traducciones y aplicarlas al DOM
  let translations = {};
  try {
    translations = await loadLang(lang);
    applyTranslations(translations);
  } catch (error) {
    console.error("Error al cargar traducciones:", error);
  }

  // Validar parámetro id
  if (!id) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_invalid_id"] || "Invalid or missing card ID"}</p>`;
    return;
  }

  // Cargar datos de las cartas
  const res = await fetch(config.CARDS_DATA_PATH);
  if (!res.ok) throw new Error("No se pudo cargar cards.json");
  const data = await res.json();
  const cardData = data[id];
  if (!cardData) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_card_not_found"] || "Card not found"}</p>`;
    return;
  }
  
  // Construir rutas de recursos
  const modelPath = `${config.MODEL_PATH}${cardData.model}`;
  const videoPath = `${config.VIDEO_PATH}${cardData.video}`;

  // Validar que los archivos de recursos existan
  const [modelExists, videoExists] = await Promise.all([
    validateResource(modelPath, 'modelo 3D'),
    validateResource(videoPath, 'video')
  ]);

  if (!modelExists) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_model_not_found"] || "3D model file not found"}</p>`;
    return;
  }

  if (!videoExists) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_video_not_found"] || "Video file not found"}</p>`;
    return;
  }

  // --- Referencias a elementos DOM ---
  const viewer = document.getElementById("card_viewer");
  const video = document.getElementById("card_video");
  const fade = document.getElementById("card_fade_effect");
  const indicator = document.getElementById("card_hold_indicator");
  const particlesContainer = document.getElementById("card_particles_container");
  const skipButton = document.getElementById("card_skip_button");
  const infoBox = document.getElementById("card_info_box");
  const logo = document.getElementById("card_logo");

  // Mostrar título de la carta
  const title =
    (cardData.title && (cardData.title[lang] || cardData.title[config.DEFAULT_LANG])) ||
    "Unknown Card";
  document.getElementById("card_title").textContent = title;

  // Asignar rutas a modelo 3D y video (ya validadas)
  viewer.setAttribute("src", modelPath);
  video.src = videoPath;

  // --- Validación adicional de carga del video ---
  video.addEventListener('error', () => {
    console.error('Error cargando video:', videoPath);
    // Mostrar advertencia pero no detener la aplicación
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,165,0,0.9);color:black;padding:0.5rem 1rem;border-radius:4px;z-index:1002;';
    warningDiv.textContent = translations["warning_video_unavailable"] || "Video unavailable";
    document.body.appendChild(warningDiv);
    
    // Ocultar advertencia después de 3 segundos
    setTimeout(() => warningDiv.remove(), 3000);
  });

  // --- Variables de control ---
  let isHolding = false;
  let activePointerId = null;
  let lastCameraOrbit = null;
  let modelMoved = false;
  let isAutoRotateEnabled = true;
  let currentState = 'model'; // 'model', 'transitioning', 'video'

  // --- Variables de control de timeouts y progreso ---
  let holdTimeout = null;
  let particleInterval = null;
  let videoTransitionTimeout = null;
  let modelTransitionTimeout = null;
  let autoRotateTimeout = null;
  let snapTimeout = null;
  let progressInterval = null;

  // --- Variables para el progreso del indicador ---
  let holdStartTime = 0;
  const TOTAL_HOLD_TIME = config.HOLD_DURATION + config.VIDEO_ACTIVATION_DELAY; // Tiempo total real

  // --- Función para actualizar progreso del indicador ---
  function updateHoldProgress() {
    if (!isHolding) return;
    
    const elapsed = Date.now() - holdStartTime;
    const progress = Math.min(elapsed / TOTAL_HOLD_TIME, 1);
    
    // Calcular ancho basado en el progreso
    const maxWidth = window.innerWidth <= 768 
      ? (window.innerWidth <= 480 ? '60vw' : '65vw') 
      : '70vw';
    
    const currentWidth = progress * (maxWidth === '60vw' ? 60 : maxWidth === '65vw' ? 65 : 70);
    indicator.style.width = `${currentWidth}vw`;
    
    // Si llegamos al 100%, no necesitamos más actualizaciones
    if (progress >= 1) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  // --- Funciones de validación de Model-Viewer ---
  function isModelViewerReady() {
    return (
      typeof window.customElements !== 'undefined' &&
      window.customElements.get('model-viewer') &&
      viewer &&
      typeof viewer.getCameraOrbit === 'function'
    );
  }

  function waitForModelViewer(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkReady = () => {
        attempts++;
        
        if (isModelViewerReady()) {
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error('Model-viewer no se cargó correctamente'));
          return;
        }
        
        setTimeout(checkReady, interval);
      };
      
      checkReady();
    });
  }

  function safeGetCameraOrbit() {
    if (!isModelViewerReady()) {
      console.warn('Model-viewer no está listo');
      return null;
    }
    
    try {
      return viewer.getCameraOrbit();
    } catch (error) {
      console.error('Error al obtener camera orbit:', error);
      return null;
    }
  }

  function safeSetCameraOrbit(orbitString) {
    if (!isModelViewerReady()) {
      console.warn('Model-viewer no está listo para cambiar cámara');
      return false;
    }
    
    try {
      viewer.cameraOrbit = orbitString;
      return true;
    } catch (error) {
      console.error('Error al establecer camera orbit:', error);
      return false;
    }
  }

  // --- Deshabilitar pan y context menu del Model-Viewer para prevenir comportamientos no deseados ---
  function disablePanMovement() {
    if (!isModelViewerReady()) {
      console.warn('Model-viewer no está listo para configurar controles');
      return;
    }

    try {
      // Deshabilitar pan programáticamente (por si no está en HTML)
      viewer.disablePan = true;
    
      // Prevenir el menú contextual del click derecho
      viewer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
        });

      // Prevenir drag con botón derecho/medio
      viewer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) { // Botón medio o derecho
          e.preventDefault();
          return false;
        }
      });

      if (config.DEBUG_MODE) {
        console.log('Pan movement disabled successfully');
      }
    
    } catch (error) {
      console.error('Error deshabilitando pan movement:', error);
    }
  }

  // --- Función para limpiar todos los timeouts ---
  function clearAllTimeouts() {
    clearTimeout(holdTimeout);
    clearTimeout(videoTransitionTimeout);
    clearTimeout(modelTransitionTimeout);  
    clearTimeout(autoRotateTimeout);
    clearTimeout(snapTimeout);
    clearInterval(particleInterval);
    clearInterval(progressInterval); // Agregamos el nuevo interval
    
    holdTimeout = null;
    videoTransitionTimeout = null;
    modelTransitionTimeout = null;
    autoRotateTimeout = null;
    snapTimeout = null;
    particleInterval = null;
    progressInterval = null;
  }

  // --- Función para gestionar isAutoRotateEnabled de forma centralizada ---
  function setAutoRotateState(enabled, delay = 0) {
    clearTimeout(autoRotateTimeout);
    
    if (delay > 0) {
      autoRotateTimeout = setTimeout(() => {
        isAutoRotateEnabled = enabled;
        autoRotateTimeout = null;
      }, delay);
    } else {
      isAutoRotateEnabled = enabled;
    }
  }

  // --- Funciones auxiliares ---

  // Mostrar video con transición
  function showVideo() {
    if (currentState !== 'model') return; // Evitar múltiples llamadas
    
    currentState = 'transitioning';
    clearAllTimeouts(); // Limpiar cualquier timeout pendiente
    
    setAutoRotateState(false);
    fade.classList.add("active");

    videoTransitionTimeout = setTimeout(() => {
      viewer.style.display = "none";
      infoBox.style.display = "none";
      logo.classList.add("hidden");

      video.style.display = "block";
      video.classList.add("showing");
      skipButton.style.display = "block";

      fade.classList.remove("active");
      video.play();

      particlesContainer.innerHTML = "";
      currentState = 'video';
      videoTransitionTimeout = null;
    }, config.FADE_DURATION);
  }

  // Volver al modelo 3D con transición
  function returnToModel() {
    if (currentState !== 'video') return; // Evitar múltiples llamadas
    
    currentState = 'transitioning';
    clearAllTimeouts(); // Limpiar cualquier timeout pendiente
    
    fade.classList.add("active");

    modelTransitionTimeout = setTimeout(() => {
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      video.style.display = "none";
      skipButton.style.display = "none";

      viewer.style.display = "block";
      infoBox.style.display = "block";
      logo.classList.remove("hidden");

      fade.classList.remove("active");
      currentState = 'model';
      modelTransitionTimeout = null;
      
      // Activar auto-rotate después de un delay
      setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }, config.FADE_DURATION);
  }

  // Cancelar el estado de "hold" (mantener presionado)
  function cancelHold() {
    isHolding = false;
    activePointerId = null;
    
    // Limpiar timeouts específicos del hold
    clearTimeout(holdTimeout);
    clearInterval(particleInterval);
    clearInterval(progressInterval); // Limpiar progreso
    holdTimeout = null;
    particleInterval = null;
    progressInterval = null;

    indicator.classList.remove("active");
    indicator.style.width = '0'; // Reset manual del ancho
    viewer.classList.remove("hold");
  }

  // --- Función para configurar event listeners ---
  function setupEventListeners() {
    // Deshabilitar movimiento de pan
    disablePanMovement();
    
    // Botón para saltar video y volver al modelo 3D
    skipButton.addEventListener("click", returnToModel);

    // Iniciar "hold" al presionar puntero (mouse o touch)
    viewer.addEventListener("pointerdown", (e) => {
      if (activePointerId !== null || currentState !== 'model') return;
      activePointerId = e.pointerId;

      const x = e.clientX;
      const y = e.clientY;
      modelMoved = false;
      lastCameraOrbit = safeGetCameraOrbit();

      holdTimeout = setTimeout(() => {
        if (!modelMoved && currentState === 'model') {
          isHolding = true;
          holdStartTime = Date.now(); // Marcar inicio del hold
          viewer.classList.add("hold");
          indicator.classList.add("active");

          // Iniciar progreso visual sincronizado
          progressInterval = setInterval(updateHoldProgress, 16); // ~60fps

          // Iniciar partículas
          particleInterval = setInterval(() => {
            spawnParticles(x, y, particlesContainer);
          }, config.PARTICLE_SPAWN_INTERVAL);

          // Mostrar video después del tiempo total configurado
          setTimeout(() => {
            if (isHolding && currentState === 'model') {
              showVideo();
            }
          }, config.VIDEO_ACTIVATION_DELAY);
        }
      }, config.HOLD_DURATION);
    });

    // Detectar movimiento de cámara para cancelar "hold"
    viewer.addEventListener("pointermove", () => {
      if (!lastCameraOrbit) return;

      const currentOrbit = safeGetCameraOrbit();
      if (currentOrbit && currentOrbit.theta !== lastCameraOrbit.theta) {
        modelMoved = true;
        clearTimeout(holdTimeout);
      }
    });

    // Al soltar puntero, cancelar "hold" y activar rotación automática
    viewer.addEventListener("pointerup", (e) => {
      if (e.pointerId !== activePointerId) return;
      
      cancelHold();

      if (currentState === 'model') {
        // Realizar snap al soltar para orientar bien la carta
        snapToNearestSide(viewer);
        setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
      }
    });

    // Cancelar hold si puntero sale o se cancela
    viewer.addEventListener("pointercancel", (e) => {
      if (e.pointerId !== activePointerId) return;
      cancelHold();
    });

    viewer.addEventListener("pointerleave", (e) => {
      if (e.pointerId !== activePointerId) return;
      cancelHold();
    });

    // Al finalizar video, volver al modelo
    video.addEventListener("ended", returnToModel);

    // Snap de rotación horizontal
    viewer.addEventListener("camera-change", () => {
      if (currentState !== 'model') return;
      
      clearTimeout(snapTimeout);

      snapTimeout = setTimeout(() => {
        if (currentState === 'model') {
          setAutoRotateState(false);
          snapToNearestSide(viewer);
          setAutoRotateState(true, config.CAMERA_SNAP_TRANSITION);
        }
        snapTimeout = null;
      }, config.CAMERA_SNAP_DELAY);
    });
  }

  // --- Inicialización con validación ---
  async function initializeModelViewer() {
    try {
      // Esperar a que model-viewer esté completamente cargado
      await waitForModelViewer();
      
      // Validación adicional del modelo
      viewer.addEventListener('load', () => {
        console.log('Modelo 3D cargado exitosamente');
        if (config.DEBUG_MODE) {
          console.log('Model-viewer inicializado:', {
            hasGetCameraOrbit: typeof viewer.getCameraOrbit === 'function',
            initialOrbit: safeGetCameraOrbit()
          });
        }
      });
      
      viewer.addEventListener('error', (event) => {
        console.error('Error en model-viewer:', event);
        document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_model_load_failed"] || "Failed to load 3D model"}</p>`;
      });
      
      // Configurar event listeners solo después de que model-viewer esté listo
      setupEventListeners();
      
      // Iniciar rotación automática si está habilitada
      if (config.AUTO_ROTATE_ENABLED) {
        customAutoRotate(viewer, () => isAutoRotateEnabled, config.AUTO_ROTATE_SPEED);
      }
      
    } catch (error) {
      console.error('Error inicializando model-viewer:', error);
      document.body.innerHTML = `<p style='color:white;text-align:center;'>Error: ${translations["error_model_load_failed"] || "Failed to load 3D model"} - ${error.message}</p>`;
    }
  }

  // --- Inicializar todo ---
  initializeModelViewer();

})();
