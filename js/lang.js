import { DEFAULT_LANG, LANG_PATH } from "./config.js";

/**
 * Carga el archivo de idioma correspondiente
 * @param {string} lang - Código de idioma ("en", "es", etc.)
 * @returns {Promise<Object>} - Objeto con claves y traducciones
 */
export async function loadLang(lang) {
  const path = `${LANG_PATH}${lang}.json`;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`No se pudo cargar el archivo: ${path}`);
    return await res.json();
  } catch (error) {
    console.warn(`Fallo al cargar idioma '${lang}', se usará '${DEFAULT_LANG}'`, error);
    if (lang !== DEFAULT_LANG) {
      return loadLang(DEFAULT_LANG);
    }
    return {};
  }
}

/**
 * Aplica las traducciones a los elementos con atributo data-i18n
 * @param {Object} translations - Objeto con claves y textos traducidos
 */
export function applyTranslations(translations) {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) {
      el.textContent = translations[key];
    }
  });
}
