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
 * Prepara el modelo para la captura posicionándolo correctamente
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} shareConfig - configuración para el share
 * @returns {Promise<Object>} - órbita original para restaurar después
 */
export async function prepareModelForCapture(viewer, shareConfig) {
  if (!viewer || typeof viewer.getCameraOrbit !== 'function') {
    throw new Error('Model-viewer not available');
  }

  // Guardar posición original
  const originalOrbit = viewer.getCameraOrbit();
  
  // Configurar posición ideal para captura
  const captureOrbit = shareConfig?.captureOrbit || '0deg 90deg auto';
  viewer.cameraOrbit = captureOrbit;
  
  // Esperar a que se aplique la transición
  await new Promise(resolve => setTimeout(resolve, shareConfig?.transitionDelay || 500));
  
  return originalOrbit;
}

/**
 * Restaura la posición original del modelo después de la captura
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} originalOrbit - órbita original guardada
 */
export function restoreModelPosition(viewer, originalOrbit) {
  if (!viewer || !originalOrbit) return;
  
  try {
    viewer.cameraOrbit = `${originalOrbit.theta}rad ${originalOrbit.phi}rad ${originalOrbit.radius}m`;
  } catch (error) {
    console.error('Error restaurando posición del modelo:', error);
  }
}

/**
 * Captura screenshot del modelo 3D usando html2canvas
 * @param {HTMLElement} viewer - elemento model-viewer
 * @param {Object} shareConfig - configuración para la captura
 * @returns {Promise<Blob>} - blob de la imagen capturada
 */
export async function captureModelScreenshot(viewer, shareConfig = {}) {
  return new Promise((resolve, reject) => {
    // Verificar que html2canvas esté disponible
    if (typeof html2canvas === 'undefined') {
      reject(new Error('html2canvas not loaded'));
      return;
    }

    // Configuración específica para capturar elementos WebGL/Canvas
    const config = {
      allowTaint: true,
      useCORS: true,
      scale: shareConfig.scale || 2,
      width: shareConfig.width || 800,
      height: shareConfig.height || 800,
      backgroundColor: shareConfig.backgroundColor || '#000000',
      logging: false,
      // Configuraciones específicas para WebGL/Canvas
      foreignObjectRendering: true,
      removeContainer: true,
      imageTimeout: 15000,
      // Preservar canvas y elementos 3D
      canvas: viewer.shadowRoot?.querySelector('canvas') || viewer.querySelector('canvas'),
      onclone: function(clonedDoc, element) {
        // Intentar preservar el canvas del modelo 3D
        const modelCanvas = viewer.shadowRoot?.querySelector('canvas');
        if (modelCanvas) {
          const clonedCanvas = clonedDoc.createElement('canvas');
          clonedCanvas.width = modelCanvas.width;
          clonedCanvas.height = modelCanvas.height;
          const ctx = clonedCanvas.getContext('2d');
          if (ctx && modelCanvas.getContext) {
            try {
              ctx.drawImage(modelCanvas, 0, 0);
            } catch (e) {
              console.warn('No se pudo copiar el canvas del modelo:', e);
            }
          }
          element.appendChild(clonedCanvas);
        }
      },
      ...shareConfig.html2canvasOptions
    };

    // Intentar diferentes enfoques para capturar
    html2canvas(viewer, config)
      .then(canvas => {
        // Verificar si el canvas está vacío (completamente negro/transparente)
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let hasContent = false;
        
        // Verificar si hay pixeles no negros
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
            hasContent = true;
            break;
          }
        }

        if (!hasContent) {
          console.warn('Canvas capturado parece estar vacío, intentando método alternativo...');
          // Intentar capturar todo el viewport como alternativa
          html2canvas(document.body, {
            ...config,
            width: window.innerWidth,
            height: window.innerHeight
          }).then(fallbackCanvas => {
            fallbackCanvas.toBlob(
              blob => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Error generating fallback image blob'));
                }
              },
              shareConfig.imageFormat || 'image/png',
              shareConfig.imageQuality || 0.9
            );
          }).catch(reject);
        } else {
          canvas.toBlob(
            blob => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Error generating image blob'));
              }
            },
            shareConfig.imageFormat || 'image/png',
            shareConfig.imageQuality || 0.9
          );
        }
      })
      .catch(error => {
        console.error('Error en html2canvas:', error);
        reject(error);
      });
  });
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
