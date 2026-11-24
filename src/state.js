window.DiceApp = window.DiceApp || {};

// Theme & timing
DiceApp.success_color = "#0b7002";
DiceApp.fail_color = "#8b0229";
DiceApp.success_fail_flash_duration = 1;
DiceApp.COMBO_TIMEOUT_MS = 10000;

const STORAGE_KEY = "dice_worlds_v1";
const DEFAULT_WORLD_URL = "example-world.json";

DiceApp.database = {};
DiceApp.currentWorld = "";
DiceApp.currentCharacter = "";
DiceApp.rollBuffer = [];
DiceApp.lastRollTime = 0;

DiceApp.getCurrentCharacterData = function () {
  DiceApp.ensureCharacterStructure();
  return DiceApp.database[DiceApp.currentWorld][DiceApp.currentCharacter];
};

DiceApp.ensureCharacterStructure = function (
  world = DiceApp.currentWorld,
  char = DiceApp.currentCharacter,
) {
  if (!DiceApp.database[world]) DiceApp.database[world] = {};
  if (!DiceApp.database[world][char])
    DiceApp.database[world][char] = { buttons: [], variables: {}, notes: "" };
  const c = DiceApp.database[world][char];
  if (!c.buttons) c.buttons = [];
  if (!c.variables) c.variables = {};
  if (typeof c.notes === "undefined") c.notes = "";
};

DiceApp.saveToStorage = function () {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DiceApp.database));
  localStorage.setItem("current_dice_world", DiceApp.currentWorld);
  localStorage.setItem("current_dice_char", DiceApp.currentCharacter);
};

DiceApp._databaseLoaded = false;

DiceApp.loadDatabase = async function () {
  if (DiceApp._databaseLoaded) return;
  DiceApp._databaseLoaded = true;

  let saved = null;
  const savedJson = localStorage.getItem(STORAGE_KEY);
  if (savedJson) {
    try {
      saved = JSON.parse(savedJson);
    } catch (e) {
      console.error(
        "Failed to parse saved database, loading example world.",
        e,
      );
    }
  }

  if (saved && Object.keys(saved).length > 0) {
    DiceApp.database = saved;
  } else {
    DiceApp.database = {};

    try {
      const response = await fetch(DEFAULT_WORLD_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const parsed = await response.json();
      if (parsed.worldName && typeof parsed.characters === "object") {
        DiceApp.database[parsed.worldName] = parsed.characters;
      } else {
        throw new Error("Invalid example world JSON structure");
      }
    } catch (e) {
      console.error("Failed to load example world.", e);
      DiceApp.database["Default World"] = {};
    }
  }

  if (!Object.keys(DiceApp.database).length) {
    DiceApp.database["Default World"] = {};
  }

  DiceApp.currentWorld =
    localStorage.getItem("current_dice_world") ||
    Object.keys(DiceApp.database)[0];
  if (!DiceApp.database[DiceApp.currentWorld]) {
    DiceApp.currentWorld = Object.keys(DiceApp.database)[0];
  }

  DiceApp.currentCharacter =
    localStorage.getItem("current_dice_char") ||
    Object.keys(DiceApp.database[DiceApp.currentWorld] || {})[0];
  if (
    !DiceApp.database[DiceApp.currentWorld] ||
    !DiceApp.database[DiceApp.currentWorld][DiceApp.currentCharacter]
  ) {
    DiceApp.currentCharacter = Object.keys(
      DiceApp.database[DiceApp.currentWorld],
    )[0];
  }

  DiceApp.rollBuffer = [];
  DiceApp.lastRollTime = 0;

  DiceApp.ensureCharacterStructure();
};
