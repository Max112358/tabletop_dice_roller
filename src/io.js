window.DiceApp = window.DiceApp || {};

DiceApp.exportWorld = function () {
  DiceApp.ensureCharacterStructure();
  const exportPack = {
    worldName: DiceApp.currentWorld,
    characters: DiceApp.database[DiceApp.currentWorld],
  };
  document.getElementById("ioJson").value = JSON.stringify(exportPack);
  showStatus("World JSON package generated!");
};

DiceApp.importWorld = function (onComplete) {
  const rawJson = document.getElementById("ioJson").value.trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed.worldName && typeof parsed.characters === "object") {
      DiceApp.database[parsed.worldName] = parsed.characters;
      DiceApp.currentWorld = parsed.worldName;
      const chars = Object.keys(parsed.characters);
      DiceApp.currentCharacter = chars.length ? chars[0] : "New Character";
      DiceApp.ensureCharacterStructure();
      DiceApp.saveToStorage();
      onComplete();
      showStatus(`Imported world "${parsed.worldName}".`);
      document.getElementById("ioJson").value = "";
    } else {
      showStatus("Invalid world JSON structure format.", true);
    }
  } catch (e) {
    showStatus("Failed to parse world JSON string config pack.", true);
  }
};

DiceApp.exportCharacter = function () {
  DiceApp.ensureCharacterStructure();
  const exportPack = {
    characterName: DiceApp.currentCharacter,
    buttons: DiceApp.getCurrentCharacterData().buttons,
    variables: DiceApp.getCurrentCharacterData().variables,
    notes: DiceApp.getCurrentCharacterData().notes,
  };
  document.getElementById("ioJson").value = JSON.stringify(exportPack);
  showStatus("Character JSON package generated!");
};

DiceApp.importCharacter = function (onComplete) {
  const rawJson = document.getElementById("ioJson").value.trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed.characterName && Array.isArray(parsed.buttons)) {
      if (!DiceApp.database[DiceApp.currentWorld])
        DiceApp.database[DiceApp.currentWorld] = {};

      DiceApp.database[DiceApp.currentWorld][parsed.characterName] = {
        buttons: parsed.buttons,
        variables: parsed.variables || {},
        notes: parsed.notes || "",
      };

      DiceApp.currentCharacter = parsed.characterName;
      DiceApp.saveToStorage();
      onComplete();
      showStatus(
        `Successfully imported ${parsed.characterName} into ${DiceApp.currentWorld}!`,
      );
      document.getElementById("ioJson").value = "";
    } else {
      showStatus("Invalid character JSON structure format.", true);
    }
  } catch (e) {
    showStatus("Failed to parse character JSON string config pack.", true);
  }
};

window.exportWorld = DiceApp.exportWorld;
window.importWorld = function () {
  DiceApp.importWorld(DiceApp.renderUI);
};

window.exportCharacter = DiceApp.exportCharacter;
window.importCharacter = function () {
  DiceApp.importCharacter(DiceApp.renderUI);
};
