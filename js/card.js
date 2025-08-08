import { loadLang, applyTranslations } from "./lang.js";
import * as config from "./config.js";
import {
  spawnParticles,
  customAutoRotate,
  snapToNearestSide
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

  // Asignar rutas a modelo 3D y video
  viewer.setAttribute("src", `${config.MODEL_PATH}${cardData.model}`);
  video.src = `${config.VIDEO_PATH}${cardData.video}`;

  // --- Variables de control ---
  let isHolding = false;
  let holdTimeout = null;
  let particleInterval = null;
  let activePointerId = null;
  let lastCameraOrbit = null;
  let modelMoved = false;
  let isAutoRotateEnabled = true;

  // --- Funciones auxiliares ---

  // Mostrar video con transición
  function showVideo() {
    isAutoRotateEnabled = false;
    fade.classList.add("active");

    setTimeout(() => {
      viewer.style.display = "none";
      infoBox.style.display = "none";
      logo.classList.add("hidden");

      video.style.display = "block";
      video.classList.add("showing");
      skipButton.style.display = "block";

      fade.classList.remove("active");
      video.play();

      particlesContainer.innerHTML = "";
    }, config.FADE_DURATION);
  }

  // Volver al modelo 3D con transición
  function returnToModel() {
    fade.classList.add("active");

    setTimeout(() => {
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      video.style.display = "none";
      skipButton.style.display = "none";

      viewer.style.display = "block";
      infoBox.style.display = "block";
      logo.classList.remove("hidden");

      fade.classList.remove("active");
    }, config.FADE_DURATION);

    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, config.VIDEO_ACTIVATION_DELAY);
  }

  // Cancelar el estado de "hold" (mantener presionado)
  function cancelHold() {
    isHolding = false;
    activePointerId = null;
    clearTimeout(holdTimeout);

    if (particleInterval) {
      clearInterval(particleInterval);
      particleInterval = null;
    }

    indicator.classList.remove("active");
    viewer.classList.remove("hold");
  }

  // --- Event listeners ---

  // Botón para saltar video y volver al modelo 3D
  skipButton.addEventListener("click", returnToModel);

  // Iniciar "hold" al presionar puntero (mouse o touch)
  viewer.addEventListener("pointerdown", (e) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;

    const x = e.clientX;
    const y = e.clientY;
    modelMoved = false;
    lastCameraOrbit = viewer.getCameraOrbit ? viewer.getCameraOrbit() : null;

    holdTimeout = setTimeout(() => {
      if (!modelMoved) {
        isHolding = true;
        viewer.classList.add("hold");
        indicator.classList.add("active");

        particleInterval = setInterval(() => {
          spawnParticles(x, y, particlesContainer);
        }, config.PARTICLE_SPAWN_INTERVAL);

        setTimeout(() => {
          if (isHolding) showVideo();
        }, config.VIDEO_ACTIVATION_DELAY);
      }
    }, config.HOLD_DURATION);
  });

  // Detectar movimiento de cámara para cancelar "hold"
  viewer.addEventListener("pointermove", () => {
    if (!lastCameraOrbit) return;

    const currentOrbit = viewer.getCameraOrbit ? viewer.getCameraOrbit() : null;
    if (currentOrbit && currentOrbit.theta !== lastCameraOrbit.theta) {
      modelMoved = true;
      clearTimeout(holdTimeout);
    }
  });

  // Al soltar puntero, cancelar "hold" y activar rotación automática
  viewer.addEventListener("pointerup", (e) => {
    if (e.pointerId !== activePointerId) return;
    cancelHold();

    // Realizar snap al soltar para orientar bien la carta
    snapToNearestSide(viewer);

    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, config.VIDEO_ACTIVATION_DELAY);
  });

  // Cancelar hold si puntero sale o se cancela
  viewer.addEventListener("pointercancel", cancelHold);
  viewer.addEventListener("pointerleave", cancelHold);

  // Al finalizar video, volver al modelo
  video.addEventListener("ended", returnToModel);

  // --- Snap de rotación horizontal (por si el usuario gira manualmente) ---
  // Esta función ya realiza un snap gradual, puede coexistir con el snap en pointerup
  let snapTimeout = null;

  viewer.addEventListener("camera-change", () => {
    clearTimeout(snapTimeout);

    snapTimeout = setTimeout(() => {
      isAutoRotateEnabled = false;
      snapToNearestSide(viewer);

      setTimeout(() => {
        isAutoRotateEnabled = true;
      }, config.CAMERA_SNAP_TRANSITION);
    }, config.CAMERA_SNAP_DELAY);
  });

  // --- Iniciar rotación automática ---
  //customAutoRotate(viewer, () => isAutoRotateEnabled, config.AUTO_ROTATE_SPEED);
})();