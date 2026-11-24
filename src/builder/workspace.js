import { registry } from "../engine/nodeRegistry.js";
import { nodeToString } from "../shared.js";
import { OP_LABELS } from "./constants.js";

export function renderWorkspace(builder, parentNode, parentPath, containerEl) {
  containerEl.innerHTML = "";

  const operands = parentNode.operands;

  if (operands.length === 0) {
    containerEl.appendChild(
      createEmptyDropZone(builder, parentNode, parentPath),
    );
    return;
  }

  containerEl.appendChild(
    createReorderDropZone(builder, parentNode, parentPath, 0),
  );

  operands.forEach((node, idx) => {
    const chipPath = [...parentPath, idx];
    const chip = createChip(builder, node, chipPath);
    containerEl.appendChild(chip);

    if (idx < operands.length - 1) {
      containerEl.appendChild(
        createOperatorDropdown(builder, parentNode, parentPath, idx),
      );
    }

    containerEl.appendChild(
      createReorderDropZone(builder, parentNode, parentPath, idx + 1),
    );
  });
}

function createEmptyDropZone(builder, parentNode, parentPath) {
  const zone = document.createElement("div");
  zone.className = "builder-drop-zone";
  zone.innerText = "Drag a node type here";

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = builder.dragSourceInfo ? "move" : "copy";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drop-active");
    handleDropOnWorkspace(builder, parentNode, parentPath, e);
  });

  return zone;
}

function createReorderDropZone(builder, parentNode, parentPath, insertIndex) {
  const zone = document.createElement("div");
  zone.className = "builder-reorder-zone";
  zone.dataset.parentPath = JSON.stringify(parentPath);
  zone.dataset.insertIndex = insertIndex;

  zone.addEventListener("dragover", (e) => {
    if (!builder.dragSourceInfo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  zone.addEventListener("drop", (e) => {
    if (!builder.dragSourceInfo) return;
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drop-active");

    const targetPath = JSON.parse(zone.dataset.parentPath);
    const targetIndex = parseInt(zone.dataset.insertIndex, 10);
    handleChipDrop(builder, targetPath, targetIndex);
  });

  return zone;
}

function createChip(builder, node, path) {
  const chip = document.createElement("div");
  chip.className = "builder-chip";
  chip.draggable = true;
  chip.dataset.path = JSON.stringify(path);
  chip.innerHTML = `<span>${nodeToString(node)}</span>`;

  if (builder.selectedPath && pathsEqual(builder.selectedPath, path)) {
    chip.classList.add("selected");
  }

  chip.addEventListener("click", () => {
    builder.selectedPath = path;
    builder.render();
  });

  chip.addEventListener("dragstart", (e) => {
    builder.dragSourceInfo = { path };
    e.dataTransfer.effectAllowed = "move";
  });

  chip.addEventListener("dragend", (e) => {
    if (!builder.dragSourceInfo) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const zone = target?.closest(".builder-reorder-zone");
    if (zone && zone.dataset.parentPath) {
      const targetPath = JSON.parse(zone.dataset.parentPath);
      const targetIndex = parseInt(zone.dataset.insertIndex, 10);
      handleChipDrop(builder, targetPath, targetIndex);
    }

    builder.dragSourceInfo = null;
    builder.render();
  });

  const removeBtn = document.createElement("button");
  removeBtn.innerText = "×";
  removeBtn.title = "Remove";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeNodeAtPath(builder, path);
  });
  chip.appendChild(removeBtn);

  return chip;
}

function createOperatorDropdown(builder, parentNode, parentPath, index) {
  const select = document.createElement("select");
  select.className = "builder-operator";
  select.dataset.parentPath = JSON.stringify(parentPath);

  Object.keys(OP_LABELS).forEach((op) => {
    const opt = document.createElement("option");
    opt.value = op;
    opt.innerText = OP_LABELS[op];
    if (op === parentNode.op) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const node = getNodeAtPath(builder.currentAst.root, parentPath);
    node.op = select.value;
    builder.render();
  });

  return select;
}

function handleDropOnWorkspace(builder, parentNode, parentPath, e) {
  if (builder.dragSourceInfo) {
    handleChipDrop(builder, parentPath, parentNode.operands.length);
  } else {
    const type = e.dataTransfer.getData("text/plain");
    if (type) addNodeAtPath(builder, parentPath, type);
  }
}

function handleChipDrop(builder, targetParentPath, targetInsertIndex) {
  const sourcePath = builder.dragSourceInfo?.path;
  if (!sourcePath) return;

  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];

  const sourceParent = getNodeAtPath(builder.currentAst.root, sourceParentPath);
  const targetParent = getNodeAtPath(builder.currentAst.root, targetParentPath);

  if (sourceParent !== targetParent) return; // cross-workspace moves not supported yet

  const operands = sourceParent.operands;
  if (sourceIndex === targetInsertIndex) return;
  if (sourceIndex === targetInsertIndex - 1) return;

  const [moved] = operands.splice(sourceIndex, 1);
  const insertIndex =
    targetInsertIndex > sourceIndex ? targetInsertIndex - 1 : targetInsertIndex;
  operands.splice(insertIndex, 0, moved);

  builder.selectedPath = [...targetParentPath, insertIndex];
  builder.dragSourceInfo = null;
  builder.render();
}

function addNodeAtPath(builder, parentPath, type) {
  const def = registry.get(type);
  if (!def) return;

  const parent = getNodeAtPath(builder.currentAst.root, parentPath);
  if (!parent.operands) return;

  const node = def.create();
  parent.operands.push(node);
  builder.selectedPath = [...parentPath, parent.operands.length - 1];
  builder.render();
}

function removeNodeAtPath(builder, path) {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parent = getNodeAtPath(builder.currentAst.root, parentPath);

  if (!parent.operands) return;

  parent.operands.splice(index, 1);

  if (parent.operands.length === 0 && parent.type === "group") {
    // remove empty group from its parent
    if (parentPath.length > 0) {
      removeNodeAtPath(builder, parentPath);
      return;
    }
  }

  if (parent.operands.length === 0 && parent.type === "math") {
    // leave empty math root
  } else if (parent.operands.length === 1 && parentPath.length === 0) {
    // top-level math with one operand collapses to that operand
    builder.currentAst.root = parent.operands[0];
  }

  builder.selectedPath = null;
  builder.render();
}

export function getNodeAtPath(root, path) {
  let node = root;
  for (let i = 0; i < path.length; i++) {
    node = node.operands[path[i]];
  }
  return node;
}

function pathsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
