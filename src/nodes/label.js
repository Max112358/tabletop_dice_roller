import { registry } from "../engine/nodeRegistry.js";

export default function register() {
  registry.register({
    type: "label",
    label: "Text Label",
    category: "leaf",

    create(value = "") {
      return { type: "label", value };
    },

    evaluate(node) {
      return {
        value: node.value,
        breakdown: [node.value],
        rolls: [],
      };
    },

    collectVariables(node, out) {},

    toDisplayString(node) {
      return `"${node.value}"`;
    },

    renderEditor(node, update) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = node.value;
      input.style.width = "12rem";
      input.addEventListener("change", () => {
        update({ ...node, value: input.value });
      });
      return input;
    },
  });
}
