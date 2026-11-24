import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "group",
    label: "Group",
    category: "composite",

    create() {
      return {
        type: "group",
        node: { type: "number", value: 0 },
      };
    },

    evaluate(node, ctx) {
      const inner = ctx.evaluate(node.node);
      const innerBreakdown = inner.breakdown?.[0] ?? String(inner.value);
      return {
        value: inner.value,
        breakdown: [`(${innerBreakdown})`],
        rolls: inner.rolls || [],
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.node, out);
    },

    toDisplayString(node) {
      return `(${nodeToString(node.node)})`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-group";

      root.appendChild(
        renderGenericEditor(node.node, (next) =>
          update({ ...node, node: next }),
        ),
      );

      return root;
    },
  });
}
