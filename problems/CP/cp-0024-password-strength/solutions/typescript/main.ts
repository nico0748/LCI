import { readFileSync } from "node:fs";

const SYMBOLS = "!#$%&*+-=?@_";

function judge(user: string, pw: string): string {
  // 規則 1: 長さ
  if (pw.length < 8 || pw.length > 64) return "1";
  let upper = false;
  let lower = false;
  let digit = false;
  let symbol = false;
  for (const c of pw) {
    if (c >= "A" && c <= "Z") upper = true;
    else if (c >= "a" && c <= "z") lower = true;
    else if (c >= "0" && c <= "9") digit = true;
    else if (SYMBOLS.includes(c)) symbol = true;
    else return "2"; // 規則 2: 使えない文字
  }
  // 規則 3: 4 種類のうち 3 種類以上
  if (Number(upper) + Number(lower) + Number(digit) + Number(symbol) < 3) return "3";
  // 規則 4: 同じ文字の 3 連続（数えた直後に判定するので末尾の連続も漏れない）
  let run = 1;
  for (let i = 1; i < pw.length; i++) {
    run = pw[i] === pw[i - 1] ? run + 1 : 1;
    if (run >= 3) return "4";
  }
  // 規則 5: ユーザー名を含まない（大文字小文字を区別しない）
  if (pw.toLowerCase().includes(user.toLowerCase())) return "5";
  return "OK";
}

const lines = readFileSync(0, "utf8").split("\n");
const n = Number(lines[0]);
const out: string[] = [];
for (let i = 1; i <= n; i++) {
  const line = lines[i];
  const sp = line.indexOf(" ");
  out.push(judge(line.slice(0, sp), line.slice(sp + 1)));
}
process.stdout.write(out.join("\n") + "\n");
