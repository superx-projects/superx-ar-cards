import { loadLang, applyTranslations } from "./lang.js";
import { DEFAULT_LANG } from "./config.js";

(async function () {
  const userLang = navigator.language.startsWith("es") ? "es" : "en";
  const lang = userLang || DEFAULT_LANG;

  try {
    const translations = await loadLang(lang);
    applyTranslations(translations);
  } catch (error) {
    console.error("Error al cargar traducciones:", error);
  }
})();
