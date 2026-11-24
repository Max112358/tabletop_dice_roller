import { registry } from "../engine/nodeRegistry.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "replace",
    label: "Replace Rolls",
    category: "modifier",

    create(min = 1, max = 1, withValue = 1) {
      return { type: "replace", min, max, with: withValue };
    },

    evaluate(mod, ctx) {
      // handled inside dice.evaluate
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {},

    toDisplayString(mod) {
      return `replace[${mod.min}-${mod.max}][${mod.with}]`;
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");
      root.appendChild(document.createTextNode("Replace "));
      const min = document.createElement("input");
      min.type = "number";
      min.value = mod.min;
      min.style.width = "3rem";
      const max = document.createElement("input");
      max.type = "number";
      max.value = mod.max;
      max.style.width = "3rem";
      const withVal = document.createElement("input");
      withVal.type = "number";
      withVal.value = mod.with;
      withVal.style.width = "3rem";

      function emit() {
        update({
          ...mod,
          min: Number(min.value) || 0,
          max: Number(max.value) || 0,
          with: Number(withVal.value) || 0,
        });
      }
      min.addEventListener("change", emit);
      max.addEventListener("change", emit);
      withVal.addEventListener("change", emit);

      root.appendChild(min);
      root.appendChild(document.createTextNode("-"));
      root.appendChild(max);
      root.appendChild(document.createTextNode(" with "));
      root.appendChild(withVal);
      return root;
    },
  });
}
