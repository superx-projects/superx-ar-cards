/**
 * test.js - Controlador principal para test.html
 * Proyecto: Super X Immersive Cards
 * VERSIÓN CORREGIDA - Problema de drag solucionado
 */

import {
  loadLang,
  applyTranslations,
  detectUserLanguage,
  getTranslation,
  switchLanguage,
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
  getDeviceCapabilities,
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
    displayWarning(
      getTranslation(
        translations,
        "warning_translation_load_failed",
        "No se pudieron cargar las traducciones"
      )
    );
  }

  let cardData = null;
  let errorMsg = null;

  if (!cardId) {
    errorMsg = getTranslation(
      translations,
      "error_invalid_id",
      "ID de carta inválido"
    );
  } else {
    try {
      const response = await fetch(config.CARDS_DATA_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Error cargando cards.json`);
      
      const data = await response.json();
      cardData = data[cardId];
      
      if (!cardData) {
        errorMsg = getTranslation(
          translations,
          "error_card_not_found",
          "Carta no encontrada"
        );
      }
    } catch (err) {
      if (config.DEBUG_MODE) console.error("Error cargando datos de cartas:", err);
      errorMsg = getTranslation(
        translations,
        "error_loading_data",
        `Error cargando datos: ${err.message}`
      );
    }
  }

  if (errorMsg) {
    showViewError();
    const errorElement = document.getElementById("card_error_message");
    if (errorElement) {
      errorElement.textContent = errorMsg;
    }
    return;
  }

  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`,
  };

  try {
    const [modelExists, videoExists] = await Promise.all([
      validateResource(resourcePaths.model, config.RESOURCE_VALIDATION),
      validateResource(resourcePaths.video, config.RESOURCE_VALIDATION),
    ]);

    if (!modelExists || !videoExists) {
      displayError("Recursos de la carta no encontrados");
      showViewError();
      return;
    }

    const app = new CardViewerApp({
      cardId,
      cardData,
      resourcePaths,
      translations,
      lang: selectedLang,
    });

    await app.initialize();
    
    if (config.DEBUG_MODE) {
      window.cardViewerApp = app;
    }

  } catch (error) {
    if (config.DEBUG_MODE) console.error("Error fatal inicializando la aplicación:", error);
    displayError(
      getTranslation(
        translations || {},
        "error_fatal_init",
        "Error fatal de inicialización"
      )
    );
    showViewError();
  }
})();

/* ===================== CLASE PRINCIPAL ===================== */
class CardViewerApp {
  constructor(options) {
    Object.assign(this, options);

    this.elements = {
      viewer: document.getElementById("card_viewer"),
	  blocker: document.getElementById("interaction_blocker"),
      video: document.getElementById("card_video"),
      fade: document.getElementById("card_fade_effect"),
      indicator: document.getElementById("card_hold_indicator"),
      particlesContainer: document.getElementById("card_particles_container"),
      skipButton: document.getElementById("card_skip_button"),
      shareButton: document.getElementById("card_share_button"),
      logo: document.getElementById("card_logo"),
      title: document.getElementById("card_title"),
    };

    const requiredElements = ['viewer', 'video', 'fade', 'indicator'];
    const missingElements = requiredElements.filter(key => !this.elements[key]);
    
    if (missingElements.length > 0) {
      throw new Error(`Elementos DOM requeridos no encontrados: ${missingElements.join(', ')}`);
    }

    this.state = {
      current: "model",
      isHolding: false,
      activePointerId: null,
      interactionLocked: false,
      isAutoRotateEnabled: true,
      isDragging: false,
    };

    this.interaction = {
      touchStartPosition: null,
      dragThreshold: config.DRAG_THRESHOLD,
      lastInteractionTime: 0,
    };

    this.timers = new Map();

    this.progress = {
      startTime: 0,
      totalTime: config.VIDEO_ACTIVATION_DELAY,
    };
  }

  /* ===================== GESTIÓN DE TIMERS ===================== */
  setTimer(name, callback, delay, isInterval = false) {
    this.clearTimer(name);
    const timer = isInterval
      ? setInterval(callback, delay)
      : setTimeout(callback, delay);
    this.timers.set(name, timer);
    return timer;
  }

  clearTimer(name) {
    if (this.timers.has(name)) {
      const timer = this.timers.get(name);
      clearTimeout(timer);
      clearInterval(timer);
      cancelAnimationFrame(timer);
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
      if (config.DEBUG_MODE)
        console.error("Error inicializando aplicación:", error);
      displayError("Error de inicialización");
    }
  }

  setupCardContent() {
    const title = this.getLocalizedTitle();
    
    if (this.elements.title) {
      this.elements.title.textContent = title;
    }
    
    if (this.elements.viewer) {
      this.elements.viewer.setAttribute("src", this.resourcePaths.model);
    }
    
    if (this.elements.video) {
      this.elements.video.src = this.resourcePaths.video;
    }
    
    this.updateDynamicTexts();
  }

  updateDynamicTexts() {
    if (this.elements.skipButton) {
      this.elements.skipButton.textContent = this.getText("video_skip", "Skip");
    }
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
      if (config.DEBUG_MODE)
        console.error("Error cargando video:", this.resourcePaths.video);
      displayWarning(
        this.getText("warning_video_unavailable", "Video no disponible")
      );
    });
  }

  /* ===================== MODEL-VIEWER ===================== */
  async initializeModelViewer() {
    await this.waitForModelViewer();
    this.setupModelViewerEvents();
    this.setupEventListeners();
    this.setModelViewerInteraction(true);
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
    maxAttempts = config.RETRY_CONFIG?.modelViewer?.maxAttempts || 30,
    interval = config.RETRY_CONFIG?.modelViewer?.interval || 200
  ) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkReady = () => {
        attempts++;
        
        if (config.DEBUG_MODE && attempts % 5 === 0) {
          console.log(`Esperando model-viewer... intento ${attempts}/${maxAttempts}`);
        }
        
        try {
          if (isModelViewerReady(this.elements.viewer)) {
            if (config.DEBUG_MODE) {
              console.log(`Model-viewer listo después de ${attempts} intentos`);
            }
            resolve(true);
            return;
          }
        } catch (error) {
          if (config.DEBUG_MODE) {
            console.warn(`Error verificando model-viewer (intento ${attempts}):`, error);
          }
        }
        
        if (attempts >= maxAttempts) {
          const errorMsg = `Model-viewer no se cargó después de ${attempts} intentos`;
          if (config.DEBUG_MODE) {
            console.error(errorMsg);
          }
          reject(new Error(errorMsg));
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
      displayError(
        this.getText(
          "error_model_load_failed",
          "Error al cargar el modelo 3D"
        )
      );
    });
  }

  /* ===================== GESTIÓN DE ESTADOS ===================== */
  showVideo() {
    if (this.state.current !== "model" || this.state.interactionLocked) {
      return;
    }
    if (config.DEBUG_MODE) console.log("🎬 Iniciando transición a video");
    
    this.resetHoldState(); // ✅ Limpieza simplificada

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    this.clearAllTimers();

    this.elements.fade.classList.remove("hidden");
    this.setTimer(
      "videoTransition",
      () => {
        showViewVideo();
        this.elements.logo.classList.add("hidden");
        this.elements.video.classList.add("showing");
        
        const playPromise = this.elements.video.play();
        if (playPromise) {
          playPromise.catch(error => {
            if (config.DEBUG_MODE) console.error("Error reproduciendo video:", error);
            displayWarning(this.getText("warning_video_playback", "Error de reproducción"));
          });
        }
        
        this.elements.fade.classList.add("hidden");
        this.state.current = "video";
        this.state.interactionLocked = false;
        if (config.DEBUG_MODE) console.log("✅ Transición a video completada");
      },
      config.FADE_DURATION
    );
  }

  // ✅ MÉTODO RETURNTOMODEL COMPLETAMENTE REESCRITO Y SIMPLIFICADO
  returnToModel() {
    if (this.state.current !== "video") return;
    if (config.DEBUG_MODE) console.log("🔄 Volviendo al modelo 3D");

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    this.clearAllTimers();
    
    this.elements.fade.classList.remove("hidden");
    
    this.setTimer(
      "modelTransition",
      () => {
        if (config.DEBUG_MODE) console.log("⏱ Ejecutando transición de regreso");
        
        // Limpiar video
        this.elements.video.classList.remove("showing");
        this.elements.video.pause();
        this.elements.video.currentTime = 0;
        
        // Mostrar vista del modelo
        showViewModel();        
        this.elements.logo.classList.remove("hidden");
        
        // Resetear estado completamente
        this.resetHoldState();
        
        // Quitar fade
        this.elements.fade.classList.add("hidden");
        
        // REACTIVAR ESTADO Y CONTROLES EN EL ORDEN CORRECTO
        this.state.current = "model";
        this.state.interactionLocked = false;
        
        // Ocultar el bloqueador para poder interactuar con el modelo
        //this.setModelViewerInteraction(true);
		this.elements.blocker.classList.add("hidden"); // ✅ OCULTAR EL BLOQUEADOR
        if (config.DEBUG_MODE) console.log("🔓 Interacción desbloqueada post-video.");
        
        // Programar auto-rotate y snap
        this.scheduleAutoSnap();
        
        if (config.DEBUG_MODE) console.log("✅ Transición de regreso completada - Controles reactivados");
      },
      config.FADE_DURATION
    );
  }

  setAutoRotateState(enabled, delay = 0) {
    const timerKey = "autoRotate";
    this.clearTimer(timerKey);
    
    if (delay > 0) {
      const timestamp = Date.now();
      this.setTimer(timerKey, () => {
        if (this.state.lastAutoRotateTimestamp && 
            timestamp < this.state.lastAutoRotateTimestamp) {
          if (config.DEBUG_MODE) console.log("Timer de auto-rotate obsoleto ignorado");
          return;
        }
        this.state.isAutoRotateEnabled = enabled;
      }, delay);
      this.state.lastAutoRotateTimestamp = timestamp;
    } else {
      this.state.isAutoRotateEnabled = enabled;
      this.state.lastAutoRotateTimestamp = Date.now();
    }
  }

  /* ===================== SISTEMA DE INTERACCIÓN SIMPLIFICADO ===================== */

  startHoldDetection(event) {
    if (this.state.activePointerId !== null || 
        this.state.current !== 'model' || 
        this.state.interactionLocked) {
      return;
    }

    if (config.DEBUG_MODE) console.log("👇 pointerdown: Iniciando detección.");
    
    this.state.activePointerId = event.pointerId;
    this.state.holdStartTimestamp = Date.now();
    this.interaction.touchStartPosition = getEventPosition(event);
    this.state.isDragging = false;
    this.updateLastInteraction();
    
    this.clearTimer('autoSnap');
    this.setAutoRotateState(false);

    this.setTimer('holdInitiator', () => {
      if (this.state.activePointerId === event.pointerId && 
          !this.state.isDragging &&
          this.state.current === 'model') {
        if (config.DEBUG_MODE) console.log("⏳ Timer 'holdInitiator' disparado. Es un HOLD.");
        this.initiateHold();
      } else {
        if (config.DEBUG_MODE) console.log("⚠️ Hold cancelado: estado cambió durante el timer");
      }
    }, config.HOLD_DURATION);
  }

  updateHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId || this.state.isHolding) {
      return;
    }

    this.updateLastInteraction();

    const currentPosition = getEventPosition(event);
    const dragDistance = calculateDragDistance(this.interaction.touchStartPosition, currentPosition);

    if (dragDistance > this.interaction.dragThreshold) {
      if (config.DEBUG_MODE && !this.state.isDragging) {
        console.log(`↔️ Drag detectado (${dragDistance.toFixed(1)}px). Cancelando timer de hold.`);
      }
      this.state.isDragging = true;
      this.clearTimer('holdInitiator');
    }
  }

  endHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId) return;
    if (config.DEBUG_MODE) console.log("👆 pointerup: Finalizando interacción.");

    this.clearTimer('holdInitiator');

    if (this.state.isHolding) {
      if (config.DEBUG_MODE) console.log("🚫 Hold interrumpido por pointerup.");
      this.cancelHold();
    }
    else if (this.state.isDragging) {
      if (config.DEBUG_MODE) console.log("✅ Drag completado.");
    }
    else {
      if (config.DEBUG_MODE) console.log("🖱️ Clic corto detectado.");
    }

    this.state.activePointerId = null;
    this.state.isDragging = false;
    this.updateLastInteraction();
    
    this.scheduleAutoSnap();
  }

  updateLastInteraction() {
    this.interaction.lastInteractionTime = Date.now();
  }

  scheduleAutoSnap() {
    this.clearTimer('autoSnap');
    
    this.setTimer(
      'autoSnap',
      () => {
        const timeSinceLastInteraction = Date.now() - this.interaction.lastInteractionTime;
        
        if (timeSinceLastInteraction >= config.CAMERA_SNAP_DELAY && 
            this.state.current === 'model' && 
            !this.state.interactionLocked &&
            !this.state.isHolding) {
          
          if (config.DEBUG_MODE) console.log("📐 Snap automático por inactividad");
          
          try {
            snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
            this.setAutoRotateState(true, config.CAMERA_SNAP_TRANSITION);
          } catch (error) {
            if (config.DEBUG_MODE) console.error("Error en snap automático:", error);
            this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
          }
        } else {
          if (config.DEBUG_MODE) console.log("⏭️ Snap cancelado: hubo interacción reciente");
        }
      },
      config.CAMERA_SNAP_DELAY
    );
    
    this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
  }
  
  cancelHold() {
    if (!this.state.isHolding) return;
    if (config.DEBUG_MODE) console.log("🧹 Cancelando HOLD activo.");

    this.resetHoldState();
    //this.setModelViewerInteraction(true);
	this.elements.blocker.classList.add("hidden");
	if (config.DEBUG_MODE) console.log("🔓 Interacción desbloqueada.");
  }

  initiateHold() {
    if (!this.validateHoldConditions()) {
      if (config.DEBUG_MODE) console.warn("⚠️ Condiciones no válidas para iniciar hold. Abortando.");
      return;
    }
    
    if (config.DEBUG_MODE) console.log("🚀 Iniciando efectos de HOLD con snap preventivo.");

    try {
      snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
      if (config.DEBUG_MODE) console.log("📐 Snap preventivo ejecutado para hold");
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error en snap preventivo:", error);
    }

    this.state.isHolding = true;
    this.updateLastInteraction();

    //this.setModelViewerInteraction(false);
    this.elements.blocker.classList.remove("hidden");
	
    this.progress.startTime = Date.now();
    this.elements.viewer.classList.add("hold");
    this.elements.indicator.classList.add("active");
    triggerHapticFeedback(config.DEVICE_CONFIG?.hapticFeedback);
    this.startProgressAnimation();
    this.startParticleEffect(this.interaction.touchStartPosition);
    
    this.setTimer(
      "videoActivation",
      () => {
        if (this.state.isHolding && this.state.current === 'model') {
          this.showVideo();
        }
      },
      config.VIDEO_ACTIVATION_DELAY
    );
  }

  validateHoldConditions() {
    try {
      if (!this.elements.viewer || 
          !isModelViewerReady(this.elements.viewer) || 
          !this.elements.viewer.src) {
        throw new Error("Model-viewer no está listo");
      }

      if (this.state.current !== 'model' || 
          this.state.interactionLocked ||
          this.state.activePointerId === null) {
        throw new Error("Estado de aplicación no válido para hold");
      }

      if (this.state.holdStartTimestamp && 
          (Date.now() - this.state.holdStartTimestamp) > config.HOLD_DURATION * 2) {
        throw new Error("Hold iniciado demasiado tarde");
      }

      return true;
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Validación hold falló:", error);
      return false;
    }
  }

  /* ===================== EFECTOS VISUALES ===================== */
  startProgressAnimation() {
    const animate = () => {
      if (!this.state.isHolding) {
        this.clearTimer("progress");
        return;
      }
      
      const elapsed = Date.now() - this.progress.startTime;
      const progress = Math.min(elapsed / this.progress.totalTime, 1);
      const currentWidth = progress * 90;
      
      if (this.elements.indicator) {
        this.elements.indicator.style.width = `${currentWidth}vw`;
      }
      
      if (progress >= 1) {
        triggerHapticFeedback(config.DEVICE_CONFIG?.hapticFeedback);
        this.clearTimer("progress");
        return;
      }
      
      this.timers.set("progress", requestAnimationFrame(animate));
    };
    
    this.clearTimer("progress");
    this.timers.set("progress", requestAnimationFrame(animate));
  }

  startParticleEffect(position) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      if (config.DEBUG_MODE) {
        console.warn("Posición inválida para partículas:", position);
      }
      return;
    }
    
    this.setTimer(
      "particles",
      () => {
        if (this.state.isHolding && this.elements.particlesContainer) {
          try {
            spawnParticles(
              position.x,
              position.y,
              this.elements.particlesContainer,
              config.PARTICLE_CONFIG
            );
          } catch (error) {
            if (config.DEBUG_MODE) {
              console.warn("Error generando partículas:", error);
            }
          }
        }
      },
      config.PARTICLE_SPAWN_INTERVAL,
      true
    );
  }

  /*  ===================== LIMPIEZA SIMPLIFICADA ===================== */
  resetHoldState() {
    if (config.DEBUG_MODE) console.log("🧹 Reseteando estado de hold");
    
    // Limpiar estado
    this.state.isHolding = false;
    this.state.activePointerId = null;
    this.state.isDragging = false;
    this.state.holdStartTimestamp = null;
    this.updateLastInteraction();
    
    // Limpiar efectos visuales
    if (this.elements.viewer) {
      this.elements.viewer.classList.remove("hold");
    }
    
    if (this.elements.indicator) {
      this.elements.indicator.classList.remove("active");
      this.elements.indicator.style.width = "0";
    }
    
    // Limpiar partículas
    if (this.elements.particlesContainer) {
      const particles = this.elements.particlesContainer.querySelectorAll('.particle');
      particles.forEach(particle => {
        try {
          particle.remove();
        } catch (error) {
          if (config.DEBUG_MODE) console.warn("Error removiendo partícula:", error);
        }
      });
    }
    
    // Limpiar timers específicos de hold
    ['holdInitiator', 'videoActivation', 'progress', 'particles'].forEach(timerName => {
      this.clearTimer(timerName);
    });
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
      displayError(
        this.getText("share_error", "Error al preparar la imagen")
      );
    } finally {
      this.setShareButtonState("normal");
    }
  }

  generateShareText(platform) {
    const cardTitle = this.getLocalizedTitle();
    const storeHandle =
      config.SHARE_CONFIG?.socialHandles?.[platform] ||
      config.SHARE_CONFIG?.socialHandles?.default ||
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
    const filename = `${
      config.SHARE_CONFIG?.filename || "super-x-card"
    }-${this.cardId}.png`;
    const nativeShared = await tryNativeShare(imageBlob, shareText, filename);
    if (nativeShared) return { method: "native", success: true };
    const copied = await copyImageToClipboard(imageBlob);
    if (copied) return { method: "clipboard", success: true };
    downloadImage(
      imageBlob,
      filename,
      config.PERFORMANCE_CONFIG?.cleanup?.urlRevokeDelay
    );
    return { method: "download", success: true };
  }

  handleShareResult(result) {
    if (result.success) {
      const messages = {
        native: this.getText("share_success", "¡Imagen lista para compartir!"),
        clipboard: this.getText(
          "share_fallback",
          "Imagen copiada. Pégala en tus redes sociales"
        ),
        download: this.getText(
          "share_success",
          "¡Imagen lista para compartir!"
        ),
      };
      displaySuccess(messages[result.method]);
    }
  }

  setShareButtonState(state) {
    const button = this.elements.shareButton;
    if (!button) return;
    
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
  setModelViewerInteraction(enabled) {
    if (!this.elements.viewer) {
      if (config.DEBUG_MODE) console.warn("Model-viewer element not found");
      return;
    }
 
    if (!isModelViewerReady(this.elements.viewer)) {
      if (config.DEBUG_MODE) console.warn("Model-viewer not ready, scheduling retry");
      setTimeout(() => this.setModelViewerInteraction(enabled), 100);
      return;
    }
 
    try {
      if (enabled) {
        if (config.DEBUG_MODE) console.log("🔓 Habilitando controles de model-viewer");
        this.elements.viewer.setAttribute("camera-controls", "");
        
        setTimeout(() => {
          try {
          // Verificamos de nuevo por si el elemento ya no es válido
            if (this.elements.viewer && isModelViewerReady(this.elements.viewer)) {
              const currentOrbit = this.elements.viewer.cameraOrbit;
              this.elements.viewer.cameraOrbit = currentOrbit;
              if (config.DEBUG_MODE) console.log("🔄 Forzando actualización de model-viewer.");
            }
          } catch (e) {
            if (config.DEBUG_MODE) console.error("Error al forzar actualización de model-viewer:", e);
          }
        }, 50); // Un pequeño delay de 50ms es suficiente

      } else {
        if (config.DEBUG_MODE) console.log("🔒 Deshabilitando controles de model-viewer");
        this.elements.viewer.removeAttribute("camera-controls");
      }
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error controlando interacciones de model-viewer:", error);
    }
  }
  
  /* ===================== MÉTODO DE CLEANUP ===================== */
  destroy() {
    if (config.DEBUG_MODE) console.log("🧹 Destruyendo CardViewerApp");
    
    this.clearAllTimers();
    this.cleanupAllHoldEffects();
    
    // Limpiar referencias DOM
    Object.keys(this.elements).forEach(key => {
      this.elements[key] = null;
    });
    
    // Limpiar estado
    this.state = null;
    this.interaction = null;
    this.progress = null;
  }

  /* ===================== EVENT LISTENERS ===================== */
  setupEventListeners() {
    // Botones de interfaz
    if (this.elements.skipButton) {
      this.elements.skipButton.addEventListener("click", () =>
        this.returnToModel()
      );
    }
    
    if (this.elements.shareButton) {
      this.elements.shareButton.addEventListener("click", () =>
        this.handleShareCard()
      );
    }

    // Sistema de interacción principal
    this.elements.viewer.addEventListener("pointerdown", (e) =>
      this.startHoldDetection(e)
    );
    this.elements.viewer.addEventListener("pointermove", (e) =>
      this.updateHoldDetection(e)
    );
    this.elements.viewer.addEventListener("pointerup", (e) =>
      this.endHoldDetection(e)
    );
    this.elements.viewer.addEventListener("pointercancel", (e) =>
      this.endHoldDetection(e)
    );
    this.elements.viewer.addEventListener("pointerleave", (e) =>
      this.endHoldDetection(e)
    );

    // Prevenir drag de imágenes
    this.elements.viewer.addEventListener("dragstart", (e) =>
      e.preventDefault()
    );
    
    // Video events
    this.elements.video.addEventListener("ended", () => this.returnToModel());

    // Language switching
    window.addEventListener("languageChanged", (event) => {
      this.lang = event.detail.language;
      this.translations = event.detail.translations;
      this.updateDynamicTexts();
      if (this.elements.title) {
        this.elements.title.textContent = this.getLocalizedTitle();
      }
      this.setShareButtonState("normal");
    });

    // Debug: Language switching con tecla L
    if (config.DEBUG_MODE) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "l" || e.key === "L") {
          const newLang = this.lang === "en" ? "es" : "en";
          switchLanguage(newLang).catch(console.error);
        }
      });
    }
  }
}
