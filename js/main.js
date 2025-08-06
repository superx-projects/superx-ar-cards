(async function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const lang = navigator.language.startsWith("es") ? "es" : "en";
  const translations = await loadLang(lang);

  if (!id) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_invalid_id"] || "Invalid or missing card ID"}</p>`;
    return;
  }
  
  const response = await fetch("data/cards.json");
  const data = await response.json();
  const cardData = data[id];

  if (!cardData) {
    document.body.innerHTML = `<p style='color:white;text-align:center;'>${translations["error_card_not_found"] || "Card not found"}</p>`;
    return;
  }

  const viewer = document.getElementById("viewer");
  const video = document.getElementById("card_video");
  const fade = document.getElementById("fade_effect");
  const indicator = document.getElementById("hold-indicator");
  const particles = document.getElementById("particles");
  const skipButton = document.getElementById("skip_button");

  document.getElementById("card_title").textContent = cardData.title[lang] || cardData.title["en"];
  document.getElementById("card_instructions").textContent = translations["card_hold_to_play"] || "Hold the card to play animation";
  document.getElementById("skip_button").textContent = translations["video_skip"] || "Skip";

  viewer.setAttribute("src", `assets/models/${cardData.model}`);
  video.src = `assets/videos/${cardData.video}`;

  let holdTimeout;

  function showVideo() {
    fade.classList.add("active");
    setTimeout(() => {
      viewer.style.display = "none";
      document.getElementById("info-box").style.display = "none";
      document.querySelector(".logo").classList.add("hidden");
      particles.classList.remove("active");

      video.classList.add("showing");
      video.style.display = "block";

      skipButton.style.display = "block";

      fade.classList.remove("active");
      video.play();
    }, 400);
  }

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
  }

  skipButton.addEventListener("click", returnToModel);

  viewer.addEventListener("pointerdown", () => {
    viewer.classList.add("hold");
    indicator.classList.add("active");
    particles.classList.add("active");
    holdTimeout = setTimeout(showVideo, 1500);
  });

  ["pointerup", "pointerleave"].forEach(evt => {
    viewer.addEventListener(evt, () => {
      clearTimeout(holdTimeout);
      indicator.classList.remove("active");
      particles.classList.remove("active");
      viewer.classList.remove("hold");
    });
  });

  video.addEventListener("ended", returnToModel);
})();

