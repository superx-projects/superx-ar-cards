/**
 * test.js - Controlador principal para test.html
 * Proyecto: Super X Immersive Cards
 * VERSIÓN CON SISTEMA DE CARGA SIMPLE
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
  snapToNearestSide,
  validateResource,
  isModelViewerReady,
  getCardShareImage,
  detectPlatform,
  tryNativeShare,
  copyImageToClipboard,
  downloadImage,
  triggerHapticFeedback,
  getEventPosition,
  calculateDragDistance,
  showNotification,
} from "./utils.js";

/* ===================== FUNCIONES DE VISTA ===================== */
function showView(id) {
  ["card_view_error", "card_view_model", "card_view_video", "card_view_loading"].forEach((v) => {
    const element = document.getElementById(v);
    if (element) element.classList.add("hidden");
  });
  const targetView = document.getElementById(id);
  if (targetView) targetView.classList.remove("hidden");
}

/* ===================== FUNCIONES DE NOTIFICACIÓN ===================== */
const displayError = (message) => showNotification(message, config.NOTIFICATION_ERROR_CONFIG);
const displayWarning = (message) => showNotification(message, config.NOTIFICATION_WARNING_CONFIG);
const displaySuccess = (message) => showNotification(message, config.NOTIFICATION_SUCCESS_CONFIG);
const displayInfo = (message) => showNotification(message, config.NOTIFICATION_INFO_CONFIG);

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
    displayWarning(getTranslation(translations, "warning_translation_load_failed", "No se pudieron cargar las traducciones"));
  }

  let cardData = null;
  let errorMsg = null;

  if (!cardId) {
    errorMsg = getTranslation(translations, "error_invalid_id", "ID de carta inválido");
  } else {
    try {
      const response = await fetch(config.CARDS_DATA_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      cardData = data[cardId];
      
      if (!cardData) {
        errorMsg = getTranslation(translations, "error_card_not_found", "Carta no encontrada");
      }
    } catch (err) {
      if (config.DEBUG_MODE) console.error("Error cargando datos:", err);
      errorMsg = getTranslation(translations, "error_loading_data", `Error cargando datos: ${err.message}`);
    }
  }

  if (errorMsg) {
    showView("card_view_error");
    const errorElement = document.getElementById("card_error_message");
    if (errorElement) errorElement.textContent = errorMsg;
    return;
  }

  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`,
  };

  const app = new CardViewerApp({ cardId, cardData, resourcePaths, translations, lang: selectedLang });
  await app.initialize();
  
  if (config.DEBUG_MODE) window.cardViewerApp = app;
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
      // Nuevos elementos de loading
      loadingSpinner: document.getElementById("loading_spinner"),
      loadingMessage: document.getElementById("loading_message"),
      loadingProgress: document.getElementById("loading_progress"),
    };

    const requiredElements = ['viewer', 'blocker', 'video', 'fade', 'indicator'];
    const missingElements = requiredElements.filter(key => !this.elements[key]);
    
    if (missingElements.length > 0) {
      throw new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`);
    }

    this.state = {
      current: "loading",
      isHolding: false,
      activePointerId: null,
      interactionLocked: false,
      isDragging: false,
      modelLoaded: false,
      videoLoaded: false,
    };

    this.interaction = {
      touchStartPosition: null,
      lastInteractionTime: 0,
    };

    this.timers = new Map();
    this.progress = { startTime: 0, totalTime: config.VIDEO_ACTIVATION_DELAY };
  }

  /* ===================== SISTEMA DE CARGA ===================== */
  updateLoadingProgress(message, progress = null) {
    if (this.elements.loadingMessage) {
      this.elements.loadingMessage.textContent = message;
    }
    
    if (this.elements.loadingProgress && progress !== null) {
      this.elements.loadingProgress.style.width = `${progress}%`;
    }
    
    if (config.DEBUG_MODE) {
      console.log(`🔄 Carga: ${message} ${progress !== null ? `(${progress}%)` : ''}`);
    }
  }

  async loadResources() {
    try {
      // Mostrar pantalla de carga
      showView("card_view_loading");
      this.updateLoadingProgress(this.getText("loading_validating", "Validando recursos..."), 10);

      // Validar recursos
      const [modelExists, videoExists] = await Promise.all([
        validateResource(this.resourcePaths.model, config.RESOURCE_VALIDATION),
        validateResource(this.resourcePaths.video, config.RESOURCE_VALIDATION),
      ]);

      if (!modelExists || !videoExists) {
        throw new Error("Recursos no encontrados");
      }

      this.updateLoadingProgress(this.getText("loading_model", "Cargando modelo 3D..."), 30);

      // Ahora sí cargar el modelo (model-viewer ya está listo)
      await this.preloadModel();
      this.state.modelLoaded = true;
      
      this.updateLoadingProgress(this.getText("loading_video", "Preparando video..."), 70);

      // Precargar video
      await this.preloadVideo();
      this.state.videoLoaded = true;
      
      this.updateLoadingProgress(this.getText("loading_complete", "¡Listo!"), 100);

      // Pequeña pausa para mostrar "¡Listo!"
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mostrar vista del modelo
      showView("card_view_model");
      this.state.current = "model";
      
      if (config.DEBUG_MODE) console.log("✅ Todos los recursos cargados");

    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error cargando recursos:", error);
      displayError("Error cargando recursos de la carta");
      showView("card_view_error");
    }
  }

  async preloadModel() {
    return new Promise((resolve, reject) => {
      const viewer = this.elements.viewer;
      const targetSrc = this.resourcePaths.model;
      
      if (config.DEBUG_MODE) console.log(`🎯 Cargando modelo: ${targetSrc}`);
      
      let resolved = false;
      let timeoutId;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        viewer.removeEventListener("load", onLoad);
        viewer.removeEventListener("error", onError);
      };
      
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (config.DEBUG_MODE) console.log("✅ Modelo cargado exitosamente");
          resolve();
        }
      };
      
      const rejectOnce = (error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (config.DEBUG_MODE) console.error("❌ Error cargando modelo:", error);
          reject(error);
        }
      };
      
      const onLoad = () => {
        if (config.DEBUG_MODE) console.log("🎯 Modelo cargado completamente");
        resolveOnce();
      };
      
      const onError = (event) => {
        rejectOnce(new Error(`Error cargando modelo: ${event.message || event.type || 'Error desconocido'}`));
      };
      
      // Configurar listeners
      viewer.addEventListener("load", onLoad, { once: true });
      viewer.addEventListener("error", onError, { once: true });
      
      // Configurar timeout más largo para modelos grandes
      timeoutId = setTimeout(() => {
        rejectOnce(new Error("Timeout: El modelo tardó demasiado en cargar"));
      }, 45000); // 45 segundos
      
      // Configurar el src - el model-viewer ya está listo
      if (config.DEBUG_MODE) console.log("🔄 Estableciendo src del modelo");
      viewer.src = targetSrc;
    });
  }

  async preloadVideo() {
    return new Promise((resolve, reject) => {
      const video = this.elements.video;
      
      const onCanPlay = () => {
        video.removeEventListener("canplaythrough", onCanPlay);
        video.removeEventListener("error", onError);
        resolve();
      };
      
      const onError = (error) => {
        video.removeEventListener("canplaythrough", onCanPlay);
        video.removeEventListener("error", onError);
        reject(error);
      };
      
      video.addEventListener("canplaythrough", onCanPlay, { once: true });
      video.addEventListener("error", onError, { once: true });
      
      // Configurar y cargar video
      video.src = this.resourcePaths.video;
      video.preload = "auto";
      video.load();
      
      // Timeout de seguridad
      setTimeout(() => {
        video.removeEventListener("canplaythrough", onCanPlay);
        video.removeEventListener("error", onError);
        resolve(); // Permitir continuar incluso si el video no carga completamente
      }, 20000); // 20 segundos
    });
  }

  /* ===================== GESTIÓN DE TIMERS ===================== */
  setTimer(name, callback, delay, isInterval = false) {
    this.clearTimer(name);
    const timer = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);
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
    this.setupEventListeners();
    
    // PRIMERO inicializar model-viewer completamente
    await this.initializeModelViewer();
    
    // DESPUÉS cargar recursos
    await this.loadResources();
  }

  setupCardContent() {
    const title = this.getLocalizedTitle();
    
    if (this.elements.title) this.elements.title.textContent = title;
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
    return (title && (title[this.lang] || title[config.DEFAULT_LANG])) || 
           this.getText("card_title_fallback", "Unknown Card");
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
    const viewer = this.elements.viewer;
    
    if (config.DEBUG_MODE) console.log("🔧 Inicializando model-viewer...");
    
    try {
      // Esperar que model-viewer esté definido
      await this.waitForModelViewerDefinition();
      
      // Esperar que esté completamente inicializado
      if (viewer.updateComplete) {
        await viewer.updateComplete;
        if (config.DEBUG_MODE) console.log("✅ Model-viewer updateComplete resuelto");
      }
      
      // Verificación final
      await this.waitForModelViewer();
      
      // Configurar event listeners
      this.setupModelViewerEvents();
      
      if (config.DEBUG_MODE) console.log("✅ Model-viewer completamente inicializado");
      
    } catch (error) {
      if (config.DEBUG_MODE) console.error("❌ Error inicializando model-viewer:", error);
      throw error;
    }
  }

  waitForModelViewerDefinition(maxWait = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkDefined = () => {
        if (Date.now() - startTime > maxWait) {
          reject(new Error("Model-viewer no se definió en el tiempo esperado"));
          return;
        }
        
        if (customElements.get('model-viewer')) {
          if (config.DEBUG_MODE) console.log("✅ Model-viewer está definido");
          resolve();
        } else {
          if (config.DEBUG_MODE && Date.now() - startTime > 2000) {
            console.log("⏳ Esperando definición de model-viewer...");
          }
          setTimeout(checkDefined, 100);
        }
      };
      
      checkDefined();
    });
  }

  waitForModelViewer(maxAttempts = 50, interval = 200) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkReady = () => {
        attempts++;
        
        try {
          // Verificaciones más exhaustivas
          const viewer = this.elements.viewer;
          
          // Verificar que el elemento existe
          if (!viewer) {
            throw new Error("Elemento model-viewer no encontrado");
          }
          
          // Verificar que model-viewer está definido
          if (typeof viewer.updateComplete === 'undefined') {
            if (config.DEBUG_MODE && attempts === 1) {
              console.log("⏳ Esperando que model-viewer se defina...");
            }
            throw new Error("Model-viewer no está definido aún");
          }
          
          // Verificar que está listo usando múltiples métodos
          const isReady = isModelViewerReady(viewer);
          
          if (isReady) {
            if (config.DEBUG_MODE) console.log(`✅ Model-viewer completamente listo después de ${attempts} intentos`);
            resolve(true);
            return;
          } else {
            if (config.DEBUG_MODE && attempts % 10 === 0) {
              console.log(`⏳ Esperando model-viewer... intento ${attempts}`);
            }
            throw new Error("Model-viewer no está listo");
          }
          
        } catch (error) {
          if (attempts >= maxAttempts) {
            if (config.DEBUG_MODE) console.error(`❌ Model-viewer no se cargó después de ${attempts} intentos:`, error.message);
            reject(new Error(`Model-viewer no se cargó después de ${attempts} intentos: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, interval);
        }
      };
      
      // Empezar la verificación
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

  /* ===================== GESTIÓN DE ESTADOS ===================== */
  showVideo() {
    if (this.state.current !== "model" || this.state.interactionLocked) return;
    if (config.DEBUG_MODE) console.log("🎬 Iniciando transición a video");
    
    this.resetHoldState();
    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    this.clearAllTimers();

    this.elements.fade.classList.remove("hidden");
    
    this.setTimer("videoTransition", () => {
      showView("card_view_video");
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
    }, config.FADE_DURATION);
  }

  returnToModel() {
    if (this.state.current !== "video") return;
    if (config.DEBUG_MODE) console.log("🔄 Volviendo al modelo 3D");

    this.state.current = "transitioning";
    this.state.interactionLocked = true;
    this.clearAllTimers();
    
    this.elements.fade.classList.remove("hidden");
    
    this.setTimer("modelTransition", () => {
      // Limpiar video
      this.elements.video.classList.remove("showing");
      this.elements.video.pause();
      this.elements.video.currentTime = 0;
      
      // Mostrar vista del modelo
      showView("card_view_model");
      this.elements.logo.classList.remove("hidden");
      
      // Resetear estado
      this.resetHoldState();
      this.elements.fade.classList.add("hidden");
      
      // Reactivar estado
      this.state.current = "model";
      this.state.interactionLocked = false;
      
      // Programar auto-snap
      this.scheduleAutoSnap();
    }, config.FADE_DURATION);
  }

  /* ===================== SISTEMA DE INTERACCIÓN ===================== */
  startHoldDetection(event) {
    if (this.state.activePointerId !== null || 
        this.state.current !== 'model' || 
        this.state.interactionLocked) {
      return;
    }

    if (config.DEBUG_MODE) console.log("👇 Iniciando detección de hold");
    
    this.state.activePointerId = event.pointerId;
    this.interaction.touchStartPosition = getEventPosition(event);
    this.state.isDragging = false;
    this.updateLastInteraction();
    
    this.clearTimer('autoSnap');

    this.setTimer('holdInitiator', () => {
      if (this.state.activePointerId === event.pointerId && 
          !this.state.isDragging &&
          this.state.current === 'model') {
        this.initiateHold();
      }
    }, config.HOLD_DURATION);
  }

  updateHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId || this.state.isHolding) return;

    this.updateLastInteraction();
    const currentPosition = getEventPosition(event);
    const dragDistance = calculateDragDistance(this.interaction.touchStartPosition, currentPosition);

    if (dragDistance > config.DRAG_THRESHOLD) {
      if (!this.state.isDragging && config.DEBUG_MODE) {
        console.log(`↔️ Drag detectado (${dragDistance.toFixed(1)}px)`);
      }
      this.state.isDragging = true;
      this.clearTimer('holdInitiator');
    }
  }

  endHoldDetection(event) {
    if (event.pointerId !== this.state.activePointerId) return;
    if (config.DEBUG_MODE) console.log("👆 Finalizando interacción");

    this.clearTimer('holdInitiator');

    if (this.state.isHolding) {
      this.cancelHold();
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
    
    this.setTimer('autoSnap', () => {
      const timeSinceLastInteraction = Date.now() - this.interaction.lastInteractionTime;
      
      if (timeSinceLastInteraction >= config.CAMERA_SNAP_DELAY && 
          this.state.current === 'model' && 
          !this.state.interactionLocked &&
          !this.state.isHolding) {
        
        if (config.DEBUG_MODE) console.log("📐 Snap automático");
        
        try {
          snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
        } catch (error) {
          if (config.DEBUG_MODE) console.error("Error en snap automático:", error);
        }
      }
    }, config.CAMERA_SNAP_DELAY);
  }
  
  cancelHold() {
    if (!this.state.isHolding) return;
    if (config.DEBUG_MODE) console.log("🧹 Cancelando HOLD");
    this.resetHoldState();
  }

  initiateHold() {
    if (!this.validateHoldConditions()) return;
    
    if (config.DEBUG_MODE) console.log("🚀 Iniciando HOLD");

    // Snap preventivo
    try {
      snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG);
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error en snap preventivo:", error);
    }

    this.state.isHolding = true;
    this.updateLastInteraction();

    // Bloquear interacción con model-viewer
    this.elements.blocker.classList.remove("hidden");
    
    // Iniciar efectos visuales
    this.progress.startTime = Date.now();
    this.elements.viewer.classList.add("hold");
    this.elements.indicator.classList.add("active");
    triggerHapticFeedback(config.DEVICE_CONFIG?.hapticFeedback);
    
    this.startProgressAnimation();
    this.startParticleEffect(this.interaction.touchStartPosition);
    
    this.setTimer("videoActivation", () => {
      if (this.state.isHolding && this.state.current === 'model') {
        this.showVideo();
      }
    }, config.VIDEO_ACTIVATION_DELAY);
  }

  validateHoldConditions() {
    return this.elements.viewer && 
           isModelViewerReady(this.elements.viewer) && 
           this.elements.viewer.src &&
           this.state.current === 'model' && 
           !this.state.interactionLocked &&
           this.state.activePointerId !== null;
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
      if (config.DEBUG_MODE) console.warn("Posición inválida para partículas:", position);
      return;
    }
    
    this.setTimer("particles", () => {
      if (this.state.isHolding && this.elements.particlesContainer) {
        try {
          spawnParticles(position.x, position.y, this.elements.particlesContainer, config.PARTICLE_CONFIG);
        } catch (error) {
          if (config.DEBUG_MODE) console.warn("Error generando partículas:", error);
        }
      }
    }, config.PARTICLE_SPAWN_INTERVAL, true);
  }

  /* ===================== LIMPIEZA ===================== */
  resetHoldState() {
    if (config.DEBUG_MODE) console.log("🧹 Reseteando estado de hold");
    
    // Limpiar estado
    this.state.isHolding = false;
    this.state.activePointerId = null;
    this.state.isDragging = false;
    this.updateLastInteraction();
    
    // Desbloquear interacción
    this.elements.blocker.classList.add("hidden");
    
    // Limpiar efectos visuales
    this.elements.viewer.classList.remove("hold");
    this.elements.indicator.classList.remove("active");
    this.elements.indicator.style.width = "0";
    
    // Limpiar partículas
    const particles = this.elements.particlesContainer.querySelectorAll('.particle');
    particles.forEach(particle => particle.remove());
    
    // Limpiar timers específicos
    ['holdInitiator', 'videoActivation', 'progress', 'particles'].forEach(name => {
      this.clearTimer(name);
    });
  }

  /* ===================== COMPARTIR ===================== */
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
      const result = await this.attemptShare(imageBlob, shareText);
      this.handleShareResult(result);
      
    } catch (error) {
      if (config.DEBUG_MODE) console.error("Error al compartir:", error);
      displayError(this.getText("share_error", "Error al preparar la imagen"));
    } finally {
      this.setShareButtonState("normal");
    }
  }

  generateShareText(platform) {
    const cardTitle = this.getLocalizedTitle();
    const storeHandle = config.SHARE_CONFIG?.socialHandles?.[platform] || 
                       config.SHARE_CONFIG?.socialHandles?.default || 
                       "@superx_coleccionables";

    let shareText = this.getText(`share_${platform}_text`);
    if (shareText === `share_${platform}_text`) {
      shareText = this.getText("share_text", 
        `¡Mira esta increíble carta 3D: "${cardTitle}"! 🎮✨\n¡Consigue la tuya en ${storeHandle}!`);
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
    
    downloadImage(imageBlob, filename, config.PERFORMANCE_CONFIG?.cleanup?.urlRevokeDelay);
    return { method: "download", success: true };
  }

  handleShareResult(result) {
    if (result.success) {
      const messages = {
        native: this.getText("share_success", "¡Imagen lista para compartir!"),
        clipboard: this.getText("share_fallback", "Imagen copiada. Pégala en tus redes sociales"),
        download: this.getText("share_success", "¡Imagen lista para compartir!"),
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

  /* ===================== EVENT LISTENERS ===================== */
  setupEventListeners() {
    // Botones de interfaz
    this.elements.skipButton?.addEventListener("click", () => this.returnToModel());
    this.elements.shareButton?.addEventListener("click", () => this.handleShareCard());

    // Sistema de interacción principal
    this.elements.viewer.addEventListener("pointerdown", (e) => this.startHoldDetection(e));
    this.elements.viewer.addEventListener("pointermove", (e) => this.updateHoldDetection(e));
    this.elements.viewer.addEventListener("pointerup", (e) => this.endHoldDetection(e));
    this.elements.viewer.addEventListener("pointercancel", (e) => this.endHoldDetection(e));
    this.elements.viewer.addEventListener("pointerleave", (e) => this.endHoldDetection(e));
    this.elements.viewer.addEventListener("dragstart", (e) => e.preventDefault());
    
    // Video events
    this.elements.video.addEventListener("ended", () => this.returnToModel());

    // Language switching
    window.addEventListener("languageChanged", (event) => {
      this.lang = event.detail.language;
      this.translations = event.detail.translations;
      this.updateDynamicTexts();
      if (this.elements.title) this.elements.title.textContent = this.getLocalizedTitle();
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

  /* ===================== CLEANUP ===================== */
  destroy() {
    if (config.DEBUG_MODE) console.log("🧹 Destruyendo CardViewerApp");
    
    this.clearAllTimers();
    this.resetHoldState();
    
    Object.keys(this.elements).forEach(key => {
      this.elements[key] = null;
    });
    
    this.state = null;
    this.interaction = null;
    this.progress = null;
  }
}
