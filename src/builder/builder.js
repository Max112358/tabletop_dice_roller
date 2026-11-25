import { nodeToString } from "../shared.js";
import { PAGE_HTML } from "./page-template.js";
import { renderPalette } from "./palette.js";
import { renderWorkspace, getNodeAtPath } from "./workspace.js";
import { renderProperties } from "./properties.js";

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this.onSaveDefault = onSave;
    this.onSaveCallback = onSave;
    this.mode = "formula";
    this._stack = [];
    this.currentAst = null;
    this.selectedPath = null;
    this.dragSourceInfo = null;
    this._editingIndex = null;
    this._editingOriginalName = null;
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

    const exportBtn = document.getElementById("builder-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportJson());
    }

    const importBtn = document.getElementById("builder-import");
    if (importBtn) {
      importBtn.addEventListener("click", () => this.importJson());
    }

    const selectAllBtn = document.getElementById("builder-select-all");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () =>
        document.getElementById("builder-json-output").select(),
      );
    }

    const jsonOutput = document.getElementById("builder-json-output");
    if (jsonOutput) {
      let lastClick = 0;
      let clickCount = 0;
      jsonOutput.addEventListener("click", (e) => {
        const now = Date.now();
        if (now - lastClick < 400) {
          clickCount++;
        } else {
          clickCount = 1;
        }
        lastClick = now;
        if (clickCount === 3) {
          e.preventDefault();
          jsonOutput.select();
        }
      });
    }
  }

  open({
    label = "",
    note = "",
    ast = null,
    index = null,
    onDone = null,
    mode = "formula",
    originalName = null,
    onSave = null,
  } = {}) {
    if (this.currentAst) {
      this._stack.push({
        ast: this.currentAst,
        selectedPath: this.selectedPath,
        editingIndex: this._editingIndex,
        originalName: this._editingOriginalName,
        onDone: this._currentOnDone,
        mode: this.mode,
        onSave: this.onSaveCallback,
        label: document.getElementById("builder-label").value,
        note: document.getElementById("builder-note").value,
      });
    }

    this._currentOnDone = onDone;
    this._editingIndex = mode === "formula" ? index : null;
    this._editingOriginalName = originalName;
    this.mode = mode;
    this.onSaveCallback = onSave || this.onSaveDefault;

    this.currentAst = ast
      ? JSON.parse(JSON.stringify(ast))
      : {
          root: { type: "math", op: "add", operands: [] },
          critSuccess: [],
          critFail: [],
        };

    const root = this.currentAst.root;
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

    document.querySelectorAll(".builder-form-note").forEach((el) => {
      el.style.display = mode === "variable" ? "none" : "";
    });

    this._updateHeader();
    this.render();

    const page = document.getElementById("formula-builder-page");
    page.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  _updateHeader() {
    const header = document.querySelector(".builder-page-header h3");
    if (!header) return;

    if (this.mode === "variable") {
      header.innerText = "Build Variable";
    } else if (this._stack.length) {
      header.innerText = `Edit Nested Formula (${this._stack.length} level${this._stack.length > 1 ? "s" : ""} deep)`;
    } else {
      header.innerText = "Build Formula";
    }
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
    this._editingOriginalName = null;
    this._currentOnDone = null;
    this._stack = [];
    this.mode = "formula";
    this.onSaveCallback = this.onSaveDefault;
  }

  _restoreParent() {
    const frame = this._stack.pop();
    this.currentAst = frame.ast;
    this.selectedPath = frame.selectedPath;
    this._editingIndex = frame.editingIndex;
    this._editingOriginalName = frame.originalName;
    this._currentOnDone = frame.onDone;
    this.mode = frame.mode;
    this.onSaveCallback = frame.onSave;
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
  }

  renderDisplay() {
    const root = this.currentAst.root;
    document.getElementById("builder-display").innerText =
      root.type === "math" && root.operands.length === 0
        ? "(empty)"
        : nodeToString(root);
  }

  renderCritRules() {}

  exportJson() {
    const textarea = document.getElementById("builder-json-output");
    if (!textarea) return;

    let payload;
    if (this.mode === "variable") {
      payload = this.currentAst.root;
    } else {
      payload = this.currentAst;
    }

    try {
      textarea.value = JSON.stringify(payload, null, 2);
      textarea.focus();
      textarea.select();
      showStatus("Formula JSON exported to text box.");
    } catch (err) {
      textarea.value = "Error: " + err.message;
    }
  }

  importJson() {
    const textarea = document.getElementById("builder-json-output");
    if (!textarea) return;

    const raw = textarea.value.trim();
    if (!raw) {
      showStatus(
        "Paste formula JSON into the text box before importing.",
        true,
      );
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      showStatus("Invalid JSON: " + err.message, true);
      return;
    }

    if (this.mode === "variable") {
      this.currentAst = { root: parsed };
    } else {
      if (parsed && typeof parsed === "object" && parsed.root) {
        this.currentAst = {
          root: parsed.root,
          critSuccess: Array.isArray(parsed.critSuccess)
            ? parsed.critSuccess
            : [],
          critFail: Array.isArray(parsed.critFail) ? parsed.critFail : [],
        };
      } else if (parsed && typeof parsed === "object" && parsed.type) {
        this.currentAst = {
          root: parsed,
          critSuccess: [],
          critFail: [],
        };
      } else {
        showStatus(
          "Imported JSON must be a formula object with a root node.",
          true,
        );
        return;
      }
    }

    const root = this.currentAst.root;
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
    this.render();
    showStatus("Formula JSON imported.");
  }

  save() {
    const labelInput = document.getElementById("builder-label");
    const noteInput = document.getElementById("builder-note");
    const label = labelInput.value.trim();
    const note = noteInput.value.trim();

    const nestedOnDone = this._currentOnDone;
    if (nestedOnDone) {
      const result = { node: this.currentAst.root, label, note };
      this._restoreParent();
      nestedOnDone(result);
      return;
    }

    if (!label) {
      labelInput.classList.add("builder-label-error");
      setTimeout(() => labelInput.classList.remove("builder-label-error"), 800);
      showStatus(
        this.mode === "variable"
          ? "Variable name is required."
          : "Button label is required.",
        true,
      );
      return;
    }

    if (this.mode === "variable") {
      let node = this.currentAst.root;
      if (node.type === "math" && node.operands && node.operands.length === 1) {
        node = node.operands[0];
      }

      this.onSaveCallback({
        label,
        node,
        originalName: this._editingOriginalName,
      });
    } else {
      this.onSaveCallback({
        label,
        note,
        ast: this.currentAst,
        index: this._editingIndex,
      });
    }

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
