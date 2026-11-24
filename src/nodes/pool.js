import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";
import { sortNumbers, sum } from "./nodesShared.js";

export default function register() {
  registry.register({
    type: "pool",
    label: "Pool & Keep",
    category: "composite",

    create() {
      return {
        type: "pool",
        batch: { type: "dice", count: 1, sides: 6, modifiers: [] },
        iterations: { type: "number", value: 2 },
        keep: { mode: "highest", count: { type: "number", value: 1 } },
      };
    },

    evaluate(node, ctx) {
      const iterations = Math.max(
        1,
        Math.floor(ctx.evaluate(node.iterations).value),
      );

      const batchResults = [];
      const batchBreakdowns = [];

      for (let i = 0; i < iterations; i++) {
        const res = ctx.evaluate(node.batch);
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
        `Pool ${iterations}×{${nodeToString(node.batch)}} -> Kept ${modeLabel} ${keepCount}: ` +
        `(${kept.join("+")}=${total}) [${batchBreakdowns.join(", ")}]`;

      return { value: total, breakdown: [breakdown], rolls: [] };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.batch, out);
      collectVariableRefs(node.iterations, out);
      collectVariableRefs(node.keep.count, out);
    },

    toDisplayString(node) {
      return `{${nodeToString(node.batch)}}p${nodeToString(
        node.iterations,
      )}k${node.keep.mode === "highest" ? "h" : "l"}${nodeToString(
        node.keep.count,
      )}`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-pool";

      const batchRow = document.createElement("div");
      batchRow.appendChild(document.createTextNode("Batch: "));
      batchRow.appendChild(
        renderGenericEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      root.appendChild(batchRow);

      const iterRow = document.createElement("div");
      iterRow.appendChild(document.createTextNode("Iterations: "));
      iterRow.appendChild(
        renderGenericEditor(node.iterations, (next) =>
          update({ ...node, iterations: next }),
        ),
      );
      root.appendChild(iterRow);

      const keepRow = document.createElement("div");
      keepRow.appendChild(document.createTextNode("Keep "));
      const mode = document.createElement("select");
      [
        ["highest", "Highest"],
        ["lowest", "Lowest"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = label;
        if (node.keep.mode === value) opt.selected = true;
        mode.appendChild(opt);
      });
      mode.addEventListener("change", () =>
        update({ ...node, keep: { ...node.keep, mode: mode.value } }),
      );
      keepRow.appendChild(mode);
      keepRow.appendChild(document.createTextNode(" "));
      keepRow.appendChild(
        renderGenericEditor(node.keep.count, (next) =>
          update({ ...node, keep: { ...node.keep, count: next } }),
        ),
      );
      root.appendChild(keepRow);

      return root;
    },
  });
}
