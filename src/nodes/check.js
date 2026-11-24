import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "check",
    label: "VS Check",
    category: "composite",

    create() {
      return {
        type: "check",
        mode: "gte",
        roll: { type: "dice", count: 1, sides: 20, modifiers: [] },
        weak: { type: "number", value: 10 },
        strong: null,
      };
    },

    evaluate(node, ctx) {
      const rollResult = ctx.evaluate(node.roll);
      const total = rollResult.value;
      const weak = ctx.evaluate(node.weak).value;
      const strong = node.strong ? ctx.evaluate(node.strong).value : null;

      let checkResult;
      let context;

      if (node.mode === "gte") {
        if (strong != null && total >= strong) {
          checkResult = "strong";
          context = `[vs ${weak}/${strong}] -> STRONG SUCCESS ✨`;
        } else if (total >= weak) {
          checkResult = "weak";
          context = `[vs ${weak}/${strong}] -> WEAK SUCCESS ⚠️`;
        } else {
          checkResult = "failure";
          context = `[vs ${weak}/${strong}] -> FAILURE ❌`;
        }
      } else {
        if (strong != null && total <= strong) {
          checkResult = "strong";
          context = `[<= ${weak}/${strong}] -> STRONG SUCCESS ✨`;
        } else if (total <= weak) {
          checkResult = "weak";
          context = `[<= ${weak}/${strong}] -> WEAK SUCCESS ⚠️`;
        } else {
          checkResult = "failure";
          context = `[<= ${weak}/${strong}] -> FAILURE ❌`;
        }
      }

      return {
        value: total,
        breakdown: [...(rollResult.breakdown || []), context],
        rolls: rollResult.rolls || [],
        checkResult,
        checkContext: context,
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.roll, out);
      collectVariableRefs(node.weak, out);
      if (node.strong) collectVariableRefs(node.strong, out);
    },

    toDisplayString(node) {
      const op = node.mode === "gte" ? "vs" : "<=";
      const strong = node.strong ? `/${nodeToString(node.strong)}` : "";
      return `${nodeToString(node.roll)} ${op} ${nodeToString(
        node.weak,
      )}${strong}`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-check";

      const rollRow = document.createElement("div");
      rollRow.appendChild(document.createTextNode("Roll: "));
      rollRow.appendChild(
        renderGenericEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      root.appendChild(rollRow);

      const modeRow = document.createElement("div");
      const mode = document.createElement("select");
      [
        ["gte", "vs (greater/equal)"],
        ["lte", "<= (less/equal)"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = label;
        if (node.mode === value) opt.selected = true;
        mode.appendChild(opt);
      });
      mode.addEventListener("change", () =>
        update({ ...node, mode: mode.value }),
      );
      modeRow.appendChild(document.createTextNode("Mode: "));
      modeRow.appendChild(mode);
      root.appendChild(modeRow);

      const weakRow = document.createElement("div");
      weakRow.appendChild(document.createTextNode("Weak: "));
      weakRow.appendChild(
        renderGenericEditor(node.weak, (next) =>
          update({ ...node, weak: next }),
        ),
      );
      root.appendChild(weakRow);

      const strongRow = document.createElement("div");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = node.strong != null;
      cb.addEventListener("change", () => {
        update({
          ...node,
          strong: cb.checked ? { type: "number", value: 10 } : null,
        });
      });
      strongRow.appendChild(cb);
      strongRow.appendChild(document.createTextNode(" Strong threshold "));
      if (node.strong) {
        strongRow.appendChild(
          renderGenericEditor(node.strong, (next) =>
            update({ ...node, strong: next }),
          ),
        );
      }
      root.appendChild(strongRow);

      return root;
    },
  });
}
