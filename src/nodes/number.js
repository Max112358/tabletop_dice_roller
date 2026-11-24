import { registry } from "../engine/nodeRegistry.js";

export default function register() {
  registry.register({
    type: "number",
    label: "Number",
    category: "leaf",

    create(value = 0) {
      return { type: "number", value };
    },

    evaluate(node) {
      return {
        value: node.value,
        breakdown: [String(node.value)],
        rolls: [],
      };
    },

    collectVariables(node, out) {},

    toDisplayString(node) {
      return String(node.value);
    },

    renderEditor(node, update) {
      const input = document.createElement("input");
      input.type = "number";
      input.value = node.value;
      input.style.width = "5rem";
      input.addEventListener("change", () => {
        update({ ...node, value: Number(input.value) || 0 });
      });
      return input;
    },
  });
}
