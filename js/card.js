/**
 * card.js - Controlador principal para card.html
 * Proyecto: Super X Immersive Cards
 * VERSIÓN REFACTORIZADA - Con gestión de vistas optimizada
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

/* ===================== GESTIÓN DE VISTAS (REFACTORIZADO) ===================== */

// Guardamos una referencia a las vistas para no tener que buscarlas en el DOM cada vez.
const views = {
    error: document.getElementById('card_view_error'),
    loading: document.getElementById('card_view_loading'),
    model: document.getElementById('card_view_model'),
    video: document.getElementById('card_view_video')
};

/**
 * Cambia a la vista especificada.
 * Este es el nuevo enfoque: declarativo, simple y que aprovecha las transiciones CSS.
 * @param {('error'|'loading'|'model'|'video')} viewName - El nombre corto de la vista a mostrar.
 */
function switchView(viewName) {
    // 1. Quita la clase 'active' de todas las vistas.
    Object.values(views).forEach(view => view.classList.remove('active'));

    // 2. Añade la clase 'active' solo a la vista deseada.
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}


/* ===================== FUNCIONES DE NOTIFICACIÓN ===================== */
const displayError = (message) => showNotification(message, config.NOTIFICATION_ERROR_CONFIG);
const displayWarning = (message) => showNotification(message, config.NOTIFICATION_WARNING_CONFIG);
const displaySuccess = (message) => showNotification(message, config.NOTIFICATION_SUCCESS_CONFIG);
const displayInfo = (message) => showNotification(message, config.NOTIFICATION_INFO_CONFIG);

/* ===================== INICIALIZACIÓN PRINCIPAL ===================== */
(async function initializeCardViewer() {
  // --- Parte 1: Validación y carga (sin cambios, excepto las llamadas a switchView) ---
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
    errorMsg = getTranslation(translations, "card_error_message", "Debes escanear la carta 3D para acceder a su experiencia interactiva.");
  } else {
    try {
      const response = await fetch(config.CARDS_DATA_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      cardData = data[cardId];
      if (!cardData) {
        errorMsg = getTranslation(translations, "card_error_message", "Debes escanear la carta 3D para acceder a su experiencia interactiva.");
      }
    } catch (err) {
      if (config.DEBUG_MODE) console.error("Error cargando datos:", err);
      errorMsg = getTranslation(translations, "error_loading_data", `Error cargando datos: ${err.message}`);
    }
  }

  if (errorMsg) {
    // AHORA: Usamos el nuevo sistema
    switchView("error");
    const errorElement = document.getElementById("card_error_message");
    if (errorElement) errorElement.textContent = errorMsg;
    return;
  }

  // --- Parte 2: Lógica de carga ---
  // AHORA: Usamos el nuevo sistema
  switchView("loading");
  
  const loadingMessage = document.getElementById("loading_message");
  const loadingProgress = document.getElementById("loading_progress");
  const resourcePaths = {
    model: `${config.MODEL_PATH}${cardData.model}`,
    video: `${config.VIDEO_PATH}${cardData.video}`,
    share: `${config.IMAGE_PATH}${cardData.share}`,
  };

  try {
    if(loadingMessage) loadingMessage.textContent = getTranslation(translations, "loading_validating", "Verificando recursos...");
    if(loadingProgress) loadingProgress.style.width = "25%";

    const [modelExists, videoExists] = await Promise.all([
      validateResource(resourcePaths.model, config.RESOURCE_VALIDATION),
      validateResource(resourcePaths.video, config.RESOURCE_VALIDATION),
    ]);

    if (!modelExists || !videoExists) {
      throw new Error("Recursos críticos de la carta (modelo/video) no encontrados.");
    }

    if(loadingMessage) loadingMessage.textContent = getTranslation(translations, "loading_model", "Cargando modelo 3D...");
    if(loadingProgress) loadingProgress.style.width = "60%";

    const app = new CardViewerApp({ cardId, cardData, resourcePaths, translations, lang: selectedLang });
    await app.initialize();

    if(loadingProgress) loadingProgress.style.width = "100%";

    setTimeout(() => {
      // app.initialize() ahora se encarga de llamar a switchView("model")
    }, 800);

    if (config.DEBUG_MODE) window.cardViewerApp = app;

  } catch (error) {
    if (config.DEBUG_MODE) console.error("Error durante la carga de recursos o inicialización:", error);
    const friendlyError = getTranslation(translations, "error_resource_load_failed", "No se pudo cargar la carta. Inténtalo de nuevo más tarde.");
    const errorElement = document.getElementById("card_error_message");
    if (errorElement) errorElement.textContent = friendlyError;
    
    // AHORA: Usamos el nuevo sistema
    switchView("error");
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
            // El elemento fade ya no es necesario para las transiciones de vista
            // fade: document.getElementById("card_fade_effect"), 
            indicator: document.getElementById("card_hold_indicator"),
            particlesContainer: document.getElementById("card_particles_container"),
            skipButton: document.getElementById("card_skip_button"),
            shareButton: document.getElementById("card_share_button"),
            logo: document.getElementById("card_logo"),
            title: document.getElementById("card_title"),
        };
        // ... El resto del constructor sigue igual ...
        const requiredElements = ['viewer', 'blocker', 'video', 'indicator'];
        const missingElements = requiredElements.filter(key => !this.elements[key]);
        if (missingElements.length > 0) {
            throw new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`);
        }
        this.state = { current: "model", isHolding: false, activePointerId: null, interactionLocked: false, isDragging: false };
        this.interaction = { touchStartPosition: null, lastInteractionTime: 0 };
        this.timers = new Map();
        this.progress = { startTime: 0, totalTime: config.VIDEO_ACTIVATION_DELAY };
    }
    
    /* ===================== GESTIÓN DE TIMERS (sin cambios) ===================== */
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
        await this.initializeModelViewer();
        this.setupEventListeners();
        switchView("model");
    }
  
    setupCardContent() { 
      const title = this.getLocalizedTitle(); 
      if (this.elements.title) this.elements.title.textContent = title; 
      if (this.elements.viewer) this.elements.viewer.setAttribute("src", this.resourcePaths.model); 
      if (this.elements.video) this.elements.video.src = this.resourcePaths.video; 
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
      return (title && (title[this.lang] || title[config.DEFAULT_LANG])) || this.getText("card_title_fallback", "Unknown Card"); 
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

    /* ===================== MODEL-VIEWER (sin cambios) ===================== */
    async initializeModelViewer() { 
      await this.waitForModelViewer(); 
      this.setupModelViewerEvents(); 
    }
  
    waitForModelViewer(maxAttempts = 30, interval = 200) { 
      return new Promise((resolve, reject) => { 
        let attempts = 0; 
        const checkReady = () => { 
          attempts++; 
          try { if (isModelViewerReady(this.elements.viewer)) { 
            if (config.DEBUG_MODE) console.log(`Model-viewer listo después de ${attempts} intentos`); 
            resolve(true); 
            return; 
          } } 
          catch (error) { 
            if (config.DEBUG_MODE) console.warn(`Error verificando model-viewer:`, error); 
          } 
          if (attempts >= maxAttempts) { 
            reject(new Error(`Model-viewer no se cargó después de ${attempts} intentos`)); 
            return; 
          } setTimeout(checkReady, interval); }; checkReady(); }); 
    }
  
    setupModelViewerEvents() { 
      his.elements.viewer.addEventListener("load", () => { 
        if (config.DEBUG_MODE) console.log("Modelo 3D cargado exitosamente");
      }); 
      this.elements.viewer.addEventListener("error", (event) => { 
        if (config.DEBUG_MODE) console.error("Error en model-viewer:", event); 
        displayError(this.getText("error_model_load_failed", "Error al cargar el modelo 3D")); 
      }); 
    }

    /* ===================== GESTIÓN DE ESTADOS (REFACTORIZADO) ===================== */
    
    /**
     * Transición a la vista de video.
     * La lógica se simplifica enormemente. Ya no se necesita el #card_fade_effect.
     */
    showVideo() {
        if (this.state.current !== "model" || this.state.interactionLocked) return;
        if (config.DEBUG_MODE) console.log("🎬 Iniciando transición a video");
        
        this.resetHoldState();
        this.state.current = "transitioning";
        this.state.interactionLocked = true;
        this.clearAllTimers();

        // 1. Simplemente cambiamos a la vista de video. El CSS se encarga del fade.
        switchView("video");
        this.elements.logo.classList.add("hidden");

        // 2. Esperamos a que la transición termine para empezar a reproducir.
        this.setTimer("videoPlayback", () => {
            const playPromise = this.elements.video.play();
            if (playPromise) {
                playPromise.catch(error => {
                    if (config.DEBUG_MODE) console.error("Error reproduciendo video:", error);
                    displayWarning(this.getText("warning_video_playback", "Error de reproducción"));
                });
            }
            this.state.current = "video";
            this.state.interactionLocked = false;
        }, config.FADE_DURATION); // Usamos la misma duración que la transición CSS
    }

    /**
     * Transición de vuelta a la vista del modelo.
     * Lógica también simplificada.
     */
    returnToModel() {
        if (this.state.current !== "video") return;
        if (config.DEBUG_MODE) console.log("🔄 Volviendo al modelo 3D");

        this.state.current = "transitioning";
        this.state.interactionLocked = true;
        this.clearAllTimers();
        
        // 1. Detenemos el video inmediatamente.
        this.elements.video.pause();
        this.elements.video.currentTime = 0;

        // 2. Cambiamos a la vista del modelo. El CSS se encarga del fade.
        switchView("model");
        this.elements.logo.classList.remove("hidden");
        
        // 3. Esperamos a que la transición termine para restaurar el estado y la interacción.
        this.setTimer("modelTransitionEnd", () => {
            this.resetHoldState();
            this.state.current = "model";
            this.state.interactionLocked = false;
            this.scheduleAutoSnap();
        }, config.FADE_DURATION);
    }

    // ... Todas las demás funciones (sistema de interacción, efectos, compartir, etc.)
    // no necesitan cambios y se mantienen exactamente igual.
    // He omitido el resto de la clase para brevedad, solo debes reemplazar
    // las funciones `showVideo` y `returnToModel` en tu archivo original.
    // ...
    /* ===================== SISTEMA DE INTERACCIÓN (sin cambios) ===================== */
    startHoldDetection(event) { if (this.state.activePointerId !== null || this.state.current !== 'model' || this.state.interactionLocked) { return; } if (config.DEBUG_MODE) console.log("👇 Iniciando detección de hold"); this.state.activePointerId = event.pointerId; this.interaction.touchStartPosition = getEventPosition(event); this.state.isDragging = false; this.updateLastInteraction(); this.clearTimer('autoSnap'); this.setTimer('holdInitiator', () => { if (this.state.activePointerId === event.pointerId && !this.state.isDragging && this.state.current === 'model') { this.initiateHold(); } }, config.HOLD_DURATION); }
    updateHoldDetection(event) { if (event.pointerId !== this.state.activePointerId || this.state.isHolding) return; this.updateLastInteraction(); const currentPosition = getEventPosition(event); const dragDistance = calculateDragDistance(this.interaction.touchStartPosition, currentPosition); if (dragDistance > config.DRAG_THRESHOLD) { if (!this.state.isDragging && config.DEBUG_MODE) { console.log(`↔️ Drag detectado (${dragDistance.toFixed(1)}px)`); } this.state.isDragging = true; this.clearTimer('holdInitiator'); } }
    endHoldDetection(event) { if (event.pointerId !== this.state.activePointerId) return; if (config.DEBUG_MODE) console.log("👆 Finalizando interacción"); this.clearTimer('holdInitiator'); if (this.state.isHolding) { this.cancelHold(); } this.state.activePointerId = null; this.state.isDragging = false; this.updateLastInteraction(); this.scheduleAutoSnap(); }
    updateLastInteraction() { this.interaction.lastInteractionTime = Date.now(); }
    scheduleAutoSnap() { this.clearTimer('autoSnap'); this.setTimer('autoSnap', () => { const timeSinceLastInteraction = Date.now() - this.interaction.lastInteractionTime; if (timeSinceLastInteraction >= config.CAMERA_SNAP_DELAY && this.state.current === 'model' && !this.state.interactionLocked && !this.state.isHolding) { if (config.DEBUG_MODE) console.log("📐 Snap automático"); try { snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG); } catch (error) { if (config.DEBUG_MODE) console.error("Error en snap automático:", error); } } }, config.CAMERA_SNAP_DELAY); }
    cancelHold() { if (!this.state.isHolding) return; if (config.DEBUG_MODE) console.log("🧹 Cancelando HOLD"); this.resetHoldState(); }
    initiateHold() { if (!this.validateHoldConditions()) return; if (config.DEBUG_MODE) console.log("🚀 Iniciando HOLD"); try { snapToNearestSide(this.elements.viewer, config.ROTATION_CONFIG); } catch (error) { if (config.DEBUG_MODE) console.error("Error en snap preventivo:", error); } this.state.isHolding = true; this.updateLastInteraction(); this.elements.blocker.classList.remove("hidden"); this.progress.startTime = Date.now(); this.elements.viewer.classList.add("hold"); this.elements.indicator.classList.add("active"); triggerHapticFeedback(config.DEVICE_CONFIG?.hapticFeedback); this.startProgressAnimation(); this.startParticleEffect(this.interaction.touchStartPosition); this.setTimer("videoActivation", () => { if (this.state.isHolding && this.state.current === 'model') { this.showVideo(); } }, config.VIDEO_ACTIVATION_DELAY); }
    validateHoldConditions() { return this.elements.viewer && isModelViewerReady(this.elements.viewer) && this.elements.viewer.src && this.state.current === 'model' && !this.state.interactionLocked && this.state.activePointerId !== null; }
    /* ===================== EFECTOS VISUALES (sin cambios) ===================== */
    startProgressAnimation() { const animate = () => { if (!this.state.isHolding) { this.clearTimer("progress"); return; } const elapsed = Date.now() - this.progress.startTime; const progress = Math.min(elapsed / this.progress.totalTime, 1); const currentWidth = progress * 90; if (this.elements.indicator) { this.elements.indicator.style.width = `${currentWidth}vw`; } if (progress >= 1) { triggerHapticFeedback(config.DEVICE_CONFIG?.hapticFeedback); this.clearTimer("progress"); return; } this.timers.set("progress", requestAnimationFrame(animate)); }; this.clearTimer("progress"); this.timers.set("progress", requestAnimationFrame(animate)); }
    startParticleEffect(position) { if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') { if (config.DEBUG_MODE) console.warn("Posición inválida para partículas:", position); return; } this.setTimer("particles", () => { if (this.state.isHolding && this.elements.particlesContainer) { try { spawnParticles(position.x, position.y, this.elements.particlesContainer, config.PARTICLE_CONFIG); } catch (error) { if (config.DEBUG_MODE) console.warn("Error generando partículas:", error); } } }, config.PARTICLE_SPAWN_INTERVAL, true); }
    /* ===================== LIMPIEZA (sin cambios) ===================== */
    resetHoldState() { if (config.DEBUG_MODE) console.log("🧹 Reseteando estado de hold"); this.state.isHolding = false; this.state.activePointerId = null; this.state.isDragging = false; this.updateLastInteraction(); this.elements.blocker.classList.add("hidden"); this.elements.viewer.classList.remove("hold"); this.elements.indicator.classList.remove("active"); this.elements.indicator.style.width = "0"; const particles = this.elements.particlesContainer.querySelectorAll('.particle'); particles.forEach(particle => particle.remove()); ['holdInitiator', 'videoActivation', 'progress', 'particles'].forEach(name => { this.clearTimer(name); }); }
    /* ===================== COMPARTIR (sin cambios) ===================== */
    async handleShareCard() { if (this.state.current !== "model" || this.state.interactionLocked) return; try { this.setShareButtonState("loading"); displayInfo(this.getText("share_preparing", "Preparando captura...")); const imageBlob = await getCardShareImage(this.resourcePaths.share); if (!imageBlob) { displayWarning(this.getText("share_no_image", "Imagen no disponible")); return; } const shareText = this.generateShareText(); const result = await this.attemptShare(imageBlob, shareText); this.handleShareResult(result); } catch (error) { if (config.DEBUG_MODE) console.error("Error al compartir:", error); displayError(this.getText("share_error", "Error al preparar la imagen")); } finally { this.setShareButtonState("normal"); } }
    generateShareText() { const cardTitle = this.getLocalizedTitle(); const storeUrl = config.SHARE_CONFIG?.storeUrl || "https://www.superx.com.ar"; const handle = config.SHARE_CONFIG?.socialHandle || "@superx_coleccionables"; const fallbackText = `🎮 ¡Mira esta increíble carta 3D: {cardTitle}! ✨\n\n` + `🔥 Descubre todos nuestros productos en: {storeUrl}\n` + `📱 Síguenos en Instagram: {handle}\n\n` + `#cartas3D #coleccionables #manga #comic #anime #gamming`; const shareTemplate = this.getText("share_text", fallbackText); const finalShareText = shareTemplate .replace("{cardTitle}", cardTitle) .replace("{storeUrl}", storeUrl) .replace("{handle}", handle); return finalShareText; }
    async attemptShare(imageBlob, shareText) { const filename = `${config.SHARE_CONFIG?.filename || "super-x-card"}-${this.cardId}.png`; const nativeShared = await tryNativeShare(imageBlob, shareText, filename); if (nativeShared) return { method: "native", success: true }; const copied = await copyImageToClipboard(imageBlob); if (copied) return { method: "clipboard", success: true }; downloadImage(imageBlob, filename, config.PERFORMANCE_CONFIG?.cleanup?.urlRevokeDelay); return { method: "download", success: true }; }
    handleShareResult(result) { if (result.success) { const messages = { native: this.getText("share_success", "¡Imagen lista para compartir!"), clipboard: this.getText("share_clipboard", "Imagen copiada al portapapeles"), download: this.getText("share_download", "Imagen descargada"), }; displaySuccess(messages[result.method]); } }
    setShareButtonState(state) { const button = this.elements.shareButton; if (!button) return; if (state === "loading") { button.classList.add("loading"); button.textContent = this.getText("share_preparing", "Preparando..."); } else { button.classList.remove("loading"); button.innerHTML = ` <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/> </svg> <span>${this.getText("share_button", "Compartir")}</span> `; } }
    /* ===================== EVENT LISTENERS (sin cambios) ===================== */
    setupEventListeners() { this.elements.skipButton?.addEventListener("click", () => this.returnToModel()); this.elements.shareButton?.addEventListener("click", () => this.handleShareCard()); this.elements.viewer.addEventListener("pointerdown", (e) => this.startHoldDetection(e)); this.elements.viewer.addEventListener("pointermove", (e) => this.updateHoldDetection(e)); this.elements.viewer.addEventListener("pointerup", (e) => this.endHoldDetection(e)); this.elements.viewer.addEventListener("pointercancel", (e) => this.endHoldDetection(e)); this.elements.viewer.addEventListener("pointerleave", (e) => this.endHoldDetection(e)); this.elements.viewer.addEventListener("dragstart", (e) => e.preventDefault()); this.elements.video.addEventListener("ended", () => this.returnToModel()); window.addEventListener("languageChanged", (event) => { this.lang = event.detail.language; this.translations = event.detail.translations; this.updateDynamicTexts(); if (this.elements.title) this.elements.title.textContent = this.getLocalizedTitle(); this.setShareButtonState("normal"); }); if (config.DEBUG_MODE) { document.addEventListener("keydown", (e) => { if (e.key === "l" || e.key === "L") { const newLang = this.lang === "en" ? "es" : "en"; switchLanguage(newLang).catch(console.error); } }); } }
    /* ===================== CLEANUP (sin cambios) ===================== */
    destroy() { if (config.DEBUG_MODE) console.log("🧹 Destruyendo CardViewerApp"); this.clearAllTimers(); this.resetHoldState(); Object.keys(this.elements).forEach(key => { this.elements[key] = null; }); this.state = null; this.interaction = null; this.progress = null; }
}
