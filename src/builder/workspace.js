import { registry } from "../engine/nodeRegistry.js";
import { nodeToString } from "../shared.js";
import { OP_LABELS } from "./constants.js";
import { migratePoolNode } from "../nodes/pool.js";

export function renderWorkspace(builder, parentPath, containerEl) {
  containerEl.innerHTML = "";
  containerEl.dataset.workspacePath = JSON.stringify(parentPath);

  const parentNode = getNodeAtPath(builder.currentAst.root, parentPath);

  if (parentNode.type === "check") {
    renderCheckWorkspace(builder, parentPath, containerEl, parentNode);
    return;
  }

  if (parentNode.type === "pool") {
    renderPoolWorkspace(builder, parentPath, containerEl, parentNode);
    return;
  }

  if (!parentNode?.operands || parentNode.operands.length === 0) {
    containerEl.appendChild(createEmptyDropZone(builder, parentPath));
    return;
  }

  containerEl.appendChild(createReorderDropZone(builder, parentPath, 0, false));

  const len = parentNode.operands.length;
  parentNode.operands.forEach((node, idx) => {
    const chipPath = [...parentPath, idx];
    const chip = createChip(builder, node, chipPath);
    containerEl.appendChild(chip);

    if (idx < len - 1) {
      containerEl.appendChild(createOperatorDropdown(builder, parentPath, idx));
      containerEl.appendChild(
        createReorderDropZone(builder, parentPath, idx + 1, false),
      );
    } else {
      containerEl.appendChild(
        createReorderDropZone(builder, parentPath, idx + 1, true),
      );
    }
  });
}

function renderPoolWorkspace(builder, parentPath, containerEl, node) {
  migratePoolNode(node);

  const header = document.createElement("div");
  header.className = "builder-check-header";
  header.innerText = "Pool Batch — drag nodes here";
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    builder.selectedPath = parentPath;
    builder.render();
  });
  containerEl.appendChild(header);

  const nested = document.createElement("div");
  nested.className = "builder-workspace-nested";
  containerEl.appendChild(nested);

  renderWorkspace(builder, [...parentPath, 0], nested);
}

function renderCheckWorkspace(builder, parentPath, containerEl, node) {
  const header = document.createElement("div");
  header.className = "builder-check-header";
  header.innerText = "VS Check — click to edit settings";
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    builder.selectedPath = parentPath;
    builder.render();
  });
  containerEl.appendChild(header);

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";
  row.style.flexWrap = "wrap";
  containerEl.appendChild(row);

  const leftWorkspace = document.createElement("div");
  leftWorkspace.className = "builder-workspace-nested";
  leftWorkspace.style.flex = "1";
  leftWorkspace.style.minWidth = "120px";
  row.appendChild(leftWorkspace);
  renderWorkspace(builder, [...parentPath, 0], leftWorkspace);

  row.appendChild(createSignDropdown(builder, parentPath));

  const rightWorkspace = document.createElement("div");
  rightWorkspace.className = "builder-workspace-nested";
  rightWorkspace.style.flex = "1";
  rightWorkspace.style.minWidth = "120px";
  row.appendChild(rightWorkspace);
  renderWorkspace(builder, [...parentPath, 1], rightWorkspace);
}

function createSignDropdown(builder, parentPath) {
  const parentNode = getNodeAtPath(builder.currentAst.root, parentPath);
  const select = document.createElement("select");
  select.className = "builder-operator";
  [">", ">=", "=", "<", "<="].forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.innerText = s;
    if ((parentNode.sign ?? ">=") === s) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    parentNode.sign = select.value;
    builder.render();
  });
  return select;
}

function createEmptyDropZone(builder, parentPath) {
  const zone = document.createElement("div");
  zone.className = "builder-drop-zone";
  zone.innerText = "Drag a node type here";

  zone.addEventListener("dragover", (e) => {
    if (!builder.dragSourceInfo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect =
      builder.dragSourceInfo.kind === "chip" ? "move" : "copy";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drop-active");
    handleDrop(builder, zone, parentPath, 0);
  });

  return zone;
}

function createReorderDropZone(
  builder,
  parentPath,
  insertIndex,
  isLast = false,
) {
  const zone = document.createElement("div");
  zone.className = "builder-reorder-zone";
  if (isLast) zone.classList.add("builder-reorder-zone-last");
  zone.dataset.insertIndex = insertIndex;

  zone.addEventListener("dragover", (e) => {
    if (!builder.dragSourceInfo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect =
      builder.dragSourceInfo.kind === "chip" ? "move" : "copy";
    zone.classList.add("drop-active");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drop-active");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("drop-active");
    handleDrop(builder, zone, parentPath, insertIndex);
  });

  return zone;
}

function createChip(builder, node, path) {
  const chip = document.createElement("div");
  chip.className = "builder-chip";
  chip.draggable = true;
  chip.dataset.path = JSON.stringify(path);

  const label = document.createElement("span");
  label.innerText = nodeToString(node);
  chip.appendChild(label);

  if (builder.selectedPath && pathsEqual(builder.selectedPath, path)) {
    chip.classList.add("selected");
  }

  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    builder.selectedPath = path;
    builder.render();
  });

  chip.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    builder.dragSourceInfo = { kind: "chip", path };
    chip.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  chip.addEventListener("dragend", (e) => {
    e.stopPropagation();
    builder.dragSourceInfo = null;
    chip.classList.remove("dragging");
    builder.render();
  });

  const removeBtn = document.createElement("button");
  removeBtn.innerText = "×";
  removeBtn.title = "Remove";
  removeBtn.draggable = false;
  removeBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    removeNodeAtPath(builder, path);
  });
  chip.appendChild(removeBtn);

  if (node.type === "group") {
    const nested = document.createElement("div");
    nested.className = "builder-workspace-nested";
    chip.appendChild(nested);
    renderWorkspace(builder, path, nested);
  }

  if (node.type === "pool") {
    const poolContainer = document.createElement("div");
    poolContainer.style.width = "100%";
    poolContainer.style.marginTop = "6px";
    chip.appendChild(poolContainer);
    renderWorkspace(builder, path, poolContainer);
  }

  return chip;
}

function createOperatorDropdown(builder, parentPath, index) {
  const parentNode = getNodeAtPath(builder.currentAst.root, parentPath);
  const select = document.createElement("select");
  select.className = "builder-operator";
  select.draggable = false;

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

function moveNode(builder, sourcePath, targetParentPath, targetInsertIndex) {
  if (isAncestorPath(sourcePath, targetParentPath)) {
    builder.render();
    return;
  }

  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];

  if (pathsEqual(sourceParentPath, targetParentPath)) {
    reorderWithinWorkspace(
      builder,
      targetParentPath,
      sourceIndex,
      targetInsertIndex,
    );
    return;
  }

  const sourceParent = getNodeAtPath(builder.currentAst.root, sourceParentPath);
  const targetParent = getNodeAtPath(builder.currentAst.root, targetParentPath);

  if (!sourceParent?.operands || !targetParent?.operands) {
    builder.render();
    return;
  }

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
  if (!parent?.operands) {
    builder.render();
    return;
  }
  if (sourceIndex === targetInsertIndex) {
    builder.render();
    return;
  }
  if (sourceIndex === targetInsertIndex - 1) {
    builder.render();
    return;
  }

  const [moved] = parent.operands.splice(sourceIndex, 1);
  const insertIndex =
    targetInsertIndex > sourceIndex ? targetInsertIndex - 1 : targetInsertIndex;
  parent.operands.splice(insertIndex, 0, moved);

  builder.selectedPath = [...parentPath, insertIndex];
  builder.render();
}

export function addNodeAtPath(builder, parentPath, insertIndex, type) {
  const def = registry.get(type);
  if (!def) {
    builder.render();
    return;
  }

  const parent = getNodeAtPath(builder.currentAst.root, parentPath);
  if (!parent?.operands) {
    builder.render();
    return;
  }

  if (parent.type === "check" && parent.operands.length >= 2) {
    showStatus("A VS check can only have a left and right side.", true);
    builder.render();
    return;
  }

  const node = def.create();
  parent.operands.splice(insertIndex, 0, node);
  builder.selectedPath = [...parentPath, insertIndex];
  builder.render();
}

function wrapInMathIfNeeded(node) {
  if (node.type === "math" || node.type === "group") return node;
  return { type: "math", op: "add", operands: [node] };
}

function removeNodeAtPath(builder, path) {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parent = getNodeAtPath(builder.currentAst.root, parentPath);

  if (!parent?.operands) return;

  // Root-level check: unwrap to left side.
  if (path.length === 0 && parent.type === "check") {
    builder.currentAst.root = parent.operands[0];
    builder.selectedPath = null;
    builder.render();
    return;
  }

  // Inside a check: replace the side with empty math rather than removing it.
  if (parent.type === "check") {
    parent.operands[index] = { type: "math", op: "add", operands: [] };
    builder.selectedPath = null;
    builder.render();
    return;
  }

  // Inside a pool: replace the batch with an empty math workspace.
  if (parent.type === "pool") {
    parent.operands[index] = { type: "math", op: "add", operands: [] };
    builder.selectedPath = null;
    builder.render();
    return;
  }

  parent.operands.splice(index, 1);

  if (parent.operands.length === 0 && parent.type === "group") {
    if (parentPath.length > 0) {
      removeNodeAtPath(builder, parentPath);
      return;
    }
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

export function setNodeAtPath(root, path, node) {
  if (path.length === 0) return node;
  const parent = getNodeAtPath(root, path.slice(0, -1));
  if (parent?.operands) {
    parent.operands[path[path.length - 1]] = node;
  }
  return root;
}

function pathsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function isAncestorPath(ancestorPath, maybeDescendantPath) {
  if (maybeDescendantPath.length <= ancestorPath.length) return false;
  return ancestorPath.every((v, i) => v === maybeDescendantPath[i]);
}

function handleDrop(builder, zone, fallbackParentPath, fallbackInsertIndex) {
  const source = builder.dragSourceInfo;
  if (!source) return;

  const workspace = zone.closest(
    ".builder-workspace, .builder-workspace-nested",
  );
  const parentPath = workspace
    ? JSON.parse(workspace.dataset.workspacePath)
    : fallbackParentPath;
  const insertIndex = zone.classList.contains("builder-drop-zone")
    ? 0
    : fallbackInsertIndex;

  if (source.kind === "palette" && source.type === "check") {
    const targetNode = getNodeAtPath(builder.currentAst.root, parentPath);
    if (targetNode?.type === "check") {
      showStatus("This expression already has a VS check.", true);
      return;
    }
    if (targetNode?.type === "table") {
      showStatus(
        "Add VS checks inside table entries, not on the table itself.",
        true,
      );
      return;
    }

    const newCheck = {
      type: "check",
      mode: "binary",
      sign: ">=",
      operands: [
        wrapInMathIfNeeded(targetNode),
        { type: "math", op: "add", operands: [{ type: "number", value: 0 }] },
      ],
      strong: null,
    };

    builder.currentAst.root = setNodeAtPath(
      builder.currentAst.root,
      parentPath,
      newCheck,
    );
    builder.selectedPath = parentPath;
    builder.dragSourceInfo = null;
    builder.render();
    return;
  }

  if (source.kind === "palette") {
    addNodeAtPath(builder, parentPath, insertIndex, source.type);
  } else if (source.kind === "chip") {
    moveNode(builder, source.path, parentPath, insertIndex);
  }
}
