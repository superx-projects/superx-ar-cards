/**
 * lang.js - Sistema de internacionalización
 * Proyecto: Super X Immersive Cards
 */

import { DEFAULT_LANG, LANG_PATH } from "./config.js";

const translationCache = new Map();

export function detectUserLanguage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  
  if (urlLang && isValidLanguageCode(urlLang)) return urlLang;
  
  const storedLang = localStorage.getItem('preferred-language');
  if (storedLang && isValidLanguageCode(storedLang)) return storedLang;
  
  const browserLang = navigator.language.split('-')[0];
  if (isValidLanguageCode(browserLang)) return browserLang;
  
  return DEFAULT_LANG;
}

function isValidLanguageCode(lang) {
  return typeof lang === 'string' && /^[a-z]{2}$/.test(lang);
}

export async function loadLang(lang) {
  if (!isValidLanguageCode(lang)) {
    console.warn(`Código de idioma inválido: ${lang}, usando ${DEFAULT_LANG}`);
    lang = DEFAULT_LANG;
  }
  
  if (translationCache.has(lang)) {
    return translationCache.get(lang);
  }
  
  const path = `${LANG_PATH}${lang}.json`;
  
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    
    const translations = await response.json();
    if (!translations || typeof translations !== 'object') {
      throw new Error('Formato de archivo de traducción inválido');
    }
    
    translationCache.set(lang, translations);
    localStorage.setItem('preferred-language', lang);
    return translations;
    
  } catch (error) {
    console.warn(`Error cargando idioma '${lang}':`, error.message);
    
    if (lang !== DEFAULT_LANG) return await loadLang(DEFAULT_LANG);
    
    console.error(`Error crítico: no se pudo cargar el idioma por defecto '${DEFAULT_LANG}'`);
    return {};
  }
}

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
    if (!key) return;
    
    if (translations.hasOwnProperty(key)) {
      element.textContent = translations[key];
      translatedCount++;
    } else {
      missingTranslations.push(key);
    }
  });
  
  if (elements.length > 0) {
    console.log(`Traducciones aplicadas: ${translatedCount}/${elements.length}`);
    if (missingTranslations.length > 0) {
      console.warn('Traducciones faltantes:', missingTranslations);
    }
  }
}

export function getTranslation(translations, key, fallback = key) {
  if (!translations || typeof translations !== 'object') return fallback;
  return translations[key] || fallback;
}

export async function switchLanguage(newLang, root = document) {
  try {
    const translations = await loadLang(newLang);
    applyTranslations(translations, root);
    
    document.documentElement.lang = newLang;
    
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: newLang, translations }
    }));
    
    return translations;
    
  } catch (error) {
    console.error(`Error cambiando idioma a '${newLang}':`, error);
    throw error;
  }
}

export function clearTranslationCache() {
  translationCache.clear();
  console.log('Cache de traducciones limpiado');
}