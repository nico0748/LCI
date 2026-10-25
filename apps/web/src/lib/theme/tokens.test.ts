import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGlobalsCss, resolveColorTokens, resolveValue } from "./css-tokens.ts";
import { LCI_TOKENS, PRIMITIVES, SEMANTIC_TOKEN_NAMES, FONT_MONO } from "./tokens.ts";
import { CONTRAST_PAIRS, SESSION_FOCUS_PAIRS } from "./pairs.ts";
import { contrastRatio, mixHex } from "./contrast.ts";

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const parsed = parseGlobalsCss(css);

test("tokens.ts の LCI_TOKENS は globals.css の light / dark と一致する（Monaco 用の静的な写し）", () => {
  assert.deepEqual(resolveColorTokens(parsed.light, parsed.primitives), LCI_TOKENS.light);
  assert.deepEqual(resolveColorTokens(parsed.dark, parsed.primitives), LCI_TOKENS.dark);
});

test("dark の 2 つの定義（@media prefers-color-scheme と [data-theme=dark]）は同じ値", () => {
  assert.deepEqual(resolveColorTokens(parsed.darkMedia, parsed.primitives), resolveColorTokens(parsed.dark, parsed.primitives));
  // 色以外（影・backdrop）も含めて宣言の集合が一致する
  assert.deepEqual(Object.keys(parsed.darkMedia).sort(), Object.keys(parsed.dark).sort());
});

test("light と dark は同じトークン名の集合を持つ", () => {
  assert.deepEqual(Object.keys(parsed.light).sort(), Object.keys(parsed.dark).sort());
  assert.deepEqual([...SEMANTIC_TOKEN_NAMES].sort(), Object.keys(LCI_TOKENS.dark).sort());
});

test("PRIMITIVES は globals.css の --dads-* / --lci-* と一致し、使われていない段を持たない", () => {
  const prims = resolveColorTokens(parsed.primitives, {});
  assert.deepEqual(prims, { ...PRIMITIVES });
  const used = new Set<string>();
  for (const block of [parsed.light, parsed.dark]) {
    for (const v of Object.values(block)) for (const m of v.matchAll(/var\(--((?:dads|lci)-[\w-]+)\)/g)) used.add(m[1]!);
  }
  // Monaco の行番号は primitive を直接使う
  used.add("dads-gray-400");
  used.add("dads-gray-536");
  const unused = Object.keys(prims).filter((k) => !used.has(k));
  assert.deepEqual(unused, []);
});

test("FONT_MONO は --font-mono と同じ", () => {
  assert.equal(resolveValue("var(--font-mono)", [parsed.primitives]), FONT_MONO);
});

test("pairs.ts の組み合わせはすべて基準を満たす（check-contrast と同じ判定）", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const p of [...CONTRAST_PAIRS, ...SESSION_FOCUS_PAIRS]) {
      const r = contrastRatio(LCI_TOKENS[mode][p.fg], LCI_TOKENS[mode][p.bg]);
      assert.ok(r >= p.min, `${mode}: ${p.fg} / ${p.bg} = ${r.toFixed(2)} < ${p.min}`);
    }
  }
});

test("dark の eval-*-subtle は mark 16% + surface の固定値（04 §3.2）", () => {
  const d = LCI_TOKENS.dark;
  for (const k of ["major", "minor", "good"] as const) {
    assert.equal(d[`eval-${k}-subtle`], mixHex(d[`eval-${k}`], d["bg-surface"], 0.16));
  }
});

test("contrastRatio は WCAG の既知値を返す", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");
});
