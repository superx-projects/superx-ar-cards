/**
 * 404.js - Script principal para 404.html
 * Proyecto: Super X Immersive Cards
 * 
 * Maneja la funcionalidad específica de la página 404,
 * aprovechando el sistema de i18n global existente.
 */

import { loadLang, applyTranslations, detectUserLanguage } from "./lang.js";
import { DEFAULT_LANG, DEBUG_MODE } from "./config.js";

/* =====================
   INICIALIZACIÓN PRINCIPAL
===================== */
/**
 * Función principal de inicialización
 * Usa el sistema de i18n existente sin duplicar lógica
 */
(async function initialize404Page() {
  try {
    // Usar el sistema existente de detección e inicialización
    const userLang = detectUserLanguage();
    const selectedLang = userLang || DEFAULT_LANG;
    
    // Cargar traducciones usando el sistema existente
    const translations = await loadLang(selectedLang);
    applyTranslations(translations);
    
    // Establecer idioma en el documento
    document.documentElement.lang = selectedLang;
    
    // Configurar funcionalidades específicas de la página 404
    setupNavigationButtons();
    logPageNotFound();
    
    if (DEBUG_MODE) console.log(`Página 404 inicializada en idioma: ${selectedLang}`);
    
  } catch (error) {
    if (DEBUG_MODE) console.error("Error al inicializar la página 404:", error);
    
    // Fallback simple - al menos configurar navegación
    setupNavigationButtons();
  }
})();

/* =====================
   NAVEGACIÓN Y BOTONES
===================== */
/**
 * Configura los botones de navegación de la página 404
 */
function setupNavigationButtons() {
  const goBackBtn = document.getElementById('go-back-btn');
  
  if (goBackBtn) {
    goBackBtn.addEventListener('click', handleGoBack);
    
    // Si no hay historial disponible, adaptar el comportamiento
    if (window.history.length <= 1) {
      goBackBtn.addEventListener('click', () => window.location.href = '/');
    }
  }
  
  // Registrar clicks en botón de inicio para analytics
  const homeBtn = document.querySelector('.btn-primary[href="/"]');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      logNavigationEvent('home_from_404');
    });
  }
}

/**
 * Maneja el evento de "volver atrás"
 */
function handleGoBack(event) {
  event.preventDefault();
  
  try {
    if (window.history.length > 1) {
      window.history.back();
      logNavigationEvent('back_from_404');
    } else {
      window.location.href = '/';
      logNavigationEvent('home_from_404_no_history');
    }
  } catch (error) {
    if (DEBUG_MODE) console.error("Error navegando:", error);
    window.location.href = '/';
  }
}

/* =====================
   LOGGING Y ANALYTICS
===================== */
/**
 * Registra el error 404 para monitoreo
 */
function logPageNotFound() {
  const errorInfo = {
    url: window.location.href,
    referrer: document.referrer || 'direct',
    userAgent: navigator.userAgent,
    language: document.documentElement.lang,
    timestamp: new Date().toISOString(),
    viewport: `${window.innerWidth}x${window.innerHeight}`
  };
  
  if (DEBUG_MODE) {
    console.group('📊 404 Error Info');
    console.table(errorInfo);
    console.groupEnd();
  }
  
  // Enviar a tu servicio de analytics si está configurado
  // Analytics.track('404_error', errorInfo);
  
  // Opcional: enviar a un endpoint para logging
  // fetch('/api/log/404', { method: 'POST', body: JSON.stringify(errorInfo) });
}

/**
 * Registra eventos de navegación desde la página 404
 */
function logNavigationEvent(action) {
  const eventData = {
    action,
    from_404: true,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };
  
  if (DEBUG_MODE) console.log(`🔄 Navegación 404:`, eventData);
  
  // Enviar a analytics
  // Analytics.track('404_navigation', eventData);
}

/* =====================
   EVENT LISTENERS GLOBALES
===================== */

// Escuchar cambios de idioma (tu sistema ya emite este evento)
document.addEventListener('languageChanged', (event) => {
  if (DEBUG_MODE) console.log('🌍 Idioma cambiado en 404:', event.detail.language);
});

// Manejar errores específicos de la página 404
window.addEventListener('error', (event) => {
  if (DEBUG_MODE) console.error('❌ Error en página 404:', event.error);
  
  logNavigationEvent('javascript_error_404');
});

/* =====================
   UTILIDADES PARA DESARROLLO
===================== */

// Exponer funciones útiles en modo debug
if (DEBUG_MODE) {
  window.debug404 = {
    logPageNotFound,
    logNavigationEvent,
    setupNavigationButtons,
    forceLanguage: async (lang) => {
      const translations = await loadLang(lang);
      applyTranslations(translations);
      document.documentElement.lang = lang;
    }
  };
  
  console.log('🔧 Funciones de debug 404 disponibles en window.debug404');
}