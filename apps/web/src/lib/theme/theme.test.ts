import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThemePreference, resolveTheme, resolveThemeFromAttribute, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme.ts";

test("parseThemePreference: light / dark 以外はすべて system", () => {
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  for (const v of ["system", "", null, undefined, "DARK", 1]) assert.equal(parseThemePreference(v), "system");
});

test("resolveTheme: 明示指定は OS 設定より優先、自動は OS 設定に従う", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveThemeFromAttribute(null, true), "dark");
  assert.equal(resolveThemeFromAttribute("light", true), "light");
});

test("THEME_INIT_SCRIPT: 保存値を data-theme に反映し、localStorage が使えなくても例外を出さない", () => {
  const attrs: Record<string, string> = {};
  const run = (storage: { getItem: (k: string) => string | null }) => {
    const fn = new Function("localStorage", "document", THEME_INIT_SCRIPT);
    fn(storage, { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } });
  };
  run({ getItem: (k) => (k === THEME_STORAGE_KEY ? "dark" : null) });
  assert.equal(attrs["data-theme"], "dark");
  delete attrs["data-theme"];
  run({ getItem: () => "system" });
  assert.equal(attrs["data-theme"], undefined);
  run({
    getItem: () => {
      throw new Error("SecurityError");
    },
  });
  assert.equal(attrs["data-theme"], undefined);
});
