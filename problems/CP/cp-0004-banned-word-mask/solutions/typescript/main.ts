import { readFileSync } from "node:fs";

// 本文には空白が続くことがあるので、空白で split せず行で読む
const lines = readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
const words: string[] = [];
for (let i = 0; i < n; i++) words.push(lines[1 + i].trim());
const s = lines[1 + n].replace(/\r$/, "");
// 原文の上で一致を探して印だけ付ける（置き換えた文字列で次の語を探さない。重なった一致も拾う）
const mark = new Uint8Array(s.length);
for (const wd of words) {
  for (let i = 0; i + wd.length <= s.length; i++) {
    if (s.startsWith(wd, i)) mark.fill(1, i, i + wd.length);
  }
}
const out: string[] = [];
for (let i = 0; i < s.length; i++) out.push(mark[i] ? "*" : s[i]);
process.stdout.write(out.join("") + "\n");
