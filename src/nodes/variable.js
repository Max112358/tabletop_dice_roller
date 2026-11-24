import { registry } from "../engine/nodeRegistry.js";

export default function register() {
  registry.register({
    type: "variable",
    label: "Variable",
    category: "leaf",

    create(name = "") {
      return { type: "variable", name };
    },

    evaluate(node, ctx) {
      const expr = ctx.getVariable(node.name);
      if (!expr) throw new Error(`Missing variable: ${node.name}`);
      return ctx.evaluate(expr);
    },

    collectVariables(node, out) {
      if (node.name) out.add(node.name.toUpperCase());
    },

    toDisplayString(node) {
      return `[${node.name}]`;
    },

    renderEditor(node, update) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = node.name;
      input.placeholder = "VAR_NAME";
      input.style.width = "6rem";
      input.style.textTransform = "uppercase";
      input.addEventListener("change", () => {
        update({ ...node, name: input.value.trim().toUpperCase() });
      });
      return input;
    },
  });
}
