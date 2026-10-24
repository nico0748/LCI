import { readFileSync } from "node:fs";

const tokens = readFileSync(0, "utf8").split(/\s+/).filter(Boolean);
const n = Number(tokens[0]);
const k = Number(tokens[1]);
const words = tokens.slice(2, 2 + n);
// ここに実装する
console.log("TODO");
