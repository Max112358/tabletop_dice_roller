import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";
import { sortNumbers, sum } from "./nodesShared.js";

export function migratePoolNode(node) {
  if (node.batch) {
    const batch = node.batch;
    node.operands =
      batch && Array.isArray(batch.operands)
        ? [batch]
        : [{ type: "math", op: "add", operands: [batch] }];
    delete node.batch;
  }
}

export default function register() {
  registry.register({
    type: "pool",
    label: "Pool & Keep",
    category: "composite",

    create() {
      return {
        type: "pool",
        operands: [{ type: "group", op: "add", operands: [] }],
        iterations: { type: "number", value: 2 },
        keep: { mode: "highest", count: { type: "number", value: 1 } },
      };
    },

    evaluate(node, ctx) {
      migratePoolNode(node);

      if (!node.operands?.length) {
        return { value: 0, breakdown: ["pool (empty) = 0"], rolls: [] };
      }

      const batchNode = node.operands[0];
      const iterations = Math.max(
        1,
        Math.floor(ctx.evaluate(node.iterations).value),
      );

      const batchResults = [];
      const batchBreakdowns = [];

      for (let i = 0; i < iterations; i++) {
        const res = ctx.evaluate(batchNode);
        batchResults.push(res.value);
        batchBreakdowns.push(
          res.breakdown?.[0] ? `[${res.breakdown[0]}]` : String(res.value),
        );
      }

      const keepCount = Math.max(
        1,
        Math.floor(ctx.evaluate(node.keep.count).value),
      );
      const kept = sortNumbers(batchResults, node.keep.mode).slice(
        0,
        keepCount,
      );
      const total = sum(kept);

      const modeLabel = node.keep.mode === "highest" ? "Highest" : "Lowest";
      const breakdown =
        `Pool ${iterations}×{${nodeToString(batchNode)}} -> Kept ${modeLabel} ${keepCount}: ` +
        `(${kept.join("+")}=${total}) [${batchBreakdowns.join(", ")}]`;

      return { value: total, breakdown: [breakdown], rolls: [] };
    },

    collectVariables(node, out) {
      migratePoolNode(node);
      if (node.operands?.[0]) collectVariableRefs(node.operands[0], out);
      collectVariableRefs(node.iterations, out);
      collectVariableRefs(node.keep.count, out);
    },

    toDisplayString(node) {
      migratePoolNode(node);
      const batch = node.operands?.[0];
      const batchStr = batch ? nodeToString(batch) : "";
      return `{${batchStr}}p${nodeToString(node.iterations)}k${
        node.keep.mode === "highest" ? "h" : "l"
      }${nodeToString(node.keep.count)}`;
    },

    renderEditor(node, update) {
      migratePoolNode(node);
      const root = document.createElement("div");
      root.className = "builder-pool";

      const summary = document.createElement("div");
      summary.innerText = `Batch: ${nodeToString(node.operands[0])}`;
      root.appendChild(summary);

      const note = document.createElement("p");
      note.style.marginTop = "8px";
      note.style.fontSize = "12px";
      note.style.color = "var(--text-muted)";
      note.innerText =
        "Edit the pool batch by dragging nodes into the pool workspace.";
      root.appendChild(note);

      return root;
    },
  });
}
