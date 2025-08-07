(async function () {
  // Obtener los parametros de la URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  // Obtener el idioma del navegador y cargar el correspondiente archivo de idioma
  const lang = navigator.language.startsWith("es") ? "es" : "en";
  const translations = await loadLang(lang);

  // Chequear si se accede desde una url valida (existe el parametro 'id')
  if (!id) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_invalid_id"] || "Invalid or missing card ID"}</p>`;
    return;
  }

  // Chequear si el id parametro 'id' es valido y corresponde a una carta fisica
  const response = await fetch("data/cards.json");
  const data = await response.json();
  const cardData = data[id];
  if (!cardData) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_card_not_found"] || "Card not found"}</p>`;
    return;
  }

  // Obtener los elementos de la pagina card.html
  const viewer = document.getElementById("viewer");
  const video = document.getElementById("card_video");
  const fade = document.getElementById("fade_effect");
  const indicator = document.getElementById("hold-indicator");
  const particlesContainer = document.getElementById("particles-container");
  const skipButton = document.getElementById("skip_button");

  // Cargar textos dinámicamente
  document.getElementById("card_title").textContent = cardData.title[lang] || cardData.title["en"];
  document.getElementById("card_instructions").textContent = translations["card_hold_to_play"] || "Hold the card to play animation";
  skipButton.textContent = translations["video_skip"] || "Skip";

  // Asignar modelo y video
  viewer.setAttribute("src", `assets/models/${cardData.model}`);
  video.src = `assets/videos/${cardData.video}`;

  // Variables globales del main
  const HOLD_DELAY = 600; // tiempo minimo para reaccionar a la pulsacion del modelo
  const VIDEO_TRIGGER_DELAY = 2000; // tiempo para mostrar el video (2000 ms = 2 segundos)
  let isHolding = false;
  let holdTimeout = null;
  let particleInterval = null;
  let activePointerId = null;
  let lastCameraOrbit = null;
  let modelMoved = false;
  let isAutoRotateEnabled = true;
  let lastTimestamp = null;
  const rotateSpeed = 0.0005; // ajustar si gira muy lento o rápido

 // Función para generar partículas en la posición del click
  function spawnParticles(x, y) {
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 60 + 20;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      particle.style.setProperty("--dx", `${dx}px`);
      particle.style.setProperty("--dy", `${dy}px`);

      particlesContainer.appendChild(particle);

      // Eliminar la partícula después de la animación
      setTimeout(() => {
        if (particle.parentElement) {
          particlesContainer.removeChild(particle);
        }
      }, 600);
    }
  }

  // Función para mostrar el video
  function showVideo() {
    // Pausar auto-rotate al mostrar el video
    isAutoRotateEnabled = false;
    // Mostar el fade en pantalla
    fade.classList.add("active");

    setTimeout(() => {
      // Ocultar model-viewer, logo y textos en pantalla
      viewer.style.display = "none";
      document.getElementById("info-box").style.display = "none";
      document.querySelector(".logo").classList.add("hidden");

      // Mostrar video y botón de salto
      video.style.display = "block";
      video.classList.add("showing");
      skipButton.style.display = "block";

      // Finalizar el fade en pantalla y reproducir el video
      fade.classList.remove("active");
      video.play();

      // Limpiar partículas existentes por si quedan
      particlesContainer.innerHTML = "";
    }, 400);
  }

  // Función para volver al modelo después del video
  function returnToModel() {
    // Mostrar el fade en pantalla
    fade.classList.add("active");

    setTimeout(() => {
      // Ocultar video y skip-button
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      video.style.display = "none";
      skipButton.style.display = "none";

      // Mostrar model.viewer, logo y textos en pantalla
      viewer.style.display = "block";
      document.getElementById("info-box").style.display = "block";
      document.querySelector(".logo").classList.remove("hidden");

      // Finalizar el fade en pantalla
      fade.classList.remove("active");
    }, 400);

    // Habilitar auto-rotate al volver del video
    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, 2000);
    
  }

  // Botón para omitir el video
  skipButton.addEventListener("click", returnToModel);

  // Evento cuando el usuario mantiene presionado sobre el modelo
  viewer.addEventListener("pointerdown", (e) => {
    // Prevenir múltiples toques simultáneos
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;

    const x = e.clientX;
    const y = e.clientY;
    modelMoved = false;

    lastCameraOrbit = viewer.getCameraOrbit ? viewer.getCameraOrbit() : null;

    // Delay para mostrar partículas y reproducir video si no hay movimiento
    holdTimeout = setTimeout(() => {
      if (!modelMoved) {
       isHolding = true;
        viewer.classList.add("hold");
        indicator.classList.add("active");

        // Iniciar partículas
        particleInterval = setInterval(() => {
          spawnParticles(x, y);
        }, 80);

        // Reproducir video después de 2s
        setTimeout(() => {
          if (isHolding) showVideo();
        }, VIDEO_TRIGGER_DELAY);
      }
    }, HOLD_DELAY);
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

    // Habilitar auto-rotate 2 segundos después de soltar
    setTimeout(() => {
      isAutoRotateEnabled = true;
    }, 2000);
  });

  viewer.addEventListener("pointercancel", cancelHold);
  viewer.addEventListener("pointerleave", cancelHold);

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

  // Volver al modelo cuando el video termina
  video.addEventListener("ended", returnToModel);

  // SNAP DE ROTACIÓN HORIZONTAL
  let snapTimeout = null;

  viewer.addEventListener("camera-change", () => {
    clearTimeout(snapTimeout);

    snapTimeout = setTimeout(() => {
      const orbit = viewer.getCameraOrbit();
      const theta = orbit.theta; // radianes

      const deg = (theta * 180) / Math.PI;
      const normalized = ((deg % 360) + 360) % 360;

      // Si está más cerca de 180°, mostrar reverso
      const targetDeg = (normalized > 90 && normalized < 270) ? 180 : 0;

      // Pausar la auto-rotación durante el snap para evitar conflicto
      isAutoRotateEnabled = false;

      // Aplicar rotación con snap visual
      viewer.cameraOrbit = `${targetDeg}deg 90deg auto`;

      // Reactivar auto-rotate después de alinear
      setTimeout(() => {
        isAutoRotateEnabled = true;
        }, 1000);
      
      }, 800); // espera 800ms de inactividad antes de alinear
    
  });

  function customAutoRotate(timestamp) {
    if (!isAutoRotateEnabled || !viewer.getCameraOrbit) {
      requestAnimationFrame(customAutoRotate);
      return;
    }

    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const orbit = viewer.getCameraOrbit();
    const newTheta = orbit.theta + delta * rotateSpeed;

    viewer.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;

    requestAnimationFrame(customAutoRotate);
  }

  requestAnimationFrame(customAutoRotate);

})();
