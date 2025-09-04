/**
 * index.js - Script principal para index.html
 * Proyecto: Super X Immersive Cards
 * 
 * Maneja la inicialización de la página principal con carga de traducciones
 * y configuración básica del sistema de internacionalización.
 */

import { loadLang, applyTranslations, detectUserLanguage } from "./lang.js";
import { DEFAULT_LANG, DEBUG_MODE } as config from "./config.js";

/* =====================
   INICIALIZACIÓN PRINCIPAL
===================== */

/**
 * Función principal de inicialización
 * Se ejecuta automáticamente al cargar el módulo
 */
(async function initializeIndexPage() {
  try {
    // Detectar idioma preferido del usuario
    const userLang = detectUserLanguage();
    const selectedLang = userLang || config.DEFAULT_LANG;
    
    // Cargar y aplicar traducciones
    const translations = await loadLang(selectedLang);
    applyTranslations(translations);
    
    // Establecer atributo lang en el documento
    document.documentElement.lang = selectedLang;
    
    if (config.DEBUG_MODE) console.log(`Página de inicio inicializada en idioma: ${selectedLang}`);
    
  } catch (error) {
    if (config.DEBUG_MODE) console.error("Error al inicializar la página de inicio:", error);
    
    // Fallback: intentar cargar idioma por defecto si falla el detectado
    try {
      const fallbackTranslations = await loadLang(config.DEFAULT_LANG);
      applyTranslations(fallbackTranslations);
      document.documentElement.lang = config.DEFAULT_LANG;
      
      if (config.DEBUG_MODE) console.warn(`Fallback aplicado: idioma ${config.DEFAULT_LANG}`);
      
    } catch (fallbackError) {
      if (config.DEBUG_MODE) console.error("Error crítico cargando idioma por defecto:", fallbackError);
      
      // Mostrar mensaje de error básico si todo falla
      showCriticalError();
    }
  }
})();

/* =====================
   FUNCIONES AUXILIARES
===================== */

/**
 * Muestra un mensaje de error crítico cuando falla la carga de traducciones
 * @private
 */
function showCriticalError() {
  const mainElement = document.getElementById('index_main');
  
  if (mainElement) {
    mainElement.innerHTML = `
      <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
        <h1>Error Loading Application</h1>
        <p>Please refresh the page or try again later.</p>
        <p style="font-size: 0.9em; opacity: 0.8; margin-top: 1rem;">
          Error al cargar la aplicación. Por favor recarga la página.
        </p>
      </div>
    `;
  }
}

/* =====================
   CONFIGURACIÓN DE EVENTOS DEL DOCUMENTO
===================== */

// Escuchar cambios de idioma dinámicos (si se implementa en el futuro)
document.addEventListener('languageChanged', (event) => {
  if (config.DEBUG_MODE) console.log('Idioma cambiado a:', event.detail.language);
});

// Manejar errores no capturados relacionados con la página
window.addEventListener('error', (event) => {
  if (config.DEBUG_MODE) console.error('Error no capturado en index:', event.error);
});

// Manejar promesas rechazadas no capturadas
window.addEventListener('unhandledrejection', (event) => {
  if (config.DEBUG_MODE) console.error('Promesa rechazada no manejada en index:', event.reason);
});