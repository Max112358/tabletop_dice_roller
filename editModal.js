window.DiceApp = window.DiceApp || {};

(function () {
  "use strict";

  function parseVariableValue(valueStr) {
    const cleanVal = parseFloat(valueStr);
    return !isNaN(cleanVal) && cleanVal.toString() === valueStr
      ? cleanVal
      : valueStr;
  }

  function validateVarName(rawName, originalName) {
    const cleanName = rawName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");
    if (!cleanName) {
      showStatus(
        "Variable label must contain uppercase alphabetic characters!",
        true,
      );
      return null;
    }
    if (["D", "KH", "KL"].includes(cleanName)) {
      showStatus(`"${cleanName}" is a reserved syntax key word.`, true);
      return null;
    }

    const variables = DiceApp.getCurrentCharacterData().variables;
    const duplicate = Object.keys(variables).some(
      (k) => k !== originalName && k.toUpperCase() === cleanName,
    );
    if (duplicate) {
      showStatus(`Variable "${cleanName}" already exists.`, true);
      return null;
    }

    return cleanName;
  }

  function makeUniqueCopyName(baseName) {
    const variables = DiceApp.getCurrentCharacterData().variables;
    let candidate = baseName + "_COPY";
    while (variables.hasOwnProperty(candidate)) {
      candidate += "_COPY";
    }
    return candidate;
  }

  // ------------------------------------------------------------------
  // Button edit / copy
  // ------------------------------------------------------------------

  DiceApp.openButtonEditModal = function (index) {
    const buttons = DiceApp.getCurrentCharacterData().buttons;
    const btn = buttons[index];
    if (!btn) return;

    document.getElementById("btnEditIndex").value = index;
    document.getElementById("btnEditLabel").value = btn.label;
    document.getElementById("btnEditFormula").value = btn.formula;
    document.getElementById("btnEditNote").value = btn.note || "";
    openModal("button-edit-modal");
  };

  DiceApp.saveButtonEdit = function () {
    const index = parseInt(document.getElementById("btnEditIndex").value, 10);
    const label = document.getElementById("btnEditLabel").value.trim();
    const formula = document.getElementById("btnEditFormula").value.trim();
    const note = document.getElementById("btnEditNote").value.trim();

    if (isNaN(index)) return;
    if (!label || !formula) {
      showStatus("Label and Formula are required!", true);
      return;
    }

    const buttons = DiceApp.getCurrentCharacterData().buttons;
    buttons[index] = { label, formula, note };
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    closeModal("button-edit-modal");
    showStatus(`Updated "${label}"`);
  };

  DiceApp.copyButton = function (index) {
    const buttons = DiceApp.getCurrentCharacterData().buttons;
    const original = buttons[index];
    if (!original) return;

    const copy = {
      label: original.label + " (Copy)",
      formula: original.formula,
      note: original.note,
    };
    buttons.splice(index + 1, 0, copy);

    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Copied "${original.label}"`);
  };

  // ------------------------------------------------------------------
  // Variable edit / copy
  // ------------------------------------------------------------------

  DiceApp.openVariableEditModal = function (name) {
    const variables = DiceApp.getCurrentCharacterData().variables;
    if (!variables.hasOwnProperty(name)) return;

    document.getElementById("varEditOriginalName").value = name;
    document.getElementById("varEditName").value = name;
    document.getElementById("varEditValue").value = variables[name];
    openModal("variable-edit-modal");
  };

  DiceApp.saveVariableEdit = function () {
    const originalName = document.getElementById("varEditOriginalName").value;
    const rawName = document.getElementById("varEditName").value;
    const valueStr = document.getElementById("varEditValue").value.trim();

    const cleanName = validateVarName(rawName, originalName);
    if (!cleanName) return;

    const variables = DiceApp.getCurrentCharacterData().variables;

    if (cleanName !== originalName) {
      const newVars = {};
      Object.keys(variables).forEach((key) => {
        if (key === originalName) {
          newVars[cleanName] = parseVariableValue(valueStr);
        } else {
          newVars[key] = variables[key];
        }
      });
      DiceApp.getCurrentCharacterData().variables = newVars;
    } else {
      variables[originalName] = parseVariableValue(valueStr);
    }

    DiceApp.saveToStorage();
    DiceApp.renderUI();
    closeModal("variable-edit-modal");
    showStatus(`Updated variable "${cleanName}"`);
  };

  DiceApp.copyVariable = function (name) {
    const variables = DiceApp.getCurrentCharacterData().variables;
    if (!variables.hasOwnProperty(name)) return;

    const copyName = makeUniqueCopyName(name);
    const newVars = {};
    Object.keys(variables).forEach((key) => {
      newVars[key] = variables[key];
      if (key === name) {
        newVars[copyName] = variables[key];
      }
    });

    DiceApp.getCurrentCharacterData().variables = newVars;
    DiceApp.saveToStorage();
    DiceApp.renderUI();
    showStatus(`Copied variable "${name}" to "${copyName}"`);
  };

  // Expose for inline HTML onclick handlers
  window.openButtonEditModal = DiceApp.openButtonEditModal;
  window.saveButtonEdit = DiceApp.saveButtonEdit;
  window.copyButton = DiceApp.copyButton;
  window.openVariableEditModal = DiceApp.openVariableEditModal;
  window.saveVariableEdit = DiceApp.saveVariableEdit;
  window.copyVariable = DiceApp.copyVariable;
})();
