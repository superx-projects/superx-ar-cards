(async function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.body.innerHTML = "<p style='color:white;text-align:center;'>Invalid or missing card ID</p>";
    return;
  }

  const lang = navigator.language.startsWith("es") ? "es" : "en";
  const translations = await loadLang(lang);

  const response = await fetch("data/cards.json");
  const data = await response.json();
  const cardData = data[id];

  if (!cardData) {
    document.body.innerHTML = "<p style='color:white;text-align:center;'>Card not found</p>";
    return;
  }

  const viewer = document.getElementById("viewer");
  const video = document.getElementById("card_video");
  const fade = document.getElementById("fade_effect");

  // Textos
  document.getElementById("card_title").textContent = cardData.title[lang] || cardData.title["en"];
  document.getElementById("card_instructions").textContent = translations["card_hold_to_play"] || "Hold the card to play animation";

  // Model y video
  viewer.setAttribute("src", `assets/models/${cardData.model}`);
  video.src = `assets/videos/${cardData.video}`;

  let holdTimeout;

  // Función para reproducir el video
  function showVideo() {
    fade.classList.add("in");
    setTimeout(() => {
      viewer.style.display = "none";
      document.getElementById("info-box").style.display = "none";
      document.querySelector(".logo").classList.add("hidden");
      video.classList.add("showing");
      fade.classList.remove("in");
      video.play();
    }, 400);
  }

  // Función para volver al modelo
  function returnToModel() {
    fade.classList.add("in");
    setTimeout(() => {
      video.classList.remove("showing");
      video.pause();
      video.currentTime = 0;
      viewer.style.display = "block";
      document.getElementById("info-box").style.display = "block";
      document.querySelector(".logo").classList.remove("hidden");
      fade.classList.remove("in");
    }, 400);
  }

  // Evento para mantener presionado
  viewer.addEventListener("pointerdown", () => {
    holdTimeout = setTimeout(showVideo, 800); // 800ms hold
  });

  ["pointerup", "pointerleave"].forEach(evt => {
    viewer.addEventListener(evt, () => clearTimeout(holdTimeout));
  });

  video.addEventListener("ended", returnToModel);
})();

