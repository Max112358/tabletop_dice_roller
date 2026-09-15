window.DiceApp = window.DiceApp || {};

DiceApp.renderNotes = function () {
  const notesArea = document.getElementById("charNotes");
  if (notesArea) {
    notesArea.value = DiceApp.database[DiceApp.currentCharacter].notes || "";
  }
};

DiceApp.renderCharacterSelect = function () {
  const select = document.getElementById("charSelect");
  if (!select) return;
  select.innerHTML = "";
  Object.keys(DiceApp.database).forEach((char) => {
    const opt = document.createElement("option");
    opt.value = char;
    opt.innerText = char;
    if (char === DiceApp.currentCharacter) opt.selected = true;
    select.appendChild(opt);
  });
};

DiceApp.renderVariables = function () {
  const varContainer = document.getElementById("varContainer");
  if (!varContainer) return;
  varContainer.innerHTML = "";
  const variables = DiceApp.database[DiceApp.currentCharacter].variables || {};

  Object.keys(variables).forEach((varName) => {
    const badge = document.createElement("div");
    badge.className = "var-badge";
    badge.dataset.varname = varName;
    badge.style.cursor = "grab";

    const label = document.createElement("span");
    label.className = "var-name";
    label.innerText = varName;

    const input = document.createElement("input");
    const isNumeric =
      !isNaN(parseFloat(variables[varName])) && isFinite(variables[varName]);
    input.type = isNumeric ? "number" : "text";
    input.className = "var-val-input";
    input.value = variables[varName];
    input.onchange = function () {
      DiceApp.updateVariableValue(varName, this.value);
    };

    const actions = document.createElement("div");
    actions.className = "var-actions no-drag";

    const editBtn = document.createElement("button");
    editBtn.className = "var-edit-btn no-drag";
    editBtn.innerHTML = "✎";
    editBtn.title = `Edit variable ${varName}`;
    editBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.openVariableEditModal(varName);
    };

    const copyBtn = document.createElement("button");
    copyBtn.className = "var-copy-btn no-drag";
    copyBtn.innerHTML = "⎘";
    copyBtn.title = `Copy variable ${varName}`;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.copyVariable(varName);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "var-delete-btn no-drag";
    delBtn.innerHTML = "✕";
    delBtn.title = `Delete variable ${varName}`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.removeVariable(varName);
    };

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    badge.appendChild(label);
    badge.appendChild(input);
    badge.appendChild(actions);
    varContainer.appendChild(badge);
  });
};

DiceApp.renderDiceGrid = function () {
  const grid = document.getElementById("diceGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const buttons = DiceApp.database[DiceApp.currentCharacter].buttons || [];

  buttons.forEach((btn, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "dice-btn";
    wrapper.dataset.index = index.toString();
    wrapper.style.cursor = "grab";

    const missingVars = DiceApp.getMissingVariables(btn.formula);
    if (missingVars.length > 0) wrapper.classList.add("broken");

    const rollBtn = document.createElement("button");
    rollBtn.style.width = "100%";
    rollBtn.style.whiteSpace = "pre-line";
    rollBtn.style.cursor = "pointer";
    rollBtn.innerText = btn.label;

    let tooltipText = `Formula: ${btn.formula}`;
    if (btn.note) tooltipText += `\nNote: ${btn.note}`;
    rollBtn.title = tooltipText;

    rollBtn.onclick = function () {
      DiceApp.executeRoll(btn.label, btn.formula, btn.note, this);
    };

    const errorBadge = document.createElement("div");
    errorBadge.className = "error-badge";
    errorBadge.innerText = `⚠️ Missing: ${missingVars.join(", ")}`;

    const actions = document.createElement("div");
    actions.className = "btn-actions no-drag";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn no-drag";
    editBtn.innerHTML = "✎";
    editBtn.title = "Edit";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.openButtonEditModal(index);
    };

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn no-drag";
    copyBtn.innerHTML = "⎘";
    copyBtn.title = "Duplicate";
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.copyButton(index);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn no-drag";
    delBtn.innerText = "✕";
    delBtn.title = `Delete ${btn.label}`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.removeButton(index, btn.label);
    };

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    wrapper.appendChild(rollBtn);
    wrapper.appendChild(errorBadge);
    wrapper.appendChild(actions);
    grid.appendChild(wrapper);
  });
};

DiceApp.renderUI = function () {
  const t0 = performance.now();
  DiceApp.ensureCharacterStructure(DiceApp.currentCharacter);
  DiceApp.renderNotes();
  DiceApp.renderCharacterSelect();
  DiceApp.renderVariables();
  DiceApp.renderDiceGrid();
  DiceApp.logElapsed("[renderUI]", t0, 50);
};
