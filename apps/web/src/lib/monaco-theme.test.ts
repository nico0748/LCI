import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonacoTheme, defineLciThemes, MONACO_THEME_NAME } from "./monaco-theme.ts";
import { LCI_TOKENS } from "./theme/tokens.ts";
import { contrastRatio } from "./theme/contrast.ts";

test("buildMonacoTheme: 面と文字は LCI の semantic トークンに合わせる（03 §3.10）", () => {
  for (const mode of ["light", "dark"] as const) {
    const t = buildMonacoTheme(mode);
    assert.equal(t.base, mode === "dark" ? "vs-dark" : "vs");
    assert.equal(t.inherit, true);
    assert.equal(t.colors["editor.background"], LCI_TOKENS[mode]["bg-surface"]);
    assert.equal(t.colors["editor.foreground"], LCI_TOKENS[mode].fg);
    assert.equal(t.colors["editorCursor.foreground"], LCI_TOKENS[mode].fg);
    assert.match(t.colors["editor.selectionBackground"]!, /^#[0-9a-f]{8}$/);
  }
});

test("buildMonacoTheme: 行番号は surface 上で 4.5:1 以上", () => {
  for (const mode of ["light", "dark"] as const) {
    const t = buildMonacoTheme(mode);
    const r = contrastRatio(t.colors["editorLineNumber.foreground"]!, t.colors["editor.background"]!);
    assert.ok(r >= 4.5, `${mode}: ${r}`);
  }
});

test("defineLciThemes: lci-light と lci-dark を登録する", () => {
  const defined: string[] = [];
  defineLciThemes({ editor: { defineTheme: (name) => void defined.push(name) } });
  assert.deepEqual(defined, [MONACO_THEME_NAME.light, MONACO_THEME_NAME.dark]);
});
