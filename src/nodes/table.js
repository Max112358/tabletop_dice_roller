import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString } from "../shared.js";

function getEntryFormula(entry) {
  return entry.formula ?? entry.result;
}

function summarizeEntries(entries) {
  if (!entries || entries.length === 0) return "";
  const min = entries[0].min ?? 0;
  const last = entries[entries.length - 1];
  const max = last.max ?? last.min ?? min;
  return `; ${entries.length} entries, ${min}-${max}`;
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
          isCritSuccess: rollResult.isCritSuccess,
          isCritFail: rollResult.isCritFail,
          tableDetail: {
            rollValue,
            entryLabel: "",
            entryNote: "",
            entryResult: 0,
            entryBreakdown: "no table entry",
          },
        };
      }

      const formula = getEntryFormula(entry);
      const result = formula
        ? ctx.evaluate(formula)
        : { value: 0, breakdown: [] };

      const entryLabel = entry.label || "";
      const entryNote = entry.note || "";
      const entryBreakdown = result.breakdown?.[0] ?? String(result.value);

      const tableDetail = {
        rollValue,
        entryLabel,
        entryNote,
        entryResult: result.value,
        entryBreakdown,
      };

      const parts = [`${nodeToString(node.roll)}=${rollValue}`];
      if (entryLabel) parts.push(`[${entryLabel}]`);
      if (entryNote) parts.push(entryNote);
      parts.push(`Result: ${entryBreakdown}`);

      return {
        value: result.value,
        breakdown: parts,
        rolls: rollResult.rolls || [],
        isCritSuccess: rollResult.isCritSuccess,
        isCritFail: rollResult.isCritFail,
        tableDetail,
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
      return `table[${nodeToString(node.roll)}${summarizeEntries(
        node.entries,
      )}]`;
    },

    renderEditor() {
      const div = document.createElement("div");
      div.innerText = "Tables are edited in the properties panel.";
      return div;
    },
  });
}
