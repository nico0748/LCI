import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs, constants as fsc } from "node:fs";
import path from "node:path";
import { LCI_ASSERT_H, LCI_ASSERT_PHP } from "./templates.ts";
import { FakeBackend } from "./backend-fake.ts";
import { parseTap } from "./unit-parsers.ts";

const TPL = path.resolve(import.meta.dirname, "../templates/harness");

async function has(bin: string): Promise<boolean> {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    try {
      await fs.access(path.join(dir, bin), fsc.X_OK);
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}

test("embedded templates match templates/ files", async () => {
  assert.equal(await fs.readFile(path.join(TPL, "c/lci_assert.h"), "utf8"), LCI_ASSERT_H, "templates.ts を再生成してください");
  assert.equal(await fs.readFile(path.join(TPL, "php/lci_assert.php"), "utf8"), LCI_ASSERT_PHP, "templates.ts を再生成してください");
});

test("C lci_assert.h emits parseable TAP", async (t) => {
  if (!(await has("gcc"))) return t.skip("gcc がありません");
  const b = new FakeBackend();
  const ws = await b.open("c", [
    { path: "lci_assert.h", content: LCI_ASSERT_H },
    { path: "solution.c", content: "int add(int a, int b) { return a + b + (a < 0); }\n" },
    {
      path: "test.c",
      content: `#include "lci_assert.h"
#include "solution.c"
LCI_TEST(add_small) { LCI_ASSERT_EQ_INT(add(1, 2), 3); }
LCI_TEST(add_neg) { LCI_ASSERT_EQ_INT(add(-1, 1), 0); }
LCI_TEST(str_ok) { LCI_ASSERT_EQ_STR("a", "a"); }
LCI_MAIN(add_small, add_neg, str_ok)
`,
    },
  ]);
  const r = await ws.exec(["bash", "-c", "gcc -O2 -std=c17 -Wall -o t test.c -lm && ./t"], { limits: { wallMs: 20000, outputKb: 64 } });
  await ws.close();
  assert.equal(r.exitCode, 1, r.stderr);
  const res = parseTap(r.stdout);
  assert.deepEqual(res.map((x) => [x.name, x.ok]), [["add_small", true], ["add_neg", false], ["str_ok", true]]);
  assert.match(res[1]!.message!, /expected 0, got 1/);
});

test("PHP lci_assert.php emits parseable TAP", async (t) => {
  if (!(await has("php"))) return t.skip("php がありません");
  const b = new FakeBackend();
  const ws = await b.open("php", [
    { path: "lci_assert.php", content: LCI_ASSERT_PHP },
    { path: "solution.php", content: "<?php\nfunction add(int $a, int $b): int { return $a + $b + ($a < 0 ? 1 : 0); }\n" },
    {
      path: "test.php",
      content: `<?php
require __DIR__ . '/lci_assert.php';
require __DIR__ . '/solution.php';
lci_test('add small', fn() => lci_assert_eq(add(1, 2), 3));
lci_test('add neg', fn() => lci_assert_eq(add(-1, 1), 0));
lci_test('throws', function () { throw new RuntimeException('boom'); });
lci_run();
`,
    },
  ]);
  const r = await ws.exec(["php", "-d", "display_errors=stderr", "test.php"], { limits: { wallMs: 10000, outputKb: 64 } });
  await ws.close();
  assert.equal(r.exitCode, 1, r.stderr);
  const res = parseTap(r.stdout);
  assert.deepEqual(res.map((x) => [x.name, x.ok]), [["add small", true], ["add neg", false], ["throws", false]]);
  assert.match(res[1]!.message!, /expected 0, got 1/);
  assert.match(res[2]!.message!, /RuntimeException: boom/);
});
