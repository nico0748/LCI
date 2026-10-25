import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PKG_ROOT } from "./paths.ts";

/**
 * scripts/selftest.ts を実際に起動して、時間の判定（50% 警告・制限超過 FAIL・--timing）と --naive、--only を確かめる。
 * Python だけの小さい stdio 問題を一時ディレクトリに作る。制限は timeMs 200（Python は ×3 で 600 ms、警告は 300 ms 超、
 * 素朴解の TLE 閾値は ×1.5 で 900 ms）にして、sleep で遅さを作る（CPU の速さに左右されにくくする）。
 */

function hasPython(): boolean {
  return spawnSync("python3", ["--version"]).status === 0;
}

const SUM_PY = "import sys\nxs = sys.stdin.read().split()\nprint(sum(map(int, xs[1:])))\n";

async function writeProblem(root: string, id: string, opts: { solution: string; naive?: string }): Promise<void> {
  const dir = path.join(root, "ALG", `${id}-fixture`);
  await fs.mkdir(path.join(dir, "tests"), { recursive: true });
  await fs.mkdir(path.join(dir, "solutions"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "problem.md"),
    `---
id: ${id}
slug: fixture
title: 和（${id}）
category: ALG
difficulty: L1
time_limit: 15
languages: [python]
starter_files:
  - path: main.py
    language: python
    content: "import sys\\n"
reference_solutions:
  python: solutions/main.py
---

## 問題文

和を出す。
`,
  );
  await fs.writeFile(path.join(dir, "solutions", "main.py"), opts.solution);
  if (opts.naive !== undefined) {
    await fs.mkdir(path.join(dir, "gen"));
    await fs.writeFile(path.join(dir, "gen", "naive.py"), opts.naive);
  }
  const cases = [
    { name: "sample-1", visibility: "sample", stdin: "2\n1 2\n", expected: "3\n" },
    { name: "hidden-max-1", visibility: "hidden", stdin: "3\n1 2 3\n", expected: "6\n" },
  ];
  await fs.writeFile(path.join(dir, "tests.json"), JSON.stringify({ kind: "stdio", limits: { timeMs: 200, wallMs: 1000 }, compare: { mode: "token" }, cases }));
}

function selftest(root: string, ...args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/selftest.ts", "--root", root, ...args], { cwd: PKG_ROOT, encoding: "utf8" });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

test("selftest: 制限の 50% 超は警告（--timing では FAIL）、制限超過は FAIL、表に最大時間を出す", async (t) => {
  if (!hasPython()) return t.skip("python3 がありません");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-selftest-test-"));
  await writeProblem(root, "alg-0001", { solution: SUM_PY });
  await writeProblem(root, "alg-0002", { solution: "import time\ntime.sleep(0.38)\n" + SUM_PY });
  await writeProblem(root, "alg-0003", { solution: "import time\ntime.sleep(0.7)\n" + SUM_PY });

  const fast = selftest(root, "--only", "alg-0001");
  assert.equal(fast.status, 0, fast.out);
  assert.match(fast.out, /alg-0001\s+stdio\s+python\s+PASS\s+FAILS\s+\d+\s+600\s+\d+%\s+\S+/);

  const warn = selftest(root, "--only", "alg-0002");
  assert.equal(warn.status, 0, warn.out);
  assert.match(warn.out, /\[warn\] alg-0002 \[python\] .*制限 600 ms の \d+%/);
  const strict = selftest(root, "--only", "alg-0002", "--timing");
  assert.equal(strict.status, 1, strict.out);
  assert.match(strict.out, /alg-0002\s+stdio\s+python\s+FAIL/);

  const slow = selftest(root, "--only", "alg-0003");
  assert.equal(slow.status, 1, slow.out);
  assert.match(slow.out, /時間超過 \d+ ms > 制限 600 ms/);

  // --only は複数指定・接頭辞を受け付け、何にも当たらなければ exit 2
  const two = selftest(root, "--only", "alg-0001,alg-0002");
  assert.equal(two.status, 0, two.out);
  assert.match(two.out, /参照解 PASS 2 /);
  assert.equal(selftest(root, "--only", "cp-").status, 2);
});

test("selftest --naive: hidden-max で TLE 閾値を超える素朴解は TLE 確認、間に合ってしまう素朴解は失敗", async (t) => {
  if (!hasPython()) return t.skip("python3 がありません");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-selftest-naive-"));
  // sample は速く正しく、hidden-max（3 要素）だけ遅い素朴解
  const slowOnMax = "import sys, time\nxs = sys.stdin.read().split()\nif int(xs[0]) >= 3:\n    time.sleep(3)\nprint(sum(map(int, xs[1:])))\n";
  await writeProblem(root, "alg-0001", { solution: SUM_PY, naive: slowOnMax });
  await writeProblem(root, "alg-0002", { solution: SUM_PY, naive: SUM_PY });
  await writeProblem(root, "alg-0003", { solution: SUM_PY });

  const ok = selftest(root, "--only", "alg-0001", "--naive");
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /alg-0001\s+gen\/naive\.py\s+python\s+TLE\s+\d+\s+900\s+hidden-max-1/);

  const bad = selftest(root, "--only", "alg-0002", "--naive");
  assert.equal(bad.status, 1, bad.out);
  assert.match(bad.out, /alg-0002\s+gen\/naive\.py\s+python\s+PASSES/);

  // naive の無い問題は対象外（失敗にしない）
  const none = selftest(root, "--only", "alg-0003", "--naive");
  assert.equal(none.status, 0, none.out);
});
