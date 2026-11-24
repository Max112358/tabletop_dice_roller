import { registry } from "./nodeRegistry.js";

export class EvalContext {
  constructor(variables = {}) {
    this.variables = variables;
    this.primaryRoll = null;
  }

  evaluate(node) {
    if (!node || typeof node !== "object") {
      throw new Error("Evaluator received non-node value: " + node);
    }
    const def = registry.get(node.type);
    if (!def) throw new Error(`Unknown node type: ${node.type}`);
    return def.evaluate(node, this);
  }

  getVariable(name) {
    if (!name) return null;
    const key = Object.keys(this.variables).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    return key ? this.variables[key] : null;
  }

  trackPrimaryRoll(roll) {
    if (!this.primaryRoll) this.primaryRoll = roll;
  }
}

export function checkCritRule(rule, primaryRoll, ctx) {
  if (!primaryRoll) return false;

  const trigger = rule.trigger;

  if (trigger === "max") {
    return primaryRoll.total === primaryRoll.count * primaryRoll.sides;
  }
  if (trigger === "min") {
    return primaryRoll.total === primaryRoll.count;
  }
  if (trigger === "value") {
    const target = ctx.evaluate(rule.value).value;
    return primaryRoll.total === target;
  }
  if (trigger === "range") {
    const min = ctx.evaluate(rule.min).value;
    const max = ctx.evaluate(rule.max).value;
    return primaryRoll.total >= min && primaryRoll.total <= max;
  }
  if (trigger === "doubles") {
    const totalStr = String(primaryRoll.total);
    return totalStr.length > 1 && /^(\d)\1+$/.test(totalStr);
  }
  if (trigger === "yahtzee") {
    return (
      primaryRoll.rolls.length > 1 &&
      primaryRoll.rolls.every((r) => r === primaryRoll.rolls[0])
    );
  }
  return false;
}

export function executeAST(ast, variables = {}) {
  const ctx = new EvalContext(variables);
  const root = ast.root ?? ast;
  migrateCheckNode(root);
  const rollResult = ctx.evaluate(root);

  const primary = ctx.primaryRoll;
  const checkResult = rollResult.checkResult || null;

  let gotCritSuccess = primary?.isCritSuccess || false;
  let gotCritFail = primary?.isCritFail || false;

  if (primary && checkResult) {
    for (const mod of primary.sourceMods || []) {
      if (mod.trigger !== "checkRelative") continue;

      const isDoubles =
        String(primary.total).length > 1 &&
        /^(\d)\1+$/.test(String(primary.total));

      if (!isDoubles) continue;

      if (
        mod.mode === "successesDoubles" &&
        ["success", "strong"].includes(checkResult)
      ) {
        gotCritSuccess = true;
      }
      if (mod.mode === "failuresDoubles" && checkResult === "failure") {
        gotCritFail = true;
      }
    }
  }

  const dhContext = [
    rollResult.daggerheartContext,
    rollResult.checkContext,
    ...(gotCritSuccess ? ["🌟 CRITICAL SUCCESS!"] : []),
    ...(gotCritFail ? ["💀 CRITICAL FAILURE!"] : []),
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    total: rollResult.value,
    breakdown: mergeBreakdowns(rollResult.breakdown),
    dhContext: dhContext || null,
    isCritSuccess: gotCritSuccess || rollResult.isCritical || false,
    isCritFail: gotCritFail || false,
    isSuccess:
      rollResult.checkResult === "success" ||
      rollResult.checkResult === "strong"
        ? true
        : rollResult.checkResult === "failure"
          ? false
          : null,
    checkResult: rollResult.checkResult || null,
  };
}

function migrateCheckNode(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "check") {
    if (!node.operands || node.operands.length < 2) {
      node.operands = [
        node.roll ?? node.left ?? { type: "number", value: 0 },
        node.dc ?? node.weak ?? { type: "number", value: 0 },
      ];
    }
    if (!node.sign) {
      node.sign = node.mode === "lte" ? "<=" : ">=";
    }
    if (!node.mode || (node.mode !== "binary" && node.mode !== "ternary")) {
      node.mode = node.strong ? "ternary" : "binary";
    }
  }
  if (node.operands) node.operands.forEach(migrateCheckNode);
  if (node.batch) migrateCheckNode(node.batch);
  if (node.roll) migrateCheckNode(node.roll);
  if (node.entries) {
    node.entries.forEach((e) => {
      migrateCheckNode(e.roll);
      migrateCheckNode(e.result);
    });
  }
}

function mergeBreakdowns(parts, joiner = " -> ") {
  const flat = parts
    ?.flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter(Boolean);
  return flat?.length ? flat.join(joiner) : null;
}

export function collectVariableRefs(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  const def = registry.get(node.type);
  if (def?.collectVariables) {
    def.collectVariables(node, out);
  } else {
    Object.values(node).forEach((v) => {
      if (Array.isArray(v)) v.forEach((item) => collectVariableRefs(item, out));
      else if (v && typeof v === "object") collectVariableRefs(v, out);
    });
  }
  return out;
}
