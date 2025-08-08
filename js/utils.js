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
    if (!isEnabledFn() || !viewer.getCameraOrbit) {
      requestAnimationFrame(rotate);
      return;
    }

    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const orbit = viewer.getCameraOrbit();
    const newTheta = orbit.theta + delta * speed;

    viewer.cameraOrbit = `${newTheta}rad ${orbit.phi}rad ${orbit.radius}m`;

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
  if (!viewer.getCameraOrbit) return;

  const orbit = viewer.getCameraOrbit();
  const thetaDeg = (orbit.theta * 180) / Math.PI;
  const normalized = normalizeAngle(thetaDeg);
  const targetDeg = getSnapAngle(normalized);

  // Se fija phi (elevación) a 90 grados (horizontal),
  // radius en automático para no cambiar zoom
  viewer.cameraOrbit = `${targetDeg}deg 90deg auto`;
}
