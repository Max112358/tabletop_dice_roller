import number from "../nodes/number.js";
import variable from "../nodes/variable.js";
import label from "../nodes/label.js";
import math from "../nodes/math.js";
import dice from "../nodes/dice.js";
import pool from "../nodes/pool.js";
import rollUntilTarget from "../nodes/rollUntilTarget.js";
import daggerheart from "../nodes/daggerheart.js";
import check from "../nodes/check.js";
import table from "../nodes/table.js";

import keep from "../modifiers/keep.js";
import reroll from "../modifiers/reroll.js";
import replace from "../modifiers/replace.js";
import critRule from "../modifiers/critRule.js";

export function registerAll() {
  number();
  variable();
  label();
  math();
  dice();
  pool();
  rollUntilTarget();
  daggerheart();
  check();
  table();

  keep();
  reroll();
  replace();
  critRule();
}
