import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const q = Number(tok[1]);
const parent = new Int32Array(n + 1);
const size = new Int32Array(n + 1);
for (let i = 0; i <= n; i++) {
  parent[i] = i;
  size[i] = 1;
}

/** 根を返す。再帰にしない（深さ 10^5 で Node のスタックが溢れる）。経路半減で木を浅く保つ */
function find(x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

const out: string[] = [];
let p = 2;
for (let j = 0; j < q; j++) {
  const t = tok[p];
  if (t === "2") {
    out.push(String(size[find(Number(tok[p + 1]))]));
    p += 2;
    continue;
  }
  let a = find(Number(tok[p + 1]));
  let b = find(Number(tok[p + 2]));
  p += 3;
  if (t === "1") {
    if (a !== b) {
      // 既に同じ組なら何もしない。小さい組を大きい組の下に付ける
      if (size[a] < size[b]) [a, b] = [b, a];
      parent[b] = a;
      size[a] += size[b];
    }
  } else {
    out.push(a === b ? "Yes" : "No");
  }
}
process.stdout.write(out.join("\n") + "\n");
