import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

function getEntryFormula(entry) {
  return entry.formula ?? entry.result;
}

export default function register() {
  registry.register({
    type: "table",
    label: "Lookup Table",
    category: "composite",

    create() {
      return {
        type: "table",
        roll: {
          type: "dice",
          count: { type: "number", value: 1 },
          sides: { type: "number", value: 6 },
          modifiers: [],
        },
        entries: [
          {
            min: 1,
            max: 1,
            label: "RESULT 1",
            note: "",
            formula: { type: "number", value: 1 },
          },
        ],
      };
    },

    evaluate(node, ctx) {
      const rollResult = ctx.evaluate(node.roll);
      const rollValue = rollResult.value;

      const entry = (node.entries || []).find((e) => {
        const min = Number(e.min) || 0;
        const max = e.max != null ? Number(e.max) : min;
        return rollValue >= min && rollValue <= max;
      });

      if (!entry) {
        return {
          value: 0,
          breakdown: [
            `${nodeToString(node.roll)}=${rollValue} -> no table entry`,
          ],
          rolls: rollResult.rolls || [],
        };
      }

      const formula = getEntryFormula(entry);
      const result = formula
        ? ctx.evaluate(formula)
        : { value: 0, breakdown: [] };

      const labelTag = entry.label ? ` [${entry.label}]` : "";
      const noteTag = entry.note ? ` (${entry.note})` : "";

      return {
        value: result.value,
        breakdown: [
          ...(rollResult.breakdown || []),
          `Table lookup ${rollValue}${labelTag}${noteTag}: ${result.breakdown?.[0] ?? result.value}`,
        ],
        rolls: rollResult.rolls || [],
        isCritSuccess: rollResult.isCritSuccess,
        isCritFail: rollResult.isCritFail,
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.roll, out);
      (node.entries || []).forEach((e) => {
        const f = getEntryFormula(e);
        if (f) collectVariableRefs(f, out);
      });
    },

    toDisplayString(node) {
      const entries = (node.entries || [])
        .map((e) => {
          const f = getEntryFormula(e);
          const min = e.min ?? 0;
          const max = e.max ?? min;
          const range =
            Number(min) === Number(max) ? String(min) : `${min}-${max}`;
          return `${range}:${nodeToString(f)}`;
        })
        .join(";");
      return `table[${nodeToString(node.roll)};${entries}]`;
    },

    renderEditor() {
      const div = document.createElement("div");
      div.innerText = "Tables are edited in the properties panel.";
      return div;
    },
  });
}
