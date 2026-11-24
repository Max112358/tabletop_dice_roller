import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

const TRIGGERS = [
  ["max", "Max roll"],
  ["min", "Min roll"],
  ["value", "Exact value"],
  ["range", "Range"],
  ["doubles", "Doubles"],
  ["yahtzee", "Yahtzee"],
  ["checkRelative", "Check-relative doubles"],
];

function createCritRule(trigger) {
  switch (trigger) {
    case "min":
      return { trigger: "min" };
    case "value":
      return { trigger: "value", value: { type: "number", value: 20 } };
    case "range":
      return {
        trigger: "range",
        min: { type: "number", value: 18 },
        max: { type: "number", value: 20 },
      };
    case "doubles":
      return { trigger: "doubles" };
    case "checkRelative":
      return { trigger: "checkRelative", mode: "successesDoubles" };
    case "yahtzee":
      return { trigger: "yahtzee" };
    case "max":
    default:
      return { trigger: "max" };
  }
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
    input.style.width = "4rem";
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

function makeDef(type, label, displayPrefix) {
  return {
    type,
    label,
    category: "modifier",

    create() {
      return { type, ...createCritRule("max") };
    },

    evaluate(mod, ctx) {
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {
      if (mod.trigger === "value") collectVariableRefs(mod.value, out);
      if (mod.trigger === "range") {
        collectVariableRefs(mod.min, out);
        collectVariableRefs(mod.max, out);
      }
    },

    toDisplayString(mod) {
      let inner;
      if (mod.trigger === "value") {
        inner = nodeToString(mod.value);
      } else if (mod.trigger === "range") {
        inner = `${nodeToString(mod.min)}-${nodeToString(mod.max)}`;
      } else {
        inner = mod.trigger;
      }
      return `${displayPrefix}[${inner}]`;
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");

      const labelSpan = document.createElement("strong");
      labelSpan.innerText = label + ": ";
      root.appendChild(labelSpan);

      const triggerSelect = document.createElement("select");
      TRIGGERS.forEach(([value, text]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.innerText = text;
        if (mod.trigger === value) opt.selected = true;
        triggerSelect.appendChild(opt);
      });
      triggerSelect.addEventListener("change", () => {
        update({ ...mod, ...createCritRule(triggerSelect.value) });
      });
      root.appendChild(triggerSelect);

      if (mod.trigger === "value") {
        root.appendChild(document.createTextNode(" is "));
        root.appendChild(
          makeValueEditor(mod.value, (next) => update({ ...mod, value: next })),
        );
      } else if (mod.trigger === "range") {
        root.appendChild(document.createTextNode(" from "));
        root.appendChild(
          makeValueEditor(mod.min, (next) => update({ ...mod, min: next })),
        );
        root.appendChild(document.createTextNode(" to "));
        root.appendChild(
          makeValueEditor(mod.max, (next) => update({ ...mod, max: next })),
        );
      }

      return root;
    },
  };
}

export default function register() {
  registry.register(makeDef("critSuccess", "Critical Success", "critsuccess"));
  registry.register(makeDef("critFail", "Critical Failure", "critfail"));

  registry.register({
    type: "checkRelativeSuccess",
    label: "Crit Success on Success + Doubles",
    category: "modifier",

    create() {
      return {
        type: "checkRelativeSuccess",
        trigger: "checkRelative",
        mode: "successesDoubles",
      };
    },

    evaluate(mod, ctx) {
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {},

    toDisplayString(mod) {
      return "critsuccessifsucceed+doubles";
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");
      root.innerText = "Success + doubles";
      return root;
    },
  });

  registry.register({
    type: "checkRelativeFail",
    label: "Crit Fail on Failure + Doubles",
    category: "modifier",

    create() {
      return {
        type: "checkRelativeFail",
        trigger: "checkRelative",
        mode: "failuresDoubles",
      };
    },

    evaluate(mod, ctx) {
      return { value: 0, breakdown: [], rolls: [] };
    },

    collectVariables(mod, out) {},

    toDisplayString(mod) {
      return "critfailiffail+doubles";
    },

    renderEditor(mod, update) {
      const root = document.createElement("span");
      root.innerText = "Failure + doubles";
      return root;
    },
  });
}
