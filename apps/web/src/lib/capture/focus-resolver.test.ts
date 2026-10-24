import { test } from "node:test";
import assert from "node:assert/strict";
import { RegexFocusResolver, chainAt, outline, sameSymbol } from "./focus-resolver.ts";

const r = new RegexFocusResolver();

test("javascript: 関数・クラス・メソッド・アロー関数の入れ子", () => {
  const src = [
    "const cache = new Map();", // 1
    "class Store {", // 2
    "  get(key) {", // 3
    "    return this.m.get(key); // }", // 4
    "  }", // 5
    "}", // 6
    "async function search(q) {", // 7
    "  const url = `x{`;", // 8
    "  const res = await fetch(url);", // 9
    "}", // 10
    "const render = (items) => {", // 11
    "  items.forEach(i => {});", // 12
    "};", // 13
    "const one = (x) => x + 1;", // 14
  ].join("\n");
  assert.equal(r.resolve(src, 1, "javascript").symbol, null);
  assert.deepEqual(r.resolve(src, 4, "javascript").symbol?.path, ["Store", "get"]);
  assert.equal(r.resolve(src, 4, "javascript").symbol?.kind, "method");
  assert.deepEqual(r.resolve(src, 9, "javascript").symbol?.path, ["search"]);
  assert.deepEqual(r.resolve(src, 9, "javascript").symbol?.range, [7, 1, 10, 2]);
  assert.deepEqual(r.resolve(src, 12, "javascript").symbol?.path, ["render"]);
  assert.deepEqual(r.resolve(src, 14, "javascript").symbol?.path, ["one"]);
  assert.equal(r.resolve(src, 14, "javascript").confidence, "low");
  assert.equal(r.resolve(src, 14, "javascript").resolver, "regex");
});

test("javascript: 編集中（閉じ括弧なし）でも末尾まで含める", () => {
  const src = "function a() {\n  const x = 1;\n";
  const s = r.resolve(src, 2, "javascript").symbol;
  assert.deepEqual(s?.path, ["a"]);
  assert.equal(s?.range[2], 3);
});

test("python: インデントで入れ子を解決", () => {
  const src = ["class Cache:", "    def __init__(self):", "        self.m = {}", "", "    def get(self, k):", "        return self.m.get(k)", "", "def main():", "    c = Cache()", "x = 1"].join("\n");
  assert.deepEqual(r.resolve(src, 3, "python").symbol?.path, ["Cache", "__init__"]);
  assert.deepEqual(r.resolve(src, 6, "python").symbol?.path, ["Cache", "get"]);
  assert.deepEqual(r.resolve(src, 9, "python").symbol?.path, ["main"]);
  assert.equal(r.resolve(src, 10, "python").symbol, null);
  assert.deepEqual(r.resolve(src, 4, "python").symbol?.path, ["Cache"], "メソッド間の空行はクラスに属する（直前メソッドには含めない）");
});

test("go / rust / c / php の定義行", () => {
  const go = "package main\n\ntype S struct {\n  a int\n}\n\nfunc (s *S) Get() int {\n  return s.a\n}\n\nfunc main() {\n}\n";
  assert.deepEqual(r.resolve(go, 4, "go").symbol?.path, ["S"]);
  assert.deepEqual(r.resolve(go, 8, "go").symbol?.path, ["S.Get"]);
  assert.deepEqual(r.resolve(go, 11, "go").symbol?.path, ["main"]);

  const rust = "struct P { x: i32 }\nimpl P {\n    pub fn new() -> P {\n        P { x: 0 }\n    }\n}\nfn main() {\n    let p = P::new();\n}\n";
  assert.deepEqual(r.resolve(rust, 4, "rust").symbol?.path, ["P", "new"]);
  assert.deepEqual(r.resolve(rust, 8, "rust").symbol?.path, ["main"]);

  const c = "#include <stdio.h>\nint add(int a, int b);\nstatic int add(int a, int b)\n{\n    return a + b;\n}\nint main(void) {\n    if (1) {\n        printf(\"%d\", add(1, 2));\n    }\n    return 0;\n}\n";
  assert.equal(r.resolve(c, 2, "c").symbol, null, "プロトタイプは定義ではない");
  assert.deepEqual(r.resolve(c, 5, "c").symbol?.path, ["add"]);
  assert.deepEqual(r.resolve(c, 9, "c").symbol?.path, ["main"]);

  const php = "<?php\nclass A {\n  public function f() {\n    return 1;\n  }\n}\nfunction g() {}\n";
  assert.deepEqual(r.resolve(php, 4, "php").symbol?.path, ["A", "f"]);
  assert.deepEqual(r.resolve(php, 7, "php").symbol?.path, ["g"]);
});

test("html: 要素スタックと <script> 内 JS の二次解析", () => {
  const src = [
    "<!doctype html>", // 1
    "<html>", // 2
    "<body class=\"p-4\">", // 3
    "  <div class=\"flex\">", // 4
    "    <input id=\"q\" />", // 5
    "    <button id=\"go\">検索</button>", // 6
    "  </div>", // 7
    "  <div id=\"results\"></div>", // 8
    "  <script>", // 9
    "    const cache = new Map();", // 10
    "    async function search() {", // 11
    "      const q = input.value;", // 12
    "    }", // 13
    "  </script>", // 14
    "  <style>", // 15
    "    .row { display: flex; }", // 16
    "  </style>", // 17
    "</body>", // 18
    "</html>", // 19
  ].join("\n");
  assert.deepEqual(r.resolve(src, 6, "html").symbol?.path, ["div.flex", "button#go"]);
  assert.deepEqual(r.resolve(src, 8, "html").symbol?.path, ["div#results"]);
  assert.deepEqual(r.resolve(src, 10, "html").symbol?.path, ["script"]);
  const inScript = r.resolve(src, 12, "html").symbol;
  assert.deepEqual(inScript?.path, ["script", "search"]);
  assert.equal(inScript?.kind, "function");
  assert.deepEqual(inScript?.range.slice(0, 3), [11, 1, 13]);
  assert.deepEqual(r.resolve(src, 16, "html").symbol?.path, ["style", ".row"]);
});

test("chainAt / sameSymbol", () => {
  const nodes = outline("function a() {\n  function b() {\n  }\n}\n", "javascript");
  assert.deepEqual(
    chainAt(nodes, 2).map((n) => n.name),
    ["a", "b"],
  );
  assert.equal(sameSymbol({ path: ["a"], kind: "function", range: [1, 1, 2, 1] }, { path: ["a"], kind: "function", range: [1, 1, 9, 1] }), true);
  assert.equal(sameSymbol({ path: ["a"], kind: "function", range: [1, 1, 2, 1] }, null), false);
});
