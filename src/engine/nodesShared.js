export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function describeRolls(rolls) {
  return rolls.length ? rolls.join("+") : "0";
}

export function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

export function sortNumbers(arr, mode) {
  return [...arr].sort(mode === "highest" ? (a, b) => b - a : (a, b) => a - b);
}
