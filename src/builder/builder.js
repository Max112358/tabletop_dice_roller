import { executeAST } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";
import { renderGenericEditor } from "../shared.js";

const MODAL_HTML = `
<div id="formula-builder-modal" class="modal-overlay modal-hidden">
  <div class="modal-content builder-modal-content" onclick="event.stopPropagation()">
    <span class="modal-close" onclick="closeModal('formula-builder-modal')">&times;</span>
    <h3 id="builder-title">Build Formula</h3>

    <label style="display:block; margin-top:10px;">Label</label>
    <input type="text" id="builder-label" style="width:100%" />

    <label style="display:block; margin-top:10px;">Note</label>
    <input type="text" id="builder-note" style="width:100%" />

    <div style="margin-top:10px; color:#a6adc8; font-size:12px;">
      Display: <span id="builder-display"></span>
    </div>

    <div id="builder-root" style="margin-top:15px;"></div>

    <h4 style="margin-top:15px;">Critical Rules</h4>
    <div id="builder-crit-success">Success:</div>
    <div id="builder-crit-fail" style="margin-top:8px;">Failure:</div>

    <div style="display:flex; gap:10px; margin-top:15px;">
      <button id="builder-preview" type="button">Preview Roll</button>
      <button id="builder-save" type="button">Save</button>
      <button class="danger" onclick="closeModal('formula-builder-modal')" type="button">Cancel</button>
    </div>

    <pre id="builder-preview-output" style="margin-top:10px; font-size:12px; white-space:pre-wrap;"></pre>
  </div>
</div>
`;

export class FormulaBuilder {
  constructor(onSave) {
    this.onSave = onSave;
    this.currentAst = null;
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
      root: { type: "dice", count: 1, sides: 20, modifiers: [] },
      critSuccess: [],
      critFail: [],
    };

    document.getElementById("builder-label").value = label;
    document.getElementById("builder-note").value = note;
    document.getElementById("builder-preview-output").innerText = "";

    this.render();
    openModal("formula-builder-modal");
  }

  render() {
    const rootEl = document.getElementById("builder-root");
    rootEl.innerHTML = "<strong>Formula root:</strong><br/>";
    rootEl.appendChild(
      renderGenericEditor(this.currentAst.root, (next) => {
        this.currentAst.root = next;
        this.render();
      }),
    );

    document.getElementById("builder-display").innerText = nodeToString(
      this.currentAst.root,
    );

    this.renderCritLists();
  }

  renderCritLists() {
    const renderRules = (rules, containerId, type) => {
      const container = document.getElementById(containerId);
      container.innerHTML = `<strong>${type}:</strong> `;
      rules.forEach((rule, idx) => {
        const chip = document.createElement("span");
        chip.className = "crit-chip";
        chip.innerText = rule.trigger;
        const del = document.createElement("button");
        del.innerText = "×";
        del.type = "button";
        del.addEventListener("click", () => {
          rules.splice(idx, 1);
          this.renderCritLists();
        });
        chip.appendChild(del);
        container.appendChild(chip);
      });
      const add = document.createElement("select");
      add.appendChild(new Option("+", ""));
      ["max", "min", "doubles", "yahtzee"].forEach((t) =>
        add.appendChild(new Option(t, t)),
      );
      add.addEventListener("change", () => {
        if (!add.value) return;
        rules.push({ type: "critRule", trigger: add.value });
        add.value = "";
        this.renderCritLists();
      });
      container.appendChild(add);
    };

    renderRules(this.currentAst.critSuccess, "builder-crit-success", "Success");
    renderRules(this.currentAst.critFail, "builder-crit-fail", "Failure");
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
