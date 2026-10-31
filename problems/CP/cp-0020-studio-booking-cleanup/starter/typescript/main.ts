import { readFileSync } from "node:fs";

// 標準入力をまとめて読む（readline で 1 行ずつ読むより速い）
const input = readFileSync(0, "utf8");
// 例: const tokens = input.split(/\s+/).filter((s) => s !== "");  /  const lines = input.split("\n");
// TODO: 入力を解析して答えを求める（2^53 を超える整数は BigInt、数値の sort は比較関数を渡す）
// 出力は配列に溜めて最後に 1 回で書く（例: process.stdout.write(out.join("\n") + "\n")）
void input;
