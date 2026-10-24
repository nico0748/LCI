import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGoTestJson, parseRustTest, parseTap, parseUnittestVerbose } from "./unit-parsers.ts";
import { compareOutput } from "./compare.ts";

test("TAP from node:test keeps leaves, drops suite rows", () => {
  const s = `TAP version 13
# Subtest: plain ok
ok 1 - plain ok
  ---
  duration_ms: 0.748424
  type: 'test'
  ...
# Subtest: grp
    # Subtest: child ok
    ok 1 - child ok
      ---
      duration_ms: 0.159294
      type: 'test'
      ...
    # Subtest: child bad
    not ok 2 - child bad
      ---
      duration_ms: 1.215266
      type: 'test'
      location: '/work/r1/t.test.ts:4:51'
      failureType: 'testCodeFailure'
      error: |-
        one is not two

        1 !== 2

      code: 'ERR_ASSERTION'
      ...
    1..2
not ok 2 - grp
  ---
  duration_ms: 2.109062
  type: 'suite'
  error: '1 subtest failed'
  ...
1..2
# tests 3
`;
  const r = parseTap(s);
  assert.deepEqual(
    r.map((x) => [x.name, x.ok]),
    [
      ["plain ok", true],
      ["child ok", true],
      ["child bad", false],
    ],
  );
  assert.equal(r[2]?.message, "one is not two\n\n1 !== 2");
  assert.equal(r[0]?.timeMs, 0.748424);
});

test("TAP from lci_assert (comment-line messages)", () => {
  const s = `TAP version 13
1..2
not ok 1 - add_small
# test.c:5: expected 3, got 4
ok 2 - add_neg
`;
  const r = parseTap(s);
  assert.deepEqual(r.map((x) => [x.name, x.ok]), [["add_small", false], ["add_neg", true]]);
  assert.equal(r[0]?.message, "test.c:5: expected 3, got 4");
  const php = `TAP version 13
1..1
not ok 1 - add small
# expected 3, got 4
`;
  assert.equal(parseTap(php)[0]?.message, "expected 3, got 4");
});

test("go test -json", () => {
  const s = [
    `{"Action":"start","Package":"lci"}`,
    `{"Action":"run","Package":"lci","Test":"TestAdd"}`,
    `{"Action":"output","Package":"lci","Test":"TestAdd","Output":"=== RUN   TestAdd\\n"}`,
    `{"Action":"output","Package":"lci","Test":"TestAdd","Output":"--- PASS: TestAdd (0.00s)\\n"}`,
    `{"Action":"pass","Package":"lci","Test":"TestAdd","Elapsed":0}`,
    `{"Action":"run","Package":"lci","Test":"TestBad"}`,
    `{"Action":"output","Package":"lci","Test":"TestBad","Output":"    add_test.go:4: expected 1 got 2\\n"}`,
    `{"Action":"output","Package":"lci","Test":"TestBad","Output":"--- FAIL: TestBad (0.01s)\\n"}`,
    `{"Action":"fail","Package":"lci","Test":"TestBad","Elapsed":0.01}`,
    `{"Action":"fail","Package":"lci","Elapsed":0.003}`,
  ].join("\n");
  assert.deepEqual(parseGoTestJson(s), [
    { name: "TestAdd", ok: true, message: undefined, timeMs: 0 },
    { name: "TestBad", ok: false, message: "add_test.go:4: expected 1 got 2", timeMs: 10 },
  ]);
});

test("python unittest -v", () => {
  const s = `test_bad (__main__.T.test_bad) ... FAIL
test_err (__main__.T.test_err) ... ERROR
test_ok (__main__.T.test_ok) ... ok
test_skip (__main__.T.test_skip) ... skipped 'later'

======================================================================
ERROR: test_err (__main__.T.test_err)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/work/r1/test_x.py", line 6, in test_err
    def test_err(self): raise ValueError("x")
                        ^^^^^^^^^^^^^^^^^^^^^
ValueError: x

======================================================================
FAIL: test_bad (__main__.T.test_bad)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/work/r1/test_x.py", line 5, in test_bad
    def test_bad(self): self.assertEqual(1, 2, "nope")
                        ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^
AssertionError: 1 != 2 : nope

----------------------------------------------------------------------
Ran 4 tests in 0.001s

FAILED (failures=1, errors=1)
`;
  assert.deepEqual(parseUnittestVerbose(s), [
    { name: "test_bad", ok: false, message: "AssertionError: 1 != 2 : nope" },
    { name: "test_err", ok: false, message: "ValueError: x" },
    { name: "test_ok", ok: true },
    { name: "test_skip", ok: true },
  ]);
});

test("rustc --test output", () => {
  const s = `
running 2 tests
test ok_one ... ok
test bad_one ... FAILED

failures:

---- bad_one stdout ----

thread 'bad_one' (4320) panicked at rt.rs:2:24:
assertion \`left == right\` failed: nope
  left: 1
 right: 2
stack backtrace:
   0: __rustc::rust_begin_unwind

failures:
    bad_one

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.35s
`;
  const r = parseRustTest(s);
  assert.deepEqual(r.map((x) => [x.name, x.ok]), [["ok_one", true], ["bad_one", false]]);
  assert.equal(r[1]?.message, "assertion `left == right` failed: nope\n  left: 1\n right: 2 (rt.rs:2:24)");
});

test("compareOutput modes", () => {
  assert.ok(compareOutput("1 2\r\n", "1 2\n", { mode: "exact" }).ok);
  assert.ok(compareOutput("1 2  \n\n", "1 2\n", { mode: "exact" }).ok);
  assert.ok(!compareOutput("1  2\n", "1 2\n", { mode: "exact" }).ok);
  assert.ok(compareOutput("1  2\n\n", "1\n2", { mode: "token" }).ok);
  const wa = compareOutput("1 3", "1 2", { mode: "token" });
  assert.ok(!wa.ok);
  assert.match(wa.message!, /トークン 2/);
  assert.ok(!compareOutput("1", "1 2", { mode: "token" }).ok);
  assert.ok(compareOutput("0.3333334", "0.333333333", { mode: "float", floatAbs: 1e-6 }).ok);
  assert.ok(!compareOutput("0.34", "0.333333333", { mode: "float", floatAbs: 1e-6, floatRel: 1e-6 }).ok);
  assert.ok(compareOutput("1000000.5", "1000000", { mode: "float", floatAbs: 0, floatRel: 1e-6 }).ok);
  assert.ok(!compareOutput("abc", "abd", { mode: "float" }).ok);
});
