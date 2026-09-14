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

    const delBtn = document.createElement("button");
    delBtn.className = "var-del-btn";
    delBtn.innerHTML = "✕";
    delBtn.title = `Delete variable ${varName}`;
    delBtn.onclick = function (e) {
      e.stopPropagation();
      DiceApp.removeVariable(varName);
    };

    badge.appendChild(label);
    badge.appendChild(input);
    badge.appendChild(delBtn);
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

    const delBtn = document.createElement("button");
    delBtn.className = "delete-corner-btn";
    delBtn.innerText = "✕";
    delBtn.title = `Delete ${btn.label}`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      DiceApp.removeButton(index, btn.label);
    };

    wrapper.appendChild(rollBtn);
    wrapper.appendChild(errorBadge);
    wrapper.appendChild(delBtn);
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
