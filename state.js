window.DiceApp = window.DiceApp || {};

// Theme & timing
DiceApp.success_color = "#0b7002";
DiceApp.fail_color = "#8b0229";
DiceApp.success_fail_flash_duration = 1;
DiceApp.COMBO_TIMEOUT_MS = 10000;

const DEFAULT_DATABASE = {
  "Example World": {
    "Example Paladin (D&D)": {
      buttons: [
        {
          label: "Longsword (Standard) Vs AC",
          formula: "1d20+[STR]+[PROF]+[BLESS]vs[ENEMY_AC]",
          note: "To Hit",
        },
        {
          label: "Longsword (Advantage)",
          formula: "2d20kh1+[STR]+[PROF]+[BLESS]vs[ENEMY_AC]",
          note: "To Hit",
        },
        {
          label: "Longsword (Disadvantage)",
          formula: "2d20kl1+[STR]+[PROF]+[BLESS]vs[ENEMY_AC]",
          note: "To Hit",
        },
        {
          label: "Longsword Savage Attacker Damage",
          formula: "[CRIT_MULTIPLIER]d8p2kh1+[STR]",
          note: "Slashing",
        },
        {
          label: "Divine Smite",
          formula: "[SMITE_DICE]d8",
          note: "Radiant Damage",
        },
        {
          label: "Athletics Check",
          formula: "1d20+[STR]+[PROF]+[GUIDANCE]",
          note: "",
        },
        {
          label: "Athletics Check Vs DC",
          formula: "1d20+[STR]+[PROF]+[GUIDANCE]vs[TARGET_DC]",
          note: "",
        },
      ],
      variables: {
        STR: 4,
        PROF: 2,
        HIT_POINTS: 20,
        AC: 18,
        CRIT_MULTIPLIER: 1,
        SMITE_DICE_BASE: 2,
        SMITE_DICE: "[SMITE_DICE_BASE] * [CRIT_MULTIPLIER]",
        BLESS_MULTIPLIER: 0,
        BLESS: "[BLESS_MULTIPLIER]d4",
        GUIDANCE_MULTIPLIER: 0,
        GUIDANCE: "[GUIDANCE_MULTIPLIER]d4",
        TARGET_DC: 16,
        ENEMY_AC: 14,
      },
      notes:
        "11 gold, 2 silver, 3 copper. Longsword +1, Shield +1, Chainmail +1. Potion of Healing x2.",
    },
    "Example Seraph (Daggerheart)": {
      buttons: [
        { label: "Daggerheart Action", formula: "2d12daggerheart", note: "" },
        {
          label: "Daggerheart Action Vs DC",
          formula: "2d12daggerheartvs[TARGET_DC]",
          note: "",
        },
        {
          label: "Daggerheart Action With Exp Vs DC",
          formula: "2d12daggerheart+2vs[TARGET_DC]",
          note: "",
        },
        {
          label: "Greatsword Attack",
          formula: "2d12daggerheart+[STR]vs[ENEMY_DIFFICULTY]",
          note: "To Hit",
        },
        {
          label: "Greatsword Attack (Advantage)",
          formula: "2d12daggerheart+[STR]+1d6vs[ENEMY_DIFFICULTY]",
          note: "To Hit",
        },
        {
          label: "Greatsword Attack (Disadvantage)",
          formula: "2d12daggerheart+[STR]-1d6vs[ENEMY_DIFFICULTY]",
          note: "To Hit",
        },
        {
          label: "Greatsword Damage",
          formula: "[ATTACK_DICE]d10kh[PROF]+3",
          note: "Physical damage",
        },
        {
          label: "Greatsword Damage Crit",
          formula: "[PROF]*10+[ATTACK_DICE]d10kh[PROF]+3",
          note: "Physical damage critical hit",
        },
      ],
      variables: {
        STR: 2,
        PROF: 1,
        HOPE: 2,
        STRESS: 6,
        HIT_POINTS: 6,
        EVASION: 9,
        DAMAGE_THRESHOLDS: "7/15",
        ARMOR: 4,
        ATTACK_DICE: "[PROF]+1",
        TARGET_DC: 16,
        ENEMY_DIFFICULTY: 11,
      },
      notes: "Potion of Healing x2.",
    },
  },
};

DiceApp.database =
  JSON.parse(localStorage.getItem("dice_worlds_v1")) ||
  JSON.parse(JSON.stringify(DEFAULT_DATABASE));

// Guard against an empty database object
if (!Object.keys(DiceApp.database).length) {
  DiceApp.database = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
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
  localStorage.setItem("dice_worlds_v1", JSON.stringify(DiceApp.database));
  localStorage.setItem("current_dice_world", DiceApp.currentWorld);
  localStorage.setItem("current_dice_char", DiceApp.currentCharacter);
};

DiceApp.ensureCharacterStructure();
