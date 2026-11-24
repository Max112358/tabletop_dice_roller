import { PALETTE } from "./constants.js";
import { addNodeAtPath } from "./workspace.js";

export function renderPalette(builder, containerId) {
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
      builder.dragSourceInfo = { kind: "palette", type: item.type };
    });

    el.addEventListener("dragend", (e) => {
      const source = builder.dragSourceInfo;
      builder.dragSourceInfo = null;

      if (!source || source.kind !== "palette") {
        builder.render();
        return;
      }

      el.style.display = "none";
      const target = document.elementFromPoint(e.clientX, e.clientY);
      el.style.display = "";

      const zone = target?.closest(".builder-reorder-zone, .builder-drop-zone");
      if (!zone) {
        builder.render();
        return;
      }

      const workspace = zone.closest(
        ".builder-workspace, .builder-workspace-nested",
      );
      const parentPath = workspace
        ? JSON.parse(workspace.dataset.workspacePath)
        : [];
      const insertIndex = zone.classList.contains("builder-drop-zone")
        ? 0
        : parseInt(zone.dataset.insertIndex, 10);

      addNodeAtPath(builder, parentPath, insertIndex, source.type);
    });

    container.appendChild(el);
  });
}
