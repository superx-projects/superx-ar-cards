(async function() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.body.innerHTML = "<p style='color:white;text-align:center;'>Invalid or missing card ID</p>";
    return;
  }

  const lang = navigator.language.startsWith("es") ? "es" : "en";
  const translations = await loadLang(lang); // from lang.js

  const response = await fetch("data/cards.json");
  const data = await response.json();

  const cardData = data[id];
  if (!cardData) {
    document.body.innerHTML = "<p style='color:white;text-align:center;'>Card not found</p>";
    return;
  }

  // Set title
  document.getElementById("card_title").textContent = cardData.title[lang] || cardData.title["en"];
  document.getElementById("card_instructions").textContent = translations['card_hold_to_play'] || "Hold the card to play animation";

  // Load model
  const viewer = document.getElementById("viewer");
  viewer.setAttribute("src", `assets/models/${cardData.model}`);

  // Prepare video
  const video = document.getElementById("card_video");
  video.src = `assets/videos/${cardData.video}`;

  // Touch and hold to play video
  let holdTimeout;
  viewer.addEventListener("pointerdown", () => {
    holdTimeout = setTimeout(() => {
      viewer.style.display = "none";
      video.style.display = "block";
      video.play();
    }, 800); // 800ms hold
  });

  ["pointerup", "pointerleave"].forEach(evt =>
    viewer.addEventListener(evt, () => clearTimeout(holdTimeout))
  );

  // When video ends, return to model
  video.addEventListener("ended", () => {
    video.style.display = "none";
    viewer.style.display = "block";
  });
})();
