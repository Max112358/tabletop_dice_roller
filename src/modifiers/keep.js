import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "keep",
    label: "Keep Highest/Lowest",
    category: "modifier",

    create(mode = "highest", count = 1) {
      return {
        type: "keep",
        mode,
        count: { type: "number", value: count },
      };
    },

    evaluate(mod, ctx) {
      // handled inside dice.evaluate
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {
      collectVariableRefs(mod.count, out);
    },

    toDisplayString(mod) {
      return `k${mod.mode === "highest" ? "h" : "l"}${mod.count.value}`;
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");
      root.appendChild(document.createTextNode("Keep "));
      const mode = document.createElement("select");
      [
        ["highest", "Highest"],
        ["lowest", "Lowest"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = label;
        if (mod.mode === value) opt.selected = true;
        mode.appendChild(opt);
      });
      mode.addEventListener("change", () =>
        update({ ...mod, mode: mode.value }),
      );
      root.appendChild(mode);
      root.appendChild(document.createTextNode(" "));
      root.appendChild(
        renderGenericEditor(mod.count, (next) =>
          update({ ...mod, count: next }),
        ),
      );
      return root;
    },
  });
}
