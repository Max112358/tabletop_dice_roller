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
  const cleanName = rawName.replace(/[^A-Z0-9_-]/g, "");
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

  DiceApp.getCurrentCharacterData().variables[cleanName] = finalValue;
  DiceApp.saveToStorage();
  DiceApp.renderUI();

  nameInput.value = "";
  valInput.value = "";
  showStatus(`Variable "${cleanName}" added!`);
};

DiceApp.updateVariableValue = function (name, val) {
  const valueStr = val.trim();
  const cleanVal = parseFloat(valueStr);

  DiceApp.getCurrentCharacterData().variables[name] =
    !isNaN(cleanVal) && cleanVal.toString() === valueStr ? cleanVal : valueStr;

  DiceApp.saveToStorage();
  DiceApp.renderUI();
  showStatus(`Updated variable "${name}"`);
};

DiceApp.removeVariable = function (name) {
  if (confirm(`Delete character variable "${name}"?`)) {
    delete DiceApp.getCurrentCharacterData().variables[name];
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Deleted variable "${name}".`);
  }
};

// ------------------------------------------------------------------
// World management
// ------------------------------------------------------------------

DiceApp.switchWorld = function () {
  DiceApp.currentWorld = document.getElementById("worldSelect").value;
  const characters = DiceApp.database[DiceApp.currentWorld] || {};
  const remaining = Object.keys(characters);
  DiceApp.currentCharacter = remaining.length ? remaining[0] : "New Character";
  DiceApp.ensureCharacterStructure();
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  DiceApp.rollBuffer = [];
  DiceApp.lastRollTime = 0;
  document.getElementById("resTitle").innerText = "No dice rolled yet...";
  document.getElementById("resRaw").innerText =
    "Click a custom action button above to calculate a formula string.";
  document.getElementById("bufferTimer").style.display = "none";
};

DiceApp.createWorld = function () {
  const name = document.getElementById("newWorldName").value.trim();
  if (!name) return;
  if (DiceApp.database[name]) {
    showStatus(`A world named "${name}" already exists.`, true);
    return;
  }
  DiceApp.database[name] = {};
  DiceApp.currentWorld = name;
  DiceApp.currentCharacter = "New Character";
  DiceApp.ensureCharacterStructure();
  document.getElementById("newWorldName").value = "";
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  showStatus(`Created world "${name}".`);
};

DiceApp.deleteWorld = function () {
  if (
    confirm(
      `Are you sure you want to delete the entire world "${DiceApp.currentWorld}" and all of its characters?`,
    )
  ) {
    delete DiceApp.database[DiceApp.currentWorld];

    const remainingWorlds = Object.keys(DiceApp.database);
    if (remainingWorlds.length) {
      DiceApp.currentWorld = remainingWorlds[0];
    } else {
      DiceApp.database["Default World"] = {};
      DiceApp.currentWorld = "Default World";
    }

    const characters = DiceApp.database[DiceApp.currentWorld] || {};
    const remainingChars = Object.keys(characters);
    DiceApp.currentCharacter = remainingChars.length
      ? remainingChars[0]
      : "New Character";
    DiceApp.ensureCharacterStructure();

    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus("World deleted.");
  }
};

DiceApp.openRenameWorldModal = function () {
  document.getElementById("renameWorldOriginalName").value =
    DiceApp.currentWorld;
  document.getElementById("renameWorldNewName").value = DiceApp.currentWorld;
  openModal("rename-world-modal");
};

DiceApp.saveRenameWorld = function () {
  const oldName = document.getElementById("renameWorldOriginalName").value;
  const newName = document.getElementById("renameWorldNewName").value.trim();

  if (!newName) {
    showStatus("World name cannot be empty.", true);
    return;
  }

  if (newName === oldName) {
    closeModal("rename-world-modal");
    return;
  }

  if (DiceApp.database.hasOwnProperty(newName)) {
    showStatus(`A world named "${newName}" already exists.`, true);
    return;
  }

  DiceApp.database[newName] = DiceApp.database[oldName];
  delete DiceApp.database[oldName];
  DiceApp.currentWorld = newName;

  DiceApp.saveToStorage();
  DiceApp.renderUI();
  closeModal("rename-world-modal");
  showStatus(`Renamed world to "${newName}".`);
};

// ------------------------------------------------------------------
// Character management
// ------------------------------------------------------------------

DiceApp.switchCharacter = function () {
  DiceApp.currentCharacter = document.getElementById("charSelect").value;
  DiceApp.ensureCharacterStructure();
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
  if (!DiceApp.database[DiceApp.currentWorld])
    DiceApp.database[DiceApp.currentWorld] = {};
  if (!DiceApp.database[DiceApp.currentWorld][name])
    DiceApp.database[DiceApp.currentWorld][name] = {
      buttons: [],
      variables: {},
      notes: "",
    };
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
    if (!DiceApp.database[DiceApp.currentWorld])
      DiceApp.database[DiceApp.currentWorld] = {};
    delete DiceApp.database[DiceApp.currentWorld][DiceApp.currentCharacter];

    const remaining = Object.keys(DiceApp.database[DiceApp.currentWorld]);
    DiceApp.currentCharacter = remaining.length
      ? remaining[0]
      : "New Character";
    DiceApp.ensureCharacterStructure();

    DiceApp.saveToStorage();
    DiceApp.renderUI();
  }
};

DiceApp.openRenameCharacterModal = function () {
  document.getElementById("renameCharOriginalName").value =
    DiceApp.currentCharacter;
  document.getElementById("renameCharNewName").value = DiceApp.currentCharacter;
  openModal("rename-character-modal");
};

DiceApp.saveRenameCharacter = function () {
  const oldName = document.getElementById("renameCharOriginalName").value;
  const newName = document.getElementById("renameCharNewName").value.trim();

  if (!newName) {
    showStatus("Character name cannot be empty.", true);
    return;
  }

  if (newName === oldName) {
    closeModal("rename-character-modal");
    return;
  }

  const world = DiceApp.database[DiceApp.currentWorld];
  if (world.hasOwnProperty(newName)) {
    showStatus(`A character named "${newName}" already exists.`, true);
    return;
  }

  world[newName] = world[oldName];
  delete world[oldName];
  DiceApp.currentCharacter = newName;

  DiceApp.saveToStorage();
  DiceApp.renderUI();
  closeModal("rename-character-modal");
  showStatus(`Renamed character to "${newName}".`);
};

// ------------------------------------------------------------------
// Buttons
// ------------------------------------------------------------------

DiceApp.addButton = function () {
  const label = document.getElementById("btnLabel").value.trim();
  const formula = document.getElementById("btnFormula").value.trim();
  const note = document.getElementById("btnNote").value.trim();

  if (!label || !formula) {
    showStatus("Label and Formula are required!", true);
    return;
  }

  DiceApp.getCurrentCharacterData().buttons.push({ label, formula, note });
  DiceApp.saveToStorage();
  DiceApp.renderUI();

  document.getElementById("btnLabel").value = "";
  document.getElementById("btnFormula").value = "";
  document.getElementById("btnNote").value = "";
};

DiceApp.removeButton = function (index, label) {
  if (confirm(`Delete the "${label}" macro button?`)) {
    DiceApp.getCurrentCharacterData().buttons.splice(index, 1);
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Deleted "${label}" macro.`);
  }
};

DiceApp.updateNotes = function (text) {
  DiceApp.getCurrentCharacterData().notes = text;
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
    const charData = DiceApp.getCurrentCharacterData();
    const vars = charData.variables;
    const sortedKeys = Object.keys(vars).sort((a, b) => a.localeCompare(b));
    const newVars = {};
    sortedKeys.forEach((key) => {
      newVars[key] = vars[key];
    });

    charData.variables = newVars;
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
    DiceApp.getCurrentCharacterData().buttons.sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus("Buttons sorted alphabetically.");
  }
};

DiceApp.factoryResetDatabase = function () {
  const firstConfirmation = confirm(
    "WARNING: This will permanently delete ALL worlds, characters, custom buttons, and variables from this browser's local storage.\n\nAre you sure you want to proceed?",
  );

  if (firstConfirmation) {
    const secondConfirmation = confirm(
      "FINAL CONFIRMATION:\n\nThis action is irreversible. Press OK to completely wipe the application data and reload the page.",
    );

    if (secondConfirmation) {
      localStorage.removeItem("dice_worlds_v1");
      localStorage.removeItem("current_dice_world");
      localStorage.removeItem("current_dice_char");
      localStorage.removeItem("dice_profiles_v2");
      localStorage.removeItem("dice_profiles");
      window.location.reload();
    }
  }
};

// Wire up drag-and-drop
DiceApp.setupVariableDragAndDrop(DiceApp.renderUI);
DiceApp.setupButtonDragAndDrop(DiceApp.renderUI);

// Expose handlers for inline HTML onclick attributes
window.switchWorld = DiceApp.switchWorld;
window.createWorld = DiceApp.createWorld;
window.deleteWorld = DiceApp.deleteWorld;
window.openRenameWorldModal = DiceApp.openRenameWorldModal;
window.saveRenameWorld = DiceApp.saveRenameWorld;

window.switchCharacter = DiceApp.switchCharacter;
window.createCharacter = DiceApp.createCharacter;
window.deleteCharacter = DiceApp.deleteCharacter;
window.openRenameCharacterModal = DiceApp.openRenameCharacterModal;
window.saveRenameCharacter = DiceApp.saveRenameCharacter;

window.addVariable = DiceApp.addVariable;
window.updateVariableValue = DiceApp.updateVariableValue;
window.removeVariable = DiceApp.removeVariable;
window.addButton = DiceApp.addButton;
window.removeButton = DiceApp.removeButton;
window.alphabetizeVariables = DiceApp.alphabetizeVariables;
window.alphabetizeButtons = DiceApp.alphabetizeButtons;
window.updateNotes = DiceApp.updateNotes;
window.clearFeed = DiceApp.clearFeed;
window.factoryResetDatabase = DiceApp.factoryResetDatabase;

// Initialize
DiceApp.renderUI();
