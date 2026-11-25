import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

const MODES = [
  ["once", "Once"],
  ["repeating", "Repeating"],
  ["additively", "Additively"],
  ["additivelyrepeating", "Additively Repeating"],
];

const TARGET_KINDS = [
  ["value", "Single value"],
  ["range", "Range"],
  ["max", "Maximum"],
  ["min", "Minimum"],
];

function normalizeTarget(target) {
  if (target && typeof target === "object" && target.kind) return target;
  if (target === "max") return { kind: "max" };
  if (target === "min") return { kind: "min" };
  const n = Number(target);
  return { kind: "value", value: { type: "number", value: isNaN(n) ? 0 : n } };
}

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
    input.style.width = "3.5rem";
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
    type: "reroll",
    label: "Reroll / Explode",
    category: "modifier",

    create(
      mode = "once",
      target = { kind: "value", value: { type: "number", value: 1 } },
    ) {
      return { type: "reroll", mode, target };
    },

    evaluate(mod, ctx) {
      // Actual reroll logic lives inside dice.evaluate.
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {
      const t = normalizeTarget(mod.target);
      if (t.kind === "value") collectVariableRefs(t.value, out);
      if (t.kind === "range") {
        collectVariableRefs(t.min, out);
        collectVariableRefs(t.max, out);
      }
    },

    toDisplayString(mod) {
      const t = normalizeTarget(mod.target);
      let inner;
      switch (t.kind) {
        case "max":
          inner = "max";
          break;
        case "min":
          inner = "min";
          break;
        case "range":
          inner = `${nodeToString(t.min)}-${nodeToString(t.max)}`;
          break;
        case "value":
        default:
          inner = nodeToString(t.value);
          break;
      }
      return `reroll${mod.mode}[${inner}]`;
    },

    renderEditor(mod, update) {
      const target = normalizeTarget(mod.target);
      const root = document.createElement("span");

      root.appendChild(document.createTextNode("Reroll mode: "));
      const modeSelect = document.createElement("select");
      MODES.forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = label;
        if (mod.mode === value) opt.selected = true;
        modeSelect.appendChild(opt);
      });
      modeSelect.addEventListener("change", () => {
        update({ ...mod, mode: modeSelect.value });
      });
      root.appendChild(modeSelect);

      root.appendChild(document.createTextNode(" Trigger: "));
      const kindSelect = document.createElement("select");
      TARGET_KINDS.forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = label;
        if (target.kind === value) opt.selected = true;
        kindSelect.appendChild(opt);
      });
      kindSelect.addEventListener("change", () => {
        const kind = kindSelect.value;
        let nextTarget;
        if (kind === "value") {
          nextTarget = { kind, value: { type: "number", value: 1 } };
        } else if (kind === "range") {
          nextTarget = {
            kind,
            min: { type: "number", value: 1 },
            max: { type: "number", value: 2 },
          };
        } else {
          nextTarget = { kind };
        }
        update({ ...mod, target: nextTarget });
      });
      root.appendChild(kindSelect);

      if (target.kind === "value") {
        root.appendChild(document.createTextNode(" "));
        root.appendChild(
          makeValueEditor(target.value, (next) =>
            update({ ...mod, target: { ...target, value: next } }),
          ),
        );
      } else if (target.kind === "range") {
        root.appendChild(document.createTextNode(" "));
        root.appendChild(
          makeValueEditor(target.min, (next) =>
            update({ ...mod, target: { ...target, min: next } }),
          ),
        );
        root.appendChild(document.createTextNode(" - "));
        root.appendChild(
          makeValueEditor(target.max, (next) =>
            update({ ...mod, target: { ...target, max: next } }),
          ),
        );
      }

      return root;
    },
  });
}
