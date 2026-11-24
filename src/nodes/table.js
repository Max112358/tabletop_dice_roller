import { registry } from "../engine/nodeRegistry.js";
import { collectVariableRefs } from "../engine/evaluator.js";
import { nodeToString, renderGenericEditor } from "../shared.js";

export default function register() {
  registry.register({
    type: "table",
    label: "Lookup Table",
    category: "composite",

    create() {
      return {
        type: "table",
        roll: { type: "dice", count: 1, sides: 6, modifiers: [] },
        entries: [
          { min: 1, max: 1, result: { type: "label", value: "Result 1" } },
        ],
      };
    },

    evaluate(node, ctx) {
      const rollResult = ctx.evaluate(node.roll);
      const rollValue = rollResult.value;
      const entry = (node.entries || []).find(
        (e) => rollValue >= e.min && rollValue <= e.max,
      );

      if (!entry) {
        return {
          value: 0,
          breakdown: [
            `${nodeToString(node.roll)}=${rollValue} -> no table entry`,
          ],
          rolls: rollResult.rolls || [],
        };
      }

      const result = ctx.evaluate(entry.result);
      return {
        value: result.value,
        breakdown: [
          ...(rollResult.breakdown || []),
          `Table lookup ${rollValue}: ${result.breakdown?.[0] ?? result.value}`,
        ],
        rolls: rollResult.rolls || [],
      };
    },

    collectVariables(node, out) {
      collectVariableRefs(node.roll, out);
      (node.entries || []).forEach((e) => {
        collectVariableRefs(e.result, out);
      });
    },

    toDisplayString(node) {
      const entries = (node.entries || [])
        .map(
          (e) =>
            `${e.min}${e.min !== e.max ? `-${e.max}` : ""}:${nodeToString(e.result)}`,
        )
        .join(";");
      return `table[${nodeToString(node.roll)};${entries}]`;
    },

    renderEditor(node, update) {
      const root = document.createElement("div");
      root.className = "builder-table";

      const rollRow = document.createElement("div");
      rollRow.appendChild(document.createTextNode("Roll: "));
      rollRow.appendChild(
        renderGenericEditor(node.roll, (next) =>
          update({ ...node, roll: next }),
        ),
      );
      root.appendChild(rollRow);

      const entriesDiv = document.createElement("div");
      entriesDiv.className = "builder-table-entries";
      (node.entries || []).forEach((entry, idx) => {
        const row = document.createElement("div");
        row.className = "builder-table-row";

        const min = document.createElement("input");
        min.type = "number";
        min.value = entry.min;
        min.style.width = "3rem";
        const max = document.createElement("input");
        max.type = "number";
        max.value = entry.max;
        max.style.width = "3rem";

        const onRangeChange = () => {
          const entries = [...node.entries];
          entries[idx] = {
            ...entry,
            min: Number(min.value) || 0,
            max: Number(max.value) || 0,
          };
          update({ ...node, entries });
        };
        min.addEventListener("change", onRangeChange);
        max.addEventListener("change", onRangeChange);

        row.appendChild(min);
        row.appendChild(document.createTextNode("-"));
        row.appendChild(max);
        row.appendChild(document.createTextNode(" → "));

        row.appendChild(
          renderGenericEditor(entry.result, (next) => {
            const entries = [...node.entries];
            entries[idx] = { ...entry, result: next };
            update({ ...node, entries });
          }),
        );

        const del = document.createElement("button");
        del.innerText = "×";
        del.type = "button";
        del.addEventListener("click", () => {
          const entries = [...node.entries];
          entries.splice(idx, 1);
          update({ ...node, entries });
        });
        row.appendChild(del);

        entriesDiv.appendChild(row);
      });
      root.appendChild(entriesDiv);

      const addBtn = document.createElement("button");
      addBtn.innerText = "+ Add Row";
      addBtn.type = "button";
      addBtn.addEventListener("click", () => {
        const last = node.entries[node.entries.length - 1];
        const nextMin = last ? last.max + 1 : 1;
        update({
          ...node,
          entries: [
            ...(node.entries || []),
            {
              min: nextMin,
              max: nextMin,
              result: { type: "label", value: `Result ${nextMin}` },
            },
          ],
        });
      });
      root.appendChild(addBtn);

      return root;
    },
  });
}
