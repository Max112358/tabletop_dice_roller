window.DiceApp = window.DiceApp || {};

(function initParticlePool() {
  function createParticleElement(sizePx, svgUrl) {
    const p = document.createElement("div");
    p.setAttribute("aria-hidden", "true");
    p.style.cssText =
      `position:absolute;top:0;left:0;width:${sizePx}px;height:${sizePx}px;` +
      "user-select:none;pointer-events:none;opacity:0;" +
      "transform:translate(-50%,-50%) scale(0.1);will-change:transform,opacity;";

    const img = document.createElement("img");
    img.src = svgUrl;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";

    p.appendChild(img);
    return p;
  }

  function init() {
    if (DiceApp._particlePool) return;

    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize || "16",
    );

    const container = document.createElement("div");
    container.id = "dice-particle-fx";
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;top:50%;left:50%;width:0;height:0;overflow:visible;pointer-events:none;z-index:10000;";
    document.body.appendChild(container);

    const SVG_PATHS = {
      success: ["assets/sparkle.svg", "assets/green-square.svg"],
      fail: ["assets/skull.svg", "assets/explosion.svg"],
    };

    function makePool(svgs, count) {
      const pool = [];
      for (let i = 0; i < count; i++) {
        const sizePx = (Math.random() * 1.5 + 1.2) * rootFontSize;
        const svgUrl = svgs[Math.floor(Math.random() * svgs.length)];
        const p = createParticleElement(sizePx, svgUrl);
        pool.push(p);
        container.appendChild(p);
      }
      return pool;
    }

    DiceApp._particleContainer = container;
    DiceApp._particlePool = {
      success: makePool(SVG_PATHS.success, 45),
      fail: makePool(SVG_PATHS.fail, 45),
    };
  }

  if (document.body) {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();

DiceApp.triggerCritSuccessVisuals = function () {
  DiceApp.triggerBackgroundFlash(
    DiceApp.success_color,
    DiceApp.success_fail_flash_duration,
  );
  DiceApp.createParticleExplosion(
    ["success"],
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
    ["fail"],
    45,
    DiceApp.success_fail_flash_duration,
  );
};

DiceApp.triggerBackgroundFlash = function (color, duration = 0.5) {
  const body = document.body;
  if (body._flashTimeout) clearTimeout(body._flashTimeout);

  body.style.transition = "none";
  body.style.backgroundColor = color;

  requestAnimationFrame(() => {
    body.style.transition = `background-color ${duration}s ease-out`;
    body.style.backgroundColor = "";
  });

  body._flashTimeout = setTimeout(
    () => {
      body.style.transition = "";
      body._flashTimeout = null;
    },
    duration * 1000 + 100,
  );
};

DiceApp.createParticleExplosion = function (_emojis, count, duration = 0.5) {
  if (!DiceApp._particlePool) {
    requestAnimationFrame(() =>
      DiceApp.createParticleExplosion(_emojis, count, duration),
    );
    return;
  }

  const pool =
    _emojis[0] === "success"
      ? DiceApp._particlePool.success
      : DiceApp._particlePool.fail;

  if (DiceApp._particleCleanupTimeout) {
    clearTimeout(DiceApp._particleCleanupTimeout);
    DiceApp._particleCleanupTimeout = null;
  }

  if (DiceApp._activeParticles) {
    DiceApp._activeParticles.forEach((p) => {
      p.style.transition = "none";
      p.style.opacity = "0";
      p.style.transform = "translate(-50%, -50%) scale(0.1)";
    });
  }

  const active = pool.slice(0, count);
  DiceApp._activeParticles = active;

  active.forEach((p) => {
    p.style.transition = "none";
    p.style.opacity = "1";
    p.style.transform = "translate(-50%, -50%) scale(0.1)";

    const angle = Math.random() * Math.PI * 2;
    const tx =
      Math.cos(angle) * (window.innerWidth * (Math.random() * 0.3 + 0.05));
    const ty =
      Math.sin(angle) * (window.innerHeight * (Math.random() * 0.3 + 0.05));
    const rot = Math.random() * 720 - 360;

    p._targetTransform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rot}deg) scale(1)`;
  });

  DiceApp._particleContainer.offsetHeight;

  requestAnimationFrame(() => {
    active.forEach((p) => {
      p.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease-in`;
      p.style.transform = p._targetTransform;
      p.style.opacity = "0";
      delete p._targetTransform;
    });
  });

  DiceApp._particleCleanupTimeout = setTimeout(
    () => {
      active.forEach((p) => {
        p.style.transition = "none";
        p.style.opacity = "0";
        p.style.transform = "translate(-50%, -50%) scale(0.1)";
      });
      DiceApp._activeParticles = [];
      DiceApp._particleCleanupTimeout = null;
    },
    duration * 1000 + 100,
  );
};
