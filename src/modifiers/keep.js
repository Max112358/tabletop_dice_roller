import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

function makeValueEditor(node, update) {
  const wrapper = document.createElement("span");

  const typeSelect = document.createElement("select");
  [
    { type: "number", label: "#" },
    { type: "variable", label: "[ ]" },
  ].forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.type;
    opt.innerText = t.label;
    if (node.type === t.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });

  typeSelect.addEventListener("change", () => {
    update(
      typeSelect.value === "number"
        ? { type: "number", value: 0 }
        : { type: "variable", name: "" },
    );
  });
  wrapper.appendChild(typeSelect);

  if (node.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.value = node.value;
    input.style.width = "3rem";
    input.addEventListener("change", () =>
      update({ ...node, value: Number(input.value) || 0 }),
    );
    wrapper.appendChild(input);
  } else if (node.type === "variable") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = node.name;
    input.style.width = "4rem";
    input.style.textTransform = "uppercase";
    input.addEventListener("change", () =>
      update({ ...node, name: input.value.trim().toUpperCase() }),
    );
    wrapper.appendChild(input);
  }

  return wrapper;
}

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
      return `k${mod.mode === "highest" ? "h" : "l"}${nodeToString(mod.count)}`;
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
        makeValueEditor(mod.count, (next) => update({ ...mod, count: next })),
      );
      return root;
    },
  });
}
