/**
 * utils.js - Funciones utilitarias
 * Proyecto: Super X Immersive Cards
 * 
 * Contiene funciones auxiliares para efectos visuales, geometría,
 * validación de recursos y funcionalidades de compartir.
 */

import { PARTICLE_SPAWN_DURATION } from "./config.js";

/* =====================
   SISTEMA DE PARTÍCULAS
===================== */

/**
 * Genera partículas visuales en una posición específica
 * @param {number} x - Posición X en píxeles
 * @param {number} y - Posición Y en píxeles
 * @param {HTMLElement} container - Contenedor donde crear las partículas
 * @param {Object} [options={}] - Opciones de personalización
 */
export function spawnParticles(x, y, container, options = {}) {
  if (!container || !container.appendChild) {
    console.warn('Contenedor de partículas inválido');
    return;
  }
  
  const config = {
    count: 5,
    minDistance: 20,
    maxDistance: 80,
    ...options
  };
  
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < config.count; i++) {
    const particle = createParticle(x, y, config);
    fragment.appendChild(particle);
    
    // Limpieza automática
    setTimeout(() => {
      if (particle.parentElement) {
        particle.parentElement.removeChild(particle);
      }
    }, PARTICLE_SPAWN_DURATION);
  }
  
  container.appendChild(fragment);
}

/**
 * Crea una partícula individual
 * @private
 */
function createParticle(x, y, config) {
  const particle = document.createElement("div");
  particle.className = "particle";
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  
  // Calcular dirección aleatoria
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * (config.maxDistance - config.minDistance) + config.minDistance;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  
  particle.style.setProperty("--dx", `${dx}px`);
  particle.style.setProperty("--dy", `${dy}px`);
  
  return particle;
}

/* =====================
   ROTACIÓN AUTOMÁTICA
===================== */

/**
 * Controla la rotación automática del modelo 3D
 * @param {HTMLElement} viewer - Elemento model-viewer
 * @param {Function} isEnabledFn - Función que retorna true para activar rotación
 * @param {number} [speed=0.0005] - Velocidad de rotación en radianes por milisegundo
 */
export function customAutoRotate(viewer, isEnabledFn, speed = 0.0005) {
  if (!viewer || typeof isEnabledFn !== 'function') {
    console.error('customAutoRotate: parámetros inválidos');
    return;
  }
  
  let lastTimestamp = null;
  let animationId = null;
  
  function rotate(timestamp) {
    // Verificar que model-viewer esté listo
    if (!isModelViewerReady(viewer)) {
      animationId = requestAnimationFrame(rotate);
      return;
    }
    
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    if (isEnabledFn()) {
      try {
        const orbit = viewer.getCameraOrbit();
        let newTheta = orbit.theta + delta * speed;
        
        // Normalizar ángulo para evitar overflow
        newTheta = normalizeRadians(newTheta);
        
        viewer.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
      } catch (error) {
        console.warn('Error en rotación automática:', error);
      }
    }
    
    animationId = requestAnimationFrame(rotate);
  }
  
  animationId = requestAnimationFrame(rotate);
  
  // Retornar función para detener la animación
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

// --- Función mejorada para detectar si el usuario está intentando hacer drag ---
function calculateDragDistance(startPos, currentPos) {
  if (!startPos || !currentPos) return 0;
  
  const deltaX = currentPos.x - startPos.x;
  const deltaY = currentPos.y - startPos.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// --- Función para obtener posición del evento (unified touch/mouse) ---
function getEventPosition(event) {
  return {
    x: event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0),
    y: event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0)
  };
}

/* =====================
   FUNCIONES GEOMÉTRICAS
===================== */

/**
 * Convierte grados a radianes
 * @param {number} degrees - Ángulo en grados
 * @returns {number} Ángulo en radianes
 */
export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convierte radianes a grados
 * @param {number} radians - Ángulo en radianes
 * @returns {number} Ángulo en grados
 */
export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Normaliza un ángulo en grados al rango [0, 360)
 * @param {number} degrees - Ángulo en grados
 * @returns {number} Ángulo normalizado
 */
export function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Normaliza un ángulo en radianes al rango [0, 2π)
 * @param {number} radians - Ángulo en radianes
 * @returns {number} Ángulo normalizado
 */
export function normalizeRadians(radians) {
  return ((radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Encuentra el ángulo de snap más cercano
 * @param {number} currentAngle - Ángulo actual en grados
 * @param {number[]} [snapAngles=[0, 180]] - Ángulos permitidos para snap
 * @returns {number} Ángulo de snap más cercano
 */
export function getClosestSnapAngle(currentAngle, snapAngles = [0, 180]) {
  const normalized = normalizeAngle(currentAngle);
  
  return snapAngles.reduce((closest, angle) => {
    const distance = Math.abs(normalized - angle);
    const wrappedDistance = Math.abs(normalized - (angle + 360));
    const minDistance = Math.min(distance, wrappedDistance);
    
    const closestDistance = Math.abs(normalized - closest);
    const closestWrappedDistance = Math.abs(normalized - (closest + 360));
    const minClosestDistance = Math.min(closestDistance, closestWrappedDistance);
    
    return minDistance < minClosestDistance ? angle : closest;
  });
}

/* =====================
   CONTROL DEL MODEL-VIEWER
===================== */

/**
 * Verifica si model-viewer está listo para usar
 * @param {HTMLElement} viewer - Elemento model-viewer
 * @returns {boolean} True si está listo
 */
export function isModelViewerReady(viewer) {
  return (
    viewer &&
    typeof window.customElements !== 'undefined' &&
    window.customElements.get('model-viewer') &&
    typeof viewer.getCameraOrbit === 'function'
  );
}

/**
 * Realiza snap de la cámara al lado más cercano
 * @param {HTMLElement} viewer - Elemento model-viewer
 * @param {number[]} [snapAngles] - Ángulos permitidos para snap
 */
export function snapToNearestSide(viewer, snapAngles) {
  if (!isModelViewerReady(viewer)) {
    console.warn('Model-viewer no está listo para snap');
    return;
  }
  
  try {
    const orbit = viewer.getCameraOrbit();
    if (!orbit) return;
    
    const currentDegrees = radToDeg(orbit.theta);
    const targetDegrees = getClosestSnapAngle(currentDegrees, snapAngles);
    
    // Mantener phi en 90° (horizontal) y el radio actual
    viewer.cameraOrbit = `${targetDegrees}deg 90deg ${orbit.radius}m`;
    
  } catch (error) {
    console.error('Error en snapToNearestSide:', error);
  }
}

/* =====================
   VALIDACIÓN DE RECURSOS
===================== */

/**
 * Valida que un recurso esté disponible
 * @param {string} url - URL del recurso
 * @param {string} [resourceType='resource'] - Tipo de recurso para logging
 * @param {number} [timeout=5000] - Timeout en milisegundos
 * @returns {Promise<boolean>} True si el recurso está disponible
 */
export async function validateResource(url, resourceType = 'resource', timeout = 5000) {
  if (!url || typeof url !== 'string') {
    console.error(`URL inválida para ${resourceType}:`, url);
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`✓ ${resourceType} validado: ${url}`);
      return true;
    } else {
      console.warn(`✗ ${resourceType} no disponible (${response.status}): ${url}`);
      return false;
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Timeout validando ${resourceType}: ${url}`);
    } else {
      console.error(`Error validando ${resourceType}: ${url}`, error);
    }
    return false;
  }
}

/* =====================
   SISTEMA DE COMPARTIR
===================== */

/**
 * Obtiene la imagen para compartir
 * @param {string} sharePath - Path de la imagen de share
 * @returns {Promise<Blob|null>} Blob de la imagen o null si no existe
 */
export async function getCardShareImage(sharePath) {
  try {
    const response = await fetch(sharePath);
    
    if (response.ok) {
      return await response.blob();
    }
    
    return null;
    
  } catch (error) {
    console.warn('Imagen no disponible:', error.message);
    return null;
  }
}

/**
 * Intenta compartir usando la Web Share API nativa
 * @param {Blob} imageBlob - Imagen a compartir
 * @param {string} text - Texto genérico para compartir
 * @returns {Promise<boolean>} True si se compartió exitosamente
 */
export async function tryNativeShare(imageBlob, text) {
  if (!navigator.share) {
    console.log('Web Share API no disponible');
    return false;
  }
  
  try {
    const file = new File([imageBlob], 'super-x-card.png', { type: 'image/png' });
    
    await navigator.share({
      text: text,
      files: [file]
    });
    
    return true;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Share cancelado por el usuario');
    } else {
      console.log('Error en share nativo:', error.message);
    }
    return false;
  }
}

/**
 * Intenta copiar imagen al clipboard
 * @param {Blob} imageBlob - Imagen a copiar
 * @returns {Promise<boolean>} True si se copió exitosamente
 */
export async function copyImageToClipboard(imageBlob) {
  if (!navigator.clipboard?.write) {
    console.log('Clipboard API no disponible');
    return false;
  }
  
  try {
    const clipboardItem = new ClipboardItem({
      [imageBlob.type]: imageBlob
    });
    
    await navigator.clipboard.write([clipboardItem]);
    console.log('Imagen copiada al clipboard');
    return true;
    
  } catch (error) {
    console.log('Error copiando al clipboard:', error.message);
    return false;
  }
}

/**
 * Descarga imagen como último recurso
 * @param {Blob} imageBlob - Imagen a descargar
 * @param {string} filename - Nombre del archivo
 */
export function downloadImage(imageBlob, filename) {
  try {
    const url = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpiar URL después de un tiempo
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    console.log(`Imagen descargada: ${filename}`);
    
  } catch (error) {
    console.error('Error descargando imagen:', error);
  }
}

/* =====================
   DETECCIÓN DE PLATAFORMAS Y DISPOSITIVOS
===================== */

/**
 * Detecta la plataforma o aplicación desde la que se accede
 * @returns {string} Plataforma detectada
 */
export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  // Detección de aplicaciones específicas
  if (userAgent.includes('instagram')) return 'instagram';
  if (userAgent.includes('tiktok')) return 'tiktok';
  if (userAgent.includes('twitter') || userAgent.includes('x.com')) return 'twitter';
  if (userAgent.includes('facebook')) return 'facebook';
  if (userAgent.includes('whatsapp')) return 'whatsapp';
  if (userAgent.includes('linkedin')) return 'linkedin';
  if (userAgent.includes('telegram')) return 'telegram';
  
  // Detección de sistemas operativos
  if (platform.includes('iphone') || platform.includes('ipad') || userAgent.includes('ios')) return 'ios';
  if (platform.includes('android') || userAgent.includes('android')) return 'android';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';
  
  return 'web';
}

/**
 * Verifica si el dispositivo soporta funcionalidades específicas
 * @returns {Object} Objeto con capacidades del dispositivo
 */
export function getDeviceCapabilities() {
  return {
    hasTouch: 'ontouchstart' in window,
    hasVibration: 'vibrate' in navigator,
    hasClipboard: !!navigator.clipboard,
    hasShareAPI: !!navigator.share,
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    supportsWebGL: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch (e) {
        return false;
      }
    })()
  };
}

/* =====================
   FUNCIONES AUXILIARES
===================== */

/**
 * Activa vibración háptica en dispositivos compatibles
 * @param {number} [duration=50] - Duración en milisegundos
 */
export function triggerHapticFeedback(duration = 50) {
  if (!getDeviceCapabilities().hasVibration) return;
  
  try {
    navigator.vibrate(duration);
  } catch (error) {
    console.debug('Vibración no disponible:', error);
  }
}

/**
 * Muestra una notificación temporal en pantalla
 * @param {string} message - Mensaje a mostrar
 * @param {string} [type='info'] - Tipo: 'info', 'success', 'error', 'warning'
 * @param {number} [duration=3000] - Duración en milisegundos
 */
export function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Estilos base
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-100%)',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '10000',
    minWidth: '200px',
    maxWidth: '90vw',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'all 0.3s ease',
    opacity: '0'
  });
  
  // Colores según tipo
  const colors = {
    info: { bg: '#3498db', text: '#ffffff' },
    success: { bg: '#2ecc71', text: '#ffffff' },
    error: { bg: '#e74c3c', text: '#ffffff' },
    warning: { bg: '#f39c12', text: '#ffffff' }
  };
  
  const colorScheme = colors[type] || colors.info;
  notification.style.backgroundColor = colorScheme.bg;
  notification.style.color = colorScheme.text;
  
  document.body.appendChild(notification);
  
  // Animación de entrada
  requestAnimationFrame(() => {
    notification.style.transform = 'translateX(-50%) translateY(0)';
    notification.style.opacity = '1';
  });
  
  // Animación de salida y limpieza
  setTimeout(() => {
    notification.style.transform = 'translateX(-50%) translateY(-100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

export function displayError(message) { showNotification(message, 'error'); }
export function displayWarning(message) { showNotification(message, 'warning'); }
export function displaySuccess(message) { showNotification(message, 'success'); }
export function displayInfo(message) { showNotification(message, 'info'); }

/**
 * Debounce function para limitar ejecuciones frecuentes
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función debounced
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function para limitar ejecuciones por tiempo
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función throttled
 */
export function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function executedFunction(...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };

}
