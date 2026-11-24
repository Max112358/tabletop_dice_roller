import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

export default function register() {
  registry.register({
    type: "group",
    label: "Group",
    category: "composite",

    create() {
      return {
        type: "group",
        op: "add",
        operands: [],
      };
    },

    evaluate(node, ctx) {
      if (!node.operands?.length) {
        return { value: 0, breakdown: ["(0)"], rolls: [] };
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

      const opSymbol =
        { add: "+", subtract: "-", multiply: "*", divide: "/" }[node.op] ??
        node.op;
      const expression = results
        .map((r) => r.breakdown?.[0] ?? String(r.value))
        .join(` ${opSymbol} `);

      const rollParts = results.flatMap((r) => r.rolls || []);

      return {
        value,
        breakdown: [`(${expression})`],
        rolls: rollParts,
      };
    },

    collectVariables(node, out) {
      for (const op of node.operands || []) {
        collectVariableRefs(op, out);
      }
    },

    toDisplayString(node) {
      const op =
        { add: "+", subtract: "-", multiply: "*", divide: "/" }[node.op] ??
        node.op;
      const inner = node.operands.map((o) => nodeToString(o)).join(` ${op} `);
      return `(${inner})`;
    },

    // No custom editor needed because the builder renders nested workspaces.
    renderEditor(node, update) {
      return document.createTextNode(
        "Use the workspace above to edit this group.",
      );
    },
  });
}
