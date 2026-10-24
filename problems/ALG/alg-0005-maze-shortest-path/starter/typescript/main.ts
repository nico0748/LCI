import { readFileSync } from "node:fs";

const tokens = readFileSync(0, "utf8").split(/\s+/).filter(Boolean);
const h = Number(tokens[0]);
const w = Number(tokens[1]);
const grid = tokens.slice(2, 2 + h);
// ここに実装する
console.log("TODO");
