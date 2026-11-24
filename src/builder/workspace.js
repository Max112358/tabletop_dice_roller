import { registry } from "../engine/nodeRegistry.js";
import { nodeToString } from "../shared.js";
import { OP_LABELS } from "./constants.js";

export function bindWorkspaceDrop(builder) {
  const workspace = document.getElementById("builder-workspace");
  if (!workspace || workspace.dataset.dropBound === "true") return;

  workspace.dataset.dropBound = "true";

  workspace.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  workspace.addEventListener("drop", (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain");
    if (type) builder.addNode(type);
  });
}

export function renderWorkspace(builder) {
  const workspace = document.getElementById("builder-workspace");
  workspace.innerHTML = "";

  const root = builder.currentAst.root;

  if (root.type === "math" && root.operands.length === 0) {
    workspace.appendChild(createDropZone(builder));
    return;
  }

  const operands = root.type === "math" ? root.operands : [root];

  workspace.appendChild(createReorderDropZone(builder, 0));

  operands.forEach((node, idx) => {
    const chip = createChip(builder, node, idx);
    workspace.appendChild(chip);

    if (idx < operands.length - 1 && root.type === "math") {
      workspace.appendChild(createOperatorDropdown(builder, root.op, idx));
    }

    workspace.appendChild(createReorderDropZone(builder, idx + 1));
  });
}

function createDropZone(builder) {
  const zone = document.createElement("div");
  zone.className = "builder-drop-zone";
  zone.innerText = "Drag a node type here";

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drop-active");
    const type = e.dataTransfer.getData("text/plain");
    if (type) builder.addNode(type);
  });

  return zone;
}

function createReorderDropZone(builder, insertIndex) {
  const zone = document.createElement("div");
  zone.className = "builder-reorder-zone";
  zone.dataset.index = insertIndex;

  zone.addEventListener("dragover", (e) => {
    if (builder.dragSourceIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  return zone;
}

function createChip(builder, node, index) {
  const chip = document.createElement("div");
  chip.className = "builder-chip";
  chip.draggable = true;
  chip.dataset.index = index;
  chip.innerHTML = `<span>${nodeToString(node)}</span>`;

  if (
    builder.selectedPath &&
    builder.selectedPath.length === 1 &&
    builder.selectedPath[0] === index
  ) {
    chip.classList.add("selected");
  }

  chip.addEventListener("click", () => {
    builder.selectedPath = [index];
    builder.render();
  });

  chip.addEventListener("dragstart", (e) => {
    builder.dragSourceIndex = index;
    e.dataTransfer.effectAllowed = "move";
  });

  chip.addEventListener("dragend", (e) => {
    const sourceIndex = builder.dragSourceIndex;

    if (sourceIndex !== null) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const zone = target?.closest(".builder-reorder-zone");

      if (zone) {
        const insertIndex = parseInt(zone.dataset.index, 10);
        builder.reorderChip(sourceIndex, insertIndex);
      }
    }

    builder.dragSourceIndex = null;
    builder.render();
  });

  const removeBtn = document.createElement("button");
  removeBtn.innerText = "×";
  removeBtn.title = "Remove";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    builder.removeChip(index);
  });
  chip.appendChild(removeBtn);

  return chip;
}

function createOperatorDropdown(builder, currentOp, index) {
  const select = document.createElement("select");
  select.className = "builder-operator";

  Object.keys(OP_LABELS).forEach((op) => {
    const opt = document.createElement("option");
    opt.value = op;
    opt.innerText = OP_LABELS[op];
    if (op === currentOp) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    builder.currentAst.root.op = select.value;
    builder.render();
  });

  return select;
}

export function addNode(builder, type) {
  const def = registry.get(type);
  if (!def) return;

  const node = def.create();

  if (builder.currentAst.root.type === "math") {
    builder.currentAst.root.operands.push(node);
  } else {
    const old = builder.currentAst.root;
    builder.currentAst.root = {
      type: "math",
      op: "add",
      operands: [old, node],
    };
  }

  builder.selectedPath = [
    builder.currentAst.root.type === "math"
      ? builder.currentAst.root.operands.length - 1
      : 0,
  ];
  builder.render();
}

export function removeChip(builder, index) {
  if (builder.currentAst.root.type === "math") {
    builder.currentAst.root.operands.splice(index, 1);
    if (builder.currentAst.root.operands.length === 0) {
      builder.currentAst.root = { type: "math", op: "add", operands: [] };
    } else if (builder.currentAst.root.operands.length === 1) {
      builder.currentAst.root = builder.currentAst.root.operands[0];
    }
  } else {
    builder.currentAst.root = { type: "math", op: "add", operands: [] };
  }

  builder.selectedPath = null;
  builder.render();
}

export function reorderChip(builder, fromIndex, toIndex) {
  if (fromIndex === toIndex) return;

  if (builder.currentAst.root.type === "math") {
    const operands = builder.currentAst.root.operands;
    const [moved] = operands.splice(fromIndex, 1);

    const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    operands.splice(insertIndex, 0, moved);

    builder.selectedPath = [insertIndex];
  }

  builder.render();
}
