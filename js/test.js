/**
 * test.js - Controlador principal para test.html
 * Proyecto: Super X Immersive Cards
 */

import {
  loadLang,
  applyTranslations,
  detectUserLanguage,
  getTranslation,
  switchLanguage
} from "./lang.js";

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
  showNotification,
  getDeviceCapabilities
} from "./utils.js";

/* ===================== FUNCIONES DE VISTA ===================== */
function showView(id) {
  ["card_view_error", "card_view_model", "card_view_video"].forEach((v) =>
    document.getElementById(v).classList.add("hidden")
  );
  document.getElementById(id).classList.remove("hidden");
}

const showViewError = () => showView("card_view_error");
const showViewModel = () => showView("card_view_model");
const showViewVideo = () => showView("card_view_video");

/* ===================== FUNCIONES DE NOTIFICACIÓN ADAPTADAS ===================== */
// Funciones wrapper adaptadas a la nueva configuración
function displayError(message) {
  showNotification(message, config.NOTIFICATION_ERROR_CONFIG);
}
function displayWarning(message) {
  showNotification(message, config.NOTIFICATION_WARNING_CONFIG);
}
function displaySuccess(message) {
  showNotification(message, config.NOTIFICATION_SUCCESS_CONFIG);
}
function displayInfo(message) {
  showNotification(message, config.NOTIFICATION_INFO_CONFIG);
}

/* ===================== INICIALIZACIÓN PRINCIPAL ===================== */
(async function initializeCardViewer() {
  const params = new URLSearchParams(window.location.search);
  const cardId = params.get("id");
  const selectedLang = detectUserLanguage();
  let translations = {};

  try {
    translations = await loadLang(selectedLang);
    applyTranslations(translations);
  } catch (error) {
    if (config.DEBUG_MODE) console.error("Error cargando traducciones:", error);
    displayWarning(getTranslation(translations, "warning_translation_load_failed", "No se pudieron cargar las traducciones")
    );
  }

  // Validar ID y cargar datos
  let cardData = null;
  let errorMsg = null;

  if (!cardId) {
    errorMsg = getTranslation(translations, "error_invalid_id", "ID de carta inválido");
  } else {
    try {
      const response = await fetch(config.CARDS_DATA_PATH);
      if (!response.ok) throw new Error("Error cargando cards.json");
      const data = await response.json();
      cardData = data[cardId];
      if (!cardData) {
        errorMsg = getTranslation(translations, "error_card_not_found", "Carta no encontrada");
      }
    } catch (err) {
      if (config.DEBUG_MODE) console.error("Error cargando datos de cartas:", err);
      errorMsg = getTranslation(translations, "error_loading_data", "Error cargando datos");
    }
  }

  if (errorMsg) {
    showViewError();
    // displayError(errorMsg);
    return;
  }

  // Construir rutas y validar recursos
  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`
  };

  const [modelExists, videoExists] = await Promise.all([
    validateResource(resourcePaths.model, config.RESOURCE_VALIDATION),
    validateResource(resourcePaths.video, config.RESOURCE_VALIDATION)
  ]);

  if (!modelExists || !videoExists) {
    displayError("Recursos de la carta no encontrados");
    return;
  }

  // Inicializar aplicación
  const app = new CardViewerApp({
    cardId,
    cardData,
    resourcePaths,
    translations,
    lang: selectedLang
  });

  await app.initialize();
})();

/* ===================== CLASE PRINCIPAL ===================== */
class CardViewerApp {
  constructor(options) {
    Object.assign(this, options);

    this.elements = {
      viewer: document.getElementById("card_viewer"),
      video: document.getElementById("card_video"),
      fade: document.getElementById("card_fade_effect"),
      indicator: document.getElementById("card_hold_indicator"),
      particlesContainer: document.getElementById("card_particles_container"),
      skipButton: document.getElementById("card_skip_button"),
      shareButton: document.getElementById("card_share_button"),
      logo: document.getElementById("card_logo"),
      title: document.getElementById("card_title")
    };

    this.state = {
      current: "model",
      isHolding: false,
      activePointerId: null,
      interactionLocked: false,
      isAutoRotateEnabled: true,
      modelMoved: false,
      isDragging: false
    };

    this.interaction = {
      touchStartPosition: null,
      touchCurrentPosition: null,
      lastCameraOrbit: null,
      dragThreshold: config.DRAG_THRESHOLD
    };

    this.timers = new Map();

    this.progress = {
      startTime: 0,
      totalTime: config.HOLD_DURATION + config.VIDEO_ACTIVATION_DELAY
    };
  }

  /* ===================== GESTIÓN DE TIMERS SIMPLIFICADA ===================== */
  setTimer(name, callback, delay, isInterval = false) {
    this.clearTimer(name);
    const timer = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);
    this.timers.set(name, timer);
    return timer;
  }

  clearTimer(name) {
    if (this.timers.has(name)) {
      clearTimeout(this.timers.get(name));
      clearInterval(this.timers.get(name));
      this.timers.delete(name);
    }
  }

  clearAllTimers() {
    this.timers.forEach((timer, name) => this.clearTimer(name));
  }

  /* ===================== INICIALIZACIÓN ===================== */
  async initialize() {
    this.setupCardContent();
    this.setupVideoErrorHandling();
    try {
      await this.initializeModelViewer();
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error inicializando aplicación:", error);
      displayError("Error de inicialización");
    }
  }

  setupCardContent() {
    const title = this.getLocalizedTitle();
    this.elements.title.textContent = title;
    this.elements.viewer.setAttribute("src", this.resourcePaths.model);
    this.elements.video.src = this.resourcePaths.video;
    this.updateDynamicTexts();
  }

  updateDynamicTexts() {
    this.elements.skipButton.textContent = this.getText("video_skip", "Skip");
    document.title = this.getText("page_card_title", "Super X Card");
  }

  getLocalizedTitle() {
    const { title } = this.cardData;
    return (
      (title && (title[this.lang] || title[config.DEFAULT_LANG])) ||
      this.getText("card_title_fallback", "Unknown Card")
    );
  }

  getText(translationKey, fallback = "") {
    return getTranslation(this.translations, translationKey, fallback);
  }

  setupVideoErrorHandling() {
    this.elements.video.addEventListener("error", () => {
      if (config.DEBUG_MODE) console.error("Error cargando video:", this.resourcePaths.video);
      displayWarning(this.getText("warning_video_unavailable", "Video no disponible"));
    });
  }

  /* ===================== MODEL-VIEWER ===================== */
  async initializeModelViewer() {
    await this.waitForModelViewer();
    this.setupModelViewerEvents();
    this.setupEventListeners();
    this.disablePanMovement();
    showViewModel();

    if (config.AUTO_ROTATE_ENABLED) {
      customAutoRotate(
        this.elements.viewer,
        () => this.state.isAutoRotateEnabled,
        config.ROTATION_CONFIG
      );
    }
  }

  waitForModelViewer(
    maxAttempts = config.RETRY_CONFIG.modelViewer.maxAttempts,
    interval = config.RETRY_CONFIG.modelViewer.interval
  ) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const checkReady = () => {
        attempts++;
        if (isModelViewerReady(this.elements.viewer)) {
          resolve(true);
          return;
        }
        if (attempts >= maxAttempts) {
          reject(new Error("Model-viewer no se cargó correctamente"));
          return;
        }
        setTimeout(checkReady, interval);
      };
      checkReady();
    });
  }

  setupModelViewerEvents() {
    this.elements.viewer.addEventListener("load", () => {
      if (config.DEBUG_MODE) console.log("Modelo 3D cargado exitosamente");
    });

    this.elements.viewer.addEventListener("error", (event) => {
      if (config.DEBUG_MODE) console.error("Error en model-viewer:", event);
      displayError(this.getText("error_model_load_failed", "Error al cargar el modelo 3D"));
    });
  }

  disablePanMovement() {
    if (!isModelViewerReady(this.elements.viewer)) {
      if (config.DEBUG_MODE) console.warn("Model-viewer no está listo para configurar controles");
      return;
    }
    try {
      this.elements.viewer.disablePan = true;
      this.elements.viewer.addEventListener("contextmenu", (e) => e.preventDefault());
      this.elements.viewer.addEventListener("mousedown", (e) => {
        if (e.button === 1 || e.button === 2) e.preventDefault();
      });
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error deshabilitando pan movement:", error);
    }
  }

  /* ===================== GESTIÓN DE ESTADOS ===================== */
showVideo() {
    // NUEVO: Validación adicional antes de mostrar video
    if (this.state.current !== 'model' || this.state.interactionLocked) {
      if (config.DEBUG_MODE) console.warn('⚠️ showVideo llamado en estado inválido:', this.state.current);
      return;
    }

    // NUEVO: Verificar que realmente estamos en hold válido
    if (!this.state.isHolding) {
      console.warn('⚠️ showVideo llamado sin hold activo - cancelando');
      return;
    }

    if (config.DEBUG_MODE) console.log('🎬 Iniciando transición a video');
  
    this.state.current = 'transitioning';
    this.state.interactionLocked = true;
    this.clearAllTimers(); // Limpiar todo antes de la transición

    this.elements.fade.classList.add("active");

    this.setTimer('videoTransition', () => {
      // NUEVO: Verificación de estado antes de continuar
      if (this.state.current !== 'transitioning') {
        console.warn('⚠️ Estado cambió durante transición - abortando');
        this.elements.fade.classList.remove("active");
        return;
      }
    
      showViewVideo();
      this.elements.logo.classList.add("hidden");
      this.elements.video.classList.add("showing");
      this.elements.video.play();
      this.elements.fade.classList.remove("active");

      this.state.current = 'video';
      this.state.interactionLocked = false;
    
      if (config.DEBUG_MODE) console.log('✅ Transición a video completada');
    }, config.FADE_DURATION);
  }

  returnToModel() {
    if (this.state.current !== "video") return;

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    this.clearAllTimers();

    this.elements.fade.classList.add("active");

    this.setTimer(
      "modelTransition",
      () => {
        this.elements.video.classList.remove("showing");
        this.elements.video.pause();
        this.elements.video.currentTime = 0;
        showViewModel();
        this.elements.logo.classList.remove("hidden");
        this.elements.fade.classList.remove("active");
        this.state.current = "model";
        this.state.interactionLocked = false;
        this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
      },
      config.FADE_DURATION
    );
  }

  setAutoRotateState(enabled, delay = 0) {
    if (delay > 0) {
      this.setTimer("autoRotate", () => {
        this.state.isAutoRotateEnabled = enabled;
      }, delay);
    } else {
      this.state.isAutoRotateEnabled = enabled;
    }
  }

  /* ===================== SISTEMA DE INTERACCIÓN ===================== */
  startHoldDetection(event) {
    if (this.state.activePointerId !== null || this.state.current !== "model" || this.state.interactionLocked) return;

    // Detectar si es móvil
    const capabilities = getDeviceCapabilities();
    const isMobile = capabilities.isMobile;

    // Prevenir comportamientos no deseados solo en casos específicos
    if (isMobile && event.type === "pointerdown") {
      event.preventDefault();
    }

    this.state.activePointerId = event.pointerId;
    this.interaction.touchStartPosition = getEventPosition(event);
    this.interaction.touchCurrentPosition = this.interaction.touchStartPosition;
    this.state.modelMoved = false;
    this.state.isDragging = false;
    this.interaction.lastCameraOrbit = this.safeGetCameraOrbit();

    // CLAVE: En móviles, NO deshabilitar camera-controls inmediatamente
    // Permitir que funcionen normalmente hasta determinar intención
    if (!isMobile) {
      this.setModelViewerInteraction(false);
    }

    // Configuración específica por dispositivo (evitar colisión con `config`)
    const deviceCfg = isMobile
      ? config.MOBILE_INTERACTION_CONFIG
      : {
          dragThresholdMobile: this.interaction.dragThreshold,
          holdDetectionDelay: config.INTENTION_DETECTION_DELAY,
          stabilityWindow: 50
        };

    // NUEVO: Timer para detectar intención de hold vs drag
    this.setTimer(
      "intentionDetection",
      () => {
        const dragDistance = calculateDragDistance(
          this.interaction.touchStartPosition,
          this.interaction.touchCurrentPosition
        );
        const threshold = deviceCfg.dragThresholdMobile;

        // Si NO se ha movido significativamente = POSIBLE HOLD
        if (dragDistance < threshold && !this.state.modelMoved && !this.state.isDragging) {
          if (isMobile) {
            if (config.DEBUG_MODE) console.log("📱 Posible intención de HOLD detectada en móvil");
            // AHORA sí deshabilitar controles temporalmente para hold
            this.setModelViewerInteraction(false);
          }
          // Iniciar verificación de estabilidad para hold
          this.startStabilityCheck();
        } else {
          // Se detectó movimiento = DRAG CONFIRMADO
          if (config.DEBUG_MODE) console.log("🖱️ Intención de DRAG confirmada");
          this.confirmDragMode();
        }
      },
      deviceCfg.holdDetectionDelay
    );
  }

  // NUEVO: Verificación de estabilidad para hold
  startStabilityCheck() {
    const capabilities = getDeviceCapabilities();
    const isMobile = capabilities.isMobile;

    this.setTimer(
      "stabilityCheck",
      () => {
        // Verificar que el dedo sigue quieto después del período de detección
        const finalDragDistance = calculateDragDistance(
          this.interaction.touchStartPosition,
          this.interaction.touchCurrentPosition
        );
        const threshold = isMobile
          ? config.MOBILE_INTERACTION_CONFIG.dragThresholdMobile
          : this.interaction.dragThreshold;

        if (finalDragDistance < threshold && !this.state.modelMoved && !this.state.isDragging) {
          if (config.DEBUG_MODE) console.log("✅ HOLD confirmado - iniciando");
          this.initializeHoldState(this.interaction.touchStartPosition);
        } else {
          if (config.DEBUG_MODE) console.log("❌ HOLD cancelado - movimiento detectado");
          this.confirmDragMode();
        }
      },
      config.MOBILE_INTERACTION_CONFIG.stabilityWindow
    );
  }

  // NUEVO: Confirmar modo drag y restaurar controles
  confirmDragMode() {
    if (config.DEBUG_MODE) console.log('🎯 Confirmando modo DRAG');

    // Limpiar hold si estaba activo
    if (this.state.isHolding || this.state.activePointerId !== null) {
      this.cancelHold();
    }

    // MEJORADO: Restaurar controles de forma más segura
    const capabilities = getDeviceCapabilities();
    if (capabilities.isMobile) {
      // En móviles, restaurar camera-controls si había backup
      if (this.elements.viewer.hasAttribute("data-camera-controls-backup")) {
        this.elements.viewer.setAttribute("camera-controls", "");
        this.elements.viewer.removeAttribute("data-camera-controls-backup");
      }
      this.elements.viewer.removeAttribute("interaction-prompt-style");
    } else {
      // Desktop: usar función normal
      this.setModelViewerInteraction(true);
    }

    // Limpiar timers de detección
    this.clearTimer('intentionDetection');
    this.clearTimer('stabilityCheck');

    // Reset pointer tracking
    this.state.activePointerId = null;
  }

  updateHoldDetection = throttle((event) => {
    if (event.pointerId !== this.state.activePointerId) return;

    this.interaction.touchCurrentPosition = getEventPosition(event);

    const capabilities = getDeviceCapabilities();
    const isMobile = capabilities.isMobile;

    const dragDistance = calculateDragDistance(
      this.interaction.touchStartPosition,
      this.interaction.touchCurrentPosition
    );
    const threshold = isMobile
      ? config.MOBILE_INTERACTION_CONFIG.dragThresholdMobile
      : this.interaction.dragThreshold;

    // Si hay movimiento significativo
    if (dragDistance > threshold) {
      this.state.isDragging = true;

      // MEJORADO: Cancel más agresivo durante detección
      if (this.timers.has('intentionDetection') || this.timers.has('stabilityCheck')) {
        if (config.DEBUG_MODE) console.log('🔄 Drag detectado durante detección - cancelando inmediatamente');
        this.confirmDragMode();
        return;
      }

      // MEJORADO: Cancel inmediato si estamos en hold
      if (this.state.isHolding) {
        if (config.DEBUG_MODE) console.log('❌ Hold cancelado por drag - limpieza inmediata');
        this.cancelHold();
        return; // Return inmediato para evitar procesamiento adicional
      }
    }

    // Detección de movimiento de cámara (solo si no hemos cancelado ya)
    if (this.interaction.lastCameraOrbit && !this.state.isDragging && this.state.activePointerId !== null) {
      const currentOrbit = this.safeGetCameraOrbit();
      if (currentOrbit) {
        const deltaTheta = Math.abs(currentOrbit.theta - this.interaction.lastCameraOrbit.theta);
        const deltaPhi = Math.abs(currentOrbit.phi - this.interaction.lastCameraOrbit.phi);
      
        const threshold = config.MOBILE_INTERACTION_CONFIG?.cameraMovementThreshold || 0.05;
      
        if (deltaTheta > threshold || deltaPhi > threshold) {
          this.state.modelMoved = true;
        
          if (this.timers.has('intentionDetection') || this.timers.has('stabilityCheck')) {
            console.log('📹 Movimiento de cámara - activando drag');
            this.confirmDragMode();
          }
        
          if (this.state.isHolding) {
            console.log('❌ Hold cancelado por movimiento de cámara');
            this.cancelHold();
          }
        }
      }
    }
  }, 16);

  endHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId) return;

    if (config.DEBUG_MODE) console.log("🏁 Finalizando detección de hold");

    // Limpiar todos los timers de detección
    this.clearTimer("intentionDetection");
    this.clearTimer("stabilityCheck");

    // Restaurar controles del model-viewer
    this.setModelViewerInteraction(true);

    // Cancelar hold si estaba activo
    this.cancelHold();

    // Snap de cámara solo si no estamos en transición
    if (this.state.current === "model" && !this.state.interactionLocked) {
      snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
      this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }
  }

  validateModelViewerState() {
  try {
    if (!this.elements.viewer) {
      throw new Error("Element viewer no encontrado");
    }
    
    if (!isModelViewerReady(this.elements.viewer)) {
      throw new Error("Model-viewer no está listo");
    }
    
    // Verificar que el modelo esté cargado
    if (!this.elements.viewer.src || this.elements.viewer.src === "") {
      throw new Error("Modelo no tiene src definido");
    }
    
    return true;
  } catch (error) {
    if (config.DEBUG_MODE) console.error("Validación model-viewer falló:", error);
    return false;
  }
}

  /* ===================== INICIALIZACIÓN DE HOLD SIN CAMBIOS ===================== */
  initializeHoldState(position) {
  // NUEVO: Validar estado del model-viewer antes de iniciar hold
  if (!this.validateModelViewerState()) {
    if (config.DEBUG_MODE) console.warn("⚠️ Model-viewer no válido - cancelando hold");
    this.cancelHold();
    return;
  }

  this.setTimer(
    "hold",
    () => {
      if (
        !this.state.modelMoved &&
        !this.state.isDragging &&
        this.state.current === "model" &&
        !this.state.interactionLocked &&
        this.validateModelViewerState() // NUEVO: Validación adicional
      ) {
        if (config.DEBUG_MODE) console.log("🎯 Iniciando HOLD definitivo");
        this.state.isHolding = true;
        this.progress.startTime = Date.now();
        this.elements.viewer.classList.add("hold");
        this.elements.indicator.classList.add("active");
        triggerHapticFeedback(config.DEVICE_CONFIG.hapticFeedback);
        this.startProgressAnimation();
        this.startParticleEffect(position);

        this.setTimer(
          "videoActivation",
          () => {
            if (this.state.isHolding && this.state.current === "model" && 
                !this.state.interactionLocked && this.validateModelViewerState()) {
              if (config.DEBUG_MODE) console.log("🎬 Activando video por hold completado");
              this.showVideo();
            }
          },
          config.VIDEO_ACTIVATION_DELAY
        );
      } else {
        // Si la validación falla, cancelar hold
        if (config.DEBUG_MODE) console.warn("⚠️ Hold cancelado por validación fallida");
        this.cancelHold();
      }
    },
    config.HOLD_DURATION
  );
}

  /* ===================== CANCELACIÓN MEJORADA ===================== */
  cancelHold() {
    if (config.DEBUG_MODE) console.log("🚫 Cancelando hold");

    // Guardar estados previos para verificación
    const wasHolding = this.state.isHolding;
    const hadActivePointer = this.state.activePointerId !== null;

    this.state.isHolding = false;
    this.state.activePointerId = null;
    this.state.isDragging = false;
    this.interaction.touchStartPosition = null;
    this.interaction.touchCurrentPosition = null;

    // Limpiar TODOS los timers
    this.clearTimer("intentionDetection");
    this.clearTimer("stabilityCheck");
    this.clearTimer("hold");
    this.clearTimer("videoActivation");
    this.clearTimer("progress");
    this.clearTimer("particles");

    // MEJORADO: Restaurar controles de forma más segura
    try {
      const capabilities = getDeviceCapabilities();
      if (capabilities.isMobile && this.elements.viewer.hasAttribute("data-camera-controls-backup")) {
        // Restaurar camera-controls en móviles
        this.elements.viewer.setAttribute("camera-controls", "");
        this.elements.viewer.removeAttribute("data-camera-controls-backup");
        this.elements.viewer.removeAttribute("interaction-prompt-style");
      } else {
        // Usar función normal para desktop
        this.setModelViewerInteraction(true);
      }
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error restaurando controles:", error);
      // Intento de recuperación: restaurar atributos básicos
      try {
        this.elements.viewer.setAttribute("camera-controls", "");
        this.elements.viewer.removeAttribute("interaction-prompt-style");
        this.elements.viewer.style.pointerEvents = "auto";
      } catch (fallbackError) {
        if (config.DEBUG_MODE) console.error("Error en recuperación de controles:", fallbackError);
      }
    }

  // Limpiar UI
  this.elements.indicator.classList.remove("active");
  this.elements.indicator.style.width = "0";
  this.elements.viewer.classList.remove("hold");

  // NUEVO: Limpiar fade si quedó activo por race condition
  if (this.elements.fade.classList.contains("active")) {
    if (config.DEBUG_MODE) console.warn('⚠️ Fade quedó activo después de cancelar hold - limpiando');
    this.elements.fade.classList.remove("active");
  }

  // NUEVO: Asegurar que estamos en el estado correcto
  if (this.state.current === 'transitioning') {
    if (config.DEBUG_MODE) console.warn('⚠️ Estado inconsistente detectado - restaurando a model');
    this.forceReturnToModel();
  }
}

  /* ===================== FUNCIÓN DE RECUPERACIÓN FORZADA ===================== */
  forceReturnToModel() {
    console.log('🔄 Forzando retorno a vista model');
  
    // Limpiar cualquier timer de transición pendiente
    this.clearTimer('videoTransition');
    this.clearTimer('modelTransition');
  
    // Restaurar estado
    this.state.current = 'model';
    this.state.interactionLocked = false;
  
    // Limpiar efectos visuales
    this.elements.fade.classList.remove("active");
    this.elements.video.classList.remove("showing");
    this.elements.video.pause();
    this.elements.video.currentTime = 0;
  
    // Mostrar vista correcta
    showViewModel();
    this.elements.logo.classList.remove("hidden");
  
    // Restaurar auto-rotación
    this.setAutoRotateState(true, 0);
  }

  /* ===================== EFECTOS VISUALES ===================== */
  startProgressAnimation() {
    this.setTimer(
      "progress",
      () => {
        if (!this.state.isHolding) return;

        const elapsed = Date.now() - this.progress.startTime;
        const progress = Math.min(elapsed / this.progress.totalTime, 1);
        const currentWidth = progress * 90;
        this.elements.indicator.style.width = `${currentWidth}vw`;

        if (progress >= 1) {
          triggerHapticFeedback(config.DEVICE_CONFIG.hapticFeedback);
          this.clearTimer("progress");
        }
      },
      16,
      true
    );
  }

  startParticleEffect(position) {
    this.setTimer(
      "particles",
      () => {
        if (this.state.isHolding) {
          spawnParticles(position.x, position.y, this.elements.particlesContainer, config.PARTICLE_CONFIG);
        }
      },
      config.PARTICLE_SPAWN_INTERVAL,
      true
    );
  }

  /* ===================== FUNCIONALIDAD DE COMPARTIR ===================== */
  async handleShareCard() {
    if (this.state.current !== "model" || this.state.interactionLocked) return;

    try {
      this.setShareButtonState("loading");
      displayInfo(this.getText("share_preparing", "Preparando captura..."));

      const imageBlob = await getCardShareImage(this.resourcePaths.share);
      if (!imageBlob) {
        displayWarning(this.getText("share_no_image", "Imagen no disponible"));
        return;
      }

      const platform = detectPlatform(config.PLATFORM_DETECTION);
      const shareText = this.generateShareText(platform);
      const shared = await this.attemptShare(imageBlob, shareText);
      this.handleShareResult(shared);
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error al compartir:", error);
      displayError(this.getText("share_error", "Error al preparar la imagen"));
    } finally {
      this.setShareButtonState("normal");
    }
  }

  generateShareText(platform) {
    const cardTitle = this.getLocalizedTitle();
    const storeHandle =
      (config.SHARE_CONFIG?.socialHandles?.[platform]) ||
      (config.SHARE_CONFIG?.socialHandles?.default) ||
      "@superx_coleccionables";

    let shareText = this.getText(`share_${platform}_text`);

    if (shareText === `share_${platform}_text`) {
      shareText = this.getText(
        "share_text",
        `¡Mira esta increíble carta 3D: "${cardTitle}"! 🎮✨\n¡Consigue la tuya en ${storeHandle}!`
      );
    }

    return shareText
      .replace("{cardTitle}", cardTitle)
      .replace("{storeHandle}", storeHandle);
  }

  async attemptShare(imageBlob, shareText) {
    const filename = `${config.SHARE_CONFIG?.filename || "super-x-card"}-${this.cardId}.png`;

    const nativeShared = await tryNativeShare(imageBlob, shareText, filename);
    if (nativeShared) return { method: "native", success: true };

    const copied = await copyImageToClipboard(imageBlob);
    if (copied) return { method: "clipboard", success: true };

    downloadImage(imageBlob, filename, config.PERFORMANCE_CONFIG.cleanup.urlRevokeDelay);
    return { method: "download", success: true };
  }

  handleShareResult(result) {
    if (result.success) {
      const messages = {
        native: this.getText("share_success", "¡Imagen lista para compartir!"),
        clipboard: this.getText("share_fallback", "Imagen copiada. Pégala en tus redes sociales"),
        download: this.getText("share_success", "¡Imagen lista para compartir!")
      };
      displaySuccess(messages[result.method]);
    }
  }

  setShareButtonState(state) {
    const button = this.elements.shareButton;

    if (state === "loading") {
      button.classList.add("loading");
      button.textContent = this.getText("share_preparing", "Preparando...");
    } else {
      button.classList.remove("loading");
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/>
        </svg>
        <span>${this.getText("share_button", "Compartir")}</span>
      `;
    }
  }

  /* ===================== UTILIDADES ===================== */
  safeGetCameraOrbit() {
    if (!isModelViewerReady(this.elements.viewer)) return null;
    try {
      return this.elements.viewer.getCameraOrbit();
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error obteniendo camera orbit:", error);
      return null;
    }
  }

  setModelViewerInteraction(enabled) {
    if (!isModelViewerReady(this.elements.viewer)) return;
  
    try {
      const capabilities = getDeviceCapabilities();
    
      if (enabled) {
        if (config.DEBUG_MODE) console.log("🔓 Habilitando controles de model-viewer");
        this.elements.viewer.removeAttribute("interaction-prompt-style");
        this.elements.viewer.style.pointerEvents = "auto";
        // CRÍTICO: Solo restaurar camera-controls si no estamos en hold activo
        if (!this.state.isHolding) {
          this.elements.viewer.setAttribute("camera-controls", "");
        }
      } else {
        if (config.DEBUG_MODE) console.log("🔒 Deshabilitando controles de model-viewer temporalmente");
        this.elements.viewer.setAttribute("interaction-prompt-style", "none");
      
        // MEJORADO: En móviles, ser más conservador
        if (capabilities.isMobile) {
          // NO tocar pointer-events en móviles, solo deshabilitar interaction-prompt
          // NO remover camera-controls completamente, solo pausar temporalmente
          if (this.elements.viewer.hasAttribute("camera-controls")) {
            this.elements.viewer.setAttribute("data-camera-controls-backup", "true");
            this.elements.viewer.removeAttribute("camera-controls");
          }
        } else {
          // Desktop: comportamiento original pero más seguro
          this.elements.viewer.removeAttribute("camera-controls");
          this.elements.viewer.style.pointerEvents = "none";
        
          // Restaurar pointer-events rápidamente para evitar problemas
          setTimeout(() => {
            if (this.elements.viewer && this.elements.viewer.style.pointerEvents === "none") {
              this.elements.viewer.style.pointerEvents = "auto";
            }
          }, 50);
        }
      }
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error controlando interacciones de model-viewer:", error);
    }
  }

  /* ===================== EVENT LISTENERS ===================== */
  setupEventListeners() {
    this.elements.skipButton.addEventListener("click", () => this.returnToModel());
    this.elements.shareButton.addEventListener("click", () => this.handleShareCard());

    // Sistema de interacción
    this.elements.viewer.addEventListener("pointerdown", (e) => this.startHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointermove", (e) => this.updateHoldDetection(e), { passive: true });
    this.elements.viewer.addEventListener("pointerup", (e) => this.endHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointercancel", (e) => this.endHoldDetection(e), { passive: false });
    this.elements.viewer.addEventListener("pointerleave", (e) => this.endHoldDetection(e), { passive: false });

    // Prevenir comportamientos no deseados
    this.elements.viewer.addEventListener("dragstart", (e) => e.preventDefault());
    this.elements.viewer.addEventListener("selectstart", (e) => e.preventDefault());

    // Control de video
    this.elements.video.addEventListener("ended", () => this.returnToModel());

    // Snap automático de cámara
    this.elements.viewer.addEventListener(
      "camera-change",
      debounce(() => {
        if (this.state.current !== "model" || this.state.interactionLocked) return;
        this.setAutoRotateState(false);
        snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
        this.setAutoRotateState(true, config.CAMERA_SNAP_TRANSITION);
      }, config.CAMERA_SNAP_DELAY)
    );

    // Cambio de idioma dinámico
    window.addEventListener("languageChanged", (event) => {
      this.lang = event.detail.language;
      this.translations = event.detail.translations;
      this.updateDynamicTexts();
      this.elements.title.textContent = this.getLocalizedTitle();
      this.setShareButtonState("normal");
    });

    // Debug: cambiar idioma con tecla 'L'
    if (config.DEBUG_MODE) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "l" || e.key === "L") {
          const newLang = this.lang === "en" ? "es" : "en";
          switchLanguage(newLang).catch((err) => {
            console.error(err);
          });
        }
      });
    }
  }
}



