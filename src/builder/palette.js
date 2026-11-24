import { PALETTE } from "./constants.js";

export function renderPalette(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  PALETTE.forEach((item) => {
    const el = document.createElement("div");
    el.className = "builder-palette-item";
    el.draggable = true;
    el.innerText = item.label;
    el.dataset.type = item.type;

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.type);
      e.dataTransfer.effectAllowed = "copy";
    });

    container.appendChild(el);
  });
}
