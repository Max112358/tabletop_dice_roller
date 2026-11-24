window.DiceApp = window.DiceApp || {};

(function () {
  "use strict";

  function parseVariableValue(valueStr, originalValue) {
    const cleanVal = parseFloat(valueStr);
    const isNumber = !isNaN(cleanVal) && cleanVal.toString() === valueStr;
    if (isNumber) return { type: "number", value: cleanVal };

    // try JSON for complex AST values
    if (
      originalValue &&
      originalValue.type &&
      originalValue.type !== "number" &&
      originalValue.type !== "label"
    ) {
      try {
        const parsed = JSON.parse(valueStr);
        if (parsed && parsed.type) return parsed;
      } catch (e) {
        // fall through to label
      }
    }

    return { type: "label", value: valueStr };
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
    DiceApp.openFormulaBuilder(index);
  };

  DiceApp.saveButtonEdit = function () {
    // no-op; builder handles saves
  };

  DiceApp.copyButton = function (index) {
    const buttons = DiceApp.getCurrentCharacterData().buttons;
    const original = buttons[index];
    if (!original) return;

    const copy = {
      label: original.label + " (Copy)",
      note: original.note,
      ast: original.ast ? JSON.parse(JSON.stringify(original.ast)) : null,
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

    const val = variables[name];
    const isSimple = val && (val.type === "number" || val.type === "label");

    document.getElementById("varEditOriginalName").value = name;
    document.getElementById("varEditName").value = name;
    document.getElementById("varEditValue").value = isSimple
      ? val.value
      : JSON.stringify(val);
    openModal("variable-edit-modal");
  };

  DiceApp.saveVariableEdit = function () {
    const originalName = document.getElementById("varEditOriginalName").value;
    const rawName = document.getElementById("varEditName").value;
    const valueStr = document.getElementById("varEditValue").value.trim();

    const cleanName = validateVarName(rawName, originalName);
    if (!cleanName) return;

    const variables = DiceApp.getCurrentCharacterData().variables;
    const originalValue = variables[originalName];
    const finalValue = parseVariableValue(valueStr, originalValue);

    if (cleanName !== originalName) {
      const newVars = {};
      Object.keys(variables).forEach((key) => {
        if (key === originalName) {
          newVars[cleanName] = finalValue;
        } else {
          newVars[key] = variables[key];
        }
      });
      DiceApp.getCurrentCharacterData().variables = newVars;
    } else {
      variables[originalName] = finalValue;
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
        newVars[copyName] = JSON.parse(JSON.stringify(variables[key]));
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
