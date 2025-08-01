function applyTranslations(translations) {
  Object.keys(translations).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.innerText = translations[key];
    }
  });
}

function detectLangAndLoad() {
  const supportedLangs = ['en', 'es'];
  const userLang = navigator.language.slice(0, 2).toLowerCase();
  const lang = supportedLangs.includes(userLang) ? userLang : 'en';

  fetch(`./lang/${lang}.json`)
    .then(response => {
      if (!response.ok) throw new Error(`No se pudo cargar el archivo de idioma: ${lang}`);
      return response.json();
    })
    .then(translations => {
      applyTranslations(translations);
    })
    .catch(error => {
      console.error('Error al cargar el idioma:', error);
    });
}

detectLangAndLoad();
