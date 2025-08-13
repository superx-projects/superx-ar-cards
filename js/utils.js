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
   FUNCIONES PARA COMPARTIR CARTAS
================================ */

/**
 * Obtiene la imagen pre-renderizada para compartir
 * @param {string} cardId - ID de la carta
 * @param {Object} shareConfig - configuración del share
 * @returns {Promise<Blob>} - blob de la imagen pre-renderizada
 */
export async function getShareImage(sharePath, shareConfig = {}) {
  try {
    // Cargar la imagen
    const response = await fetch(sharePath);
    
    if (!response.ok) {
      throw new Error(`Share image not found: ${sharePath}`);
    }
    
    const imageBlob = await response.blob();
    return imageBlob;
    
  } catch (error) {
    console.error('Error loading share image:', error);
    throw error;
  }
}

/**
 * Función de respaldo: genera imagen placeholder si no existe la imagen específica
 * @param {string} cardTitle - título de la carta
 * @param {Object} shareConfig - configuración del share
 * @returns {Promise<Blob>} - blob de imagen placeholder
 */
export async function generatePlaceholderShareImage(cardTitle, shareConfig = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Crear un canvas simple con texto
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Configurar tamaño
      canvas.width = shareConfig.width || 800;
      canvas.height = shareConfig.height || 800;
      
      // Fondo
      ctx.fillStyle = shareConfig.backgroundColor || '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Gradiente de fondo
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Texto principal
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Título de la carta
      const lines = wrapText(ctx, cardTitle, canvas.width - 100, 48);
      const startY = canvas.height / 2 - (lines.length * 30);
      
      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + (index * 60));
      });
      
      // Subtítulo
      ctx.font = '32px Arial, sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.fillText('3D Card Experience', canvas.width / 2, canvas.height - 100);
      
      // Convertir a blob
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Error generating placeholder image'));
          }
        },
        shareConfig.imageFormat || 'image/png',
        shareConfig.imageQuality || 0.9
      );
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function para dividir texto en líneas
 */
function wrapText(ctx, text, maxWidth, fontSize) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Función principal para obtener imagen de share (con fallback)
 * @param {string} cardId - ID de la carta
 * @param {string} cardTitle - título de la carta (para fallback)
 * @param {Object} shareConfig - configuración del share
 * @returns {Promise<Blob>} - blob de la imagen para compartir
 */
export async function getCardShareImage(cardId, cardTitle, shareConfig = {}) {
  try {
    // Intentar obtener la imagen pre-renderizada
    return await getShareImage(cardId, shareConfig);
  } catch (error) {
    console.warn(`Share image not found for card ${cardId}, using placeholder:`, error);
    
    if (shareConfig.allowPlaceholder !== false) {
      // Generar imagen placeholder
      return await generatePlaceholderShareImage(cardTitle, shareConfig);
    } else {
      throw error;
    }
  }
}

/**
 * Obtiene el handle específico para la plataforma detectada
 * @param {string} platform - plataforma detectada
 * @param {Object} shareConfig - configuración del share
 * @returns {string} - handle específico para la plataforma
 */
export function getPlatformHandle(platform, shareConfig) {
  const socialHandles = shareConfig?.socialHandles || {};
  return socialHandles[platform] || socialHandles.default || '';
}

/**
 * Genera texto optimizado para la plataforma específica
 * @param {string} cardTitle - título de la carta
 * @param {Object} shareConfig - configuración del share
 * @param {Object} translations - traducciones
 * @param {string} platform - plataforma específica
 * @returns {string} - texto optimizado para la plataforma
 */
export function generatePlatformSpecificText(cardTitle, shareConfig, translations, platform) {
  const hashtags = shareConfig?.hashtags || [];
  const storeHandle = getPlatformHandle(platform, shareConfig);
  
  // Intentar obtener texto específico para la plataforma
  const platformKey = `share_${platform}_text`;
  let shareText = translations[platformKey] || translations.share_text || '';
  
  // Reemplazar variables en el texto
  shareText = shareText.replace('{cardTitle}', cardTitle);
  shareText = shareText.replace('{storeHandle}', storeHandle);
  
  // Para algunas plataformas, agregar hashtags
  const hashtagText = hashtags.join(' ');
  
  // Instagram y Twitter suelen usar hashtags más frecuentemente
  if (platform === 'instagram' || platform === 'twitter') {
    return `${shareText}\n\n${hashtagText}`;
  }
  
  // Facebook y WhatsApp pueden o no usar hashtags según preferencia
  return shareText;
}

/**
 * Genera texto para compartir en redes sociales
 * @param {string} cardTitle - título de la carta
 * @param {Object} shareConfig - configuración del share
 * @param {Object} translations - traducciones
 * @param {string} platform - plataforma específica (opcional)
 * @returns {string} - texto para compartir
 */
export function generateShareText(cardTitle, shareConfig, translations, platform = null) {
  // Si no se especifica plataforma, detectarla
  const targetPlatform = platform || detectPlatform();
  
  // Usar texto específico de plataforma si está disponible
  return generatePlatformSpecificText(cardTitle, shareConfig, translations, targetPlatform);
}

/**
 * Genera texto específico para Instagram Stories
 * @param {string} cardTitle - título de la carta
 * @param {Object} shareConfig - configuración del share
 * @param {Object} translations - traducciones
 * @returns {string} - texto para Instagram Stories
 */
export function generateInstagramStoriesText(cardTitle, shareConfig, translations) {
  return generatePlatformSpecificText(cardTitle, shareConfig, translations, 'instagram');
}

/**
 * Detecta la plataforma/dispositivo del usuario
 * @returns {string} - plataforma detectada
 */
export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  if (userAgent.includes('instagram')) return 'instagram';
  if (userAgent.includes('twitter') || userAgent.includes('x.com')) return 'twitter';
  if (userAgent.includes('facebook')) return 'facebook';
  if (userAgent.includes('whatsapp')) return 'whatsapp';
  if (platform.includes('iphone') || platform.includes('ipad')) return 'ios';
  if (platform.includes('android')) return 'android';
  
  return 'web';
}

/**
 * Intenta compartir usando la Web Share API nativa
 * @param {Blob} imageBlob - imagen a compartir
 * @param {string} text - texto para compartir
 * @param {string} title - título para compartir
 * @param {Object} shareConfig - configuración para nombre de archivo
 * @returns {Promise<boolean>} - true si se compartió exitosamente
 */
export async function tryNativeShare(imageBlob, text, title, shareConfig = {}) {
  if (!navigator.share) return false;
  
  try {
    // Crear archivo desde el blob
    const filename = `${shareConfig.filename || 'super-x-card'}.png`;
    const file = new File([imageBlob], filename, { type: imageBlob.type });
    
    await navigator.share({
      title: title,
      text: text,
      files: [file]
    });
    
    return true;
  } catch (error) {
    console.log('Native share falló o fue cancelado:', error);
    return false;
  }
}

/**
 * Intenta copiar la imagen al clipboard
 * @param {Blob} imageBlob - imagen a copiar
 * @returns {Promise<boolean>} - true si se copió exitosamente
 */
export async function copyImageToClipboard(imageBlob) {
  if (!navigator.clipboard || !navigator.clipboard.write) return false;
  
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        [imageBlob.type]: imageBlob
      })
    ]);
    
    return true;
  } catch (error) {
    console.log('Copy to clipboard falló:', error);
    return false;
  }
}

/**
 * Descarga la imagen como último recurso
 * @param {Blob} imageBlob - imagen a descargar
 * @param {string} filename - nombre del archivo
 */
export function downloadImage(imageBlob, filename) {
  const url = URL.createObjectURL(imageBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Limpiar URL después de un tiempo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}