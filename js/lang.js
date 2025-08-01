async function loadLanguageTexts() {
  const userLang = navigator.language.startsWith('es') ? 'es' : 'en';
  const langFile = `/lang/${userLang}.json`;

  try {
    const res = await fetch(langFile);
    const texts = await res.json();

    // Insertar en DOM
    document.getElementById('info1').textContent = texts.info_1;
    document.getElementById('info2').textContent = texts.info_2;

    const helpBox = document.getElementById('helpBox');
    helpBox.innerHTML = `
      <p><strong>${texts.help_title}</strong></p>
      <p>${texts.help_ar}</p>
      <ul>
        <li><strong>${texts.help_ios}</strong></li>
        <li><strong>${texts.help_android}</strong></li>
      </ul>
      <p>${texts.help_controls}</p>
      <p>${texts.help_close}</p>
    `;
  } catch (error) {
    console.error('Error al cargar idioma:', error);
  }
}
