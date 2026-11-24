import { registry } from "../engine/nodeRegistry.js";
import { nodeToString } from "../shared.js";
import { getNodeAtPath } from "./workspace.js";

function setNodeAtPath(builder, path, node) {
  if (path.length === 0) {
    builder.currentAst.root = node;
    return;
  }
  const parent = getNodeAtPath(builder.currentAst.root, path.slice(0, -1));
  if (parent?.operands) {
    parent.operands[path[path.length - 1]] = node;
  }
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
    setNodeAtPath(builder, builder.selectedPath, nextNode);
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

      if (mod.type === "keep") {
        row.appendChild(document.createTextNode("Keep "));
        const mode = document.createElement("select");
        ["highest", "lowest"].forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.innerText = m;
          if (mod.mode === m) opt.selected = true;
          mode.appendChild(opt);
        });
        mode.addEventListener("change", () => {
          const nextMods = [...node.modifiers];
          nextMods[idx] = { ...mod, mode: mode.value };
          update({ ...node, modifiers: nextMods });
        });
        row.appendChild(mode);
        row.appendChild(document.createTextNode(" "));
        row.appendChild(
          createValueEditor(mod.count, (next) => {
            const nextMods = [...node.modifiers];
            nextMods[idx] = { ...mod, count: next };
            update({ ...node, modifiers: nextMods });
          }),
        );
      } else if (mod.type === "reroll") {
        row.appendChild(document.createTextNode("Reroll "));
        const mode = document.createElement("select");
        [
          ["once", "Once"],
          ["repeating", "Repeating"],
          ["additively", "Additively"],
          ["additivelyrepeating", "Additively Repeating"],
        ].forEach(([v, l]) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.innerText = l;
          if (mod.mode === v) opt.selected = true;
          mode.appendChild(opt);
        });
        mode.addEventListener("change", () => {
          const nextMods = [...node.modifiers];
          nextMods[idx] = { ...mod, mode: mode.value };
          update({ ...node, modifiers: nextMods });
        });
        row.appendChild(mode);
        row.appendChild(document.createTextNode(" on "));
        const target = document.createElement("input");
        target.type = "text";
        target.value = mod.target;
        target.style.width = "4rem";
        target.addEventListener("change", () => {
          const nextMods = [...node.modifiers];
          nextMods[idx] = { ...mod, target: target.value.trim() };
          update({ ...node, modifiers: nextMods });
        });
        row.appendChild(target);
      } else if (mod.type === "replace") {
        row.appendChild(document.createTextNode("Replace "));
        const min = document.createElement("input");
        min.type = "number";
        min.value = mod.min;
        min.style.width = "3rem";
        const max = document.createElement("input");
        max.type = "number";
        max.value = mod.max;
        max.style.width = "3rem";
        const withVal = document.createElement("input");
        withVal.type = "number";
        withVal.value = mod.with;
        withVal.style.width = "3rem";

        const emit = () => {
          const nextMods = [...node.modifiers];
          nextMods[idx] = {
            ...mod,
            min: Number(min.value) || 0,
            max: Number(max.value) || 0,
            with: Number(withVal.value) || 0,
          };
          update({ ...node, modifiers: nextMods });
        };
        min.addEventListener("change", emit);
        max.addEventListener("change", emit);
        withVal.addEventListener("change", emit);

        row.appendChild(min);
        row.appendChild(document.createTextNode("-"));
        row.appendChild(max);
        row.appendChild(document.createTextNode(" with "));
        row.appendChild(withVal);
      }

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
    box.appendChild(document.createTextNode("Mode: "));
    const mode = document.createElement("select");
    [
      ["gte", "vs (greater/equal)"],
      ["lte", "<= (less/equal)"],
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
    box.appendChild(mode);

    const weakRow = document.createElement("div");
    weakRow.style.marginTop = "8px";
    weakRow.appendChild(document.createTextNode("Weak DC: "));
    weakRow.appendChild(
      createValueEditor(node.weak, (next) => update({ ...node, weak: next })),
    );
    box.appendChild(weakRow);

    const strongRow = document.createElement("div");
    strongRow.style.marginTop = "8px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = node.strong != null;
    cb.addEventListener("change", () => {
      update({
        ...node,
        strong: cb.checked ? { type: "number", value: 10 } : null,
      });
    });
    strongRow.appendChild(cb);
    strongRow.appendChild(document.createTextNode(" Strong DC "));
    if (node.strong) {
      strongRow.appendChild(
        createValueEditor(node.strong, (next) =>
          update({ ...node, strong: next }),
        ),
      );
    }
    box.appendChild(strongRow);
  }

  if (node.type === "pool") {
    const batchRow = document.createElement("div");
    batchRow.appendChild(document.createTextNode("Batch: "));
    batchRow.appendChild(
      createInlineNodeSummary(node.batch, (next) =>
        update({ ...node, batch: next }),
      ),
    );
    box.appendChild(batchRow);

    const iterRow = document.createElement("div");
    iterRow.style.marginTop = "8px";
    iterRow.appendChild(document.createTextNode("Iterations: "));
    iterRow.appendChild(
      createValueEditor(node.iterations, (next) =>
        update({ ...node, iterations: next }),
      ),
    );
    box.appendChild(iterRow);

    const keepRow = document.createElement("div");
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
      createInlineNodeSummary(node.batch, (next) =>
        update({ ...node, batch: next }),
      ),
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
  }

  if (node.type === "table") {
    const rollRow = document.createElement("div");
    rollRow.appendChild(document.createTextNode("Roll: "));
    rollRow.appendChild(
      createInlineNodeSummary(node.roll, (next) =>
        update({ ...node, roll: next }),
      ),
    );
    box.appendChild(rollRow);

    const entries = document.createElement("div");
    entries.style.marginTop = "8px";
    entries.innerHTML = "<strong>Entries:</strong>";

    (node.entries || []).forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "builder-table-row";

      const min = document.createElement("input");
      min.type = "number";
      min.value = entry.min;
      min.style.width = "3rem";
      const max = document.createElement("input");
      max.type = "number";
      max.value = entry.max;
      max.style.width = "3rem";

      const onRange = () => {
        const nextEntries = [...node.entries];
        nextEntries[idx] = {
          ...entry,
          min: Number(min.value) || 0,
          max: Number(max.value) || 0,
        };
        update({ ...node, entries: nextEntries });
      };
      min.addEventListener("change", onRange);
      max.addEventListener("change", onRange);

      row.appendChild(min);
      row.appendChild(document.createTextNode("-"));
      row.appendChild(max);
      row.appendChild(document.createTextNode(" → "));
      row.appendChild(
        createInlineNodeSummary(entry.result, (next) => {
          const nextEntries = [...node.entries];
          nextEntries[idx] = { ...entry, result: next };
          update({ ...node, entries: nextEntries });
        }),
      );

      const del = document.createElement("button");
      del.innerText = "×";
      del.addEventListener("click", () => {
        const nextEntries = [...node.entries];
        nextEntries.splice(idx, 1);
        update({ ...node, entries: nextEntries });
      });
      row.appendChild(del);

      entries.appendChild(row);
    });

    box.appendChild(entries);

    const addBtn = document.createElement("button");
    addBtn.innerText = "+ Add Row";
    addBtn.type = "button";
    addBtn.addEventListener("click", () => {
      const last = (node.entries || [])[node.entries.length - 1];
      const nextMin = last ? last.max + 1 : 1;
      update({
        ...node,
        entries: [
          ...(node.entries || []),
          {
            min: nextMin,
            max: nextMin,
            result: { type: "label", value: `Result ${nextMin}` },
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
