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
        operands: [{ type: "group", op: "add", operands: [] }],
        target: { type: "number", value: 10 },
        limit: null,
      };
    },

    evaluate(node, ctx) {
      const batchNode = node.operands[0];

      const target = ctx.evaluate(node.target).value;
      const limit =
        node.limit != null ? ctx.evaluate(node.limit).value : Infinity;

      if (target <= 0) {
        return {
          value: 0,
          breakdown: [
            `${nodeToString(batchNode)} [Target ${target}, stopped] = 0`,
          ],
          rolls: [],
        };
      }

      let cumulative = 0;
      const batchTotals = [];
      let safety = 0;

      while (cumulative < target && safety < limit && safety < 10000) {
        safety++;
        const batch = ctx.evaluate(batchNode);
        cumulative += batch.value;
        batchTotals.push(batch.value);
        if (batch.value === 0) break;
      }

      const limitText = node.limit != null ? `, Limit ${limit}` : "";
      const reached = cumulative >= target;
      const breakdown =
        `${nodeToString(batchNode)} [Target ${target}${limitText}, ` +
        `${reached ? "reached" : "not reached"}, ${batchTotals.length} roll(s)] ` +
        `Batch totals: ${batchTotals.join(", ")} = ${cumulative}`;

      return { value: cumulative, breakdown: [breakdown], rolls: [] };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.operands[0], out);
      collectVariableRefs(node.target, out);
      if (node.limit) collectVariableRefs(node.limit, out);
    },

    toDisplayString(node) {
      const batchStr = nodeToString(node.operands[0]);
      return `{${batchStr}}rolluntiltarget${nodeToString(node.target)}${
        node.limit ? nodeToString(node.limit) : ""
      }`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-roll-until";

      const summary = document.createElement("div");
      summary.innerText = `Batch: ${nodeToString(node.operands[0])}`;
      root.appendChild(summary);

      const targetRow = document.createElement("div");
      targetRow.className = "builder-operand-row";
      targetRow.style.marginTop = "8px";
      targetRow.appendChild(document.createTextNode("Target: "));
      targetRow.appendChild(
        renderGenericEditor(node.target, (next) =>
          update({ ...node, target: next }),
        ),
      );
      root.appendChild(targetRow);

      const limitRow = document.createElement("div");
      limitRow.className = "builder-operand-row";
      limitRow.style.marginTop = "8px";

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

      const note = document.createElement("p");
      note.style.marginTop = "8px";
      note.style.fontSize = "12px";
      note.style.color = "var(--text-muted)";
      note.innerText =
        "Edit the batch by dragging nodes into the roll-until workspace.";
      root.appendChild(note);

      return root;
    },
  });
}
