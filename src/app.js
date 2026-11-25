import {
  registry,
  executeAST,
  collectVariableRefs,
  registerAll,
} from "./engine/index.js";
import { nodeToString } from "./shared.js";
import { FormulaBuilder } from "./builder/builder.js";

window.DiceApp = window.DiceApp || {};

registerAll();

window.onerror = function (msg, url, line, col, err) {
  console.error("GLOBAL ERROR:", msg, "line:", line, "err:", err);
};
window.addEventListener("unhandledrejection", function (e) {
  console.error("UNHANDLED PROMISE REJECTION:", e.reason);
});

// ------------------------------------------------------------------
// Engine helpers attached to DiceApp so classic scripts can use them
// ------------------------------------------------------------------

DiceApp.executeAST = executeAST;
DiceApp.collectVariableRefs = collectVariableRefs;
DiceApp.nodeToString = nodeToString;

DiceApp.getMissingVariables = function (ast, checkedVars = new Set()) {
  const variables = DiceApp.getCurrentCharacterData().variables || {};
  const refs = collectVariableRefs(ast.root ?? ast);
  let missing = [];

  refs.forEach((name) => {
    const upper = name.toUpperCase();
    if (checkedVars.has(upper)) return;
    const expr = variables[upper];
    if (!expr) {
      missing.push(upper);
    } else {
      checkedVars.add(upper);
      const subMissing = DiceApp.getMissingVariables(expr, checkedVars);
      missing = missing.concat(subMissing);
    }
  });

  return [...new Set(missing)];
};

// ------------------------------------------------------------------
// Variables
// ------------------------------------------------------------------

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
  const isNumber = !isNaN(cleanVal) && cleanVal.toString() === valueStr;

  DiceApp.getCurrentCharacterData().variables[cleanName] = isNumber
    ? { type: "number", value: cleanVal }
    : { type: "label", value: valueStr };

  DiceApp.saveToStorage();
  DiceApp.renderUI();

  nameInput.value = "";
  valInput.value = "";
  showStatus(`Variable "${cleanName}" added!`);
};

DiceApp.updateVariableValue = function (name, val) {
  const valueStr = val.trim();
  const cleanVal = parseFloat(valueStr);
  const isNumber = !isNaN(cleanVal) && cleanVal.toString() === valueStr;

  if (!isNumber) {
    showStatus("Only simple number variables can be edited here.", true);
    DiceApp.renderUI();
    return;
  }

  DiceApp.getCurrentCharacterData().variables[name] = {
    type: "number",
    value: cleanVal,
  };

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

DiceApp.openVariableBuilder = function (name) {
  const variables = DiceApp.getCurrentCharacterData().variables;
  if (!variables.hasOwnProperty(name)) return;

  const node = variables[name];
  DiceApp.builder.open({
    label: name,
    ast: { root: JSON.parse(JSON.stringify(node)) },
    mode: "variable",
    originalName: name,
    onSave: ({ label, node, originalName }) =>
      DiceApp.saveVariableFromBuilder(label, node, originalName),
  });
};

DiceApp.saveVariableFromBuilder = function (label, valueNode, originalName) {
  const rawName = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (!rawName) {
    showStatus(
      "Variable name must contain uppercase letters or numbers.",
      true,
    );
    return;
  }
  if (["D", "KH", "KL"].includes(rawName)) {
    showStatus(`"${rawName}" is a reserved syntax key word.`, true);
    return;
  }

  const charData = DiceApp.getCurrentCharacterData();
  const variables = charData.variables;

  const duplicate = Object.keys(variables).some(
    (k) => k !== originalName && k.toUpperCase() === rawName,
  );
  if (duplicate) {
    showStatus(`Variable "${rawName}" already exists.`, true);
    return;
  }

  if (originalName && rawName !== originalName) {
    const newVars = {};
    Object.keys(variables).forEach((k) => {
      if (k === originalName) {
        newVars[rawName] = valueNode;
      } else {
        newVars[k] = variables[k];
      }
    });
    charData.variables = newVars;
  } else {
    variables[rawName] = valueNode;
  }

  DiceApp.saveToStorage();
  DiceApp.renderUI();
  showStatus(`Variable "${rawName}" saved.`);
};

// ------------------------------------------------------------------
// Formula builder
// ------------------------------------------------------------------

DiceApp.closeFormulaBuilder = function () {
  DiceApp.builder.close();
};

DiceApp.openFormulaBuilder = function (index = null) {
  const buttons = DiceApp.getCurrentCharacterData().buttons;
  const existing = index != null ? buttons[index] : null;
  DiceApp.builder.open({
    label: existing?.label ?? "",
    note: existing?.note ?? "",
    ast: existing?.ast ?? null,
    index: index,
  });
};

DiceApp.builder = new FormulaBuilder(({ label, note, ast, index }) => {
  const buttons = DiceApp.getCurrentCharacterData().buttons;
  if (index != null) {
    buttons[index] = { label, note, ast };
    showStatus(`Updated "${label}"`);
  } else {
    buttons.push({ label, note, ast });
    showStatus(`Added "${label}"`);
  }
  DiceApp.saveToStorage();
  DiceApp.renderUI();
});

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
    "Click a custom action button above to calculate a formula.";
  document.getElementById("bufferTimer").style.display = "none";
};

DiceApp.openCreateWorldModal = function () {
  document.getElementById("createWorldName").value = "";
  openModal("create-world-modal");
};

DiceApp.createWorld = function () {
  const name = document.getElementById("createWorldName").value.trim();
  if (!name) {
    showStatus("World name cannot be empty.", true);
    return;
  }
  if (DiceApp.database[name]) {
    showStatus(`A world named "${name}" already exists.`, true);
    return;
  }
  DiceApp.database[name] = {};
  DiceApp.currentWorld = name;
  DiceApp.currentCharacter = "New Character";
  DiceApp.ensureCharacterStructure();
  document.getElementById("createWorldName").value = "";
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  closeModal("create-world-modal");
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

DiceApp.switchCharacter = function (sourceSelect) {
  const select = sourceSelect || document.getElementById("charSelect");
  DiceApp.currentCharacter = select.value;
  DiceApp.ensureCharacterStructure();
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  DiceApp.rollBuffer = [];
  DiceApp.lastRollTime = 0;
  document.getElementById("resTitle").innerText = "No dice rolled yet...";
  document.getElementById("resRaw").innerText =
    "Click a custom action button above to calculate a formula.";
  document.getElementById("bufferTimer").style.display = "none";
};

DiceApp.openCreateCharacterModal = function () {
  document.getElementById("createCharName").value = "";
  openModal("create-character-modal");
};

DiceApp.createCharacter = function () {
  const name = document.getElementById("createCharName").value.trim();
  if (!name) {
    showStatus("Character name cannot be empty.", true);
    return;
  }
  if (!DiceApp.database[DiceApp.currentWorld])
    DiceApp.database[DiceApp.currentWorld] = {};
  if (DiceApp.database[DiceApp.currentWorld][name]) {
    showStatus(`A character named "${name}" already exists.`, true);
    return;
  }
  DiceApp.database[DiceApp.currentWorld][name] = {
    buttons: [],
    variables: {},
    notes: "",
  };
  DiceApp.currentCharacter = name;
  document.getElementById("createCharName").value = "";
  DiceApp.saveToStorage();
  DiceApp.renderUI();
  closeModal("create-character-modal");
  showStatus(`Created character "${name}".`);
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
    "Click a custom action button above to calculate a formula.";
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
      window.location.reload();
    }
  }
};

// ------------------------------------------------------------------
// Expose handlers for inline HTML onclick attributes
// ------------------------------------------------------------------

window.switchWorld = DiceApp.switchWorld;
window.openCreateWorldModal = DiceApp.openCreateWorldModal;
window.createWorld = DiceApp.createWorld;
window.deleteWorld = DiceApp.deleteWorld;
window.openRenameWorldModal = DiceApp.openRenameWorldModal;
window.saveRenameWorld = DiceApp.saveRenameWorld;

window.switchCharacter = DiceApp.switchCharacter;
window.openCreateCharacterModal = DiceApp.openCreateCharacterModal;
window.createCharacter = DiceApp.createCharacter;
window.deleteCharacter = DiceApp.deleteCharacter;
window.openRenameCharacterModal = DiceApp.openRenameCharacterModal;
window.saveRenameCharacter = DiceApp.saveRenameCharacter;

window.addVariable = DiceApp.addVariable;
window.updateVariableValue = DiceApp.updateVariableValue;
window.removeVariable = DiceApp.removeVariable;
window.removeButton = DiceApp.removeButton;
window.alphabetizeVariables = DiceApp.alphabetizeVariables;
window.alphabetizeButtons = DiceApp.alphabetizeButtons;
window.updateNotes = DiceApp.updateNotes;
window.clearFeed = DiceApp.clearFeed;
window.factoryResetDatabase = DiceApp.factoryResetDatabase;
window.openFormulaBuilder = DiceApp.openFormulaBuilder;
