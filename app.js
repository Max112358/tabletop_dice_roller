// Core database state architecture updated to support custom variable schema objects per profile
let database = JSON.parse(localStorage.getItem("dice_profiles_v2")) || {
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
};

// Fallback cleanup migration helper for old localstorage profiles data if found
if (
  localStorage.getItem("dice_profiles") &&
  !localStorage.getItem("dice_profiles_v2")
) {
  try {
    let oldDb = JSON.parse(localStorage.getItem("dice_profiles"));
    Object.keys(oldDb).forEach((charKey) => {
      if (Array.isArray(oldDb[charKey])) {
        database[charKey] = { buttons: oldDb[charKey], variables: {} };
      }
    });
  } catch (e) {}
}

let currentCharacter =
  localStorage.getItem("current_dice_char") ||
  Object.keys(database)[0] ||
  "Example Paladin";
ensureCharacterStructure(currentCharacter);

function ensureCharacterStructure(charName) {
  if (!database[charName])
    database[charName] = { buttons: [], variables: {}, notes: "" };
  if (!database[charName].buttons) database[charName].buttons = [];
  if (!database[charName].variables) database[charName].variables = {};
  if (typeof database[charName].notes === "undefined")
    database[charName].notes = "";
}

// Rolling Buffer State Variables
let rollBuffer = [];
let lastRollTime = 0;
const COMBO_TIMEOUT_MS = 10000; // 10 seconds tracking limit
let draggedIndex = null; // Drag and drop helper tracking state for buttons
let draggedVarName = null; // Drag and drop helper tracking state for variables

// --- FORMULA VARIABLE VALIDATION CHECKER ---
// --- FORMULA VARIABLE VALIDATION CHECKER ---
function getMissingVariables(formula, checkedVars = new Set()) {
  ensureCharacterStructure(currentCharacter);
  const activeVars = database[currentCharacter].variables || {};

  // Build a lowercase map for case-insensitive checking
  const lowerVars = {};
  Object.keys(activeVars).forEach((k) => {
    lowerVars[k.toLowerCase()] = activeVars[k];
  });

  let missing = [];
  let workingFormula = String(formula);

  // 1. Extract crit rules so they don't break standard variable parsing,
  // but DO check them for missing custom variables.
  let critVars = [];
  workingFormula = workingFormula.replace(
    /crit(?:success|fail)\[([^\]]+)\]/gi,
    (match, val) => {
      let v = val.trim().toLowerCase();
      // Ignore reserved crit keywords; flag anything else as a potential variable
      if (
        v !== "max" &&
        v !== "min" &&
        v !== "doubles" &&
        v !== "yahtzee" &&
        !/^\d+(-\d+)?$/.test(v)
      ) {
        critVars.push(v);
      }
      return ""; // Remove from formula for the normal regex validation
    },
  );

  // Check extracted custom crit vars
  critVars.forEach((v) => {
    if (!lowerVars.hasOwnProperty(v)) {
      missing.push(v);
    } else {
      // Dive into nested variables mapped in the crit rules
      if (!checkedVars.has(v)) {
        checkedVars.add(v);
        let subFormula = String(lowerVars[v]);
        let subMissing = getMissingVariables(subFormula, checkedVars);
        missing = missing.concat(subMissing);
      }
    }
  });

  const bracketRegex = /\[([^\]]+)\]/g;
  let match;

  while ((match = bracketRegex.exec(workingFormula)) !== null) {
    let varName = match[1].trim().toLowerCase();

    if (!lowerVars.hasOwnProperty(varName)) {
      missing.push(match[1].trim());
    } else {
      // Dive into the nested variable to validate its formula too
      if (!checkedVars.has(varName)) {
        checkedVars.add(varName);
        let subFormula = String(lowerVars[varName]);
        let subMissing = getMissingVariables(subFormula, checkedVars);
        missing = missing.concat(subMissing);
      }
    }
  }

  return [...new Set(missing)];
}

// =========================================================================
// REFACTORED DICE PIPELINE ENGINE (RECURSIVE RESOLUTION)
// =========================================================================

function parseAndRoll(label, formula) {
  try {
    ensureCharacterStructure(currentCharacter);
    let activeVars = database[currentCharacter].variables || {};

    let breakdownLogs = [];
    let daggerheartContext = null;
    let primaryRoll = null; // Track the first dice pool rolled for crit logic

    // Extract Crit Rules early so they don't corrupt the PEMDAS/Variable pipeline
    let critSuccessRules = [];
    let critFailRules = [];

    let formulaString = String(formula)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    formulaString = formulaString.replace(
      /critsuccess\[([^\]]+)\]/g,
      (m, val) => {
        critSuccessRules.push(val);
        return "";
      },
    );
    formulaString = formulaString.replace(/critfail\[([^\]]+)\]/g, (m, val) => {
      critFailRules.push(val);
      return "";
    });

    // The core 3-step pipeline wrapped as a recursive executor
    function evaluateMathAndDice(expr, depth = 0) {
      if (depth > 50)
        throw new Error("Infinite loop detected in variable resolution!");

      let workingExpr = String(expr).trim().toLowerCase();

      // STEP 1: RECURSIVE VARIABLE SUBSTITUTION
      const bracketRegex = /\[([^\]]+)\]/g;
      let hasMissingVar = false;
      let missingVarName = "";

      workingExpr = workingExpr.replace(bracketRegex, (fullMatch, varName) => {
        let foundKey = Object.keys(activeVars).find(
          (k) => k.toLowerCase() === varName.trim(),
        );

        if (foundKey !== undefined) {
          return evaluateMathAndDice(activeVars[foundKey], depth + 1);
        } else {
          hasMissingVar = true;
          missingVarName = varName.toUpperCase();
          return fullMatch;
        }
      });

      if (hasMissingVar) {
        throw new Error(`Missing variable reference: [${missingVarName}]`);
      }

      // STEP 2: LEFT-TO-RIGHT DICE EVALUATION LOOP
      const diceRegex =
        /(\d+)d(\d+)(p\d+kh\d+|p\d+kl\d+|kh\d+|kl\d+|daggerheart|explosive)?/;

      while (diceRegex.test(workingExpr)) {
        let matchInstance = workingExpr.match(diceRegex);
        let fullDiceExpression = matchInstance[0];
        let count = parseInt(matchInstance[1], 10);
        let sides = parseInt(matchInstance[2], 10);
        let modifier = matchInstance[3] || "";

        let evaluatedNumericValue = 0;
        let logString = "";
        let finalRollsArray = []; // Tracks specific faces for Yahtzee/Max/Min crit evaluations

        // 1. Daggerheart Interceptor
        if (modifier === "daggerheart") {
          let hopeRoll = Math.floor(Math.random() * sides) + 1;
          let fearRoll = Math.floor(Math.random() * sides) + 1;
          evaluatedNumericValue = hopeRoll + fearRoll;
          finalRollsArray = [hopeRoll, fearRoll];

          let outcome =
            hopeRoll === fearRoll
              ? "CRITICAL SUCCESS! ✨"
              : hopeRoll > fearRoll
                ? "Roll with HOPE ☀️"
                : "Roll with FEAR 🌙";

          daggerheartContext = `[Hope: ${hopeRoll} | Fear: ${fearRoll}] -> ${outcome}`;
          logString = `${fullDiceExpression} (${hopeRoll} hope, ${fearRoll} fear)`;
        }
        // 2. Pool Matching Syntax
        else if (
          modifier.startsWith("p") &&
          (modifier.includes("kh") || modifier.includes("kl"))
        ) {
          let isHighest = modifier.includes("kh");
          let poolMatch = modifier.match(/p(\d+)(kh|kl)(\d+)/);
          let poolIterations = parseInt(poolMatch[1], 10);
          let keepCount = parseInt(poolMatch[3], 10);

          let poolTotals = [];
          let poolDetails = [];

          for (let i = 0; i < poolIterations; i++) {
            let currentIterationRolls = [];
            for (let j = 0; j < count; j++) {
              currentIterationRolls.push(Math.floor(Math.random() * sides) + 1);
            }
            let currentIterationTotal = currentIterationRolls.reduce(
              (sum, val) => sum + val,
              0,
            );
            poolTotals.push(currentIterationTotal);
            poolDetails.push(
              `[${currentIterationRolls.join("+")} = ${currentIterationTotal}]`,
            );
          }

          let keptPools = [];
          if (isHighest) {
            keptPools = [...poolTotals]
              .sort((a, b) => b - a)
              .slice(0, keepCount);
            logString = `${count}d${sides} Pool Sets: { ${poolDetails.join(" vs ")} } -> Kept Highest ${keepCount}: (${keptPools.join("+")})`;
          } else {
            keptPools = [...poolTotals]
              .sort((a, b) => a - b)
              .slice(0, keepCount);
            logString = `${count}d${sides} Pool Sets: { ${poolDetails.join(" vs ")} } -> Kept Lowest ${keepCount}: (${keptPools.join("+")})`;
          }
          evaluatedNumericValue = keptPools.reduce((sum, val) => sum + val, 0);
          finalRollsArray = keptPools; // Yahtzee logic doesn't cleanly apply to pools, but we map it for safety
        }
        // 3. Standard Keep Highest
        else if (modifier.startsWith("kh")) {
          let keepCount = parseInt(modifier.replace("kh", ""), 10);
          let rolls = [];
          for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
          }
          let kept = [...rolls].sort((a, b) => b - a).slice(0, keepCount);
          evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} [Rolls: ${rolls.join(", ")}] Kept: (${kept.join("+")})`;
          finalRollsArray = kept;
        }
        // 4. Standard Keep Lowest
        else if (modifier.startsWith("kl")) {
          let keepCount = parseInt(modifier.replace("kl", ""), 10);
          let rolls = [];
          for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
          }
          let kept = [...rolls].sort((a, b) => a - b).slice(0, keepCount);
          evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} [Rolls: ${rolls.join(", ")}] Kept: (${kept.join("+")})`;
          finalRollsArray = kept;
        }
        // 5. Explosive dice
        else if (modifier.startsWith("explosive")) {
          let rollsDisplay = [];
          let cumulativeSumsArray = [];
          let cumulativeSum = 0;

          for (let i = 0; i < count; i++) {
            let singleDieLogs = [];
            let singleDieTotal = rollExplodingDie(sides, singleDieLogs);

            cumulativeSumsArray.push(singleDieTotal);
            cumulativeSum += singleDieTotal;

            if (singleDieLogs.length > 1) {
              rollsDisplay.push(`(${singleDieLogs.join("+")})`);
            } else {
              rollsDisplay.push(singleDieLogs[0]);
            }
          }

          evaluatedNumericValue = cumulativeSum;
          logString = `${fullDiceExpression} [Dice: ${rollsDisplay.join(", ")}] Total: ${evaluatedNumericValue}`;
          finalRollsArray = cumulativeSumsArray;
        }
        // 6. Plain Vanilla
        else {
          let rolls = [];
          for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
          }
          evaluatedNumericValue = rolls.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} (${rolls.join("+")}=${evaluatedNumericValue})`;
          finalRollsArray = rolls;
        }

        // Lock in the anchor roll metrics for crit tracking
        if (!primaryRoll && count > 0) {
          primaryRoll = {
            count: count,
            sides: sides,
            total: evaluatedNumericValue,
            rolls: finalRollsArray,
          };
        }

        breakdownLogs.push(logString);
        workingExpr = workingExpr.replace(
          fullDiceExpression,
          evaluatedNumericValue,
        );
      }

      // STEP 3: STANDARD PEMDAS MATHEMATICS EVALUATION
      workingExpr = workingExpr.replace(/\s+/g, "");

      if (/[^0-9\+\-\*\/\(\)\.]/.test(workingExpr)) {
        throw new Error(
          `Syntax Error: Unexpected math operator configuration remaining in "${workingExpr}"`,
        );
      }

      return Function(`'use strict'; return (${workingExpr})`)();
    }

    // STEP 4: RESULT MAPPER INTERCEPTOR & CRIT RESOLUTION
    let isLessThan = formulaString.includes("lessthanvs");
    let splitOperator = isLessThan
      ? "lessthanvs"
      : formulaString.includes("vs")
        ? "vs"
        : null;

    let baseFormula = splitOperator
      ? formulaString.split(splitOperator)[0]
      : formulaString;

    let finalResultTotal = evaluateMathAndDice(baseFormula);
    let resultContext = null;
    let isSuccess = null; // Boolean tracker to contextualize "doubles"

    // Evaluate target DCs
    if (splitOperator) {
      let targets = formulaString.split(splitOperator)[1].split("/");

      if (targets.length === 1) {
        let targetDC = evaluateMathAndDice(targets[0]);
        isSuccess = isLessThan
          ? finalResultTotal <= targetDC
          : finalResultTotal >= targetDC;
        let opDisplay = isLessThan ? "<=" : "vs";

        resultContext = isSuccess
          ? `[${opDisplay} ${targetDC}] -> SUCCESS ✨`
          : `[${opDisplay} ${targetDC}] -> FAILURE ❌`;
      } else if (targets.length === 2) {
        let weakDC = evaluateMathAndDice(targets[0]);
        let strongDC = evaluateMathAndDice(targets[1]);

        if (isLessThan) {
          isSuccess = finalResultTotal <= weakDC;
          if (finalResultTotal <= strongDC) {
            resultContext = `[<= ${weakDC}/${strongDC}] -> STRONG SUCCESS ✨`;
          } else if (finalResultTotal <= weakDC) {
            resultContext = `[<= ${weakDC}/${strongDC}] -> WEAK SUCCESS ⚠️`;
          } else {
            resultContext = `[<= ${weakDC}/${strongDC}] -> FAILURE ❌`;
          }
        } else {
          isSuccess = finalResultTotal >= weakDC;
          if (finalResultTotal >= strongDC) {
            resultContext = `[vs ${weakDC}/${strongDC}] -> STRONG SUCCESS ✨`;
          } else if (finalResultTotal >= weakDC) {
            resultContext = `[vs ${weakDC}/${strongDC}] -> WEAK SUCCESS ⚠️`;
          } else {
            resultContext = `[vs ${weakDC}/${strongDC}] -> FAILURE ❌`;
          }
        }
      }
    }

    // --- NEW: CRIT RULE EVALUATOR ---
    function checkCrit(rulesArray, isCheckingSuccess) {
      if (!primaryRoll) return false;

      for (let ruleRaw of rulesArray) {
        let rule = ruleRaw;
        // Hot-swap in variable targets if requested
        let key = Object.keys(activeVars).find(
          (k) => k.toLowerCase() === ruleRaw,
        );
        if (key) rule = String(activeVars[key]).trim().toLowerCase();

        if (rule === "max") {
          if (primaryRoll.total === primaryRoll.count * primaryRoll.sides)
            return true;
        } else if (rule === "min") {
          if (primaryRoll.total === primaryRoll.count) return true;
        } else if (rule === "doubles") {
          const totalStr = String(primaryRoll.total);
          // Matches format (11, 22, 111) but rejects single digits like (9)
          if (totalStr.length > 1 && /^(\d)\1+$/.test(totalStr)) {
            // Smart context handling based on the pass/fail boolean state
            if (isSuccess === true && isCheckingSuccess) return true;
            if (isSuccess === false && !isCheckingSuccess) return true;
            if (isSuccess === null) return true;
          }
        } else if (rule === "yahtzee") {
          if (
            primaryRoll.rolls.length > 1 &&
            primaryRoll.rolls.every((r) => r === primaryRoll.rolls[0])
          ) {
            return true;
          }
        } else if (/^\d+-\d+$/.test(rule)) {
          let parts = rule.split("-");
          if (
            primaryRoll.total >= parseInt(parts[0], 10) &&
            primaryRoll.total <= parseInt(parts[1], 10)
          )
            return true;
        } else if (/^\d+$/.test(rule)) {
          if (primaryRoll.total === parseInt(rule, 10)) return true;
        }
      }
      return false;
    }

    let gotCritSuccess = checkCrit(critSuccessRules, true);
    let gotCritFail = checkCrit(critFailRules, false);
    let critContextTokens = [];

    if (gotCritSuccess) critContextTokens.push("🌟 CRIT SUCCESS!");
    if (gotCritFail) critContextTokens.push("💀 CRIT FAIL!");

    let combinedContext = [
      daggerheartContext,
      resultContext,
      ...critContextTokens,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      total: finalResultTotal,
      breakdown: breakdownLogs.length > 0 ? breakdownLogs.join(" -> ") : null,
      dhContext: combinedContext.length > 0 ? combinedContext : null,
    };
  } catch (error) {
    console.error(error);
    showStatus(
      error.message || "Error evaluating math formula structure!",
      true,
    );
    return null;
  }
}

function rollExplodingDie(sides, logs = []) {
  // Instant safety guard against infinite loops (d1)
  if (sides <= 1) {
    logs.push("1");
    return 1;
  }

  const roll = Math.floor(Math.random() * sides) + 1;

  if (roll === sides) {
    logs.push(`${roll}!`);
    return roll + rollExplodingDie(sides, logs);
  } else {
    logs.push(`${roll}`);
    return roll;
  }
}

function executeRoll(label, formula, note, buttonElement) {
  const missing = getMissingVariables(formula);
  if (missing.length > 0) {
    showStatus(`Cannot roll! Missing variables: ${missing.join(", ")}`, true);
    return;
  }

  const currentTime = Date.now();
  // Pass both label and formula to parseAndRoll
  const rollData = parseAndRoll(label, formula);

  if (!rollData || isNaN(rollData.total)) {
    showStatus("Error evaluating math or dice formula! Check syntax.", true);
    return;
  }

  // Format single roll line strings cleanly with current active character name
  let singleLineOutput = `*${currentCharacter} rolls ${label} (${formula}):* **${rollData.total}**`;
  if (rollData.dhContext) singleLineOutput += ` ${rollData.dhContext}`;
  if (rollData.breakdown)
    singleLineOutput += ` [Details: ${rollData.breakdown}]`;
  if (note) singleLineOutput += ` *(${note})*`;

  if (currentTime - lastRollTime > COMBO_TIMEOUT_MS) {
    rollBuffer = [];
  }

  rollBuffer.push(singleLineOutput);
  lastRollTime = currentTime;

  const combinedOutputText = rollBuffer.join("\n");

  navigator.clipboard
    .writeText(combinedOutputText)
    .then(() => {
      showStatus(
        rollBuffer.length > 1
          ? `Combined sequence copy active (${rollBuffer.length} rolls)!`
          : `Copied roll for ${label}!`,
      );

      document.getElementById("resTitle").innerHTML =
        `Active Stack: <strong>${rollBuffer.length} Roll(s)</strong>`;
      document.getElementById("resRaw").innerText = combinedOutputText;

      const timerBadge = document.getElementById("bufferTimer");
      timerBadge.style.display = "inline-block";
      timerBadge.innerText = `Combo active: +10s added`;

      if (buttonElement) {
        const originalText = buttonElement.innerText;
        buttonElement.innerText = "✓ Added!";
        buttonElement.classList.add("success-flash");

        setTimeout(() => {
          buttonElement.innerText = originalText;
          buttonElement.classList.remove("success-flash");
        }, 600);
      }
    })
    .catch((err) => {
      showStatus("Clipboard execution error!", true);
    });
}

// --- CORE DICE ROLL SIMULATOR ---
function rollBasicDice(countStr, sidesStr) {
  const count = countStr ? parseInt(countStr) : 1;
  const sides = parseInt(sidesStr);
  let rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return {
    total: rolls.reduce((a, b) => a + b, 0),
    breakdown: rolls,
  };
}

function evaluateSimpleExpression(expr, detailedRolls) {
  const diceRegex = /(\d*)d(\d+)(kh|kl)?(\d*)/g;

  return expr.replace(diceRegex, (match, countStr, sidesStr, mod, keepStr) => {
    const count = countStr ? parseInt(countStr) : 1;
    const sides = parseInt(sidesStr);
    const roll = rollBasicDice(count, sides);

    const formatRoll = (val) => {
      if (sides === 20 && (val === 1 || val === 20)) {
        return `Natural ${val}`;
      }
      return val;
    };

    if (mod) {
      const keepCount = keepStr ? parseInt(keepStr) : 1;
      let indexed = roll.breakdown.map((val, idx) => ({ val, idx }));

      if (mod === "kh") indexed.sort((a, b) => b.val - a.val);
      else indexed.sort((a, b) => a.val - b.val);

      let keptIndices = indexed.slice(0, keepCount).map((item) => item.idx);
      let keptRolls = [];
      let droppedRolls = [];

      roll.breakdown.forEach((val, idx) => {
        let formattedVal = formatRoll(val);
        if (keptIndices.includes(idx)) {
          keptRolls.push(formattedVal);
        } else {
          droppedRolls.push(formattedVal);
        }
      });

      let allRollsStr = roll.breakdown.map(formatRoll).join(" OR ");
      let stringBreakdown = `${allRollsStr} -> Kept: ${keptRolls.join(", ")}`;

      detailedRolls.push(
        `${count}d${sides}${mod}${keepCount} (${stringBreakdown})`,
      );
      let keptSum = indexed
        .slice(0, keepCount)
        .reduce((sum, item) => sum + item.val, 0);
      return `(${keptSum})`;
    } else {
      let formattedBreakdown = roll.breakdown.map(formatRoll).join("+");
      detailedRolls.push(`${count}d${sides} (${formattedBreakdown})`);
      return `(${roll.total})`;
    }
  });
}

// Auto-cleanup timer window update loop
setInterval(() => {
  if (rollBuffer.length > 0) {
    const timePassed = Date.now() - lastRollTime;
    const timerBadge = document.getElementById("bufferTimer");

    if (timePassed > COMBO_TIMEOUT_MS) {
      timerBadge.style.display = "none";
      document.getElementById("resTitle").innerHTML =
        `Stack Expired <span style="font-size:12px; font-weight:normal; color:#a6adc8;">(Next click resets)</span>`;
    } else {
      const remainingSeconds = ((COMBO_TIMEOUT_MS - timePassed) / 1000).toFixed(
        1,
      );
      timerBadge.innerText = `Combo Window: ${remainingSeconds}s`;
    }
  }
}, 200);

// --- UI & STATE MANAGEMENT ---
function saveToStorage() {
  localStorage.setItem("dice_profiles_v2", JSON.stringify(database));
  localStorage.setItem("current_dice_char", currentCharacter);
}

// Modal Display Control Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("modal-hidden");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("modal-hidden");
  }
}

// Optional: Close modals automatically if the user presses the 'Escape' key
window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.classList.add("modal-hidden");
    });
  }
});

function renderNotes() {
  const notesArea = document.getElementById("charNotes");
  if (notesArea) {
    notesArea.value = database[currentCharacter].notes || "";
  }
}

function renderCharacterSelect() {
  const select = document.getElementById("charSelect");
  if (!select) return;
  select.innerHTML = "";
  Object.keys(database).forEach((char) => {
    const opt = document.createElement("option");
    opt.value = char;
    opt.innerText = char;
    if (char === currentCharacter) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderVariables() {
  const varContainer = document.getElementById("varContainer");
  if (!varContainer) return;
  varContainer.innerHTML = "";
  const variables = database[currentCharacter].variables || {};

  Object.keys(variables).forEach((varName) => {
    const badge = document.createElement("div");
    badge.className = "var-badge";
    badge.setAttribute("draggable", true);
    badge.style.cursor = "grab";

    badge.ondragstart = function (e) {
      draggedVarName = varName;
      this.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
    };
    badge.ondragend = function () {
      this.style.opacity = "1";
      draggedVarName = null;
      document
        .querySelectorAll(".var-badge")
        .forEach((el) => (el.style.border = "1px solid #45475a"));
    };
    badge.ondragover = function (e) {
      e.preventDefault();
      return false;
    };
    badge.ondragenter = function (e) {
      const targetBadge = e.target.closest(".var-badge");
      if (targetBadge && varName !== draggedVarName)
        targetBadge.style.border = "1px dashed #89b4fa";
    };
    badge.ondragleave = function (e) {
      const relatedTargetBadge = e.relatedTarget
        ? e.relatedTarget.closest(".var-badge")
        : null;
      if (relatedTargetBadge !== this) this.style.border = "1px solid #45475a";
    };
    badge.ondrop = function (e) {
      e.preventDefault();
      this.style.border = "1px solid #45475a";
      if (draggedVarName !== null && draggedVarName !== varName) {
        const varKeys = Object.keys(variables);
        const sourceIndex = varKeys.indexOf(draggedVarName);
        const targetIndex = varKeys.indexOf(varName);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          varKeys.splice(sourceIndex, 1);
          varKeys.splice(targetIndex, 0, draggedVarName);

          const newVariables = {};
          varKeys.forEach((k) => {
            newVariables[k] = variables[k];
          });

          database[currentCharacter].variables = newVariables;
          saveToStorage();
          renderVariables();
        }
      }
    };

    const label = document.createElement("span");
    label.className = "var-name";
    label.innerText = varName;

    const input = document.createElement("input");
    const isNumeric =
      !isNaN(parseFloat(variables[varName])) && isFinite(variables[varName]);
    input.type = isNumeric ? "number" : "text";
    input.className = "var-val-input";
    input.value = variables[varName];
    input.setAttribute("draggable", false);
    input.onchange = function () {
      updateVariableValue(varName, this.value);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "var-del-btn";
    delBtn.innerHTML = "✕";
    delBtn.title = `Delete variable ${varName}`;
    delBtn.setAttribute("draggable", false);
    delBtn.onclick = function (e) {
      e.stopPropagation();
      removeVariable(varName);
    };

    badge.appendChild(label);
    badge.appendChild(input);
    badge.appendChild(delBtn);
    varContainer.appendChild(badge);
  });
}

function renderDiceGrid() {
  const grid = document.getElementById("diceGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const buttons = database[currentCharacter].buttons || [];

  buttons.forEach((btn, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "dice-btn";
    wrapper.setAttribute("draggable", true);
    wrapper.style.cursor = "grab";

    const missingVars = getMissingVariables(btn.formula);
    if (missingVars.length > 0) {
      wrapper.classList.add("broken");
    }

    wrapper.ondragstart = function (e) {
      draggedIndex = index;
      this.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
    };
    wrapper.ondragend = function () {
      this.style.opacity = "1";
      draggedIndex = null;
      document
        .querySelectorAll(".dice-btn")
        .forEach((el) => (el.style.border = "none"));
    };
    wrapper.ondragover = function (e) {
      e.preventDefault();
      return false;
    };
    wrapper.ondragenter = function (e) {
      const targetCard = e.target.closest(".dice-btn");
      if (targetCard && index !== draggedIndex)
        targetCard.style.border = "1px dashed #89b4fa";
    };
    wrapper.ondragleave = function (e) {
      const relatedTargetCard = e.relatedTarget
        ? e.relatedTarget.closest(".dice-btn")
        : null;
      if (relatedTargetCard !== this) this.style.border = "none";
    };
    wrapper.ondrop = function (e) {
      e.preventDefault();
      this.style.border = "none";
      if (draggedIndex !== null && draggedIndex !== index) {
        const movedItem = database[currentCharacter].buttons.splice(
          draggedIndex,
          1,
        )[0];
        database[currentCharacter].buttons.splice(index, 0, movedItem);
        saveToStorage();
        renderDiceGrid();
      }
    };

    const rollBtn = document.createElement("button");
    rollBtn.style.width = "100%";
    rollBtn.style.whiteSpace = "pre-line";
    rollBtn.style.cursor = "pointer";
    rollBtn.innerText = btn.label;

    let tooltipText = `Formula: ${btn.formula}`;
    if (btn.note) {
      tooltipText += `\nNote: ${btn.note}`;
    }
    rollBtn.title = tooltipText;

    rollBtn.onclick = function () {
      executeRoll(btn.label, btn.formula, btn.note, this);
    };
    rollBtn.setAttribute("draggable", false);

    const errorBadge = document.createElement("div");
    errorBadge.className = "error-badge";
    errorBadge.innerText = `⚠️ Missing: ${missingVars.join(", ")}`;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-corner-btn";
    delBtn.innerText = "✕";
    delBtn.title = `Delete ${btn.label}`;
    delBtn.setAttribute("draggable", false);
    delBtn.onclick = (e) => {
      e.stopPropagation();
      removeButton(index, btn.label);
    };

    wrapper.appendChild(rollBtn);
    wrapper.appendChild(errorBadge);
    wrapper.appendChild(delBtn);
    grid.appendChild(wrapper);
  });
}

// Master coordinator function
function renderUI() {
  ensureCharacterStructure(currentCharacter);
  renderNotes();
  renderCharacterSelect();
  renderVariables();
  renderDiceGrid();
}

// --- VARIABLE MANAGEMENT SUB-ROUTINES ---
function addVariable() {
  const nameInput = document.getElementById("newVarName");
  const valInput = document.getElementById("newVarValue"); // Ensure this is also type="text" in your HTML!

  const rawName = nameInput.value.trim().toUpperCase();
  const cleanName = rawName.replace(/[^A-Z_-]/g, ""); //allow uppercase letters, underscore and dashes
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

  database[currentCharacter].variables[cleanName] = finalValue;
  saveToStorage();
  renderUI();

  nameInput.value = "";
  valInput.value = "";
  showStatus(`Variable "${cleanName}" added!`);
}

function updateVariableValue(name, val) {
  const valueStr = val.trim();
  const cleanVal = parseFloat(valueStr);

  // Store as a strict number if it is one, otherwise store the raw text formula string
  database[currentCharacter].variables[name] =
    !isNaN(cleanVal) && cleanVal.toString() === valueStr ? cleanVal : valueStr;

  saveToStorage();
  renderUI();
  showStatus(`Updated variable "${name}"`);
}

function updateNotes(text) {
  database[currentCharacter].notes = text;
  saveToStorage();
}

function removeVariable(name) {
  if (confirm(`Delete character variable "${name}"?`)) {
    delete database[currentCharacter].variables[name];
    saveToStorage();
    renderUI();
    showStatus(`Deleted variable "${name}".`);
  }
}

// --- GENERAL MANAGEMENT ---
function switchCharacter() {
  currentCharacter = document.getElementById("charSelect").value;
  saveToStorage();
  renderUI();
  rollBuffer = [];
  document.getElementById("resTitle").innerText = "No dice rolled yet...";
  document.getElementById("resRaw").innerText =
    "Click a custom action button above to calculate a formula string.";
  document.getElementById("bufferTimer").style.display = "none";
}

function createCharacter() {
  const name = document.getElementById("newCharName").value.trim();
  if (!name) return;
  if (!database[name])
    database[name] = { buttons: [], variables: {}, notes: "" }; // Updated line
  currentCharacter = name;
  document.getElementById("newCharName").value = "";
  saveToStorage();
  renderUI();
}

function deleteCharacter() {
  if (
    confirm(
      `Are you sure you want to delete all profiles/buttons for ${currentCharacter}?`,
    )
  ) {
    delete database[currentCharacter];
    const remaining = Object.keys(database);
    currentCharacter = remaining.length ? remaining[0] : "Example Paladin";
    ensureCharacterStructure(currentCharacter);
    saveToStorage();
    renderUI();
  }
}

function addButton() {
  const label = document.getElementById("btnLabel").value.trim();
  const formula = document.getElementById("btnFormula").value.trim();
  const note = document.getElementById("btnNote").value.trim();

  if (!label || !formula) {
    showStatus("Label and Formula are required!", true);
    return;
  }

  database[currentCharacter].buttons.push({ label, formula, note });
  saveToStorage();
  renderUI();

  document.getElementById("btnLabel").value = "";
  document.getElementById("btnFormula").value = "";
  document.getElementById("btnNote").value = "";
}

function removeButton(index, label) {
  if (confirm(`Delete the "${label}" macro button?`)) {
    database[currentCharacter].buttons.splice(index, 1);
    saveToStorage();
    renderUI();
    showStatus(`Deleted "${label}" macro.`);
  }
}

// --- DATA IMPORT / EXPORT DATA LOGIC ---
function exportCharacter() {
  ensureCharacterStructure(currentCharacter);
  const exportPack = {
    characterName: currentCharacter,
    buttons: database[currentCharacter].buttons,
    variables: database[currentCharacter].variables,
    notes: database[currentCharacter].notes, // Added notes property
  };
  document.getElementById("ioJson").value = JSON.stringify(exportPack);
  showStatus("JSON package generated! Copy it from the text block below.");
}

function importCharacter() {
  const rawJson = document.getElementById("ioJson").value.trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed.characterName && Array.isArray(parsed.buttons)) {
      database[parsed.characterName] = {
        buttons: parsed.buttons,
        variables: parsed.variables || {},
        notes: parsed.notes || "", // Added fallback parsing for notes
      };
      currentCharacter = parsed.characterName;
      saveToStorage();
      renderUI();
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
}

function showStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.style.color = isError ? "#f38ba8" : "#a6e3a1";
  el.innerText = msg;
  setTimeout(() => {
    el.innerText = "";
  }, 4000);
}

function factoryResetDatabase() {
  const firstConfirmation = confirm(
    "WARNING: This will permanently delete ALL characters, custom buttons, and variables from this browser's local storage.\n\nAre you sure you want to proceed?",
  );

  if (firstConfirmation) {
    // Double-check confirmation to prevent accidental multi-clicks or rapid confirmation bypassing
    const secondConfirmation = confirm(
      "FINAL CONFIRMATION:\n\nThis action is irreversible. Press OK to completely wipe the application data and reload the page.",
    );

    if (secondConfirmation) {
      // Clear out all versions of app keys tracked in localStorage
      localStorage.removeItem("dice_profiles_v2");
      localStorage.removeItem("dice_profiles");
      localStorage.removeItem("current_dice_char");

      // Reload the window to re-trigger the default state architecture setup
      window.location.reload();
    }
  }
}

// Initialize on execution

renderUI();
