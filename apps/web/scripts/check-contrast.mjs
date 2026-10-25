// globals.css を解析し、src/lib/theme/pairs.ts の組み合わせを light / dark の両方で検証する。
// 実行: pnpm --filter @lci/web check:contrast（node --experimental-strip-types で .ts を直接 import する）
// 1 つでも基準を割ったら終了コード 1。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGlobalsCss, resolveColorTokens } from "../src/lib/theme/css-tokens.ts";
import { contrastRatio, formatRatio } from "../src/lib/theme/contrast.ts";
import { CONTRAST_PAIRS, SESSION_FOCUS_PAIRS } from "../src/lib/theme/pairs.ts";

const cssPath = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));
const parsed = parseGlobalsCss(readFileSync(cssPath, "utf8"));
const modes = {
  light: resolveColorTokens(parsed.light, parsed.primitives),
  dark: resolveColorTokens(parsed.dark, parsed.primitives),
};
const darkMedia = resolveColorTokens(parsed.darkMedia, parsed.primitives);

let failures = 0;

// dark の 2 つの定義（@media と data-theme）が一致しているか
const drift = Object.keys({ ...modes.dark, ...darkMedia }).filter((k) => modes.dark[k] !== darkMedia[k]);
if (drift.length) {
  failures += drift.length;
  console.log(`✗ dark の @media と [data-theme="dark"] の値が違います: ${drift.join(", ")}`);
}

const pairs = [...CONTRAST_PAIRS.map((p) => ({ ...p, group: "標準" })), ...SESSION_FOCUS_PAIRS.map((p) => ({ ...p, group: "面接" }))];
for (const [mode, t] of Object.entries(modes)) {
  const rows = [];
  let worstText = Infinity;
  let worstUi = Infinity;
  for (const p of pairs) {
    const fg = t[p.fg];
    const bg = t[p.bg];
    if (!fg || !bg) {
      failures++;
      rows.push(`  ✗ ${p.fg} / ${p.bg}: トークンが見つかりません`);
      continue;
    }
    const r = contrastRatio(fg, bg);
    const ok = r >= p.min;
    if (p.min === 4.5) worstText = Math.min(worstText, r);
    else worstUi = Math.min(worstUi, r);
    if (!ok) failures++;
    rows.push(`  ${ok ? "✓" : "✗"} ${formatRatio(r).padStart(6)} ≥${p.min}  ${p.fg} ${fg} / ${p.bg} ${bg}  (${p.group}: ${p.note})`);
  }
  console.log(`\n## ${mode}（${pairs.length} 組）  本文の最小 ${formatRatio(worstText)} / UI の最小 ${formatRatio(worstUi)}`);
  const verbose = process.argv.includes("--all");
  for (const row of rows) if (verbose || row.startsWith("  ✗")) console.log(row);
  if (!verbose) console.log("  （全行は --all）");
}

if (failures) {
  console.log(`\n✗ ${failures} 件が基準を満たしません`);
  process.exit(1);
}
console.log("\n✓ すべての組み合わせが基準を満たしています");
