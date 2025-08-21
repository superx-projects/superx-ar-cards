/**
 * test.js - Controlador principal para test.html
 * Proyecto: Super X Immersive Cards
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
      if (!response.ok) throw new Error("Error cargando cards.json");
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
      if (config.DEBUG_MODE)
        console.error("Error cargando datos de cartas:", err);
      errorMsg = getTranslation(
        translations,
        "error_loading_data",
        "Error cargando datos"
      );
    }
  }

  if (errorMsg) {
    showViewError();
    return;
  }

  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`,
  };

  const [modelExists, videoExists] = await Promise.all([
    validateResource(resourcePaths.model, config.RESOURCE_VALIDATION),
    validateResource(resourcePaths.video, config.RESOURCE_VALIDATION),
  ]);

  if (!modelExists || !videoExists) {
    displayError("Recursos de la carta no encontrados");
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
})();

/* ===================== CLASE PRINCIPAL (CON BUG DE HOLD CORREGIDO) ===================== */
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
      title: document.getElementById("card_title"),
    };

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
    };

    this.timers = new Map();

    this.progress = {
      startTime: 0,
      totalTime: config.VIDEO_ACTIVATION_DELAY, // El tiempo de progreso es solo el delay de activación
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
      clearTimeout(this.timers.get(name));
      clearInterval(this.timers.get(name));
      this.timers.delete(name);
    }
  }

  clearAllTimers() {
    this.timers.forEach((timer, name) => this.clearTimer(name));
  }

  clearAllTimersExcept(exceptName) {
    this.timers.forEach((timer, name) => {
      if (name !== exceptName) {
        this.clearTimer(name);
      }
    });
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
      displayError(
        this.getText(
          "error_model_load_failed",
          "Error al cargar el modelo 3D"
        )
      );
    });
  }

  disablePanMovement() {
    if (!isModelViewerReady(this.elements.viewer)) {
      if (config.DEBUG_MODE) console.warn("Model-viewer no está listo");
      return;
    }
    try {
      this.elements.viewer.disablePan = true;
      this.elements.viewer.addEventListener("contextmenu", (e) =>
        e.preventDefault()
      );
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error deshabilitando pan:", error);
    }
  }

  /* ===================== GESTIÓN DE ESTADOS ===================== */
  showVideo() {
    if (this.state.current !== "model" || this.state.interactionLocked) {
      return;
    }
    if (config.DEBUG_MODE) console.log("🎬 Iniciando transición a video");
    
    // Limpiamos el estado de la interacción que nos trajo aquí.
    this.state.isHolding = false;
    this.state.activePointerId = null;
    this.state.isDragging = false;

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    
    this.clearAllTimersExcept("videoTransition");

    this.elements.fade.classList.add("active");

    this.setTimer(
      "videoTransition",
      () => {
        showViewVideo();
        this.elements.logo.classList.add("hidden");
        this.elements.video.classList.add("showing");
        this.elements.video.play();
        this.elements.fade.classList.remove("active");
        this.state.current = "video";
        this.state.interactionLocked = false;
        if (config.DEBUG_MODE) console.log("✅ Transición a video completada");
      },
      config.FADE_DURATION
    );
  }

  returnToModel() {
    if (this.state.current !== "video") return;
    if (config.DEBUG_MODE) console.log("🔄 Volviendo al modelo 3D");

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    
    this.clearAllTimersExcept("modelTransition");
    this.elements.fade.classList.add("active");

    this.setTimer(
      "modelTransition",
      () => {
        if (config.DEBUG_MODE) console.log("⏱ Ejecutando transición de regreso");
        
        this.elements.video.classList.remove("showing");
        this.elements.video.pause();
        this.elements.video.currentTime = 0;
        
        showViewModel();        
        this.elements.logo.classList.remove("hidden");
        
        this.elements.fade.classList.remove("active");
        this.state.current = "model";
        this.state.interactionLocked = false;

        this.setModelViewerInteraction(true);
        this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
        if (config.DEBUG_MODE) console.log("✅ Transición de regreso completada");
      },
      config.FADE_DURATION
    );
  }

  setAutoRotateState(enabled, delay = 0) {
    this.clearTimer("autoRotate");
    if (delay > 0) {
      this.setTimer(
        "autoRotate",
        () => {
          this.state.isAutoRotateEnabled = enabled;
        },
        delay
      );
    } else {
      this.state.isAutoRotateEnabled = enabled;
    }
  }

  /* ===================== SISTEMA DE INTERACCIÓN (LÓGICA FINAL) ===================== */

  startHoldDetection(event) {
    if (this.state.activePointerId !== null || this.state.current !== 'model' || this.state.interactionLocked) return;

    if (config.DEBUG_MODE) console.log("👇 pointerdown: Iniciando detección.");
    this.state.activePointerId = event.pointerId;
    this.interaction.touchStartPosition = getEventPosition(event);
    this.state.isDragging = false;
    this.setAutoRotateState(false);

    this.setTimer('holdInitiator', () => {
        if (config.DEBUG_MODE) console.log("⏳ Timer 'holdInitiator' disparado. Es un HOLD.");
        this.initiateHold();
    }, config.HOLD_DURATION);
  }

  updateHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId || this.state.isHolding) return;

    const currentPosition = getEventPosition(event);
    const dragDistance = calculateDragDistance(this.interaction.touchStartPosition, currentPosition);

    if (dragDistance > this.interaction.dragThreshold) {
        if (config.DEBUG_MODE && !this.state.isDragging) console.log("↔️ Drag detectado. Cancelando timer de hold.");
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
        this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }
    else if (this.state.isDragging) {
        if (config.DEBUG_MODE) console.log("🔄 Ejecutando snap post-drag.");
        this.setTimer(
            "snapToSide",
            () => {
                snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
                this.setAutoRotateState(true, config.CAMERA_SNAP_TRANSITION);
            },
            config.CAMERA_SNAP_DELAY
        );
    }
    else {
        if (config.DEBUG_MODE) console.log("🖱️ Clic corto detectado.");
        this.setAutoRotateState(true, config.VIDEO_ACTIVATION_DELAY);
    }

    this.state.activePointerId = null;
    this.state.isDragging = false;
  }
  
  cancelHold() {
    if (!this.state.isHolding) return;
    if (config.DEBUG_MODE) console.log("🧹 Cancelando y limpiando estado de HOLD activo.");

    this.state.isHolding = false;
    
    this.clearTimer('videoActivation');
    this.clearTimer('progress');
    this.clearTimer('particles');

    this.elements.indicator.classList.remove("active");
    this.elements.indicator.style.width = "0";
    this.elements.viewer.classList.remove("hold");

    this.setModelViewerInteraction(true);
  }

  initiateHold() {
    if (!this.validateModelViewerState() || this.state.activePointerId === null) {
      if (config.DEBUG_MODE) console.warn("⚠️ Condiciones no válidas para iniciar hold. Abortando.");
      return;
    }
    
    if (config.DEBUG_MODE) console.log("🚀 Iniciando efectos de HOLD.");
    this.state.isHolding = true;

    this.setModelViewerInteraction(false); 
    
    this.progress.startTime = Date.now();
    this.elements.viewer.classList.add("hold");
    this.elements.indicator.classList.add("active");
    triggerHapticFeedback(config.DEVICE_CONFIG.hapticFeedback);
    this.startProgressAnimation();
    this.startParticleEffect(this.interaction.touchStartPosition);
    
    this.setTimer(
      "videoActivation",
      this.showVideo.bind(this),
      config.VIDEO_ACTIVATION_DELAY
    );
  }

  validateModelViewerState() {
    try {
      if (
        !this.elements.viewer ||
        !isModelViewerReady(this.elements.viewer) ||
        !this.elements.viewer.src
      ) {
        throw new Error(
          "Model-viewer no está listo o no tiene un modelo cargado."
        );
      }
      return true;
    } catch (error) {
      if (config.DEBUG_MODE)
        console.error("Validación model-viewer falló:", error);
      return false;
    }
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
          spawnParticles(
            position.x,
            position.y,
            this.elements.particlesContainer,
            config.PARTICLE_CONFIG
          );
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
      config.PERFORMANCE_CONFIG.cleanup.urlRevokeDelay
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
    if (!isModelViewerReady(this.elements.viewer)) return;
    try {
      if (enabled) {
        if (config.DEBUG_MODE)
          console.log("🔓 Habilitando controles de model-viewer");
        this.elements.viewer.setAttribute("camera-controls", "");
      } else {
        if (config.DEBUG_MODE)
          console.log("🔒 Deshabilitando controles de model-viewer");
        this.elements.viewer.removeAttribute("camera-controls");
      }
    } catch (error) {
      if (config.DEBUG_MODE)
        console.error(
          "Error controlando interacciones de model-viewer:",
          error
        );
    }
  }

  /* ===================== EVENT LISTENERS ===================== */
  setupEventListeners() {
    this.elements.skipButton.addEventListener("click", () =>
      this.returnToModel()
    );
    this.elements.shareButton.addEventListener("click", () =>
      this.handleShareCard()
    );

    // Sistema de interacción
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

    this.elements.viewer.addEventListener("dragstart", (e) =>
      e.preventDefault()
    );
    this.elements.video.addEventListener("ended", () => this.returnToModel());

    window.addEventListener("languageChanged", (event) => {
      this.lang = event.detail.language;
      this.translations = event.detail.translations;
      this.updateDynamicTexts();
      this.elements.title.textContent = this.getLocalizedTitle();
      this.setShareButtonState("normal");
    });

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


