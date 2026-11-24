import { registry } from "../engine/nodeRegistry.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "reroll",
    label: "Reroll / Explode",
    category: "modifier",

    create(mode = "once", target = 1) {
      return {
        type: "reroll",
        mode,
        target,
      };
    },

    evaluate(mod, ctx) {
      // handled inside dice.evaluate
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {},

    toDisplayString(mod) {
      return `reroll${mod.mode}[${mod.target}]`;
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");
      const mode = document.createElement("select");
      [
        ["once", "Once"],
        ["repeating", "Repeating"],
        ["additively", "Additively"],
        ["additivelyrepeating", "Additively Repeating"],
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
      root.appendChild(document.createTextNode(" on "));
      const target = document.createElement("input");
      target.type = "text";
      target.value = mod.target;
      target.style.width = "4rem";
      target.addEventListener("change", () =>
        update({ ...mod, target: target.value.trim() }),
      );
      root.appendChild(target);
      return root;
    },
  });
}
