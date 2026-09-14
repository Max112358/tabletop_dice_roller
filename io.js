window.DiceApp = window.DiceApp || {};

DiceApp.exportCharacter = function () {
  DiceApp.ensureCharacterStructure(DiceApp.currentCharacter);
  const exportPack = {
    characterName: DiceApp.currentCharacter,
    buttons: DiceApp.database[DiceApp.currentCharacter].buttons,
    variables: DiceApp.database[DiceApp.currentCharacter].variables,
    notes: DiceApp.database[DiceApp.currentCharacter].notes,
  };
  document.getElementById("ioJson").value = JSON.stringify(exportPack);
  showStatus("JSON package generated! Copy it from the text block below.");
};

DiceApp.importCharacter = function (onComplete) {
  const rawJson = document.getElementById("ioJson").value.trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed.characterName && Array.isArray(parsed.buttons)) {
      DiceApp.database[parsed.characterName] = {
        buttons: parsed.buttons,
        variables: parsed.variables || {},
        notes: parsed.notes || "",
      };
      DiceApp.currentCharacter = parsed.characterName;
      DiceApp.saveToStorage();
      onComplete();
      showStatus(
        `Successfully imported ${parsed.characterName} with variables!`,
      );
      document.getElementById("ioJson").value = "";
    } else {
      showStatus("Invalid JSON structure format.", true);
    }
  } catch (e) {
    showStatus("Failed to parse JSON string config pack.", true);
  }
};

window.exportCharacter = DiceApp.exportCharacter;
