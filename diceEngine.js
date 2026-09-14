window.DiceApp = window.DiceApp || {};

DiceApp.getMissingVariables = function (formula, checkedVars = new Set()) {
  const t0 = performance.now();
  DiceApp.ensureCharacterStructure(DiceApp.currentCharacter);
  const activeVars = DiceApp.database[DiceApp.currentCharacter].variables || {};

  const lowerVars = {};
  Object.keys(activeVars).forEach((k) => {
    lowerVars[k.toLowerCase()] = activeVars[k];
  });

  let missing = [];
  let workingFormula = String(formula);

  let critVars = [];
  workingFormula = workingFormula.replace(
    /crit(?:success|fail)\[([^\]]+)\]/gi,
    (match, val) => {
      let v = val.trim().toLowerCase();
      if (
        v !== "max" &&
        v !== "min" &&
        v !== "doubles" &&
        v !== "yahtzee" &&
        !/^\d+(-\d+)?$/.test(v)
      ) {
        critVars.push(v);
      }
      return "";
    },
  );

  critVars.forEach((v) => {
    if (!lowerVars.hasOwnProperty(v)) {
      missing.push(v);
    } else {
      if (!checkedVars.has(v)) {
        checkedVars.add(v);
        let subMissing = DiceApp.getMissingVariables(
          String(lowerVars[v]),
          checkedVars,
        );
        missing = missing.concat(subMissing);
      }
    }
  });

  workingFormula = workingFormula.replace(
    /reroll(?:once|repeating|additively|additivelyrepeating)\[([^\]]+)\]/gi,
    (match, val) => {
      let v = val.trim().toLowerCase();
      if (v !== "max" && v !== "min" && !/^\d+$/.test(v)) {
        critVars.push(v);
      }
      return "";
    },
  );

  workingFormula = workingFormula.replace(
    /replace\[\d+(?:-\d+)?\]\[\d+\]/gi,
    "",
  );

  const bracketRegex = /\[([^\]]+)\]/g;
  let match;

  while ((match = bracketRegex.exec(workingFormula)) !== null) {
    let varName = match[1].trim().toLowerCase();
    if (!lowerVars.hasOwnProperty(varName)) {
      missing.push(match[1].trim());
    } else {
      if (!checkedVars.has(varName)) {
        checkedVars.add(varName);
        let subMissing = DiceApp.getMissingVariables(
          String(lowerVars[varName]),
          checkedVars,
        );
        missing = missing.concat(subMissing);
      }
    }
  }

  DiceApp.logElapsed("getMissingVariables", t0, 10);
  return [...new Set(missing)];
};

DiceApp.parseAndRoll = function (label, formula) {
  try {
    DiceApp.ensureCharacterStructure(DiceApp.currentCharacter);
    let activeVars = DiceApp.database[DiceApp.currentCharacter].variables || {};

    let breakdownLogs = [];
    let daggerheartContext = null;
    let primaryRoll = null;

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

    function evaluateMathAndDice(expr, depth = 0) {
      if (depth > 50)
        throw new Error("Infinite loop detected in variable resolution!");

      let workingExpr = String(expr).trim().toLowerCase();

      // Variable substitution
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
          if (
            /^(min|max)$/i.test(varName.trim()) ||
            /^\d+(-\d+)?$/.test(varName.trim())
          ) {
            return fullMatch;
          }
          hasMissingVar = true;
          missingVarName = varName.toUpperCase();
          return fullMatch;
        }
      });

      if (hasMissingVar) {
        throw new Error(`Missing variable reference: [${missingVarName}]`);
      }

      // Parentheses / math functions
      const parenRegex = /(max|min|ceil|floor|round)?\(([^()]+)\)/;
      while (parenRegex.test(workingExpr)) {
        workingExpr = workingExpr.replace(
          parenRegex,
          (fullMatch, funcName, innerExpr) => {
            if (funcName) {
              let args = innerExpr
                .split(",")
                .map((arg) => evaluateMathAndDice(arg, depth + 1));
              return Math[funcName](...args);
            } else {
              return evaluateMathAndDice(innerExpr, depth + 1);
            }
          },
        );
      }

      // Dice evaluation loop
      const diceRegex =
        /(\d+)d(\d+)(?:replace\[(\d+)(?:-(\d+))?\]\[(\d+)\])?(p\d+kh\d+|p\d+kl\d+|kh\d+|kl\d+|daggerheart|reroll(?:once|repeating|additively|additivelyrepeating)\[[^\]]+\])?/;

      while (diceRegex.test(workingExpr)) {
        let matchInstance = workingExpr.match(diceRegex);
        let fullDiceExpression = matchInstance[0];
        let count = parseInt(matchInstance[1], 10);
        let sides = parseInt(matchInstance[2], 10);

        let hasReplace = matchInstance[3] !== undefined;
        let repMin = hasReplace ? parseInt(matchInstance[3], 10) : null;
        let repMax = matchInstance[4] ? parseInt(matchInstance[4], 10) : repMin;
        let repTarget = hasReplace ? parseInt(matchInstance[5], 10) : null;
        let modifier = matchInstance[6] || "";

        const getRoll = () => {
          let r = Math.floor(Math.random() * sides) + 1;
          return hasReplace && r >= repMin && r <= repMax ? repTarget : r;
        };

        let evaluatedNumericValue = 0;
        let logString = "";
        let finalRollsArray = [];

        if (modifier === "daggerheart") {
          let hopeRoll = getRoll();
          let fearRoll = getRoll();
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
        } else if (
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
              currentIterationRolls.push(getRoll());
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
          finalRollsArray = keptPools;
        } else if (modifier.startsWith("kh")) {
          let keepCount = parseInt(modifier.replace("kh", ""), 10);
          let rolls = [];
          for (let i = 0; i < count; i++) rolls.push(getRoll());
          let kept = [...rolls].sort((a, b) => b - a).slice(0, keepCount);
          evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} [Rolls: ${rolls.join(", ")}] Kept: (${kept.join("+")})`;
          finalRollsArray = kept;
        } else if (modifier.startsWith("kl")) {
          let keepCount = parseInt(modifier.replace("kl", ""), 10);
          let rolls = [];
          for (let i = 0; i < count; i++) rolls.push(getRoll());
          let kept = [...rolls].sort((a, b) => a - b).slice(0, keepCount);
          evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} [Rolls: ${rolls.join(", ")}] Kept: (${kept.join("+")})`;
          finalRollsArray = kept;
        } else if (modifier.startsWith("reroll")) {
          let rerollMatch = modifier.match(
            /reroll(once|repeating|additively|additivelyrepeating)\[([^\]]+)\]/,
          );
          let mode = rerollMatch[1];
          let targetRaw = rerollMatch[2];

          if (
            Object.keys(activeVars).some((k) => k.toLowerCase() === targetRaw)
          ) {
            let key = Object.keys(activeVars).find(
              (k) => k.toLowerCase() === targetRaw,
            );
            targetRaw = String(activeVars[key]).trim().toLowerCase();
          }
          let targetNum =
            targetRaw === "max"
              ? sides
              : targetRaw === "min"
                ? 1
                : parseInt(targetRaw, 10);

          let rollsDisplay = [];
          let cumulativeSumsArray = [];
          let cumulativeSum = 0;

          for (let i = 0; i < count; i++) {
            let currentRoll = getRoll();
            let singleDieLogs = [];
            let dieTotal = currentRoll;
            let iterations = 0;

            if (mode === "once" || mode === "repeating") {
              if (currentRoll === targetNum && sides > 1) {
                singleDieLogs.push(`~~${currentRoll}~~`);
                let maxIter = mode === "once" ? 1 : 50;
                while (
                  currentRoll === targetNum &&
                  iterations < maxIter &&
                  sides > 1
                ) {
                  currentRoll = getRoll();
                  iterations++;
                  if (currentRoll === targetNum && iterations < maxIter) {
                    singleDieLogs.push(`~~${currentRoll}~~`);
                  }
                }
                singleDieLogs.push(`${currentRoll}`);
                dieTotal = currentRoll;
              } else {
                singleDieLogs.push(`${currentRoll}`);
              }
              cumulativeSum += dieTotal;
              cumulativeSumsArray.push(dieTotal);
            } else if (
              mode === "additively" ||
              mode === "additivelyrepeating"
            ) {
              singleDieLogs.push(`${currentRoll}`);
              if (currentRoll === targetNum && sides > 1) {
                let maxIter = mode === "additively" ? 1 : 50;
                while (
                  currentRoll === targetNum &&
                  iterations < maxIter &&
                  sides > 1
                ) {
                  currentRoll = getRoll();
                  singleDieLogs.push(`${currentRoll}`);
                  dieTotal += currentRoll;
                  iterations++;
                }
              }
              cumulativeSum += dieTotal;
              cumulativeSumsArray.push(dieTotal);
            }

            if (singleDieLogs.length > 1) {
              rollsDisplay.push(
                `(${singleDieLogs.join(mode.includes("additively") ? "+" : " -> ")})`,
              );
            } else {
              rollsDisplay.push(singleDieLogs[0]);
            }
          }

          evaluatedNumericValue = cumulativeSum;
          logString = `${fullDiceExpression} [Dice: ${rollsDisplay.join(", ")}] Total: ${evaluatedNumericValue}`;
          finalRollsArray = cumulativeSumsArray;
        } else {
          let rolls = [];
          for (let i = 0; i < count; i++) rolls.push(getRoll());
          evaluatedNumericValue = rolls.reduce((sum, val) => sum + val, 0);
          logString = `${fullDiceExpression} (${rolls.join("+")}=${evaluatedNumericValue})`;
          finalRollsArray = rolls;
        }

        let keptCount = count;
        if (modifier) {
          if (modifier.startsWith("kh") || modifier.startsWith("kl")) {
            keptCount = parseInt(modifier.replace(/k[hl]/, ""), 10);
          } else if (
            modifier.startsWith("p") &&
            (modifier.includes("kh") || modifier.includes("kl"))
          ) {
            let poolMatch = modifier.match(/p(\d+)(kh|kl)(\d+)/);
            let poolKeep = parseInt(poolMatch[3], 10);
            keptCount = poolKeep * count;
          } else if (modifier === "daggerheart") {
            keptCount = 2;
          }
        }

        if (!primaryRoll && count > 0) {
          primaryRoll = {
            count: keptCount,
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

      workingExpr = workingExpr.replace(/\s+/g, "");
      if (/[^0-9\+\-\*\/\(\)\.]/.test(workingExpr)) {
        throw new Error(
          `Syntax Error: Unexpected math operator configuration remaining in "${workingExpr}"`,
        );
      }
      return Function(`'use strict'; return (${workingExpr})`)();
    }

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
    let isSuccess = null;

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

    function checkCrit(rulesArray, isCheckingSuccess) {
      if (!primaryRoll) return false;

      for (let ruleRaw of rulesArray) {
        let rule = ruleRaw;
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
          if (
            totalStr.length > 1 &&
            /^(\d)\1+$/.test(totalStr) &&
            ((isSuccess === true && isCheckingSuccess) ||
              (isSuccess === false && !isCheckingSuccess) ||
              isSuccess === null)
          ) {
            return true;
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

    if (gotCritSuccess) critContextTokens.push("🌟 CRITICAL SUCCESS!");
    if (gotCritFail) critContextTokens.push("💀 CRITICAL FAILURE!");

    let combinedContext = [
      daggerheartContext,
      resultContext,
      ...critContextTokens,
    ]
      .filter(Boolean)
      .join(" | ");

    let isDhCritSuccess = daggerheartContext
      ? daggerheartContext.includes("CRITICAL SUCCESS")
      : false;

    return {
      total: finalResultTotal,
      breakdown: breakdownLogs.length > 0 ? breakdownLogs.join(" -> ") : null,
      dhContext: combinedContext.length > 0 ? combinedContext : null,
      isCritSuccess: gotCritSuccess || isDhCritSuccess,
      isCritFail: gotCritFail,
      isSuccess: isSuccess,
    };
  } catch (error) {
    console.error(error);
    showStatus(
      error.message || "Error evaluating math formula structure!",
      true,
    );
    return null;
  }
};

DiceApp.rollExplodingDie = function (sides, logs = []) {
  if (sides <= 1) {
    logs.push("1");
    return 1;
  }
  const roll = Math.floor(Math.random() * sides) + 1;
  if (roll === sides) {
    logs.push(`${roll}!`);
    return roll + DiceApp.rollExplodingDie(sides, logs);
  } else {
    logs.push(`${roll}`);
    return roll;
  }
};

DiceApp.rollBasicDice = function (countStr, sidesStr) {
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
};

DiceApp.evaluateSimpleExpression = function (expr, detailedRolls) {
  const diceRegex = /(\d*)d(\d+)(kh|kl)?(\d*)/g;

  return expr.replace(diceRegex, (match, countStr, sidesStr, mod, keepStr) => {
    const count = countStr ? parseInt(countStr) : 1;
    const sides = parseInt(sidesStr);
    const roll = DiceApp.rollBasicDice(count, sides);

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

      roll.breakdown.forEach((val, idx) => {
        let formattedVal = formatRoll(val);
        if (keptIndices.includes(idx)) keptRolls.push(formattedVal);
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
};
