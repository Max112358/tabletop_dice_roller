import { executeAST } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";
import { MODAL_HTML } from "./modal-template.js";
import { renderPalette } from "./palette.js";
import { renderWorkspace } from "./workspace.js";
import { renderProperties } from "./properties.js";

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceInfo = null;
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

    bindGlobalDrop(this);
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

    renderPalette("builder-palette");
    this.render();
    openModal("formula-builder-modal");
  }

  render() {
    const workspace = document.getElementById("builder-workspace");
    renderWorkspace(this, this.currentAst.root, [], workspace);

    renderProperties(this);
    this.renderDisplay();
    this.renderCritRules();
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

function bindGlobalDrop(builder) {
  // Global fallback so dropping anywhere outside nested zones still acts on main workspace.
  const workspace = document.getElementById("builder-workspace");
  if (!workspace) return;
  workspace.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = builder.dragSourceInfo ? "move" : "copy";
  });
}
