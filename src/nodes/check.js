import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

const SIGNS = [">", ">=", "=", "<", "<="];

function compare(a, sign, b) {
  switch (sign) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "=":
      return a === b;
    case "<=":
      return a <= b;
    case "<":
      return a < b;
    default:
      return a >= b;
  }
}

export default function register() {
  registry.register({
    type: "check",
    label: "VS Check",
    category: "composite",

    create() {
      return {
        type: "check",
        mode: "binary",
        sign: ">=",
        operands: [
          { type: "math", op: "add", operands: [] },
          { type: "math", op: "add", operands: [{ type: "number", value: 0 }] },
        ],
        strong: null,
      };
    },

    evaluate(node, ctx) {
      // Auto-fix old saved data that used roll/weak/strong
      if (!node.operands || node.operands.length < 2) {
        node.operands = [
          node.roll ?? node.left ?? { type: "number", value: 0 },
          node.dc ?? node.weak ?? node.right ?? { type: "number", value: 0 },
        ];
      }
      if (!node.sign) {
        node.sign = node.mode === "lte" ? "<=" : ">=";
      }
      if (!node.mode || (node.mode !== "binary" && node.mode !== "ternary")) {
        node.mode = node.strong ? "ternary" : "binary";
      }

      const leftResult = ctx.evaluate(node.operands[0]);
      const rightResult = ctx.evaluate(node.operands[1]);
      const left = leftResult.value;
      const right = rightResult.value;

      const strongNode = node.strong;
      const strong = strongNode ? ctx.evaluate(strongNode).value : null;

      let checkResult;
      let context;

      if (node.mode === "ternary") {
        const passedWeak = compare(left, node.sign, right);
        const passedStrong = strong != null && compare(left, node.sign, strong);

        if (passedStrong) {
          checkResult = "strong";
          context = `[${node.sign} ${right}/${strong}] -> STRONG SUCCESS ✨`;
        } else if (passedWeak) {
          checkResult = "mixed";
          context = `[${node.sign} ${right}/${strong}] -> WEAK SUCCESS ⚠️`;
        } else {
          checkResult = "failure";
          context = `[${node.sign} ${right}/${strong}] -> FAILURE ❌`;
        }
      } else {
        if (compare(left, node.sign, right)) {
          checkResult = "success";
          context = `[${node.sign} ${right}] -> SUCCESS ✓`;
        } else {
          checkResult = "failure";
          context = `[${node.sign} ${right}] -> FAILURE ✗`;
        }
      }

      return {
        value: left,
        breakdown: [...(leftResult.breakdown || []), context],
        rolls: leftResult.rolls || [],
        checkResult,
        checkContext: context,
      };
    },

    collectVariables(node, out) {
      node.operands.forEach((op) => collectVariableRefs(op, out));
      if (node.strong) collectVariableRefs(node.strong, out);
    },

    toDisplayString(node) {
      const left = node.operands?.[0] ??
        node.roll ??
        node.left ?? { type: "number", value: 0 };
      const right = node.operands?.[1] ??
        node.dc ??
        node.weak ??
        node.right ?? { type: "number", value: 0 };
      const strong =
        node.mode === "ternary" && node.strong
          ? `/${nodeToString(node.strong)}`
          : "";
      return `${nodeToString(left)} ${node.sign ?? ">="} ${nodeToString(right)}${strong}`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-check";

      const modeRow = document.createElement("div");
      modeRow.className = "builder-operand-row";
      modeRow.appendChild(document.createTextNode("Mode: "));
      const mode = document.createElement("select");
      [
        ["binary", "Binary (Success / Failure)"],
        ["ternary", "Ternary (Failure / Weak / Strong)"],
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
      modeRow.appendChild(mode);
      root.appendChild(modeRow);

      const signRow = document.createElement("div");
      signRow.className = "builder-operand-row";
      signRow.style.marginTop = "8px";
      signRow.appendChild(document.createTextNode("Sign: "));
      const sign = document.createElement("select");
      SIGNS.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.innerText = s;
        if ((node.sign ?? ">=") === s) opt.selected = true;
        sign.appendChild(opt);
      });
      sign.addEventListener("change", () =>
        update({ ...node, sign: sign.value }),
      );
      signRow.appendChild(sign);
      root.appendChild(signRow);

      if (node.mode === "ternary") {
        const strongRow = document.createElement("div");
        strongRow.className = "builder-operand-row";
        strongRow.style.marginTop = "8px";
        strongRow.appendChild(document.createTextNode("Strong threshold: "));
        const input = document.createElement("input");
        input.type = "number";
        input.value = node.strong?.value ?? 10;
        input.addEventListener("change", () => {
          update({
            ...node,
            strong: { type: "number", value: Number(input.value) || 0 },
          });
        });
        strongRow.appendChild(input);
        root.appendChild(strongRow);
      }

      return root;
    },
  });
}
