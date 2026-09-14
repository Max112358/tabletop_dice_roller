window.DiceApp = window.DiceApp || {};

window.onerror = function (msg, url, line, col, err) {
  console.error("GLOBAL ERROR:", msg, "line:", line, "err:", err);
};
window.addEventListener("unhandledrejection", function (e) {
  console.error("UNHANDLED PROMISE REJECTION:", e.reason);
});

DiceApp.addVariable = function () {
  const nameInput = document.getElementById("newVarName");
  const valInput = document.getElementById("newVarValue");

  const rawName = nameInput.value.trim().toUpperCase();
  const cleanName = rawName.replace(/[^A-Z_-]/g, "");
  const valueStr = valInput.value.trim();

  if (!cleanName) {
    showStatus(
      "Variable label must contain uppercase alphabetic characters!",
      true,
    );
    return;
  }
  if (["D", "KH", "KL"].includes(cleanName)) {
    showStatus(`"${cleanName}" is a reserved syntax key word.`, true);
    return;
  }

  const cleanVal = parseFloat(valueStr);
  const finalValue =
    !isNaN(cleanVal) && cleanVal.toString() === valueStr ? cleanVal : valueStr;

  DiceApp.database[DiceApp.currentCharacter].variables[cleanName] = finalValue;
  DiceApp.saveToStorage();
  DiceApp.renderUI();

  nameInput.value = "";
  valInput.value = "";
  showStatus(`Variable "${cleanName}" added!`);
};

DiceApp.updateVariableValue = function (name, val) {
  const valueStr = val.trim();
  const cleanVal = parseFloat(valueStr);

  DiceApp.database[DiceApp.currentCharacter].variables[name] =
    !isNaN(cleanVal) && cleanVal.toString() === valueStr ? cleanVal : valueStr;

  DiceApp.saveToStorage();
  DiceApp.renderUI();
  showStatus(`Updated variable "${name}"`);
};

DiceApp.removeVariable = function (name) {
  if (confirm(`Delete character variable "${name}"?`)) {
    delete DiceApp.database[DiceApp.currentCharacter].variables[name];
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Deleted variable "${name}".`);
  }
};

DiceApp.switchCharacter = function () {
  DiceApp.currentCharacter = document.getElementById("charSelect").value;
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  DiceApp.rollBuffer = [];
  DiceApp.lastRollTime = 0;
  document.getElementById("resTitle").innerText = "No dice rolled yet...";
  document.getElementById("resRaw").innerText =
    "Click a custom action button above to calculate a formula string.";
  document.getElementById("bufferTimer").style.display = "none";
};

DiceApp.createCharacter = function () {
  const name = document.getElementById("newCharName").value.trim();
  if (!name) return;
  if (!DiceApp.database[name])
    DiceApp.database[name] = { buttons: [], variables: {}, notes: "" };
  DiceApp.currentCharacter = name;
  document.getElementById("newCharName").value = "";
  DiceApp.saveToStorage();
  DiceApp.renderUI();
};

DiceApp.deleteCharacter = function () {
  if (
    confirm(
      `Are you sure you want to delete all profiles/buttons for ${DiceApp.currentCharacter}?`,
    )
  ) {
    delete DiceApp.database[DiceApp.currentCharacter];
    const remaining = Object.keys(DiceApp.database);
    DiceApp.currentCharacter = remaining.length
      ? remaining[0]
      : "Example Paladin";
    DiceApp.ensureCharacterStructure(DiceApp.currentCharacter);
    DiceApp.saveToStorage();
    DiceApp.renderUI();
  }
};

DiceApp.addButton = function () {
  const label = document.getElementById("btnLabel").value.trim();
  const formula = document.getElementById("btnFormula").value.trim();
  const note = document.getElementById("btnNote").value.trim();

  if (!label || !formula) {
    showStatus("Label and Formula are required!", true);
    return;
  }

  DiceApp.database[DiceApp.currentCharacter].buttons.push({
    label,
    formula,
    note,
  });
  DiceApp.saveToStorage();
  DiceApp.renderUI();

  document.getElementById("btnLabel").value = "";
  document.getElementById("btnFormula").value = "";
  document.getElementById("btnNote").value = "";
};

DiceApp.removeButton = function (index, label) {
  if (confirm(`Delete the "${label}" macro button?`)) {
    DiceApp.database[DiceApp.currentCharacter].buttons.splice(index, 1);
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Deleted "${label}" macro.`);
  }
};

DiceApp.updateNotes = function (text) {
  DiceApp.database[DiceApp.currentCharacter].notes = text;
  DiceApp.saveToStorage();
};

DiceApp.clearFeed = function () {
  DiceApp.rollBuffer = [];
  DiceApp.lastRollTime = 0;

  navigator.clipboard.writeText("").catch(() => {});

  document.getElementById("resTitle").innerText = "No dice rolled yet...";
  document.getElementById("resRaw").innerText =
    "Click a custom action button above to calculate a formula string.";
  document.getElementById("bufferTimer").style.display = "none";

  showStatus("Clipboard feed cleared!");
};

DiceApp.alphabetizeVariables = function () {
  if (
    confirm(
      "Are you sure you want to sort all variables alphabetically? This will change their current visual order.",
    )
  ) {
    const vars = DiceApp.database[DiceApp.currentCharacter].variables;
    const sortedKeys = Object.keys(vars).sort((a, b) => a.localeCompare(b));
    const newVars = {};
    sortedKeys.forEach((key) => {
      newVars[key] = vars[key];
    });

    DiceApp.database[DiceApp.currentCharacter].variables = newVars;
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus("Variables sorted alphabetically.");
  }
};

DiceApp.alphabetizeButtons = function () {
  if (
    confirm(
      "Are you sure you want to sort all macro buttons alphabetically? This will change their current visual order.",
    )
  ) {
    DiceApp.database[DiceApp.currentCharacter].buttons.sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus("Buttons sorted alphabetically.");
  }
};

DiceApp.factoryResetDatabase = function () {
  const firstConfirmation = confirm(
    "WARNING: This will permanently delete ALL characters, custom buttons, and variables from this browser's local storage.\n\nAre you sure you want to proceed?",
  );

  if (firstConfirmation) {
    const secondConfirmation = confirm(
      "FINAL CONFIRMATION:\n\nThis action is irreversible. Press OK to completely wipe the application data and reload the page.",
    );

    if (secondConfirmation) {
      localStorage.removeItem("dice_profiles_v2");
      localStorage.removeItem("dice_profiles");
      localStorage.removeItem("current_dice_char");
      window.location.reload();
    }
  }
};

// Wire up drag-and-drop
DiceApp.setupVariableDragAndDrop(DiceApp.renderUI);
DiceApp.setupButtonDragAndDrop(DiceApp.renderUI);

// Expose handlers for inline HTML onclick attributes
window.switchCharacter = DiceApp.switchCharacter;
window.createCharacter = DiceApp.createCharacter;
window.deleteCharacter = DiceApp.deleteCharacter;
window.addVariable = DiceApp.addVariable;
window.updateVariableValue = DiceApp.updateVariableValue;
window.removeVariable = DiceApp.removeVariable;
window.addButton = DiceApp.addButton;
window.removeButton = DiceApp.removeButton;
window.alphabetizeVariables = DiceApp.alphabetizeVariables;
window.alphabetizeButtons = DiceApp.alphabetizeButtons;
window.updateNotes = DiceApp.updateNotes;
window.clearFeed = DiceApp.clearFeed;
window.importCharacter = function () {
  DiceApp.importCharacter(DiceApp.renderUI);
};
window.factoryResetDatabase = DiceApp.factoryResetDatabase;

// Initialize
DiceApp.renderUI();
