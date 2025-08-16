/**
 * test.js - Controlador principal para test.html
 * Proyecto: Super X Immersive Cards
 * 
 * Versión de prueba con funcionalidades de compartir integradas.
 * Maneja la experiencia completa de visualización 3D, interacción hold-to-play,
 * reproducción de video y funcionalidades sociales de compartir.
 */

import { loadLang, applyTranslations, detectUserLanguage, getTranslation, switchLanguage } from "./lang.js";
import * as config from "./config.js";
import {
  spawnParticles,
  customAutoRotate,
  snapToNearestSide,
  validateResource,
  isModelViewerReady,
  getCardShareImage,
  detectPlatform,
  tryNativeShare,
  copyImageToClipboard,
  downloadImage,
  triggerHapticFeedback,
  debounce,
  throttle,
  getEventPosition,
  calculateDragDistance,
  displayError,
  displayWarning,
  displaySuccess,
  displayInfo
} from "./utils.js";

/* =====================
   INICIALIZACIÓN PRINCIPAL
===================== */
(async function initializeCardViewer() {
  // --- Configuración inicial ---
  const params = new URLSearchParams(window.location.search);
  const cardId = params.get("id");
  
  // --- Detectar idioma usando lang.js ---
  const selectedLang = detectUserLanguage();

  // --- Cargar traducciones ---
  let translations = {};
  try {
    translations = await loadLang(selectedLang);
    applyTranslations(translations);
  } catch (error) {
    console.error("Error cargando traducciones:", error);
    displayWarning(getTranslation(translations, "warning_translation_load_failed", "No se pudieron cargar las traducciones. Usando valores por defecto."));
  }

  // --- Validar ID de carta ---
  if (!cardId) {
    displayError(getTranslation(translations, "error_invalid_id", "ID de carta inválido o faltante"));
    return;
  }

  // --- Cargar datos de cartas ---
  let cardData;
  try {
    const response = await fetch(config.CARDS_DATA_PATH);
    if (!response.ok) throw new Error("Error cargando cards.json");
    
    const data = await response.json();
    cardData = data[cardId];
    
    if (!cardData) {
      displayError(getTranslation(translations, "error_card_not_found", "Carta no encontrada"));
      return;
    }
  } catch (error) {
    console.error("Error cargando datos de cartas:", error);
    displayError(getTranslation(translations, "error_loading_data", "Error cargando datos de la carta"));
    return;
  }

  // --- Construir rutas de recursos ---
  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`
  };

  // --- Validar recursos ---
  const [modelExists, videoExists] = await Promise.all([
    validateResource(resourcePaths.model, 
      getTranslation(translations, "resource_3d_model", 
        config.DEFAULT_TEXTS?.[selectedLang]?.resourceModel || 
        config.DEFAULT_TEXTS?.[config.DEFAULT_LANG]?.resourceModel || 
        'modelo 3D'
      )
    ),
    validateResource(resourcePaths.video, 
      getTranslation(translations, "resource_video",
        config.DEFAULT_TEXTS?.[selectedLang]?.resourceVideo || 
        config.DEFAULT_TEXTS?.[config.DEFAULT_LANG]?.resourceVideo || 
        'video'
      )
    )
  ]);

  if (!modelExists) {
    displayError(getTranslation(translations, "error_model_not_found", "Archivo del modelo 3D no encontrado"));
    return;
  }

  if (!videoExists) {
    displayError(getTranslation(translations, "error_video_not_found", "Archivo de video no encontrado"));
    return;
  }

  // --- Inicializar aplicación ---
  const app = new CardViewerApp({
    cardId,
    cardData,
    resourcePaths,
    translations,
    lang: selectedLang
  });

  await app.initialize();
})();

/* =====================
   CLASE PRINCIPAL DE LA APLICACIÓN
===================== */
class CardViewerApp {
  constructor(options) {
    // Configuración
    this.cardId = options.cardId;
    this.cardData = options.cardData;
    this.resourcePaths = options.resourcePaths;
    this.translations = options.translations;
    this.lang = options.lang;

    // Referencias DOM
    this.elements = {
      viewer: document.getElementById("card_viewer"),
      video: document.getElementById("card_video"),
      fade: document.getElementById("card_fade_effect"),
      indicator: document.getElementById("card_hold_indicator"),
      particlesContainer: document.getElementById("card_particles_container"),
      skipButton: document.getElementById("card_skip_button"),
      shareButton: document.getElementById("card_share_button"),
      infoBox: document.getElementById("card_info_box"),
      logo: document.getElementById("card_logo"),
      title: document.getElementById("card_title")
    };

    // Estado de la aplicación
    this.state = {
      current: 'model', // 'model', 'transitioning', 'video'
      isHolding: false,
      activePointerId: null,
      interactionLocked: false,
      isAutoRotateEnabled: true,
      modelMoved: false,
      isDragging: false
    };

    // Control de interacciones
    this.interaction = {
      touchStartPosition: null,
      touchCurrentPosition: null,
      lastCameraOrbit: null,
      dragThreshold: config.DRAG_THRESHOLD || 10
    };

    // Control de timeouts y progreso
    this.timers = {
      hold: null,
      particles: null,
      videoTransition: null,
      modelTransition: null,
      autoRotate: null,
      snap: null,
      progress: null,
      dragCheck: null
    };

    // Variables de progreso
    this.progress = {
      startTime: 0,
      totalTime: config.HOLD_DURATION + config.VIDEO_ACTIVATION_DELAY
    };

    // Funciones optimizadas con debounce y throttle
    this.optimizedFunctions = {
      snapToSide: debounce(() => {
        if (this.state.current === 'model' && !this.state.interactionLocked) {
          this.setAutoRotateState(false);
          snapToNearestSide(this.elements.viewer);
          this.setAutoRotateState(true, config.CAMERA_SNAP_TRANSITION);
        }
      }, config.CAMERA_SNAP_DELAY || 300),
      
      updateHoldDetection: throttle((event) => {
        this._updateHoldDetection(event);
      }, 16), // ~60fps
      
      updateProgress: throttle(() => {
        this._updateProgress();
      }, 16) // ~60fps
    };
  }

  /* =====================
     INICIALIZACIÓN
  ===================== */
  async initialize() {
    this.setupCardContent();
    this.setupVideoErrorHandling();
    
    try {
      await this.initializeModelViewer();
    } catch (error) {
      console.error("Error inicializando aplicación:", error);
      displayError(getTranslation(this.translations, "error_initialization", "Error de inicialización"));
    }
  }

  /**
   * Cambia el idioma de la aplicación dinámicamente
   * @param {string} newLang - Código del nuevo idioma
   */
  async changeLanguage(newLang) {
    try {
      // Usar la función de lang.js para cambiar idioma
      this.translations = await switchLanguage(newLang);
      this.lang = newLang;
      
      // Actualizar textos dinámicos
      this.updateDynamicTexts();
      
      // Actualizar título de la carta
      const newTitle = this.getLocalizedTitle();
      this.elements.title.textContent = newTitle;
      
      // Actualizar botón de compartir
      this.setShareButtonState('normal');
      
      console.log(`Idioma cambiado a: ${newLang}`);
      
    } catch (error) {
      console.error(`Error cambiando idioma a ${newLang}:`, error);
      displayError(getTranslation(this.translations, "error_language_change", "Error al cambiar idioma"));
    }
  }

  setupCardContent() {
    // Configurar título de la carta
    const title = this.getLocalizedTitle();
    this.elements.title.textContent = title;

    // Asignar recursos
    this.elements.viewer.setAttribute("src", this.resourcePaths.model);
    this.elements.video.src = this.resourcePaths.video;

    // Configurar textos dinámicos desde traducciones
    this.updateDynamicTexts();
  }

  updateDynamicTexts() {
    // Actualizar texto del botón de skip
    if (this.elements.skipButton) {
      this.elements.skipButton.textContent = this.getText("video_skip", null, "Skip");
    }

    // Actualizar texto del indicador hold (si existe en DOM)
    const holdInstruction = document.querySelector('[data-i18n="card_hold_to_play"]');
    if (holdInstruction) {
      holdInstruction.textContent = this.getText("card_hold_to_play", null, "Hold the card to play the animation");
    }

    // Actualizar título de la página
    document.title = this.getText("page_card_title", null, "Super X Card");
  }

  getLocalizedTitle() {
    const { title } = this.cardData;
    return (title && (title[this.lang] || title[config.DEFAULT_LANG])) || 
           this.getText("card_title_fallback", "cardTitleFallback", "Unknown Card");
  }

  /**
   * Obtiene un texto por defecto desde config.js como fallback final
   * @param {string} key - Clave del texto en DEFAULT_TEXTS
   * @returns {string} - Texto por defecto
   */
  getDefaultText(key) {
    return config.DEFAULT_TEXTS?.[this.lang]?.[key] || 
           config.DEFAULT_TEXTS?.[config.DEFAULT_LANG]?.[key] || 
           "";
  }

  /**
   * Obtiene un texto con sistema de fallbacks completo usando lang.js
   * @param {string} translationKey - Clave en translations
   * @param {string} defaultTextKey - Clave en DEFAULT_TEXTS (opcional)
   * @param {string} hardcodedFallback - Fallback final hardcodeado (opcional)
   * @returns {string} - Texto obtenido
   */
  getText(translationKey, defaultTextKey = null, hardcodedFallback = "") {
    // 1. Intentar obtener de traducciones usando lang.js
    const translatedText = getTranslation(this.translations, translationKey);
    
    // Si getTranslation devolvió algo diferente a la clave, significa que encontró la traducción
    if (translatedText !== translationKey) {
      return translatedText;
    }

    // 2. Intentar obtener de DEFAULT_TEXTS si se proporcionó la clave
    if (defaultTextKey) {
      const defaultText = this.getDefaultText(defaultTextKey);
      if (defaultText) {
        return defaultText;
      }
    }

    // 3. Usar fallback hardcodeado
    return hardcodedFallback;
  }

  setupVideoErrorHandling() {
    this.elements.video.addEventListener('error', () => {
      console.error('Error cargando video:', this.resourcePaths.video);
      displayWarning(
        getTranslation(this.translations, "warning_video_unavailable", "Video no disponible")
      );
    });
  }

  /* =====================
     MODEL-VIEWER
  ===================== */
  async initializeModelViewer() {
    await this.waitForModelViewer();
    this.setupModelViewerEvents();
    this.setupEventListeners();
    this.disablePanMovement();

    if (config.AUTO_ROTATE_ENABLED) {
      customAutoRotate(
        this.elements.viewer, 
        () => this.state.isAutoRotateEnabled, 
        config.AUTO_ROTATE_SPEED
      );
    }
  }

  waitForModelViewer(maxAttempts = config.RETRY_CONFIG?.modelViewer?.maxAttempts || 50, 
                    interval = config.RETRY_CONFIG?.modelViewer?.interval || 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const checkReady = () => {
        attempts++;

        if (this.isModelViewerReady()) {
          resolve(true);
          return;
        }

        if (attempts >= maxAttempts) {
          const errorMsg = this.getText("error_model_viewer_timeout", "errorModelTimeout", 'Model-viewer no se cargó correctamente');
          reject(new Error(errorMsg));
          return;
        }

        setTimeout(checkReady, interval);
      };

      checkReady();
    });
  }

  isModelViewerReady() {
    return isModelViewerReady(this.elements.viewer);
  }

  setupModelViewerEvents() {
    this.elements.viewer.addEventListener('load', () => {
      console.log('Modelo 3D cargado exitosamente');
      displaySuccess(
        getTranslation(this.translations, "success_model_loaded", "Modelo 3D cargado correctamente")
      );
    });

    this.elements.viewer.addEventListener('error', (event) => {
      console.error('Error en model-viewer:', event);
      displayError(getTranslation(this.translations, "error_model_load_failed", "Error al cargar el modelo 3D"));
    });
  }

  disablePanMovement() {
    if (!this.isModelViewerReady()) {
      const warningMsg = this.getText("warning_model_viewer_not_ready", "warningModelNotReady", 'Model-viewer no está listo para configurar controles');
      console.warn(warningMsg);
      return;
    }

    try {
      this.elements.viewer.disablePan = true;

      // Prevenir menú contextual
      this.elements.viewer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });

      // Prevenir clics con botón medio/derecho
      this.elements.viewer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) {
          e.preventDefault();
          return false;
        }
      });

    } catch (error) {
      console.error('Error deshabilitando pan movement:', error);
    }
  }

  /* =====================
     CONTROL DE CÁMARA
  ===================== */
  safeGetCameraOrbit() {
    if (!this.isModelViewerReady()) return null;

    try {
      return this.elements.viewer.getCameraOrbit();
    } catch (error) {
      console.error('Error obteniendo camera orbit:', error);
      return null;
    }
  }

  safeSetCameraOrbit(orbitString) {
    if (!this.isModelViewerReady()) return false;

    try {
      this.elements.viewer.cameraOrbit = orbitString;
      return true;
    } catch (error) {
      console.error('Error estableciendo camera orbit:', error);
      return false;
    }
  }

  setModelViewerInteraction(enabled) {
    if (!this.isModelViewerReady()) return;

    try {
      if (enabled) {
        this.elements.viewer.removeAttribute('interaction-prompt-style');
        this.elements.viewer.style.pointerEvents = 'auto';
      } else {
        this.elements.viewer.setAttribute('interaction-prompt-style', 'none');
        this.elements.viewer.style.pointerEvents = 'none';
        setTimeout(() => {
          this.elements.viewer.style.pointerEvents = 'auto';
        }, 50);
      }
    } catch (error) {
      console.error('Error controlando interacciones de model-viewer:', error);
    }
  }

  /* =====================
     GESTIÓN DE ESTADOS
  ===================== */
  showVideo() {
    if (this.state.current !== 'model') return;

    this.state.current = 'transitioning';
    this.state.interactionLocked = true;
    this.clearAllTimeouts();
    this.setAutoRotateState(false);

    this.elements.fade.classList.add("active");

    this.timers.videoTransition = setTimeout(() => {
      // Ocultar elementos del modelo
      this.elements.viewer.style.display = "none";
      this.elements.infoBox.style.display = "none";
      this.elements.logo.classList.add("hidden");
      this.elements.shareButton.style.display = "none";

      // Mostrar elementos del video
      this.elements.video.style.display = "block";
      this.elements.video.classList.add("showing");
      this.elements.skipButton.style.display = "block";

      this.elements.fade.classList.remove("active");
      this.elements.video.play();
      this.elements.particlesContainer.innerHTML = "";

      this.state.current = 'video';
      this.state.interactionLocked = false;
      this.timers.videoTransition = null;
    }, config.FADE_DURATION);
  }

  returnToModel() {
    if (this.state.current !== 'video') return;

    this.state.current = 'transitioning';
    this.state.interactionLocked = true;
    this.clearAllTimeouts();

    this.elements.fade.classList.add("active");

    this.timers.modelTransition = setTimeout(() => {
      // Ocultar elementos del video
      this.elements.video.classList.remove("showing");
      this.elements.video.pause();
      this.elements.video.currentTime = 0;
      this.elements.video.style.display = "none";
      this.elements.skipButton.style.display = "none";

      // Mostrar elementos del modelo
      this.elements.viewer.style.display = "block";
      this.elements.infoBox.style.display = "block";
      this.elements.logo.classList.remove("hidden");
      this.elements.shareButton.style.display = "block";

      this.elements.fade.classList.remove("active");

      this.state.current = 'model';
      this.state.interactionLocked = false;
      this.timers.modelTransition = null;

      this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }, config.FADE_DURATION);
  }

  setAutoRotateState(enabled, delay = 0) {
    clearTimeout(this.timers.autoRotate);

    if (delay > 0) {
      this.timers.autoRotate = setTimeout(() => {
        this.state.isAutoRotateEnabled = enabled;
        this.timers.autoRotate = null;
      }, delay);
    } else {
      this.state.isAutoRotateEnabled = enabled;
    }
  }

  clearAllTimeouts() {
    Object.keys(this.timers).forEach(key => {
      if (this.timers[key]) {
        if (key === 'particles' || key === 'progress') {
          clearInterval(this.timers[key]);
        } else {
          clearTimeout(this.timers[key]);
        }
        this.timers[key] = null;
      }
    });
  }

  /* =====================
     SISTEMA DE INTERACCIÓN
  ===================== */
  startHoldDetection(event) {
    if (this.state.activePointerId !== null || 
        this.state.current !== 'model' || 
        this.state.interactionLocked) {
      return;
    }

    // Inicializar detección
    this.state.activePointerId = event.pointerId;
    this.interaction.touchStartPosition = getEventPosition(event);
    this.interaction.touchCurrentPosition = this.interaction.touchStartPosition;
    this.state.modelMoved = false;
    this.state.isDragging = false;
    this.interaction.lastCameraOrbit = this.safeGetCameraOrbit();

    // Reducir sensibilidad temporalmente
    this.setModelViewerInteraction(false);

    // Timeout para determinar intención
    this.timers.dragCheck = setTimeout(() => {
      const dragDistance = calculateDragDistance(
        this.interaction.touchStartPosition, 
        this.interaction.touchCurrentPosition
      );

      if (dragDistance < this.interaction.dragThreshold && !this.state.modelMoved) {
        this.initializeHoldState(this.interaction.touchStartPosition);
      } else {
        this.setModelViewerInteraction(true);
        this.state.activePointerId = null;
      }

      this.timers.dragCheck = null;
    }, config.INTENTION_DETECTION_DELAY || 150);
  }

  initializeHoldState(position) {
    this.timers.hold = setTimeout(() => {
      if (!this.state.modelMoved && 
          !this.state.isDragging && 
          this.state.current === 'model' && 
          !this.state.interactionLocked) {
        
        this.state.isHolding = true;
        this.progress.startTime = Date.now();
        this.elements.viewer.classList.add("hold");
        this.elements.indicator.classList.add("active");

        triggerHapticFeedback();
        this.startProgressAnimation();
        this.startParticleEffect(position);

        // Activar video después del delay configurado
        setTimeout(() => {
          if (this.state.isHolding && 
              this.state.current === 'model' && 
              !this.state.interactionLocked) {
            this.showVideo();
          }
        }, config.VIDEO_ACTIVATION_DELAY);
      }
    }, config.HOLD_DURATION);
  }

  updateHoldDetection(event) {
    this.optimizedFunctions.updateHoldDetection(event);
  }

  _updateHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId) return;

    this.interaction.touchCurrentPosition = getEventPosition(event);

    const dragDistance = calculateDragDistance(
      this.interaction.touchStartPosition,
      this.interaction.touchCurrentPosition
    );

    if (dragDistance > this.interaction.dragThreshold) {
      this.state.isDragging = true;

      if (this.timers.dragCheck) {
        clearTimeout(this.timers.dragCheck);
        this.timers.dragCheck = null;
        this.setModelViewerInteraction(true);
        this.state.activePointerId = null;
        return;
      }

      if (this.state.isHolding) {
        this.cancelHold();
      }
    }

    // Detectar movimiento de cámara
    if (this.interaction.lastCameraOrbit) {
      const currentOrbit = this.safeGetCameraOrbit();
      if (currentOrbit && currentOrbit.theta !== this.interaction.lastCameraOrbit.theta) {
        this.state.modelMoved = true;

        if (this.state.isHolding) {
          this.cancelHold();
        }

        if (this.timers.dragCheck) {
          clearTimeout(this.timers.dragCheck);
          this.timers.dragCheck = null;
          this.setModelViewerInteraction(true);
          this.state.activePointerId = null;
        }
      }
    }
  }

  endHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId) return;

    if (this.timers.dragCheck) {
      clearTimeout(this.timers.dragCheck);
      this.timers.dragCheck = null;
    }

    this.setModelViewerInteraction(true);
    this.cancelHold();

    if (this.state.current === 'model' && !this.state.interactionLocked) {
      snapToNearestSide(this.elements.viewer);
      this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }
  }

  cancelHold() {
    this.state.isHolding = false;
    this.state.activePointerId = null;
    this.state.isDragging = false;
    this.interaction.touchStartPosition = null;
    this.interaction.touchCurrentPosition = null;

    this.setModelViewerInteraction(true);
    this.clearAllTimeouts();

    this.elements.indicator.classList.remove("active");
    this.elements.indicator.style.width = '0';
    this.elements.viewer.classList.remove("hold");
  }

  /* =====================
     EFECTOS VISUALES
  ===================== */
  startProgressAnimation() {
    this.timers.progress = setInterval(() => {
      this.optimizedFunctions.updateProgress();
    }, 16);
  }

  _updateProgress() {
    if (!this.state.isHolding) return;

    const elapsed = Date.now() - this.progress.startTime;
    const progress = Math.min(elapsed / this.progress.totalTime, 1);
    const currentWidth = progress * 90; // 90% del viewport width

    this.elements.indicator.style.width = `${currentWidth}vw`;

    if (progress >= 1) {
      triggerHapticFeedback();
      clearInterval(this.timers.progress);
      this.timers.progress = null;
    }
  }

  startParticleEffect(position) {
    const spawnInterval = config.PARTICLE_SPAWN_INTERVAL || 100;
    this.timers.particles = setInterval(() => {
      if (this.state.isHolding) {
        spawnParticles(position.x, position.y, this.elements.particlesContainer);
      }
    }, spawnInterval);
  }

  /* =====================
     FUNCIONALIDAD DE COMPARTIR
  ===================== */
  async handleShareCard() {
    if (this.state.current !== 'model' || this.state.interactionLocked) return;

    try {
      this.setShareButtonState('loading');
      displayInfo(
        getTranslation(this.translations, "share_preparing", 'Preparando captura...')
      );

      // Obtener imagen para compartir
      const imageBlob = await getCardShareImage(this.resourcePaths.share);
      
      if (!imageBlob) {
        displayWarning(
          getTranslation(this.translations, "share_no_image", 'Imagen no disponible para compartir')
        );
        return;
      }

      // Generar texto optimizado
      const platform = detectPlatform();
      const shareText = this.generateShareText(platform);

      // Intentar compartir
      const shared = await this.attemptShare(imageBlob, shareText);
      this.handleShareResult(shared);

    } catch (error) {
      console.error('Error al compartir:', error);
      displayError(
        getTranslation(this.translations, "share_error", 'Error al preparar la imagen')
      );
    } finally {
      this.setShareButtonState('normal');
    }
  }

  generateShareText(platform) {
    const cardTitle = this.getLocalizedTitle();
    
    // Obtener handles desde config
    const storeHandle = config.SHARE_CONFIG?.socialHandles?.[platform] || 
                       config.SHARE_CONFIG?.socialHandles?.default || 
                       '@superx_coleccionables';
    
    // Usar traducciones específicas por plataforma o fallback general
    let shareText = getTranslation(this.translations, `share_${platform}_text`);
    
    if (shareText === `share_${platform}_text`) {
      // No se encontró traducción específica, usar texto general
      shareText = getTranslation(this.translations, "share_text", 
                 `¡Mira esta increíble carta 3D: "${cardTitle}"! 🎮✨\n¡Consigue la tuya en {storeHandle}!`);
    }
    
    // Reemplazar placeholders
    return shareText
      .replace('{cardTitle}', cardTitle)
      .replace('{storeHandle}', storeHandle);
  }

  async attemptShare(imageBlob, shareText) {
    // Intentar share nativo
    const nativeShared = await tryNativeShare(imageBlob, shareText);
    if (nativeShared) return { method: 'native', success: true };

    // Fallback: clipboard
    const copied = await copyImageToClipboard(imageBlob);
    if (copied) return { method: 'clipboard', success: true };

    // Último recurso: descarga
    const filename = `${config.SHARE_CONFIG?.filename || 'super-x-card'}-${this.cardId}.png`;
    downloadImage(imageBlob, filename);
    return { method: 'download', success: true };
  }

  handleShareResult(result) {
    if (result.success) {
      let message;
      switch (result.method) {
        case 'native':
          message = getTranslation(this.translations, "share_success", '¡Imagen lista para compartir!');
          break;
        case 'clipboard':
          message = getTranslation(this.translations, "share_fallback", 'Imagen copiada. Pégala en tus redes sociales');
          break;
        case 'download':
          message = getTranslation(this.translations, "share_success", '¡Imagen lista para compartir!');
          break;
      }
      displaySuccess(message);
    }
  }

  setShareButtonState(state) {
    const button = this.elements.shareButton;
    
    if (state === 'loading') {
      button.classList.add('loading');
      button.textContent = getTranslation(this.translations, "share_preparing", 'Preparando...');
    } else {
      button.classList.remove('loading');
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/>
        </svg>
        <span data-i18n="share_button">${getTranslation(this.translations, "share_button", 'Compartir')}</span>
      `;
    }
  }

  /* =====================
     EVENT LISTENERS
  ===================== */
  setupEventListeners() {
    // Controles principales
    this.elements.skipButton.addEventListener("click", () => this.returnToModel());
    this.elements.shareButton.addEventListener("click", () => this.handleShareCard());

    // Sistema de interacción
    this.elements.viewer.addEventListener("pointerdown", (e) => this.startHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointermove", (e) => this.updateHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointerup", (e) => this.endHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointercancel", (e) => this.endHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointerleave", (e) => this.endHoldDetection(e), { passive: false });

    // Prevenir comportamientos no deseados
    this.elements.viewer.addEventListener("dragstart", (e) => e.preventDefault());
    this.elements.viewer.addEventListener("selectstart", (e) => e.preventDefault());

    // Control de video
    this.elements.video.addEventListener("ended", () => this.returnToModel());

    // Snap automático de cámara
    this.elements.viewer.addEventListener("camera-change", () => {
      if (this.state.current !== 'model' || this.state.interactionLocked) return;
      this.optimizedFunctions.snapToSide();
    });

    // Escuchar eventos de cambio de idioma globales
    window.addEventListener('languageChanged', (event) => {
      console.log('Idioma cambiado globalmente:', event.detail.language);
      this.lang = event.detail.language;
      this.translations = event.detail.translations;
      this.updateDynamicTexts();
    });

    // Ejemplo: detectar tecla 'L' para cambiar idioma (útil para testing)
    if (config.DEBUG_MODE) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'l' || e.key === 'L') {
          const newLang = this.lang === 'en' ? 'es' : 'en';
          this.changeLanguage(newLang);
        }
      });
    }
  }
}