/**
 * utils.js - Funciones utilitarias puras
 * Proyecto: Super X Immersive Cards
 * 
 * Biblioteca de funciones auxiliares sin dependencias externas.
 * Todas las configuraciones se pasan como parámetros.
 */

/* =====================
   SISTEMA DE PARTÍCULAS
===================== */

/**
 * Genera partículas visuales en una posición específica
 * @param {number} x - Posición X en píxeles
 * @param {number} y - Posición Y en píxeles
 * @param {HTMLElement} container - Contenedor donde crear las partículas
 * @param {Object} config - Configuración completa de partículas
 * @param {number} [config.count=5] - Número de partículas
 * @param {number} [config.minDistance=20] - Distancia mínima
 * @param {number} [config.maxDistance=80] - Distancia máxima
 * @param {number} [config.duration=2000] - Duración antes de limpiar
 */
export function spawnParticles(x, y, container, config = {}) {
  if (!container?.appendChild) {
    console.warn('Contenedor de partículas inválido');
    return;
  }
  
  const settings = {
    count: 5,
    minDistance: 20,
    maxDistance: 80,
    duration: 2000,
    ...config
  };
  
  const fragment = document.createDocumentFragment();
  const particles = [];
  
  for (let i = 0; i < settings.count; i++) {
    const particle = createParticle(x, y, settings);
    fragment.appendChild(particle);
    particles.push(particle);
  }
  
  container.appendChild(fragment);
  
  // Limpieza automática
  setTimeout(() => {
    particles.forEach(particle => particle.remove());
  }, settings.duration);
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
 * @param {Object} config - Configuración de rotación
 * @param {number} [config.speed=0.0005] - Velocidad de rotación
 * @param {boolean} [config.normalizeAngle=true] - Si normalizar ángulos
 */
export function customAutoRotate(viewer, isEnabledFn, config = {}) {
  if (!viewer || typeof isEnabledFn !== 'function') {
    console.error('customAutoRotate: parámetros inválidos');
    return;
  }
  
  const settings = {
    speed: 0.0005,
    normalizeAngle: true,
    ...config
  };
  
  let lastTimestamp = null;
  let animationId = null;
  
  function rotate(timestamp) {
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
        let newTheta = orbit.theta + delta * settings.speed;
        
        if (settings.normalizeAngle) {
          newTheta = normalizeRadians(newTheta);
        }
        
        viewer.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
      } catch (error) {
        console.warn('Error en rotación automática:', error);
      }
    }
    
    animationId = requestAnimationFrame(rotate);
  }
  
  animationId = requestAnimationFrame(rotate);
  
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

/**
 * Calcula la distancia de arrastre entre dos puntos
 */
export function calculateDragDistance(startPos, currentPos) {
  if (!startPos || !currentPos) return 0;
  
  const deltaX = currentPos.x - startPos.x;
  const deltaY = currentPos.y - startPos.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Obtiene posición unificada de evento (touch/mouse)
 */
export function getEventPosition(event) {
  return {
    x: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
    y: event.clientY ?? event.touches?.[0]?.clientY ?? 0
  };
}

/* =====================
   FUNCIONES GEOMÉTRICAS
===================== */

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Normaliza un ángulo al rango especificado
 * @param {number} angle - Ángulo a normalizar
 * @param {number} [min=0] - Valor mínimo
 * @param {number} [max=360] - Valor máximo
 */
export function normalizeAngle(angle, min = 0, max = 360) {
  return ((angle % max) + max) % max;
}

/**
 * Normaliza un ángulo en radianes al rango especificado
 * @param {number} radians - Ángulo en radianes
 * @param {number} [min=0] - Valor mínimo
 * @param {number} [max=2π] - Valor máximo
 */
export function normalizeRadians(radians, min = 0, max = 2 * Math.PI) {
  return ((radians % max) + max) % max;
}

/**
 * Encuentra el ángulo de snap más cercano
 * @param {number} currentAngle - Ángulo actual
 * @param {number[]} snapAngles - Ángulos permitidos para snap
 * @param {number} [maxRange=360] - Rango máximo para cálculos
 */
export function getClosestSnapAngle(currentAngle, snapAngles, maxRange = 360) {
  const normalized = normalizeAngle(currentAngle, 0, maxRange);
  
  return snapAngles.reduce((closest, angle) => {
    const distance = Math.abs(normalized - angle);
    const wrappedDistance = Math.abs(normalized - (angle + maxRange));
    const minDistance = Math.min(distance, wrappedDistance);
    
    const closestDistance = Math.abs(normalized - closest);
    const closestWrappedDistance = Math.abs(normalized - (closest + maxRange));
    const minClosestDistance = Math.min(closestDistance, closestWrappedDistance);
    
    return minDistance < minClosestDistance ? angle : closest;
  });
}

/* =====================
   CONTROL DEL MODEL-VIEWER
===================== */

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
 * @param {Object} config - Configuración de snap
 * @param {number[]} [config.snapAngles=[0, 180]] - Ángulos de snap
 * @param {number} [config.defaultPhi=90] - Ángulo phi por defecto
 */
export function snapToNearestSide(viewer, config = {}) {
  const settings = {
    snapAngles: [0, 180],
    defaultPhi: 90,
    ...config
  };
  
  if (!isModelViewerReady(viewer)) {
    console.warn('Model-viewer no está listo para snap');
    return;
  }
  
  try {
    const orbit = viewer.getCameraOrbit();
    if (!orbit) return;
    
    const currentDegrees = radToDeg(orbit.theta);
    const targetDegrees = getClosestSnapAngle(currentDegrees, settings.snapAngles);
    
    viewer.cameraOrbit = `${targetDegrees}deg ${settings.defaultPhi}deg ${orbit.radius}m`;
    
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
 * @param {Object} config - Configuración de validación
 * @param {string} [config.resourceType='resource'] - Tipo de recurso
 * @param {number} [config.timeout=5000] - Timeout en ms
 * @param {string} [config.method='HEAD'] - Método HTTP
 */
export async function validateResource(url, config = {}) {
  const settings = {
    resourceType: 'resource',
    timeout: 5000,
    method: 'HEAD',
    ...config
  };
  
  if (!url || typeof url !== 'string') {
    console.error(`URL inválida para ${settings.resourceType}:`, url);
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.timeout);
    
    const response = await fetch(url, { 
      method: settings.method,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`✓ ${settings.resourceType} validado: ${url}`);
      return true;
    } else {
      console.warn(`✗ ${settings.resourceType} no disponible (${response.status}): ${url}`);
      return false;
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Timeout validando ${settings.resourceType}: ${url}`);
    } else {
      console.error(`Error validando ${settings.resourceType}: ${url}`, error);
    }
    return false;
  }
}

/* =====================
   SISTEMA DE COMPARTIR
===================== */

export async function getCardShareImage(sharePath) {
  try {
    const response = await fetch(sharePath);
    return response.ok ? await response.blob() : null;
  } catch (error) {
    console.warn('Imagen no disponible:', error.message);
    return null;
  }
}

export async function tryNativeShare(imageBlob, text, filename = 'image.png') {
  if (!navigator.share) {
    console.log('Web Share API no disponible');
    return false;
  }
  
  try {
    const file = new File([imageBlob], filename, { type: 'image/png' });
    await navigator.share({ text, files: [file] });
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

export async function copyImageToClipboard(imageBlob) {
  if (!navigator.clipboard?.write) {
    console.log('Clipboard API no disponible');
    return false;
  }
  
  try {
    const clipboardItem = new ClipboardItem({ [imageBlob.type]: imageBlob });
    await navigator.clipboard.write([clipboardItem]);
    console.log('Imagen copiada al clipboard');
    return true;
  } catch (error) {
    console.log('Error copiando al clipboard:', error.message);
    return false;
  }
}

/**
 * Descarga imagen con configuración de limpieza
 * @param {Blob} imageBlob - Imagen a descargar
 * @param {string} filename - Nombre del archivo
 * @param {number} [cleanupDelay=1000] - Delay antes de limpiar URL
 */
export function downloadImage(imageBlob, filename, cleanupDelay = 1000) {
  try {
    const url = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), cleanupDelay);
    console.log(`Imagen descargada: ${filename}`);
    
  } catch (error) {
    console.error('Error descargando imagen:', error);
  }
}

/* =====================
   DETECCIÓN DE PLATAFORMAS Y DISPOSITIVOS
===================== */

/**
 * Detecta la plataforma usando mapas de detección personalizables
 * @param {Object} config - Configuración de detección
 * @param {Array} [config.apps] - Array de [keyword, platform] para apps
 * @param {Array} [config.os] - Array de [regex, os] para sistemas
 * @param {string} [config.fallback='web'] - Valor por defecto
 */
export function detectPlatform(config = {}) {
  const settings = {
    apps: [
      ['instagram', 'instagram'],
      ['tiktok', 'tiktok'],
      ['twitter', 'twitter'],
      ['x.com', 'twitter'],
      ['facebook', 'facebook'],
      ['whatsapp', 'whatsapp'],
      ['linkedin', 'linkedin'],
      ['telegram', 'telegram']
    ],
    os: [
      [/iphone|ipad|ios/i, 'ios'],
      [/android/i, 'android'],
      [/mac/i, 'macos'],
      [/win/i, 'windows'],
      [/linux/i, 'linux']
    ],
    fallback: 'web',
    ...config
  };
  
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  // Detección de aplicaciones
  for (const [keyword, platformName] of settings.apps) {
    if (userAgent.includes(keyword)) return platformName;
  }
  
  // Detección de sistemas operativos
  for (const [regex, osName] of settings.os) {
    if (regex.test(userAgent + platform)) return osName;
  }
  
  return settings.fallback;
}

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
 * Activa vibración háptica configurable
 * @param {Object} config - Configuración de vibración
 * @param {number|Array} [config.pattern=50] - Patrón de vibración
 * @param {boolean} [config.enabled=true] - Si está habilitada
 */
export function triggerHapticFeedback(config = {}) {
  const settings = {
    pattern: 50,
    enabled: true,
    ...config
  };
  
  const capabilities = getDeviceCapabilities();
  if (!capabilities.hasVibration || !settings.enabled) return;
  
  try {
    navigator.vibrate(settings.pattern);
  } catch (error) {
    console.debug('Vibración no disponible:', error);
  }
}

/**
 * Sistema de notificaciones completamente configurable
 * @param {string} message - Mensaje a mostrar
 * @param {Object} config - Configuración completa de la notificación
 */
export function showNotification(message, config = {}) {
  const settings = {
    type: 'info',
    duration: 3000,
    position: { top: '20px', left: '50%' },
    styles: {
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: 10000,
      minWidth: '200px',
      maxWidth: '90vw',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'all 0.3s ease'
    },
    colors: {
      info: { bg: '#3498db', text: '#ffffff' },
      success: { bg: '#2ecc71', text: '#ffffff' },
      error: { bg: '#e74c3c', text: '#ffffff' },
      warning: { bg: '#f39c12', text: '#ffffff' }
    },
    animation: { duration: 300 },
    removeExisting: true,
    ...config
  };
  
  // Remover notificación existente si se especifica
  if (settings.removeExisting) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${settings.type}`;
  notification.textContent = message;
  
  // Aplicar estilos
  const baseStyles = {
    position: 'fixed',
    ...settings.styles,
    ...settings.position,
    transform: 'translateX(-50%) translateY(-100%)',
    opacity: '0'
  };
  
  Object.assign(notification.style, baseStyles);
  
  // Colores
  const colorScheme = settings.colors[settings.type] || settings.colors.info;
  notification.style.backgroundColor = colorScheme.bg;
  notification.style.color = colorScheme.text;
  
  document.body.appendChild(notification);
  
  // Animaciones
  requestAnimationFrame(() => {
    notification.style.transform = 'translateX(-50%) translateY(0)';
    notification.style.opacity = '1';
  });
  
  setTimeout(() => {
    notification.style.transform = 'translateX(-50%) translateY(-100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, settings.animation.duration);
  }, settings.duration);
}

/**
 * Debounce genérico
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
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
 * Throttle genérico
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}