import { registry } from "../engine/nodeRegistry.js";

export default function register() {
  registry.register({
    type: "critRule",
    label: "Critical Rule",
    category: "modifier",

    create(trigger = "max") {
      return { type: "critRule", trigger };
    },

    evaluate(node, ctx) {
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(node, out) {},

    toDisplayString(node) {
      return node.trigger;
    },

    renderEditor(node, update) {
      const root = document.createElement("span");
      root.innerText = node.trigger;
      return root;
    },
  });
}
