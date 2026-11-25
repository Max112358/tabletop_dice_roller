import { executeAST } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";
import { PAGE_HTML } from "./page-template.js";
import { renderPalette } from "./palette.js";
import { renderWorkspace, getNodeAtPath } from "./workspace.js";
import { renderProperties } from "./properties.js";

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this._stack = [];
    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceInfo = null;
    this._editingIndex = null;
    this._currentOnDone = null;
    this.setupDOM();
  }

  setupDOM() {
    if (document.getElementById("formula-builder-page")) return;

    const div = document.createElement("div");
    div.innerHTML = PAGE_HTML;
    document.body.appendChild(div.firstElementChild);

    document
      .getElementById("builder-save")
      .addEventListener("click", () => this.save());

    const cancelBtn = document.getElementById("builder-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.close());
    }
  }

  open({
    label = "",
    note = "",
    ast = null,
    index = null,
    onDone = null,
  } = {}) {
    // Save the current level before diving into a nested formula.
    if (this.currentAst) {
      this._stack.push({
        ast: this.currentAst,
        selectedPath: this.selectedPath,
        editingIndex: this._editingIndex,
        onDone: this._currentOnDone,
        label: document.getElementById("builder-label").value,
        note: document.getElementById("builder-note").value,
      });
    }

    this._currentOnDone = onDone;
    this._editingIndex = index;

    this.currentAst = ast
      ? JSON.parse(JSON.stringify(ast))
      : {
          root: { type: "math", op: "add", operands: [] },
          critSuccess: [],
          critFail: [],
        };

    const root = this.currentAst.root;
    // Keep tables (and other composite roots) as the root node. Wrap simple
    // leaves into a math workspace so they can be combined with other terms.
    if (
      root &&
      !root.operands &&
      root.type !== "table" &&
      root.type !== "check" &&
      root.type !== "pool" &&
      root.type !== "rollUntilTarget"
    ) {
      this.currentAst.root = {
        type: "math",
        op: "add",
        operands: [root],
      };
    }

    this.selectedPath = null;

    document.getElementById("builder-label").value = label;
    document.getElementById("builder-note").value = note;
    document.getElementById("builder-preview-output").innerText = "";

    this._updateHeader();
    this.render();

    const page = document.getElementById("formula-builder-page");
    page.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  _updateHeader() {
    const header = document.querySelector(".builder-page-header h3");
    if (!header) return;
    header.innerText = this._stack.length
      ? `Edit Nested Formula (${this._stack.length} level${this._stack.length > 1 ? "s" : ""} deep)`
      : "Build Formula";
  }

  close() {
    if (this._stack.length > 0) {
      this._restoreParent();
      return;
    }

    const page = document.getElementById("formula-builder-page");
    if (page) page.classList.add("hidden");
    document.body.style.overflow = "";

    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceInfo = null;
    this._editingIndex = null;
    this._currentOnDone = null;
    this._stack = [];
  }

  _restoreParent() {
    const frame = this._stack.pop();
    this.currentAst = frame.ast;
    this.selectedPath = frame.selectedPath;
    this._editingIndex = frame.editingIndex;
    this._currentOnDone = frame.onDone;

    document.getElementById("builder-label").value = frame.label;
    document.getElementById("builder-note").value = frame.note;

    this._updateHeader();
    this.render();
  }

  render() {
    renderPalette(this, "builder-palette");

    const workspace = document.getElementById("builder-workspace");
    renderWorkspace(this, [], workspace);

    renderProperties(this);
    this.renderDisplay();
    this.renderCritRules();
    this.preview();
  }

  renderDisplay() {
    const root = this.currentAst.root;
    document.getElementById("builder-display").innerText =
      root.type === "math" && root.operands.length === 0
        ? "(empty)"
        : nodeToString(root);
  }

  renderCritRules() {
    // Crit rules can be added here later.
  }

  preview() {
    const root = this.currentAst.root;
    const output = document.getElementById("builder-preview-output");

    if (root.type === "math" && root.operands.length === 0) {
      output.innerText = "";
      return;
    }

    const variables = DiceApp.getCurrentCharacterData().variables || {};
    try {
      const result = executeAST(this.currentAst, variables);
      output.innerText = JSON.stringify(result, null, 2);
    } catch (err) {
      output.innerText = "Error: " + err.message;
    }
  }

  save() {
    const labelInput = document.getElementById("builder-label");
    const noteInput = document.getElementById("builder-note");
    const label = labelInput.value.trim();
    const note = noteInput.value.trim();

    const nestedOnDone = this._currentOnDone;
    if (nestedOnDone) {
      // Nested formula editor: return the result to the parent level.
      const result = { node: this.currentAst.root, label, note };
      // Restore parent FIRST so the onDone closure sees the parent's ast/path.
      this._restoreParent();
      nestedOnDone(result);
      return;
    }

    if (!label) {
      labelInput.classList.add("builder-label-error");
      setTimeout(() => labelInput.classList.remove("builder-label-error"), 800);
      showStatus("Button label is required.", true);
      return;
    }

    this.onSave({
      label,
      note,
      ast: this.currentAst,
      index: this._editingIndex,
    });
    this.close();
  }

  isTableRoot() {
    return this.currentAst?.root?.type === "table";
  }

  rootIsEmpty() {
    const r = this.currentAst?.root;
    if (!r) return true;
    if (r.type === "math" || r.type === "group") {
      return !r.operands || r.operands.length === 0;
    }
    return false;
  }
}
