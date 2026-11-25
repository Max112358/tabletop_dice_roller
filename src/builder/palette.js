import { PALETTE } from "./constants.js";

export function renderPalette(builder, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const tableRoot = builder.isTableRoot?.();

  PALETTE.forEach((item) => {
    const el = document.createElement("div");
    el.className = "builder-palette-item";
    el.draggable = true;
    el.innerText = item.label;
    el.dataset.type = item.type;

    const disabled = tableRoot && item.type !== "table";

    if (disabled) {
      el.classList.add("disabled");
      el.draggable = false;
      el.title =
        "Tables cannot be combined with dice, checks, math, or other roll types.";
    } else if (item.type === "table") {
      el.title = "Add a lookup table (replaces the current formula).";
    }

    el.addEventListener("dragstart", (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", item.type);
      e.dataTransfer.effectAllowed = "copy";
      builder.dragSourceInfo = { kind: "palette", type: item.type };
    });

    el.addEventListener("dragend", () => {
      builder.dragSourceInfo = null;
      builder.render();
    });

    container.appendChild(el);
  });
}
