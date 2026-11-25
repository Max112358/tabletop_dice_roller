window.DiceApp = window.DiceApp || {};

(function () {
  "use strict";

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
    DiceApp.openVariableBuilder(name);
  };

  DiceApp.saveVariableEdit = function () {
    // No-op; the builder handles variable saves now.
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
