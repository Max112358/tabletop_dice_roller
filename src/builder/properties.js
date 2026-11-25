import { registry } from "../engine/nodeRegistry.js";
import { nodeToString, renderGenericEditor } from "../shared.js";
import { getNodeAtPath, setNodeAtPath } from "./workspace.js";
import { migratePoolNode } from "../nodes/pool.js";

function getEntryFormula(entry) {
  return entry.formula ?? entry.result;
}

export function renderProperties(builder) {
  const panel = document.getElementById("builder-properties");
  panel.innerHTML = "";

  if (!builder.selectedPath) {
    panel.innerText = "Click a node on the line to edit its properties.";
    return;
  }

  const node = getNodeAtPath(builder.currentAst.root, builder.selectedPath);
  const def = registry.get(node.type);

  const title = document.createElement("h4");
  title.innerText = def ? `Edit ${def.label}` : "Edit Node";
  panel.appendChild(title);

  const update = (nextNode) => {
    const newRoot = setNodeAtPath(
      builder.currentAst.root,
      builder.selectedPath,
      nextNode,
    );
    if (builder.selectedPath.length === 0) builder.currentAst.root = newRoot;
    builder.render();
  };

  const editor = createPropertyEditor(builder, node, update);
  panel.appendChild(editor);
}

function createPropertyEditor(builder, node, update) {
  const box = document.createElement("div");

  if (node.type === "dice") {
    const row1 = document.createElement("div");
    row1.appendChild(document.createTextNode("Count: "));
    row1.appendChild(
      createValueEditor(node.count, (next) => update({ ...node, count: next })),
    );
    row1.appendChild(document.createTextNode(" Sides: "));
    row1.appendChild(
      createValueEditor(node.sides, (next) => update({ ...node, sides: next })),
    );
    box.appendChild(row1);

    const mods = document.createElement("div");
    mods.className = "builder-mods-list";
    mods.style.marginTop = "8px";

    (node.modifiers || []).forEach((mod, idx) => {
      const row = document.createElement("div");
      row.className = "builder-mod-row";

      const def = registry.get(mod.type);
      row.appendChild(
        def?.renderEditor
          ? def.renderEditor(mod, (next) => {
              const nextMods = [...node.modifiers];
              nextMods[idx] = next;
              update({ ...node, modifiers: nextMods });
            })
          : document.createTextNode(mod.type),
      );

      const del = document.createElement("button");
      del.innerText = "×";
      del.addEventListener("click", () => {
        const nextMods = [...node.modifiers];
        nextMods.splice(idx, 1);
        update({ ...node, modifiers: nextMods });
      });
      row.appendChild(del);

      mods.appendChild(row);
    });

    box.appendChild(mods);

    const addMod = document.createElement("select");
    addMod.appendChild(new Option("Add modifier...", ""));
    registry.modifierTypes().forEach((def) => {
      const opt = document.createElement("option");
      opt.value = def.type;
      opt.innerText = def.label;
      addMod.appendChild(opt);
    });
    addMod.addEventListener("change", () => {
      if (!addMod.value) return;
      const def = registry.get(addMod.value);
      update({
        ...node,
        modifiers: [...(node.modifiers || []), def.create()],
      });
      addMod.value = "";
    });
    box.appendChild(addMod);
  }

  if (node.type === "variable") {
    box.appendChild(document.createTextNode("Variable name: "));
    const input = document.createElement("input");
    input.type = "text";
    input.value = node.name;
    input.style.textTransform = "uppercase";
    input.addEventListener("change", () => {
      update({ ...node, name: input.value.trim().toUpperCase() });
    });
    box.appendChild(input);
  }

  if (node.type === "number") {
    box.appendChild(document.createTextNode("Value: "));
    const input = document.createElement("input");
    input.type = "number";
    input.value = node.value;
    input.addEventListener("change", () => {
      update({ ...node, value: Number(input.value) || 0 });
    });
    box.appendChild(input);
  }

  if (node.type === "label") {
    box.appendChild(document.createTextNode("Text: "));
    const input = document.createElement("input");
    input.type = "text";
    input.value = node.value;
    input.style.width = "100%";
    input.addEventListener("change", () => {
      update({ ...node, value: input.value });
    });
    box.appendChild(input);
  }

  if (node.type === "check") {
    const modeRow = document.createElement("div");
    modeRow.className = "builder-operand-row";
    modeRow.appendChild(document.createTextNode("Mode: "));
    const mode = document.createElement("select");
    [
      ["binary", "Binary (Success / Failure)"],
      ["ternary", "Ternary (Failure / Weak / Strong)"],
    ].forEach(([v, l]) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.innerText = l;
      if (node.mode === v) opt.selected = true;
      mode.appendChild(opt);
    });
    mode.addEventListener("change", () =>
      update({ ...node, mode: mode.value }),
    );
    modeRow.appendChild(mode);
    box.appendChild(modeRow);

    const signRow = document.createElement("div");
    signRow.className = "builder-operand-row";
    signRow.style.marginTop = "8px";
    signRow.appendChild(document.createTextNode("Sign: "));
    const sign = document.createElement("select");
    [">", ">=", "=", "<", "<="].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.innerText = s;
      if ((node.sign ?? ">=") === s) opt.selected = true;
      sign.appendChild(opt);
    });
    sign.addEventListener("change", () =>
      update({ ...node, sign: sign.value }),
    );
    signRow.appendChild(sign);
    box.appendChild(signRow);

    if (node.mode === "ternary") {
      const strongRow = document.createElement("div");
      strongRow.className = "builder-operand-row";
      strongRow.style.marginTop = "8px";
      strongRow.appendChild(document.createTextNode("Strong threshold: "));
      const input = document.createElement("input");
      input.type = "number";
      input.value = node.strong?.value ?? 10;
      input.addEventListener("change", () => {
        update({
          ...node,
          strong: { type: "number", value: Number(input.value) || 0 },
        });
      });
      strongRow.appendChild(input);
      box.appendChild(strongRow);
    }

    const unwrapBtn = document.createElement("button");
    unwrapBtn.innerText = "Remove VS Check";
    unwrapBtn.type = "button";
    unwrapBtn.className = "danger";
    unwrapBtn.style.marginTop = "12px";
    unwrapBtn.addEventListener("click", () => {
      const left = node.operands?.[0] ?? { type: "number", value: 0 };
      if (builder.selectedPath.length === 0) {
        builder.currentAst.root = left;
      } else {
        setNodeAtPath(builder.currentAst.root, builder.selectedPath, left);
      }
      builder.selectedPath = null;
      builder.render();
    });
    box.appendChild(unwrapBtn);
  }

  if (node.type === "pool") {
    migratePoolNode(node);

    const iterRow = document.createElement("div");
    iterRow.appendChild(document.createTextNode("Iterations: "));
    iterRow.appendChild(
      createValueEditor(node.iterations, (next) =>
        update({ ...node, iterations: next }),
      ),
    );
    box.appendChild(iterRow);

    const keepRow = document.createElement("div");
    keepRow.className = "builder-operand-row";
    keepRow.style.marginTop = "8px";
    keepRow.appendChild(document.createTextNode("Keep "));
    const mode = document.createElement("select");
    ["highest", "lowest"].forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.innerText = m;
      if (node.keep.mode === m) opt.selected = true;
      mode.appendChild(opt);
    });
    mode.addEventListener("change", () =>
      update({ ...node, keep: { ...node.keep, mode: mode.value } }),
    );
    keepRow.appendChild(mode);
    keepRow.appendChild(document.createTextNode(" "));
    keepRow.appendChild(
      createValueEditor(node.keep.count, (next) =>
        update({ ...node, keep: { ...node.keep, count: next } }),
      ),
    );
    box.appendChild(keepRow);

    const note = document.createElement("p");
    note.style.marginTop = "10px";
    note.style.fontSize = "12px";
    note.style.color = "var(--text-muted)";
    note.innerText =
      "Drag dice, variables, and other nodes into the pool batch workspace inside the builder.";
    box.appendChild(note);
  }

  if (node.type === "daggerheart") {
    box.appendChild(document.createTextNode("Die size: "));
    box.appendChild(
      createValueEditor(node.sides, (next) => update({ ...node, sides: next })),
    );
  }

  if (node.type === "rollUntilTarget") {
    const batchRow = document.createElement("div");
    batchRow.appendChild(document.createTextNode("Batch: "));
    batchRow.appendChild(
      createInlineNodeSummary(node.operands[0], (next) => {
        const operands = [...node.operands];
        operands[0] = next;
        update({ ...node, operands });
      }),
    );
    box.appendChild(batchRow);

    const targetRow = document.createElement("div");
    targetRow.style.marginTop = "8px";
    targetRow.appendChild(document.createTextNode("Target: "));
    targetRow.appendChild(
      createValueEditor(node.target, (next) =>
        update({ ...node, target: next }),
      ),
    );
    box.appendChild(targetRow);

    const limitRow = document.createElement("div");
    limitRow.style.marginTop = "8px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = node.limit != null;
    cb.addEventListener("change", () => {
      update({
        ...node,
        limit: cb.checked ? { type: "number", value: 1 } : null,
      });
    });
    limitRow.appendChild(cb);
    limitRow.appendChild(document.createTextNode(" Limit "));
    if (node.limit) {
      limitRow.appendChild(
        createValueEditor(node.limit, (next) =>
          update({ ...node, limit: next }),
        ),
      );
    }
    box.appendChild(limitRow);

    const note = document.createElement("p");
    note.style.marginTop = "10px";
    note.style.fontSize = "12px";
    note.style.color = "var(--text-muted)";
    note.innerText =
      "Drag dice, variables, and other nodes into the roll-until batch workspace inside the builder.";
    box.appendChild(note);
  }

  if (node.type === "table") {
    const rollRow = document.createElement("div");
    rollRow.className = "builder-operand-row";
    rollRow.appendChild(document.createTextNode("Roll "));
    rollRow.appendChild(
      createValueEditor(node.roll.count, (next) =>
        update({ ...node, roll: { ...node.roll, count: next } }),
      ),
    );
    rollRow.appendChild(document.createTextNode(" d "));
    rollRow.appendChild(
      createValueEditor(node.roll.sides, (next) =>
        update({ ...node, roll: { ...node.roll, sides: next } }),
      ),
    );
    box.appendChild(rollRow);

    const entriesLabel = document.createElement("div");
    entriesLabel.style.marginTop = "12px";
    entriesLabel.innerHTML = "<strong>Entries:</strong>";
    box.appendChild(entriesLabel);

    const entriesBox = document.createElement("div");
    entriesBox.className = "builder-table-entries";

    (node.entries || []).forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "builder-table-row";
      row.style.alignItems = "center";
      row.style.gap = "16px";
      row.style.padding = "6px 0";

      // Min
      const minWrapper = document.createElement("span");
      minWrapper.className = "builder-value-editor";
      const min = document.createElement("input");
      min.type = "number";
      min.value = entry.min ?? 0;
      min.style.width = "4rem";
      minWrapper.appendChild(min);
      row.appendChild(minWrapper);

      row.appendChild(document.createTextNode("—"));

      // Max
      const maxWrapper = document.createElement("span");
      maxWrapper.className = "builder-value-editor";
      const max = document.createElement("input");
      max.type = "number";
      max.value = entry.max ?? entry.min ?? 0;
      max.style.width = "4rem";
      maxWrapper.appendChild(max);
      row.appendChild(maxWrapper);

      const onRange = () => {
        const nextEntries = [...node.entries];
        nextEntries[idx] = {
          ...entry,
          min: Number(min.value) || 0,
          max: Number(max.value) || Number(min.value) || 0,
        };
        update({ ...node, entries: nextEntries });
      };
      min.addEventListener("change", onRange);
      max.addEventListener("change", onRange);

      // Label
      const labelWrapper = document.createElement("span");
      labelWrapper.className = "builder-value-editor";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.placeholder = "Label";
      labelInput.value = entry.label || "";
      labelInput.style.width = "8rem";
      labelInput.addEventListener("change", () => {
        const nextEntries = [...node.entries];
        nextEntries[idx] = { ...entry, label: labelInput.value };
        update({ ...node, entries: nextEntries });
      });
      labelWrapper.appendChild(labelInput);
      row.appendChild(labelWrapper);

      // Note
      const noteWrapper = document.createElement("span");
      noteWrapper.className = "builder-value-editor";
      const noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.placeholder = "Note";
      noteInput.value = entry.note || "";
      noteInput.style.width = "10rem";
      noteInput.addEventListener("change", () => {
        const nextEntries = [...node.entries];
        nextEntries[idx] = { ...entry, note: noteInput.value };
        update({ ...node, entries: nextEntries });
      });
      noteWrapper.appendChild(noteInput);
      row.appendChild(noteWrapper);

      row.appendChild(document.createTextNode(" → "));

      const formulaSummary = document.createElement("span");
      formulaSummary.className = "builder-inline-summary";
      formulaSummary.innerText = nodeToString(getEntryFormula(entry));
      row.appendChild(formulaSummary);

      const editFormulaBtn = document.createElement("button");
      editFormulaBtn.innerText = "Edit Formula";
      editFormulaBtn.type = "button";
      editFormulaBtn.style.marginLeft = "8px";
      editFormulaBtn.addEventListener("click", () => {
        const formula = getEntryFormula(entry) || { type: "number", value: 0 };
        builder.open({
          label: entry.label || "",
          note: entry.note || "",
          ast: { root: JSON.parse(JSON.stringify(formula)) },
          onDone: ({ node: newFormula, label: newLabel, note: newNote }) => {
            const nextEntries = [...node.entries];
            nextEntries[idx] = {
              ...entry,
              label: newLabel,
              note: newNote,
              formula: newFormula,
            };
            delete nextEntries[idx].result;
            update({ ...node, entries: nextEntries });
          },
        });
      });
      row.appendChild(editFormulaBtn);

      const del = document.createElement("button");
      del.innerText = "×";
      del.type = "button";
      del.addEventListener("click", () => {
        const nextEntries = [...node.entries];
        nextEntries.splice(idx, 1);
        update({ ...node, entries: nextEntries });
      });
      row.appendChild(del);

      entriesBox.appendChild(row);
    });

    box.appendChild(entriesBox);

    const addBtn = document.createElement("button");
    addBtn.innerText = "+ Add Row";
    addBtn.type = "button";
    addBtn.style.marginTop = "8px";
    addBtn.addEventListener("click", () => {
      const last = (node.entries || [])[node.entries.length - 1];
      const nextMin = last ? (last.max ?? last.min ?? 0) + 1 : 1;
      update({
        ...node,
        entries: [
          ...(node.entries || []),
          {
            min: nextMin,
            max: nextMin,
            label: `RESULT ${nextMin}`,
            note: "",
            formula: { type: "number", value: nextMin },
          },
        ],
      });
    });
    box.appendChild(addBtn);
  }

  return box;
}

function createValueEditor(node, update) {
  const wrapper = document.createElement("span");
  wrapper.className = "builder-value-editor";

  const typeSelect = document.createElement("select");
  [
    { type: "number", label: "#" },
    { type: "variable", label: "[ ]" },
  ].forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.type;
    opt.innerText = t.label;
    if (node.type === t.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });

  typeSelect.addEventListener("change", () => {
    update(
      typeSelect.value === "number"
        ? { type: "number", value: 0 }
        : { type: "variable", name: "" },
    );
  });

  wrapper.appendChild(typeSelect);

  const valueBox = document.createElement("span");
  if (node.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.value = node.value;
    input.style.width = "4rem";
    input.addEventListener("change", () =>
      update({ ...node, value: Number(input.value) || 0 }),
    );
    valueBox.appendChild(input);
  } else if (node.type === "variable") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = node.name;
    input.style.width = "4rem";
    input.style.textTransform = "uppercase";
    input.addEventListener("change", () =>
      update({ ...node, name: input.value.trim().toUpperCase() }),
    );
    valueBox.appendChild(input);
  }
  wrapper.appendChild(valueBox);

  return wrapper;
}

function createInlineNodeSummary(node, update) {
  const wrapper = document.createElement("span");
  wrapper.className = "builder-inline-summary";

  const span = document.createElement("span");
  span.innerText = nodeToString(node);
  span.style.cursor = "pointer";
  span.style.textDecoration = "underline";
  span.style.color = "var(--accent-orange)";
  span.addEventListener("click", () => {
    const newValue = prompt(
      `Edit ${node.type} (not yet supported visually; paste JSON to replace):`,
      JSON.stringify(node),
    );
    if (newValue) {
      try {
        update(JSON.parse(newValue));
      } catch (e) {
        showStatus("Invalid JSON", true);
      }
    }
  });
  wrapper.appendChild(span);

  return wrapper;
}
