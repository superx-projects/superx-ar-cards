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
  const indicator = document.getElementById("hold-indicator");
  const particles = document.getElementById("particles");

  document.getElementById("card_title").textContent = cardData.title[lang] || cardData.title["en"];
  document.getElementById("card_instructions").textContent = translations["card_hold_to_play"] || "Hold the card to play animation";

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
      viewer.style.display = "block";
      document.getElementById("info-box").style.display = "block";
      document.querySelector(".logo").classList.remove("hidden");
      fade.classList.remove("active");
    }, 400);
  }

  viewer.addEventListener("pointerdown", () => {
    viewer.classList.add("hold");
    indicator.classList.add("active");
    particles.classList.add("active");
    holdTimeout = setTimeout(showVideo, 800);
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
