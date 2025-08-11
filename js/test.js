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
  
  // Si no se pasa id, que muestre la primer carta, para testeo unicamente
  // eliminar en la version final
  id = !id ? "e3y7pz" : id;

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

  // --- Variables de control específicas para interacción ---
  let touchStartPosition = null;
  let touchCurrentPosition = null;
  let isDragging = false;
  let dragThreshold = 10; // píxeles de tolerancia antes de considerar que es drag
  let interactionLocked = false; // Bloquear interacciones durante transiciones

  // --- Variables de control de timeouts y progreso ---
  let holdTimeout = null;
  let particleInterval = null;
  let videoTransitionTimeout = null;
  let modelTransitionTimeout = null;
  let autoRotateTimeout = null;
  let snapTimeout = null;
  let progressInterval = null;
  let dragCheckTimeout = null; // Nuevo timeout para verificar drag

  // --- Variables para el progreso del indicador ---
  let holdStartTime = 0;
  const TOTAL_HOLD_TIME = config.HOLD_DURATION + config.VIDEO_ACTIVATION_DELAY;

  // --- Función para activar vibración sutil ---
  function triggerHapticFeedback() {
    if ('vibrate' in navigator && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        navigator.vibrate(50);
      } catch (error) {
        console.debug('Vibración no disponible:', error);
      }
    }
  }

  // --- Función para actualizar progreso del indicador ---
  function updateHoldProgress() {
    if (!isHolding) return;
  
    const elapsed = Date.now() - holdStartTime;
    const progress = Math.min(elapsed / TOTAL_HOLD_TIME, 1);
    
    const currentWidth = progress * 90; // 90% del viewport width
    indicator.style.width = `${currentWidth}vw`;
  
    if (progress >= 1) {
      triggerHapticFeedback();
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

  // --- Función para controlar los controles de model-viewer ---
  function setModelViewerInteraction(enabled) {
    if (!isModelViewerReady()) return;
    
    try {
      if (enabled) {
        // Habilitar interacciones normales
        viewer.removeAttribute('interaction-prompt-style');
        viewer.style.pointerEvents = 'auto';
      } else {
        // Deshabilitar temporalmente las interacciones
        viewer.setAttribute('interaction-prompt-style', 'none');
        viewer.style.pointerEvents = 'none';
        // Re-habilitar solo para nuestros eventos personalizados
        setTimeout(() => {
          viewer.style.pointerEvents = 'auto';
        }, 50);
      }
    } catch (error) {
      console.error('Error controlando interacciones de model-viewer:', error);
    }
  }

  // --- Función mejorada para detectar si el usuario está intentando hacer drag ---
  function calculateDragDistance(startPos, currentPos) {
    if (!startPos || !currentPos) return 0;
    
    const deltaX = currentPos.x - startPos.x;
    const deltaY = currentPos.y - startPos.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  // --- Función para obtener posición del evento (unified touch/mouse) ---
  function getEventPosition(event) {
    return {
      x: event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0),
      y: event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0)
    };
  }

  // --- Deshabilitar pan y context menu del Model-Viewer ---
  function disablePanMovement() {
    if (!isModelViewerReady()) {
      console.warn('Model-viewer no está listo para configurar controles');
      return;
    }

    try {
      viewer.disablePan = true;
    
      viewer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });

      viewer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) {
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
    clearTimeout(dragCheckTimeout);
    clearInterval(particleInterval);
    clearInterval(progressInterval);
    
    holdTimeout = null;
    videoTransitionTimeout = null;
    modelTransitionTimeout = null;
    autoRotateTimeout = null;
    snapTimeout = null;
    dragCheckTimeout = null;
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
    if (currentState !== 'model') return;
    
    currentState = 'transitioning';
    interactionLocked = true;
    clearAllTimeouts();
    
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
      interactionLocked = false;
      videoTransitionTimeout = null;
    }, config.FADE_DURATION);
  }

  // Volver al modelo 3D con transición
  function returnToModel() {
    if (currentState !== 'video') return;
    
    currentState = 'transitioning';
    interactionLocked = true;
    clearAllTimeouts();
    
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
      interactionLocked = false;
      modelTransitionTimeout = null;
      
      // Activar auto-rotate después de un delay
      setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }, config.FADE_DURATION);
  }

  // Cancelar el estado de "hold"
  function cancelHold() {
    isHolding = false;
    activePointerId = null;
    isDragging = false;
    touchStartPosition = null;
    touchCurrentPosition = null;
    
    // Restaurar interacciones normales del model-viewer
    setModelViewerInteraction(true);
    
    clearTimeout(holdTimeout);
    clearTimeout(dragCheckTimeout);
    clearInterval(particleInterval);
    clearInterval(progressInterval);
    holdTimeout = null;
    dragCheckTimeout = null;
    particleInterval = null;
    progressInterval = null;

    indicator.classList.remove("active");
    indicator.style.width = '0';
    viewer.classList.remove("hold");
  }

  // --- Sistema de detección inteligente de intención del usuario ---
  function startHoldDetection(event) {
    if (activePointerId !== null || currentState !== 'model' || interactionLocked) {
      return;
    }

    activePointerId = event.pointerId;
    touchStartPosition = getEventPosition(event);
    touchCurrentPosition = touchStartPosition;
    modelMoved = false;
    isDragging = false;
    lastCameraOrbit = safeGetCameraOrbit();

    // Temporalmente reducir la sensibilidad del model-viewer
    setModelViewerInteraction(false);

    // Timeout corto para determinar la intención
    dragCheckTimeout = setTimeout(() => {
      const dragDistance = calculateDragDistance(touchStartPosition, touchCurrentPosition);
      
      if (dragDistance < dragThreshold && !modelMoved) {
        // El usuario parece querer hacer hold, iniciar detección
        initializeHoldState(touchStartPosition);
      } else {
        // El usuario quiere hacer drag, restaurar controles normales
        setModelViewerInteraction(true);
        activePointerId = null;
      }
      
      dragCheckTimeout = null;
    }, 150); // 150ms para determinar intención
  }

  function initializeHoldState(position) {
    // Iniciar el proceso de hold
    holdTimeout = setTimeout(() => {
      if (!modelMoved && !isDragging && currentState === 'model' && !interactionLocked) {
        isHolding = true;
        holdStartTime = Date.now();
        viewer.classList.add("hold");
        indicator.classList.add("active");

        // Feedback visual y háptico
        triggerHapticFeedback();

        // Iniciar progreso visual
        progressInterval = setInterval(updateHoldProgress, 16);

        // Iniciar partículas
        particleInterval = setInterval(() => {
          spawnParticles(position.x, position.y, particlesContainer);
        }, config.PARTICLE_SPAWN_INTERVAL);

        // Activar video después del tiempo configurado
        setTimeout(() => {
          if (isHolding && currentState === 'model' && !interactionLocked) {
            showVideo();
          }
        }, config.VIDEO_ACTIVATION_DELAY);
      }
    }, config.HOLD_DURATION);
  }

  function updateHoldDetection(event) {
    if (event.pointerId !== activePointerId) return;

    touchCurrentPosition = getEventPosition(event);
    
    // Calcular distancia de movimiento
    const dragDistance = calculateDragDistance(touchStartPosition, touchCurrentPosition);
    
    if (dragDistance > dragThreshold) {
      isDragging = true;
      
      // Si estaba esperando para iniciar hold, cancelar y habilitar drag normal
      if (dragCheckTimeout) {
        clearTimeout(dragCheckTimeout);
        dragCheckTimeout = null;
        setModelViewerInteraction(true);
        activePointerId = null;
        return;
      }
      
      // Si ya estaba en hold, cancelarlo
      if (isHolding) {
        cancelHold();
      }
    }

    // Detectar movimiento de cámara para cancelar hold existente
    if (!lastCameraOrbit) return;

    const currentOrbit = safeGetCameraOrbit();
    if (currentOrbit && currentOrbit.theta !== lastCameraOrbit.theta) {
      modelMoved = true;
      
      if (isHolding) {
        cancelHold();
      }
      
      if (dragCheckTimeout) {
        clearTimeout(dragCheckTimeout);
        dragCheckTimeout = null;
        setModelViewerInteraction(true);
        activePointerId = null;
      }
    }
  }

  function endHoldDetection(event) {
    if (event.pointerId !== activePointerId) return;
    
    // Limpiar detección pendiente
    if (dragCheckTimeout) {
      clearTimeout(dragCheckTimeout);
      dragCheckTimeout = null;
    }
    
    // Restaurar interacciones normales
    setModelViewerInteraction(true);
    
    // Cancelar hold si estaba activo
    cancelHold();

    // Realizar snap y activar auto-rotate si estamos en modelo
    if (currentState === 'model' && !interactionLocked) {
      snapToNearestSide(viewer);
      setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }
  }

  // --- Función para configurar event listeners ---
  function setupEventListeners() {
    disablePanMovement();
    
    skipButton.addEventListener("click", returnToModel);

    // Sistema mejorado de detección de eventos
    viewer.addEventListener("pointerdown", startHoldDetection, { passive: false });
    viewer.addEventListener("pointermove", updateHoldDetection, { passive: false });
    viewer.addEventListener("pointerup", endHoldDetection, { passive: false });
    viewer.addEventListener("pointercancel", endHoldDetection, { passive: false });
    viewer.addEventListener("pointerleave", endHoldDetection, { passive: false });

    // Prevenir comportamientos no deseados
    viewer.addEventListener("dragstart", (e) => e.preventDefault());
    viewer.addEventListener("selectstart", (e) => e.preventDefault());

    video.addEventListener("ended", returnToModel);

    // Snap de rotación horizontal
    viewer.addEventListener("camera-change", () => {
      if (currentState !== 'model' || interactionLocked) return;
      
      clearTimeout(snapTimeout);

      snapTimeout = setTimeout(() => {
        if (currentState === 'model' && !interactionLocked) {
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
      await waitForModelViewer();
      
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
      
      setupEventListeners();
      
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
