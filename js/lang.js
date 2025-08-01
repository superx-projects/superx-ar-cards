(async () => {
  // Detectar idioma del navegador, usar 'en' por defecto
  const supportedLangs = ['en', 'es'];
  const userLang = navigator.language.slice(0, 2).toLowerCase();
  const lang = supportedLangs.includes(userLang) ? userLang : 'en';

  try {
    // Cargar archivo JSON correspondiente al idioma
    const response = await fetch(`./lang/${lang}.json`);
    if (!response.ok) throw new Error(`No se pudo cargar el archivo de idioma: ${lang}`);
    const translations = await response.json();

    // Reemplazar texto en elementos con ID que coincidan con las claves del JSON
    Object.keys(translations).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        el.innerText = translations[key];
      }
    });
  } catch (error) {
    console.error('Error al cargar el idioma:', error);
  }
})();
