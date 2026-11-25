import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs, checkCritRule } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";
import { rollDie } from "./nodesShared.js";

export default function register() {
  registry.register({
    type: "dice",
    label: "Dice Roll",
    category: "composite",

    create() {
      return {
        type: "dice",
        count: { type: "number", value: 1 },
        sides: { type: "number", value: 20 },
        modifiers: [],
      };
    },

    evaluate(node, ctx) {
      const count = Math.max(0, Math.floor(ctx.evaluate(node.count).value));
      const sides = Math.max(1, Math.floor(ctx.evaluate(node.sides).value));

      let rollFn = () => rollDie(sides);

      for (const mod of node.modifiers || []) {
        if (mod.type === "replace") {
          const oldFn = rollFn;
          rollFn = () => {
            const r = oldFn();
            if (r >= mod.min && r <= mod.max) return mod.with;
            return r;
          };
        }
      }

      let rolls = [];
      for (let i = 0; i < count; i++) rolls.push(rollFn());

      for (const mod of node.modifiers || []) {
        if (mod.type === "reroll") {
          applyReroll(rolls, mod, rollFn, sides, ctx);
        }
      }

      let activeRolls = [...rolls];
      let keptRolls = activeRolls;
      let total = keptRolls.reduce((a, b) => a + b, 0);
      let breakdown = `${count}d${sides} (${activeRolls.join("+")}=${total})`;

      for (const mod of node.modifiers || []) {
        if (mod.type === "keep") {
          const keepCount = Math.max(
            1,
            Math.floor(ctx.evaluate(mod.count).value),
          );
          keptRolls = [...activeRolls]
            .sort(mod.mode === "highest" ? (a, b) => b - a : (a, b) => a - b)
            .slice(0, keepCount);
          total = keptRolls.reduce((a, b) => a + b, 0);
          breakdown += ` -> keep ${mod.mode} ${keepCount}: (${keptRolls.join("+")}=${total})`;
        }
      }

      const critResult = checkDiceCrits(
        node.modifiers || [],
        {
          count: keptRolls.length,
          sides,
          total,
          rolls: keptRolls,
        },
        ctx,
      );

      ctx.trackPrimaryRoll({
        count: keptRolls.length,
        sides,
        total,
        rolls: keptRolls,
        isCritSuccess: critResult.isCritSuccess,
        isCritFail: critResult.isCritFail,
        sourceMods: node.modifiers || [],
      });

      return {
        value: total,
        breakdown: [breakdown],
        rolls: keptRolls,
        isCritSuccess: critResult.isCritSuccess,
        isCritFail: critResult.isCritFail,
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.count, out);
      collectVariableRefs(node.sides, out);
      (node.modifiers || []).forEach((m) => collectVariableRefs(m, out));
    },

    toDisplayString(node) {
      let s = `${nodeToString(node.count)}d${nodeToString(node.sides)}`;
      for (const mod of node.modifiers || []) {
        const def = registry.get(mod.type);
        s += def?.toDisplayString ? def.toDisplayString(mod) : "";
      }
      return s;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-dice";

      const countRow = document.createElement("div");
      countRow.appendChild(document.createTextNode("Roll "));
      countRow.appendChild(
        renderGenericEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      countRow.appendChild(document.createTextNode(" d "));
      countRow.appendChild(
        renderGenericEditor(node.sides, (next) =>
          update({ ...node, sides: next }),
        ),
      );
      root.appendChild(countRow);

      const modsDiv = document.createElement("div");
      modsDiv.className = "builder-dice-mods";
      (node.modifiers || []).forEach((mod, idx) => {
        const def = registry.get(mod.type);
        const row = document.createElement("div");
        row.className = "builder-mod-row";
        row.appendChild(
          def?.renderEditor
            ? def.renderEditor(mod, (next) => {
                const modifiers = [...node.modifiers];
                modifiers[idx] = next;
                update({ ...node, modifiers });
              })
            : document.createTextNode(mod.type),
        );
        const del = document.createElement("button");
        del.innerText = "×";
        del.type = "button";
        del.addEventListener("click", () => {
          const modifiers = [...node.modifiers];
          modifiers.splice(idx, 1);
          update({ ...node, modifiers });
        });
        row.appendChild(del);
        modsDiv.appendChild(row);
      });
      root.appendChild(modsDiv);

      const addMod = document.createElement("select");
      addMod.appendChild(new Option("Add modifier...", ""));
      registry.modifierTypes().forEach((def) => {
        const opt = document.createElement("option");
        opt.value = def.type;
        opt.innerText = def.label;
        addMod.appendChild(opt);
      });
      addMod.addEventListener("change", () => {
        const type = addMod.value;
        if (!type) return;
        const def = registry.get(type);
        update({
          ...node,
          modifiers: [...(node.modifiers || []), def.create()],
        });
        addMod.value = "";
      });
      root.appendChild(addMod);

      return root;
    },
  });
}

function normalizeRerollTarget(target) {
  if (target && typeof target === "object" && target.kind) return target;
  if (target === "max") return { kind: "max" };
  if (target === "min") return { kind: "min" };
  const n = Number(target);
  return { kind: "value", value: { type: "number", value: isNaN(n) ? 0 : n } };
}

function applyReroll(rolls, mod, rollFn, sides, ctx) {
  const isAdditive = mod.mode.includes("additively");
  const isRepeating = mod.mode.includes("repeating");
  const maxIter = isRepeating ? 50 : 1;

  const target = normalizeRerollTarget(mod.target);

  const matches = (roll) => {
    switch (target.kind) {
      case "max":
        return roll === sides;
      case "min":
        return roll === 1;
      case "value": {
        const val = ctx.evaluate(target.value).value;
        return roll === val;
      }
      case "range": {
        const min = ctx.evaluate(target.min).value;
        const max = ctx.evaluate(target.max).value;
        return roll >= min && roll <= max;
      }
      default:
        return false;
    }
  };

  for (let i = 0; i < rolls.length; i++) {
    if (!matches(rolls[i]) || sides <= 1) continue;

    let current = rolls[i];
    let total = current;
    let iterations = 0;

    while (matches(current) && iterations < maxIter) {
      current = rollFn();
      iterations++;
      if (isAdditive) total += current;
      else total = current;
    }

    rolls[i] = total;
  }
}

function checkDiceCrits(mods, primaryRoll, ctx) {
  let isCritSuccess = false;
  let isCritFail = false;

  for (const mod of mods) {
    if (mod.type === "critSuccess" && checkCritRule(mod, primaryRoll, ctx)) {
      isCritSuccess = true;
    } else if (
      mod.type === "critFail" &&
      checkCritRule(mod, primaryRoll, ctx)
    ) {
      isCritFail = true;
    }
  }

  return { isCritSuccess, isCritFail };
}
