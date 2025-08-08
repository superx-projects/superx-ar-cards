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
