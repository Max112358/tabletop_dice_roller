window.DiceApp = window.DiceApp || {};

DiceApp.triggerCritSuccessVisuals = function () {
  DiceApp.triggerBackgroundFlash(
    DiceApp.success_color,
    DiceApp.success_fail_flash_duration,
  );
  DiceApp.createParticleExplosion(
    ["✨", "🟩"],
    45,
    DiceApp.success_fail_flash_duration,
  );
};

DiceApp.triggerCritFailVisuals = function () {
  DiceApp.triggerBackgroundFlash(
    DiceApp.fail_color,
    DiceApp.success_fail_flash_duration,
  );
  DiceApp.createParticleExplosion(
    ["💀", "💥"],
    45,
    DiceApp.success_fail_flash_duration,
  );
};

DiceApp.triggerBackgroundFlash = function (color, duration = 0.5) {
  const body = document.body;

  if (body._flashTimeout) {
    clearTimeout(body._flashTimeout);
  }

  body.style.transition = "none";
  body.style.backgroundColor = color;
  void body.offsetWidth;

  body.style.transition = `background-color ${duration}s ease-out`;
  body.style.backgroundColor = "";

  body._flashTimeout = setTimeout(
    () => {
      body.style.transition = "";
      body._flashTimeout = null;
    },
    duration * 1000 + 100,
  );
};

DiceApp.createParticleExplosion = function (emojis, count, duration = 0.5) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "50%";
  container.style.left = "50%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "10000";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.position = "absolute";
    particle.style.fontSize = Math.random() * 1.5 + 1.2 + "rem";
    particle.style.userSelect = "none";

    const angle = Math.random() * Math.PI * 2;
    const tx =
      Math.cos(angle) * (window.innerWidth * (Math.random() * 0.3 + 0.05));
    const ty =
      Math.sin(angle) * (window.innerHeight * (Math.random() * 0.3 + 0.05));
    const rot = Math.random() * 720 - 360;

    particle.style.transform = `translate(-50%, -50%) scale(0.1)`;
    particle.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease-in`;

    container.appendChild(particle);

    requestAnimationFrame(() => {
      particle.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rot}deg) scale(1)`;
      particle.style.opacity = "0";
    });
  }

  setTimeout(
    () => {
      container.remove();
    },
    duration * 1000 + 100,
  );
};
