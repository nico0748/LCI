import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildSrcdoc, embedJson } from "./host.ts";

const template = readFileSync(path.resolve(import.meta.dirname, "../../../../public/sandbox/frame.html"), "utf8");

test("buildSrcdoc: CSP・設定・Tailwind・ユーザ HTML を埋め込む", () => {
  const html = "<body><p>$& $1 </script></p></body>";
  const doc = buildSrcdoc(template, { type: "load", html, mockApi: null, scenarioMode: "preview", tailwind: true }, "http://localhost:3000");
  assert.ok(!doc.includes("__LCI_"), "プレースホルダが残っていない");
  assert.match(doc, /connect-src 'none'/);
  assert.match(doc, /script-src 'unsafe-inline' 'unsafe-eval' http:\/\/localhost:3000;/);
  assert.ok(doc.includes('<script src="http://localhost:3000/sandbox/tailwind.js"></script>'));
  assert.ok(doc.includes(html), "置換パターン（$&）がそのまま入る");
  const cfg = JSON.parse(/<script id="lci-config" type="application\/json">([\s\S]*?)<\/script>/.exec(doc)![1]!);
  assert.equal(cfg.scenarioMode, "preview");
  assert.equal(cfg.html, undefined, "ユーザ HTML は設定 JSON に二重に入れない");
  assert.ok(doc.indexOf("shim.js") < doc.indexOf(html), "シムはユーザ HTML より先");
});

test("buildSrcdoc: tailwind none なら読み込まない", () => {
  const doc = buildSrcdoc(template, { type: "load", html: "", mockApi: null, scenarioMode: "judge", tailwind: false }, "http://x");
  assert.ok(!doc.includes("tailwind.js"));
});

test("embedJson: </script> を壊さない", () => {
  const s = embedJson({ a: "</script><b> " });
  assert.ok(!s.includes("</script>"));
  assert.deepEqual(JSON.parse(s), { a: "</script><b> " });
});
