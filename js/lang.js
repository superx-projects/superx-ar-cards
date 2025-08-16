/**
 * lang.js - Sistema de internacionalización
 * Proyecto: Super X Immersive Cards
 * 
 * Maneja la carga y aplicación de traducciones para soporte multiidioma.
 */

import { DEFAULT_LANG, LANG_PATH } from "./config.js";

/* =====================
   CACHE DE TRADUCCIONES
===================== */
const translationCache = new Map();

/* =====================
   FUNCIONES PRINCIPALES
===================== */

/**
 * Detecta el idioma preferido del usuario
 * @returns {string} Código de idioma detectado
 */
export function detectUserLanguage() {
  // Prioridad: parámetro URL > localStorage > navegador > default
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  
  if (urlLang && isValidLanguageCode(urlLang)) {
    return urlLang;
  }
  
  const storedLang = localStorage.getItem('preferred-language');
  if (storedLang && isValidLanguageCode(storedLang)) {
    return storedLang;
  }
  
  const browserLang = navigator.language.split('-')[0];
  if (isValidLanguageCode(browserLang)) {
    return browserLang;
  }
  
  return DEFAULT_LANG;
}

/**
 * Valida si un código de idioma es válido
 * @param {string} lang - Código de idioma a validar
 * @returns {boolean} True si es válido
 */
function isValidLanguageCode(lang) {
  return typeof lang === 'string' && /^[a-z]{2}$/.test(lang);
}

/**
 * Carga el archivo de idioma correspondiente
 * @param {string} lang - Código de idioma ("en", "es", etc.)
 * @returns {Promise<Object>} Objeto con claves y traducciones
 */
export async function loadLang(lang) {
  // Validar entrada
  if (!isValidLanguageCode(lang)) {
    console.warn(`Código de idioma inválido: ${lang}, usando ${DEFAULT_LANG}`);
    lang = DEFAULT_LANG;
  }
  
  // Verificar cache
  if (translationCache.has(lang)) {
    return translationCache.get(lang);
  }
  
  const path = `${LANG_PATH}${lang}.json`;
  
  try {
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const translations = await response.json();
    
    // Validar estructura del archivo de traducción
    if (!translations || typeof translations !== 'object') {
      throw new Error('Formato de archivo de traducción inválido');
    }
    
    // Guardar en cache
    translationCache.set(lang, translations);
    
    // Guardar preferencia del usuario
    localStorage.setItem('preferred-language', lang);
    
    return translations;
    
  } catch (error) {
    console.warn(`Error cargando idioma '${lang}':`, error.message);
    
    // Fallback al idioma por defecto si no es el mismo
    if (lang !== DEFAULT_LANG) {
      return await loadLang(DEFAULT_LANG);
    }
    
    // Si también falla el idioma por defecto, devolver objeto vacío
    console.error(`Error crítico: no se pudo cargar el idioma por defecto '${DEFAULT_LANG}'`);
    return {};
  }
}

/**
 * Aplica las traducciones a los elementos con atributo data-i18n
 * @param {Object} translations - Objeto con claves y textos traducidos
 * @param {HTMLElement} [root=document] - Elemento raíz donde buscar elementos a traducir
 */
export function applyTranslations(translations, root = document) {
  if (!translations || typeof translations !== 'object') {
    console.warn('Objeto de traducciones inválido');
    return;
  }
  
  const elements = root.querySelectorAll("[data-i18n]");
  let translatedCount = 0;
  let missingTranslations = [];
  
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    
    if (!key) {
      console.warn('Elemento con data-i18n vacío encontrado:', element);
      return;
    }
    
    if (translations.hasOwnProperty(key)) {
      // Aplicar traducción
      element.textContent = translations[key];
      translatedCount++;
    } else {
      // Registrar traducción faltante
      missingTranslations.push(key);
    }
  });
  
  // Log de resultados
  if (elements.length > 0) {
    console.log(`Traducciones aplicadas: ${translatedCount}/${elements.length}`);
    
    if (missingTranslations.length > 0) {
      console.warn('Traducciones faltantes:', missingTranslations);
    }
  }
}

/**
 * Obtiene una traducción específica
 * @param {Object} translations - Objeto de traducciones
 * @param {string} key - Clave de la traducción
 * @param {string} [fallback] - Texto de respaldo
 * @returns {string} Traducción o fallback
 */
export function getTranslation(translations, key, fallback = key) {
  if (!translations || typeof translations !== 'object') {
    return fallback;
  }
  
  return translations[key] || fallback;
}

/**
 * Cambia el idioma de la aplicación dinámicamente
 * @param {string} newLang - Nuevo código de idioma
 * @param {HTMLElement} [root=document] - Elemento raíz donde aplicar traducciones
 * @returns {Promise<Object>} Nuevas traducciones cargadas
 */
export async function switchLanguage(newLang, root = document) {
  try {
    const translations = await loadLang(newLang);
    applyTranslations(translations, root);
    
    // Actualizar atributo lang del documento
    document.documentElement.lang = newLang;
    
    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: newLang, translations }
    }));
    
    return translations;
    
  } catch (error) {
    console.error(`Error cambiando idioma a '${newLang}':`, error);
    throw error;
  }
}

/**
 * Limpia el cache de traducciones
 */
export function clearTranslationCache() {
  translationCache.clear();
  console.log('Cache de traducciones limpiado');
}

/**
 * Obtiene información sobre el cache de traducciones
 * @returns {Object} Información del cache
 */
export function getCacheInfo() {
  return {
    size: translationCache.size,
    languages: Array.from(translationCache.keys())
  };
}