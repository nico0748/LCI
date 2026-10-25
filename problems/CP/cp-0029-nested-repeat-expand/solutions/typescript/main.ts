import { readFileSync } from "node:fs";

const s = readFileSync(0, "utf8").trim();
// stack[top] は今いる括弧の中で、ここまでに展開した断片の列
const stack: string[][] = [[]];
const counts: number[] = []; // 開いている括弧ごとの回数
const isDigit = (c: string) => c >= "0" && c <= "9";
let i = 0;
while (i < s.length) {
  const ch = s[i];
  if (isDigit(ch)) {
    let j = i;
    while (isDigit(s[j])) j++; // 回数は複数桁（例: 999a、12(…)）
    const k = Number(s.slice(i, j));
    if (s[j] === "(") {
      counts.push(k);
      stack.push([]);
    } else {
      stack[stack.length - 1].push(s[j].repeat(k)); // 直後の 1 文字だけを k 個
    }
    i = j + 1;
  } else if (ch === ")") {
    const body = stack.pop()!.join("");
    stack[stack.length - 1].push(body.repeat(counts.pop()!));
    i++;
  } else {
    stack[stack.length - 1].push(ch);
    i++;
  }
}
process.stdout.write(stack[0].join("") + "\n");
