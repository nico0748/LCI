import { readFileSync } from "node:fs";

// 暗号文には空白が続くことがあるので、行で読む（行末の \r だけ落とす）
const lines = readFileSync(0, "utf8").split("\n");
const key = lines[0].trim();
const s = lines[1].replace(/\r$/, "");
const m = key.length;
const shift = new Int32Array(m);
for (let i = 0; i < m; i++) shift[i] = key.charCodeAt(i) - 97;
const out = new Uint8Array(s.length);
let j = 0; // 鍵の位置。英字を 1 文字戻したときだけ進める
for (let i = 0; i < s.length; i++) {
  const c = s.charCodeAt(i);
  if (c >= 97 && c <= 122) {
    // JS の % は負の数に負を返すので、+26 してから取る
    out[i] = ((c - 97 - shift[j % m] + 26) % 26) + 97;
    j++;
  } else if (c >= 65 && c <= 90) {
    out[i] = ((c - 65 - shift[j % m] + 26) % 26) + 65;
    j++;
  } else {
    out[i] = c;
  }
}
process.stdout.write(Buffer.from(out).toString("latin1") + "\n");
