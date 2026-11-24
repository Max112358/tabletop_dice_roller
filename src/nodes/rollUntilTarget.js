import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "rollUntilTarget",
    label: "Roll Until Target",
    category: "composite",

    create() {
      return {
        type: "rollUntilTarget",
        batch: { type: "dice", count: 1, sides: 8, modifiers: [] },
        target: { type: "number", value: 10 },
        limit: null,
      };
    },

    evaluate(node, ctx) {
      const target = ctx.evaluate(node.target).value;
      const limit =
        node.limit != null ? ctx.evaluate(node.limit).value : Infinity;

      if (target <= 0) {
        return {
          value: 0,
          breakdown: [
            `${nodeToString(node.batch)} [Target ${target}, stopped] = 0`,
          ],
          rolls: [],
        };
      }

      let cumulative = 0;
      const batchTotals = [];
      let safety = 0;

      while (cumulative < target && safety < limit && safety < 10000) {
        safety++;
        const batch = ctx.evaluate(node.batch);
        cumulative += batch.value;
        batchTotals.push(batch.value);
        if (batch.value === 0) break;
      }

      const limitText = node.limit != null ? `, Limit ${limit}` : "";
      const reached = cumulative >= target;
      const breakdown =
        `${nodeToString(node.batch)} [Target ${target}${limitText}, ` +
        `${reached ? "reached" : "not reached"}, ${batchTotals.length} roll(s)] ` +
        `Batch totals: ${batchTotals.join(", ")} = ${cumulative}`;

      return { value: cumulative, breakdown: [breakdown], rolls: [] };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.batch, out);
      collectVariableRefs(node.target, out);
      if (node.limit) collectVariableRefs(node.limit, out);
    },

    toDisplayString(node) {
      const base = `${nodeToString(node.batch)} rolluntiltarget${nodeToString(
        node.target,
      )}`;
      return node.limit ? `${base}${nodeToString(node.limit)}` : base;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-roll-until";

      const batchRow = document.createElement("div");
      batchRow.appendChild(document.createTextNode("Batch: "));
      batchRow.appendChild(
        renderGenericEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      root.appendChild(batchRow);

      const targetRow = document.createElement("div");
      targetRow.appendChild(document.createTextNode("Target: "));
      targetRow.appendChild(
        renderGenericEditor(node.target, (next) =>
          update({ ...node, target: next }),
        ),
      );
      root.appendChild(targetRow);

      const limitRow = document.createElement("div");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = node.limit != null;
      cb.addEventListener("change", () => {
        update({
          ...node,
          limit: cb.checked ? { type: "number", value: 1 } : null,
        });
      });
      limitRow.appendChild(cb);
      limitRow.appendChild(document.createTextNode(" Limit "));
      if (node.limit) {
        limitRow.appendChild(
          renderGenericEditor(node.limit, (next) =>
            update({ ...node, limit: next }),
          ),
        );
      }
      root.appendChild(limitRow);

      return root;
    },
  });
}
