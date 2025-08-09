
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


