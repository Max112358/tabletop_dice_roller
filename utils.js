window.DiceApp = window.DiceApp || {};

DiceApp.logElapsed = function (name, startMs, thresholdMs = 5) {
  const elapsed = performance.now() - startMs;
  if (elapsed > thresholdMs) {
    console.warn(`${name} took ${elapsed.toFixed(1)}ms`);
  }
};

function showStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.style.color = isError ? "#f38ba8" : "#a6e3a1";
  el.innerText = msg;
  setTimeout(() => {
    el.innerText = "";
  }, 4000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("modal-hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("modal-hidden");
}

window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.classList.add("modal-hidden");
    });
  }
});

window.showStatus = showStatus;
window.openModal = openModal;
window.closeModal = closeModal;
