import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  const DISPLAY_OPS = {
    add: "+",
    subtract: "-",
    multiply: "*",
    divide: "/",
  };

  registry.register({
    type: "math",
    label: "Math Expression",
    category: "composite",

    create(op = "add") {
      return {
        type: "math",
        op,
        operands: [{ type: "number", value: 0 }],
      };
    },

    evaluate(node, ctx) {
      if (!node.operands?.length) {
        return { value: 0, breakdown: ["0"], rolls: [] };
      }

      const results = node.operands.map((op) => ctx.evaluate(op));
      let value = results[0].value;

      for (let i = 1; i < results.length; i++) {
        const v = results[i].value;
        if (node.op === "add") value += v;
        else if (node.op === "subtract") value -= v;
        else if (node.op === "multiply") value *= v;
        else if (node.op === "divide") value /= v;
      }

      const opSymbol = DISPLAY_OPS[node.op] ?? node.op;
      const parts = results.map((r) => r.breakdown?.[0] ?? String(r.value));
      const expression = parts.join(` ${opSymbol} `);

      const rollParts = results.flatMap((r) => r.rolls || []);

      const isCritSuccess = results.some((r) => r.isCritSuccess);
      const isCritFail = results.some((r) => r.isCritFail);

      return {
        value,
        breakdown: [`${expression} = ${value}`],
        rolls: rollParts,
        isCritSuccess,
        isCritFail,
      };
    },

    collectVariables(node, out) {
      node.operands.forEach((op) => collectVariableRefs(op, out));
    },

    toDisplayString(node) {
      const op = DISPLAY_OPS[node.op] ?? node.op;
      return node.operands.map((o) => nodeToString(o)).join(` ${op} `);
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-math";

      const opSelect = document.createElement("select");
      Object.keys(DISPLAY_OPS).forEach((op) => {
        const opt = document.createElement("option");
        opt.value = op;
        opt.innerText = op;
        if (op === node.op) opt.selected = true;
        opSelect.appendChild(opt);
      });
      opSelect.addEventListener("change", () => {
        update({ ...node, op: opSelect.value });
      });
      root.appendChild(opSelect);

      const operandsBox = document.createElement("div");
      operandsBox.className = "builder-operands";
      node.operands.forEach((operand, idx) => {
        const row = document.createElement("div");
        row.className = "builder-operand-row";
        row.appendChild(
          renderGenericEditor(operand, (next) => {
            const operands = [...node.operands];
            operands[idx] = next;
            update({ ...node, operands });
          }),
        );
        operandsBox.appendChild(row);
      });
      root.appendChild(operandsBox);

      const addBtn = document.createElement("button");
      addBtn.innerText = "+ Add Term";
      addBtn.type = "button";
      addBtn.addEventListener("click", () => {
        update({
          ...node,
          operands: [...node.operands, { type: "number", value: 0 }],
        });
      });
      root.appendChild(addBtn);

      return root;
    },
  });
}
