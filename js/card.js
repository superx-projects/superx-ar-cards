// card.js
import { loadLang, applyTranslations } from "./lang.js";
import * as config from "./config.js";
import { spawnParticles, customAutoRotate } from "./utils.js";

(async function () {
  // Obtener parámetros URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // Obtener idioma
  const userLang = navigator.language.startsWith("es") ? "es" : "en";
  const lang = userLang || DEFAULT_LANG;
  
  let translations = {};
  try {
    translations = await loadLang(lang);
    applyTranslations(translations); // Aplica automáticamente a todos los elementos con data-i18n
  } catch (error) {
    console.error("Error al cargar traducciones:", error);
  }

  // Validar id
  if (!id) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_invalid_id"] || "Invalid or missing card ID"}</p>`;
    return;
  }

  // Obtener datos de carta
  const res = await fetch(config.CARDS_DATA_PATH);
  if (!res.ok) throw new Error("No se pudo cargar cards.json");
  const data = await res.json();
  const cardData = data[id];

  if (!cardData) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_card_not_found"] || "Card not found"}</p>`;
    return;
  }

  // Obtener elementos DOM
  const viewer = document.getElementById("viewer");
  const video = document.getElementById("card_video");
  const fade = document.getElementById("fade_effect");
  const indicator = document.getElementById("hold-indicator");
  const particlesContainer = document.getElementById("particles-container");
  const skipButton = document.getElementById("skip_button");

  // Aplicar el nombre del modelo desde cardData
  const title = (cardData.title && (cardData.title[lang] || cardData.title[DEFAULT_LANG])) || "Unknown Card";
  document.getElementById("card_title").textContent = title;
  
  // Asignar rutas
  viewer.setAttribute("src", `${config.MODEL_PATH}${cardData.model}`);
  video.src = `${config.VIDEO_PATH}${cardData.video}`;

  // Variables control
  let isHolding = false;
  let holdTimeout = null;
  let particleInterval = null;
  let activePointerId = null;
  let lastCameraOrbit = null;
  let modelMoved = false;
  let isAutoRotateEnabled = true;

  // Mostrar video
  function showVideo() {
    isAutoRotateEnabled = false;
    fade.classList.add("active");

    setTimeout(() => {
      viewer.style.display = "none";
      document.getElementById("info-box").style.display = "none";
      document.querySelector(".logo").classList.add("hidden");

      video.style.display = "block";
      video.classList.add("showing");
      skipButton.style.display = "block";

      fade.classList.remove("active");
      video.play();

      particlesContainer.innerHTML = "";
    }, 400);
  }

  // Volver a modelo
  function returnToModel() {
    fade.classList.add("active");

    setTimeout(() => {
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      video.style.display = "none";
      skipButton.style.display = "none";

      viewer.style.display = "block";
      document.getElementById("info-box").style.display = "block";
      document.querySelector(".logo").classList.remove("hidden");

      fade.classList.remove("active");
    }, 400);

    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, config.VIDEO_ACTIVATION_DELAY);
  }

  // Cancelar hold
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

  // Event listeners

  skipButton.addEventListener("click", returnToModel);

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
        }, 80);

        setTimeout(() => {
          if (isHolding) showVideo();
        }, config.VIDEO_ACTIVATION_DELAY);
      }
    }, config.HOLD_DURATION);
  });

  viewer.addEventListener("pointermove", () => {
    if (!lastCameraOrbit) return;

    const currentOrbit = viewer.getCameraOrbit ? viewer.getCameraOrbit() : null;
    if (currentOrbit && currentOrbit.theta !== lastCameraOrbit.theta) {
      modelMoved = true;
      clearTimeout(holdTimeout);
    }
  });

  viewer.addEventListener("pointerup", (e) => {
    if (e.pointerId !== activePointerId) return;
    cancelHold();

    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, config.VIDEO_ACTIVATION_DELAY);
  });

  viewer.addEventListener("pointercancel", cancelHold);
  viewer.addEventListener("pointerleave", cancelHold);

  video.addEventListener("ended", returnToModel);

  // Snap de rotación horizontal
  let snapTimeout = null;

  viewer.addEventListener("camera-change", () => {
    clearTimeout(snapTimeout);

    snapTimeout = setTimeout(() => {
      const orbit = viewer.getCameraOrbit();
      const theta = orbit.theta;

      const deg = (theta * 180) / Math.PI;
      const normalized = ((deg % 360) + 360) % 360;

      const targetDeg = (normalized > 90 && normalized < 270) ? 180 : 0;

      isAutoRotateEnabled = false;
      viewer.cameraOrbit = `${targetDeg}deg 90deg auto`;

      setTimeout(() => {
        isAutoRotateEnabled = true;
      }, 1000);
    }, 800);
  });

  // Iniciar rotación automática
  customAutoRotate(viewer, () => isAutoRotateEnabled, config.AUTO_ROTATE_SPEED);
})();
