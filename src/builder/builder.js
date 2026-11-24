import { executeAST } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";
import { PAGE_HTML } from "./page-template.js";
import { renderPalette } from "./palette.js";
import { renderWorkspace, getNodeAtPath } from "./workspace.js";
import { renderProperties } from "./properties.js";

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceInfo = null;
    this._editingIndex = null;
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
  }

  open({ label = "", note = "", ast = null, index = null }) {
    this._editingIndex = index;
    this.currentAst = ast
      ? JSON.parse(JSON.stringify(ast))
      : {
          root: { type: "math", op: "add", operands: [] },
          critSuccess: [],
          critFail: [],
        };

    if (!this.currentAst.root?.operands) {
      this.currentAst.root = {
        type: "math",
        op: "add",
        operands: this.currentAst.root ? [this.currentAst.root] : [],
      };
    }

    this.selectedPath = null;

    document.getElementById("builder-label").value = label;
    document.getElementById("builder-note").value = note;
    document.getElementById("builder-preview-output").innerText = "";

    renderPalette(this, "builder-palette");
    this.render();

    const page = document.getElementById("formula-builder-page");
    page.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  close() {
    const page = document.getElementById("formula-builder-page");
    if (page) page.classList.add("hidden");
    document.body.style.overflow = "";
  }

  render() {
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
    const label = labelInput.value.trim();
    if (!label) {
      labelInput.classList.add("builder-label-error");
      setTimeout(() => labelInput.classList.remove("builder-label-error"), 800);
      showStatus("Button label is required.", true);
      return;
    }
    const note = document.getElementById("builder-note").value.trim();
    this.onSave({
      label,
      note,
      ast: this.currentAst,
      index: this._editingIndex,
    });
    this.close();
  }
}
