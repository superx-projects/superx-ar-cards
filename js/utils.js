
/**
 * Genera partículas visuales en una posición (x,y) dentro de un contenedor dado.
 * Para animaciones breves y efecto visual de "sparkles" o "explosión".
 */
export function spawnParticles(x, y, container) {
  for (let i = 0; i < 5; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;

    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * 60 + 20;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);

    container.appendChild(particle);

    setTimeout(() => {
      if (particle.parentElement) {
        container.removeChild(particle);
      }
    }, 600);
  }
}

/**
 * Realiza rotación automática suave en el modelo 3D siempre que isEnabledFn() retorne true.
 * @param {HTMLElement} viewer - el elemento <model-viewer>
 * @param {Function} isEnabledFn - función que devuelve true para activar rotación automática
 * @param {number} speed - velocidad de rotación en rad/ms (por defecto 0.0005)
 */
export function customAutoRotate(viewer, isEnabledFn, speed = 0.0005) {
  let lastTimestamp = null;

  function rotate(timestamp) {
    if (!viewer.getCameraOrbit) {
      requestAnimationFrame(rotate);
      return;
    }

    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (isEnabledFn()) {
      const orbit = viewer.getCameraOrbit();
      let newTheta = orbit.theta + delta * speed;

      // Normalizar el valor de theta entre 0 y 2π para evitar overflow
      newTheta = ((newTheta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      viewer.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;
    }

    requestAnimationFrame(rotate);
  }

  requestAnimationFrame(rotate);
}

/* ================================
   FUNCIONES PARA EL "SNAP" DE ROTACIÓN
================================ */

/**
 * Convierte grados a radianes.
 * @param {number} deg - grados
 * @returns {number} radianes
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convierte radianes a grados.
 * @param {number} rad - radianes
 * @returns {number} grados
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Normaliza ángulo en grados para estar siempre en rango [0,360).
 * @param {number} deg
 * @returns {number}
 */
export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Devuelve el ángulo objetivo (en grados) más cercano para el snap: 0° o 180°.
 * @param {number} deg - ángulo actual normalizado
 * @returns {number} - ángulo snap (0 o 180)
 */
export function getSnapAngle(deg) {
  return deg > 90 && deg < 270 ? 180 : 0;
}

/**
 * Realiza el snap de la cámara al lado más cercano (frontal o posterior)
 * para que la carta quede derecha y bien orientada.
 * @param {HTMLElement} viewer - <model-viewer>
 */
export function snapToNearestSide(viewer) {
  if (!viewer || typeof viewer.getCameraOrbit !== 'function') {
    console.warn('Model-viewer no está listo para snap');
    return;
  }

  try {
    const orbit = viewer.getCameraOrbit();
    if (!orbit) return;
    
    const thetaDeg = radToDeg(orbit.theta);
    const normalized = normalizeAngle(thetaDeg);
    const targetDeg = getSnapAngle(normalized);

    // Se fija phi (elevación) a 90 grados (horizontal),
    // toma el orbit.radius para mantener el zoom actual
    viewer.cameraOrbit = `${targetDeg}deg 90deg ${orbit.radius}m`;
  } catch (error) {
    console.error('Error en snapToNearestSide:', error);
  }
}

/**
 * Valida que un recurso (imagen, video, modelo 3D, etc.) esté disponible
 * @param {string} url - URL del recurso a validar
 * @param {string} resourceType - Tipo de recurso (para logging)
 * @returns {Promise<boolean>} - true si el recurso está disponible
 */
export async function validateResource(url, resourceType) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error(`Error validando ${resourceType}: ${url}`, error);
    return false;
  }
}

/* ================================
   FUNCIONES PARA COMPARTIR EN REDES SOCIALES
================================ */

/**
 * Captura una imagen del modelo 3D en el canvas
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} config - configuración de captura
 * @returns {Promise<Blob>} - imagen como blob
 */
export async function captureModelScreenshot(viewer, config) {
  return new Promise((resolve, reject) => {
    try {
      // Crear canvas para la captura
      const canvas = document.createElement('canvas');
      canvas.width = config.captureWidth;
      canvas.height = config.captureHeight;
      const ctx = canvas.getContext('2d');

      // Fondo transparente o negro
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Obtener la imagen del model-viewer
      viewer.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la captura del modelo'));
          return;
        }

        const img = new Image();
        img.onload = () => {
          // Centrar y escalar la imagen del modelo
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = (canvas.width - scaledWidth) / 2;
          const y = (canvas.height - scaledHeight) / 2;

          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

          // Agregar marca de agua (opcional)
          addWatermark(ctx, canvas, config);

          // Convertir canvas a blob
          canvas.toBlob(resolve, config.screenshotFormat, config.screenshotQuality);
        };

        img.onerror = () => reject(new Error('Error al procesar la imagen del modelo'));
        img.src = URL.createObjectURL(blob);
      }, config.screenshotFormat, config.screenshotQuality);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Agrega una marca de agua sutil al canvas
 * @param {CanvasRenderingContext2D} ctx - contexto del canvas
 * @param {HTMLCanvasElement} canvas - elemento canvas
 * @param {Object} config - configuración
 */
function addWatermark(ctx, canvas, config) {
  // Configurar estilo de texto para marca de agua
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  
  // Texto de la marca de agua
  const watermarkText = config.storeName || 'Super X Cards';
  const fontSize = Math.max(canvas.width * 0.04, 24);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  
  // Posicionar en la parte inferior
  const x = canvas.width / 2;
  const y = canvas.height - fontSize - 20;
  
  // Dibujar texto con contorno
  ctx.strokeText(watermarkText, x, y);
  ctx.fillText(watermarkText, x, y);
  
  ctx.restore();
}

/**
 * Prepara y posiciona el modelo para la captura óptima
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} config - configuración de captura
 * @returns {Promise<void>}
 */
export async function prepareModelForCapture(viewer, config) {
  return new Promise((resolve) => {
    // Guardar posición actual
    const currentOrbit = viewer.getCameraOrbit();
    
    // Establecer posición óptima para captura
    viewer.cameraOrbit = config.optimalCameraPosition;
    
    // Esperar un momento para que se estabilice
    setTimeout(() => {
      resolve(currentOrbit);
    }, config.captureDelay);
  });
}

/**
 * Restaura la posición original del modelo
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} originalOrbit - órbita original de la cámara
 */
export function restoreModelPosition(viewer, originalOrbit) {
  if (originalOrbit) {
    viewer.cameraOrbit = `${originalOrbit.theta}rad ${originalOrbit.phi}rad ${originalOrbit.radius}m`;
  }
}

/**
 * Genera el texto para compartir en redes sociales
 * @param {string} cardTitle - título de la carta
 * @param {Object} config - configuración de compartir
 * @param {Object} translations - traducciones
 * @returns {string} - texto formateado para compartir
 */
export function generateShareText(cardTitle, config, translations) {
  let baseText = translations.share_text
    .replace('{storeName}', config.storeName)
    .replace('{instagramHandle}', config.instagramHandle);
  
  const hashtags = config.hashtags.map(tag => `#${tag}`).join(' ');
  
  // Estructura optimizada para diferentes redes sociales
  return `${baseText}\n\n🎯 ${cardTitle}\n\n${hashtags}`;
}

/**
 * Genera texto específico para Instagram Stories
 * @param {string} cardTitle - título de la carta
 * @param {Object} config - configuración de compartir
 * @param {Object} translations - traducciones
 * @returns {string} - texto optimizado para Stories
 */
export function generateInstagramStoriesText(cardTitle, config, translations) {
  // Formato más corto y directo para Stories
  const baseText = translations.share_text
    .replace('{storeName}', config.storeName)
    .replace('{instagramHandle}', config.instagramHandle);
  
  return `${baseText}\n\n🎯 ${cardTitle}`;
}

/**
 * Detecta si el usuario está en una app específica o navegador
 * @returns {string} - plataforma detectada
 */
export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('instagram')) return 'instagram';
  if (userAgent.includes('tiktok')) return 'tiktok';  
  if (userAgent.includes('twitter') || userAgent.includes('x.com')) return 'twitter';
  if (userAgent.includes('whatsapp')) return 'whatsapp';
  
  return 'generic';
}

/**
 * Intenta usar la API nativa de compartir del navegador
 * @param {Blob} imageBlob - imagen a compartir
 * @param {string} text - texto para compartir
 * @param {string} title - título para compartir
 * @returns {Promise<boolean>} - true si se pudo compartir nativamente
 */
export async function tryNativeShare(imageBlob, text, title) {
  if (!navigator.share) {
    return false;
  }

  try {
    const file = new File([imageBlob], 'super-x-card.png', { type: 'image/png' });
    
    const shareData = {
      title: title,
      text: text,
      files: [file]
    };

    // Verificar si el navegador puede compartir archivos
    if (navigator.canShare && !navigator.canShare(shareData)) {
      return false;
    }

    await navigator.share(shareData);
    return true;
  } catch (error) {
    console.debug('Error en compartir nativo:', error);
    return false;
  }
}

/**
 * Fallback: copia la imagen al clipboard
 * @param {Blob} imageBlob - imagen a copiar
 * @returns {Promise<boolean>} - true si se pudo copiar
 */
export async function copyImageToClipboard(imageBlob) {
  if (!navigator.clipboard || !navigator.clipboard.write) {
    return false;
  }

  try {
    const clipboardItem = new ClipboardItem({
      'image/png': imageBlob
    });
    
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (error) {
    console.debug('Error copiando al clipboard:', error);
    return false;
  }
}

/**
 * Crea un enlace de descarga como último recurso
 * @param {Blob} imageBlob - imagen a descargar
 * @param {string} filename - nombre del archivo
 */
export function downloadImage(imageBlob, filename = 'super-x-card.png') {
  const url = URL.createObjectURL(imageBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Limpiar URL después de un tiempo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
