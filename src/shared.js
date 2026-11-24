import { registry } from "./engine/nodeRegistry.js";

export function nodeToString(node) {
  if (!node) return "";
  const def = registry.get(node.type);
  return def?.toDisplayString
    ? def.toDisplayString(node)
    : JSON.stringify(node);
}

export function renderGenericEditor(node, update) {
  if (!node) return document.createTextNode("∅");
  const def = registry.get(node.type);
  if (!def) return document.createTextNode(`unknown(${node.type})`);

  const wrapper = document.createElement("span");
  wrapper.className = "builder-node editor-" + node.type;

  // type switcher
  const typeSelect = document.createElement("select");
  registry
    .all()
    .filter((d) => d.category === "leaf" || d.category === "composite")
    .forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.type;
      opt.innerText = d.label;
      if (d.type === node.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
  typeSelect.addEventListener("change", () => {
    const newDef = registry.get(typeSelect.value);
    update(newDef.create());
  });

  wrapper.appendChild(typeSelect);
  wrapper.appendChild(document.createTextNode(" "));
  wrapper.appendChild(def.renderEditor(node, update));

  // Add "Wrap in Math" button for non-math nodes
  if (node.type !== "math") {
    const wrapBtn = document.createElement("button");
    wrapBtn.innerText = "+";
    wrapBtn.title = "Add as term in a math expression";
    wrapBtn.type = "button";
    wrapBtn.style.marginLeft = "6px";
    wrapBtn.addEventListener("click", () => {
      update({
        type: "math",
        op: "add",
        operands: [node, { type: "number", value: 0 }],
      });
    });
    wrapper.appendChild(wrapBtn);
  }

  return wrapper;
}
