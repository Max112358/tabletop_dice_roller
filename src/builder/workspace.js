import { registry } from "../engine/nodeRegistry.js";
import { nodeToString } from "../shared.js";
import { OP_LABELS } from "./constants.js";

export function renderWorkspace(builder, parentPath, containerEl) {
  containerEl.innerHTML = "";
  containerEl.dataset.workspacePath = JSON.stringify(parentPath);

  const parentNode = getNodeAtPath(builder.currentAst.root, parentPath);

  if (!parentNode?.operands || parentNode.operands.length === 0) {
    containerEl.appendChild(createEmptyDropZone(builder, parentPath));
    return;
  }

  containerEl.appendChild(createReorderDropZone(builder, parentPath, 0));

  parentNode.operands.forEach((node, idx) => {
    const chipPath = [...parentPath, idx];
    const chip = createChip(builder, node, chipPath);
    containerEl.appendChild(chip);

    if (idx < parentNode.operands.length - 1) {
      containerEl.appendChild(createOperatorDropdown(builder, parentPath, idx));
    }

    containerEl.appendChild(
      createReorderDropZone(builder, parentPath, idx + 1),
    );
  });
}

function createEmptyDropZone(builder, parentPath) {
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
    handleDrop(builder, parentPath, 0, e);
  });

  return zone;
}

function createReorderDropZone(builder, parentPath, insertIndex) {
  const zone = document.createElement("div");
  zone.className = "builder-reorder-zone";
  zone.dataset.insertIndex = insertIndex;

  zone.addEventListener("dragover", (e) => {
    if (!builder.dragSourceInfo && !e.dataTransfer.getData("text/plain")) {
      return;
    }
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
    handleDrop(builder, parentPath, insertIndex, e);
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
    chip.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  chip.addEventListener("dragend", () => {
    builder.dragSourceInfo = null;
    chip.classList.remove("dragging");
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

  // Groups render their own nested workspace inline
  if (node.type === "group") {
    const nested = document.createElement("div");
    nested.className = "builder-workspace-nested";
    chip.appendChild(nested);
    renderWorkspace(builder, path, nested);
  }

  return chip;
}

function createOperatorDropdown(builder, parentPath, index) {
  const parentNode = getNodeAtPath(builder.currentAst.root, parentPath);
  const select = document.createElement("select");
  select.className = "builder-operator";

  Object.keys(OP_LABELS).forEach((op) => {
    const opt = document.createElement("option");
    opt.value = op;
    opt.innerText = OP_LABELS[op];
    if (op === parentNode.op) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    parentNode.op = select.value;
    builder.render();
  });

  return select;
}

function handleDrop(builder, parentPath, insertIndex, e) {
  if (builder.dragSourceInfo) {
    moveNode(builder, builder.dragSourceInfo.path, parentPath, insertIndex);
  } else {
    const type = e.dataTransfer.getData("text/plain");
    if (type) addNodeAtPath(builder, parentPath, insertIndex, type);
  }
}

function moveNode(builder, sourcePath, targetParentPath, targetInsertIndex) {
  if (pathsEqual(sourcePath.slice(0, -1), targetParentPath)) {
    reorderWithinWorkspace(
      builder,
      targetParentPath,
      sourcePath[sourcePath.length - 1],
      targetInsertIndex,
    );
    return;
  }

  if (isAncestorPath(sourcePath, targetParentPath)) return;

  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];

  const sourceParent = getNodeAtPath(builder.currentAst.root, sourceParentPath);
  const targetParent = getNodeAtPath(builder.currentAst.root, targetParentPath);

  if (!sourceParent?.operands || !targetParent?.operands) return;

  const [moved] = sourceParent.operands.splice(sourceIndex, 1);
  targetParent.operands.splice(targetInsertIndex, 0, moved);

  builder.selectedPath = [...targetParentPath, targetInsertIndex];
  builder.dragSourceInfo = null;
  builder.render();
}

function reorderWithinWorkspace(
  builder,
  parentPath,
  sourceIndex,
  targetInsertIndex,
) {
  const parent = getNodeAtPath(builder.currentAst.root, parentPath);
  if (!parent?.operands) return;
  if (sourceIndex === targetInsertIndex) return;
  if (sourceIndex === targetInsertIndex - 1) return;

  const [moved] = parent.operands.splice(sourceIndex, 1);
  const insertIndex =
    targetInsertIndex > sourceIndex ? targetInsertIndex - 1 : targetInsertIndex;
  parent.operands.splice(insertIndex, 0, moved);

  builder.selectedPath = [...parentPath, insertIndex];
  builder.render();
}

function addNodeAtPath(builder, parentPath, insertIndex, type) {
  const def = registry.get(type);
  if (!def) return;

  const parent = getNodeAtPath(builder.currentAst.root, parentPath);
  if (!parent?.operands) return;

  const node = def.create();
  parent.operands.splice(insertIndex, 0, node);
  builder.selectedPath = [...parentPath, insertIndex];
  builder.render();
}

function removeNodeAtPath(builder, path) {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parent = getNodeAtPath(builder.currentAst.root, parentPath);

  if (!parent?.operands) return;

  parent.operands.splice(index, 1);

  if (parent.operands.length === 0 && parent.type === "group") {
    if (parentPath.length > 0) {
      removeNodeAtPath(builder, parentPath);
      return;
    }
  }

  if (parent.operands.length === 0 && parent.type === "math") {
    // leave empty
  } else if (parent.operands.length === 1 && parentPath.length === 0) {
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

function isAncestorPath(ancestorPath, maybeDescendantPath) {
  if (maybeDescendantPath.length <= ancestorPath.length) return false;
  return ancestorPath.every((v, i) => v === maybeDescendantPath[i]);
}
