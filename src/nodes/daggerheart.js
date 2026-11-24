import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";
import { rollDie } from "./nodesShared.js";

export default function register() {
  registry.register({
    type: "daggerheart",
    label: "Daggerheart Roll",
    category: "composite",

    create() {
      return { type: "daggerheart", sides: { type: "number", value: 12 } };
    },

    evaluate(node, ctx) {
      const sides = Math.max(1, ctx.evaluate(node.sides).value);
      const hope = rollDie(sides);
      const fear = rollDie(sides);
      const total = hope + fear;

      let outcome;
      if (hope === fear) outcome = "CRITICAL SUCCESS! ✨";
      else if (hope > fear) outcome = "Roll with HOPE ☀️";
      else outcome = "Roll with FEAR 🌙";

      return {
        value: total,
        breakdown: [`daggerheart d${sides} (${hope} hope, ${fear} fear)`],
        daggerheartContext: `[Hope: ${hope} | Fear: ${fear}] -> ${outcome}`,
        isCritical: hope === fear,
        rolls: [hope, fear],
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.sides, out);
    },

    toDisplayString(node) {
      return `${nodeToString(node.sides)}daggerheart`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.appendChild(document.createTextNode("d"));
      root.appendChild(
        renderGenericEditor(node.count, (next) =>
          update({ ...node, count: next }),
        ),
      );
      root.appendChild(document.createTextNode(" daggerheart"));
      return root;
    },
  });
}
