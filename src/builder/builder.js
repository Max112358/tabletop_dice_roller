import { registry } from "../engine/nodeRegistry.js";
import { executeAST } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

const MODAL_HTML = `
<div id="formula-builder-modal" class="modal-overlay modal-hidden">
  <div class="modal-content builder-modal-content" onclick="event.stopPropagation()">
    <span class="modal-close" onclick="closeModal('formula-builder-modal')">&times;</span>
    <h3>Build Formula</h3>

    <label style="display:block; margin-top:10px;">Label</label>
    <input type="text" id="builder-label" style="width:100%" />

    <label style="display:block; margin-top:10px;">Note</label>
    <input type="text" id="builder-note" style="width:100%" />

    <div style="margin-top:10px; color:#a6adc8; font-size:12px;">
      Display: <span id="builder-display"></span>
    </div>

    <div class="formula-builder-body">
      <div class="builder-palette" id="builder-palette"></div>
      <div class="builder-workspace-container">
        <div class="builder-workspace" id="builder-workspace"></div>
        <div class="builder-properties" id="builder-properties">
          Drag a node type onto the line above.
        </div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-top:15px;">
      <button id="builder-preview" type="button">Preview Roll</button>
      <button id="builder-save" type="button">Save</button>
      <button class="danger" onclick="closeModal('formula-builder-modal')" type="button">Cancel</button>
    </div>

    <pre id="builder-preview-output" style="margin-top:10px; font-size:12px; white-space:pre-wrap;"></pre>
  </div>
</div>
`;

const PALETTE = [
  { type: "dice", label: "🎲 Dice" },
  { type: "variable", label: "📊 Variable" },
  { type: "number", label: "🔢 Number" },
  { type: "check", label: "⚔️ VS Check" },
  { type: "pool", label: "🏊 Pool" },
  { type: "daggerheart", label: "💜 Daggerheart" },
  { type: "rollUntilTarget", label: "🎯 Roll Until" },
  { type: "table", label: "📜 Table" },
];

const OP_LABELS = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
};

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceIndex = null;
    this.setupDOM();
  }

  setupDOM() {
    if (document.getElementById("formula-builder-modal")) return;
    const div = document.createElement("div");
    div.innerHTML = MODAL_HTML;
    document.body.appendChild(div.firstElementChild);
    document
      .getElementById("builder-save")
      .addEventListener("click", () => this.save());
    document
      .getElementById("builder-preview")
      .addEventListener("click", () => this.preview());
  }

  open({ label = "", note = "", ast = null }) {
    this.currentAst = ast || {
      root: { type: "math", op: "add", operands: [] },
      critSuccess: [],
      critFail: [],
    };
    this.selectedPath = null;

    document.getElementById("builder-label").value = label;
    document.getElementById("builder-note").value = note;
    document.getElementById("builder-preview-output").innerText = "";

    this.renderPalette();
    this.render();
    openModal("formula-builder-modal");
  }

  render() {
    this.renderWorkspace();
    this.renderProperties();
    this.renderDisplay();
    this.renderCritRules();
  }

  renderPalette() {
    const container = document.getElementById("builder-palette");
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

  renderWorkspace() {
    const workspace = document.getElementById("builder-workspace");
    workspace.innerHTML = "";

    workspace.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    workspace.addEventListener("drop", (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("text/plain");
      if (type) this.addNode(type);
    });

    const root = this.currentAst.root;

    if (root.type === "math" && root.operands.length === 0) {
      workspace.appendChild(this.createDropZone());
      return;
    }

    const operands = root.type === "math" ? root.operands : [root];

    operands.forEach((node, idx) => {
      const chip = this.createChip(node, idx);
      workspace.appendChild(chip);

      if (idx < operands.length - 1 && root.type === "math") {
        workspace.appendChild(this.createOperatorDropdown(root.op, idx));
      }
    });
  }

  createDropZone() {
    const zone = document.createElement("div");
    zone.className = "builder-drop-zone";
    zone.innerText = "Drag a node type here";
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("text/plain");
      if (type) this.addNode(type);
    });
    return zone;
  }

  createChip(node, index) {
    const chip = document.createElement("div");
    chip.className = "builder-chip";
    chip.draggable = true;
    chip.dataset.index = index;
    chip.innerHTML = `<span>${nodeToString(node)}</span>`;

    if (
      this.selectedPath &&
      this.selectedPath.length === 1 &&
      this.selectedPath[0] === index
    ) {
      chip.classList.add("selected");
    }

    chip.addEventListener("click", () => {
      this.selectedPath = [index];
      this.render();
    });

    chip.addEventListener("dragstart", (e) => {
      this.dragSourceIndex = index;
      e.dataTransfer.effectAllowed = "move";
    });

    chip.addEventListener("dragend", () => {
      this.dragSourceIndex = null;
    });

    chip.addEventListener("dragover", (e) => {
      if (this.dragSourceIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    chip.addEventListener("drop", (e) => {
      if (this.dragSourceIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      this.reorderChip(this.dragSourceIndex, index);
    });

    const removeBtn = document.createElement("button");
    removeBtn.innerText = "×";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeChip(index);
    });
    chip.appendChild(removeBtn);

    return chip;
  }

  createOperatorDropdown(currentOp, index) {
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
      this.currentAst.root.op = select.value;
      this.render();
    });

    return select;
  }

  addNode(type) {
    const def = registry.get(type);
    if (!def) return;

    const node = def.create();

    if (this.currentAst.root.type === "math") {
      this.currentAst.root.operands.push(node);
    } else {
      const old = this.currentAst.root;
      this.currentAst.root = {
        type: "math",
        op: "add",
        operands: [old, node],
      };
    }

    this.selectedPath = [
      this.currentAst.root.type === "math"
        ? this.currentAst.root.operands.length - 1
        : 0,
    ];
    this.render();
  }

  removeChip(index) {
    if (this.currentAst.root.type === "math") {
      this.currentAst.root.operands.splice(index, 1);
      if (this.currentAst.root.operands.length === 0) {
        this.currentAst.root = { type: "math", op: "add", operands: [] };
      } else if (this.currentAst.root.operands.length === 1) {
        this.currentAst.root = this.currentAst.root.operands[0];
      }
    } else {
      this.currentAst.root = { type: "math", op: "add", operands: [] };
    }

    this.selectedPath = null;
    this.render();
  }

  reorderChip(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    if (this.currentAst.root.type === "math") {
      const operands = this.currentAst.root.operands;
      const [moved] = operands.splice(fromIndex, 1);
      operands.splice(toIndex, 0, moved);
    }

    this.selectedPath = [toIndex];
    this.render();
  }

  renderProperties() {
    const panel = document.getElementById("builder-properties");
    panel.innerHTML = "";

    if (!this.selectedPath) {
      panel.innerText = "Click a node on the line to edit its properties.";
      return;
    }

    const node = this.getNodeAtPath(this.selectedPath);
    const def = registry.get(node.type);

    const title = document.createElement("h4");
    title.innerText = def ? `Edit ${def.label}` : "Edit Node";
    panel.appendChild(title);

    const editor = this.createPropertyEditor(node, (next) => {
      this.setNodeAtPath(this.selectedPath, next);
      this.render();
    });

    panel.appendChild(editor);
  }

  getNodeAtPath(path) {
    if (this.currentAst.root.type === "math") {
      return this.currentAst.root.operands[path[0]];
    }
    return this.currentAst.root;
  }

  setNodeAtPath(path, node) {
    if (this.currentAst.root.type === "math") {
      this.currentAst.root.operands[path[0]] = node;
    } else {
      this.currentAst.root = node;
    }
  }

  createPropertyEditor(node, update) {
    const box = document.createElement("div");

    if (node.type === "dice") {
      const row1 = document.createElement("div");
      row1.appendChild(document.createTextNode("Count: "));
      row1.appendChild(
        this.createValueEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      row1.appendChild(document.createTextNode(" Sides: "));
      row1.appendChild(
        this.createValueEditor(node.sides, (next) =>
          update({ ...node, sides: next }),
        ),
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
            this.createValueEditor(mod.count, (next) => {
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
        this.createValueEditor(node.weak, (next) =>
          update({ ...node, weak: next }),
        ),
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
          this.createValueEditor(node.strong, (next) =>
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
        this.createInlineNodeSummary(node.batch, (next) =>
          update({ ...node, batch: next }),
        ),
      );
      box.appendChild(batchRow);

      const iterRow = document.createElement("div");
      iterRow.style.marginTop = "8px";
      iterRow.appendChild(document.createTextNode("Iterations: "));
      iterRow.appendChild(
        this.createValueEditor(node.iterations, (next) =>
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
        this.createValueEditor(node.keep.count, (next) =>
          update({ ...node, keep: { ...node.keep, count: next } }),
        ),
      );
      box.appendChild(keepRow);
    }

    if (node.type === "daggerheart") {
      box.appendChild(document.createTextNode("Die size: "));
      box.appendChild(
        this.createValueEditor(node.sides, (next) =>
          update({ ...node, sides: next }),
        ),
      );
    }

    if (node.type === "rollUntilTarget") {
      const batchRow = document.createElement("div");
      batchRow.appendChild(document.createTextNode("Batch: "));
      batchRow.appendChild(
        this.createInlineNodeSummary(node.batch, (next) =>
          update({ ...node, batch: next }),
        ),
      );
      box.appendChild(batchRow);

      const targetRow = document.createElement("div");
      targetRow.style.marginTop = "8px";
      targetRow.appendChild(document.createTextNode("Target: "));
      targetRow.appendChild(
        this.createValueEditor(node.target, (next) =>
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
          this.createValueEditor(node.limit, (next) =>
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
        this.createInlineNodeSummary(node.roll, (next) =>
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
          this.createInlineNodeSummary(entry.result, (next) => {
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

  createValueEditor(node, update) {
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

  createInlineNodeSummary(node, update) {
    const wrapper = document.createElement("span");
    wrapper.className = "builder-inline-summary";

    const span = document.createElement("span");
    span.innerText = nodeToString(node);
    span.style.cursor = "pointer";
    span.style.textDecoration = "underline";
    span.style.color = "var(--accent-orange)";
    span.addEventListener("click", () => {
      // For nested nodes we would need a path stack; for now open a simple editor
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

  renderDisplay() {
    const root = this.currentAst.root;
    document.getElementById("builder-display").innerText =
      root.type === "math" && root.operands.length === 0
        ? "(empty)"
        : nodeToString(root);
  }

  renderCritRules() {
    // Crit rules rendered in a small panel under preview
    // We keep them minimal for now
  }

  preview() {
    const variables = DiceApp.getCurrentCharacterData().variables || {};
    try {
      const result = executeAST(this.currentAst, variables);
      document.getElementById("builder-preview-output").innerText =
        JSON.stringify(result, null, 2);
    } catch (err) {
      document.getElementById("builder-preview-output").innerText =
        "Error: " + err.message;
    }
  }

  save() {
    const label = document.getElementById("builder-label").value.trim();
    if (!label) {
      showStatus("Button label is required.", true);
      return;
    }
    const note = document.getElementById("builder-note").value.trim();
    this.onSave({ label, note, ast: this.currentAst });
    closeModal("formula-builder-modal");
  }
}
