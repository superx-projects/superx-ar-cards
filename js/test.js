import { loadLang, applyTranslations } from "./lang.js";
import * as config from "./config.js";
import {
  spawnParticles,
  customAutoRotate,
  snapToNearestSide,
  validateResource,
  captureModelScreenshot,
  prepareModelForCapture,
  restoreModelPosition,
  generateShareText,
  generateInstagramStoriesText,
  detectPlatform,
  tryNativeShare,
  copyImageToClipboard,
  downloadImage
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
  const shareButton = document.getElementById("card_share_button");
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
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,165,0,0.9);color:black;padding:0.5rem 1rem;border-radius:4px;z-index:1002;';
    warningDiv.textContent = translations["warning_video_unavailable"] || "Video unavailable";
    document.body.appendChild(warningDiv);
    
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
  let dragThreshold = 10;
  let interactionLocked = false;

  // --- Variables de control de timeouts y progreso ---
  let holdTimeout = null;
  let particleInterval = null;
  let videoTransitionTimeout = null;
  let modelTransitionTimeout = null;
  let autoRotateTimeout = null;
  let snapTimeout = null;
  let progressInterval = null;
  let dragCheckTimeout = null;

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
    
    const currentWidth = progress * 90;
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
        viewer.removeAttribute('interaction-prompt-style');
        viewer.style.pointerEvents = 'auto';
      } else {
        viewer.setAttribute('interaction-prompt-style', 'none');
        viewer.style.pointerEvents = 'none';
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

  function getEventPosition(event) {
    return {
      x: event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0),
      y: event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0)
    };
  }

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

  function showVideo() {
    if (currentState !== 'model') return;
    
    currentState = 'transitioning';
    interactionLocked = true;
    clearAllTimeouts();
    
    setAutoRotateState(false);
    fade.classList.add("active");

    videoTransitionTimeout = setTimeout(() => {
      // Ocultar todos los elementos del modelo
      viewer.style.display = "none";
      infoBox.style.display = "none";
      logo.classList.add("hidden");
      shareButton.style.display = "none"; // Ocultar botón de compartir

      // Mostrar elementos del video
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

  function returnToModel() {
    if (currentState !== 'video') return;
    
    currentState = 'transitioning';
    interactionLocked = true;
    clearAllTimeouts();
    
    fade.classList.add("active");

    modelTransitionTimeout = setTimeout(() => {
      // Ocultar elementos del video
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      video.style.display = "none";
      skipButton.style.display = "none";

      // Mostrar elementos del modelo
      viewer.style.display = "block";
      infoBox.style.display = "block";
      logo.classList.remove("hidden");
      shareButton.style.display = "block"; // Mostrar botón de compartir otra vez

      fade.classList.remove("active");
      currentState = 'model';
      interactionLocked = false;
      modelTransitionTimeout = null;
      
      setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }, config.FADE_DURATION);
  }

  function cancelHold() {
    isHolding = false;
    activePointerId = null;
    isDragging = false;
    touchStartPosition = null;
    touchCurrentPosition = null;
    
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

    setModelViewerInteraction(false);

    dragCheckTimeout = setTimeout(() => {
      const dragDistance = calculateDragDistance(touchStartPosition, touchCurrentPosition);
      
      if (dragDistance < dragThreshold && !modelMoved) {
        initializeHoldState(touchStartPosition);
      } else {
        setModelViewerInteraction(true);
        activePointerId = null;
      }
      
      dragCheckTimeout = null;
    }, 150);
  }

  function initializeHoldState(position) {
    holdTimeout = setTimeout(() => {
      if (!modelMoved && !isDragging && currentState === 'model' && !interactionLocked) {
        isHolding = true;
        holdStartTime = Date.now();
        viewer.classList.add("hold");
        indicator.classList.add("active");

        triggerHapticFeedback();

        progressInterval = setInterval(updateHoldProgress, 16);

        particleInterval = setInterval(() => {
          spawnParticles(position.x, position.y, particlesContainer);
        }, config.PARTICLE_SPAWN_INTERVAL);

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
    
    const dragDistance = calculateDragDistance(touchStartPosition, touchCurrentPosition);
    
    if (dragDistance > dragThreshold) {
      isDragging = true;
      
      if (dragCheckTimeout) {
        clearTimeout(dragCheckTimeout);
        dragCheckTimeout = null;
        setModelViewerInteraction(true);
        activePointerId = null;
        return;
      }
      
      if (isHolding) {
        cancelHold();
      }
    }

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
    
    if (dragCheckTimeout) {
      clearTimeout(dragCheckTimeout);
      dragCheckTimeout = null;
    }
    
    setModelViewerInteraction(true);
    cancelHold();

    if (currentState === 'model' && !interactionLocked) {
      snapToNearestSide(viewer);
      setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }
  }

  // --- Funcionalidad de compartir ---
  function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `share-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Mostrar notificación
    setTimeout(() => notification.classList.add('show'), 100);

    // Ocultar y remover notificación
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentElement) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  async function handleShareCard() {
    if (currentState !== 'model' || interactionLocked) return;

    try {
      // Mostrar estado de carga
      shareButton.classList.add('loading');
      shareButton.textContent = translations.share_preparing || 'Preparando captura...';
      showNotification(translations.share_preparing || 'Preparando captura...');

      // Preparar modelo para captura
      const originalOrbit = await prepareModelForCapture(viewer, config.SHARE_CONFIG);

      // Capturar screenshot
      const imageBlob = await captureModelScreenshot(viewer, config.SHARE_CONFIG);

      // Restaurar posición original
      restoreModelPosition(viewer, originalOrbit);

      // Generar texto para compartir según la plataforma
      const platform = detectPlatform();
      let shareText;
      
      if (platform === 'instagram') {
        shareText = generateInstagramStoriesText(title, config.SHARE_CONFIG, translations);
      } else {
        shareText = generateShareText(title, config.SHARE_CONFIG, translations);
      }
      
      const shareTitle = translations.share_title || '¡Comparte tu experiencia!';

      // Intentar compartir nativamente
      const nativeShared = await tryNativeShare(imageBlob, shareText, shareTitle);
      
      if (nativeShared) {
        showNotification(translations.share_success || '¡Imagen lista para compartir!', 'success');
      } else {
        // Fallback: copiar al clipboard
        const copied = await copyImageToClipboard(imageBlob);
        
        if (copied) {
          showNotification(translations.share_fallback || 'Imagen copiada. Pégala en tus redes sociales', 'success');
        } else {
          // Último recurso: descargar imagen
          downloadImage(imageBlob, `super-x-card-${id}.png`);
          showNotification(translations.share_success || '¡Imagen lista para compartir!', 'success');
        }
      }

    } catch (error) {
      console.error('Error al compartir:', error);
      showNotification(translations.share_error || 'Error al preparar la imagen', 'error');
    } finally {
      // Restaurar estado del botón
      shareButton.classList.remove('loading');
      shareButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/>
        </svg>
        <span data-i18n="share_button">${translations.share_button || 'Compartir'}</span>
      `;
    }
  }

  // --- Función para configurar event listeners ---
  function setupEventListeners() {
    disablePanMovement();
    
    skipButton.addEventListener("click", returnToModel);
    shareButton.addEventListener("click", handleShareCard);

    viewer.addEventListener("pointerdown", startHoldDetection, { passive: false });
    viewer.addEventListener("pointermove", updateHoldDetection, { passive: false });
    viewer.addEventListener("pointerup", endHoldDetection, { passive: false });
    viewer.addEventListener("pointercancel", endHoldDetection, { passive: false });
    viewer.addEventListener("pointerleave", endHoldDetection, { passive: false });

    viewer.addEventListener("dragstart", (e) => e.preventDefault());
    viewer.addEventListener("selectstart", (e) => e.preventDefault());

    video.addEventListener("ended", returnToModel);

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

  initializeModelViewer();

})();