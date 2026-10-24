/**
 * FE（kind: web）問題の参照解セルフテスト。selftest.ts がブラウザ無しでスキップする web 問題を、
 * jsdom の上で W1 の sandbox スクリプト（apps/web/public/sandbox/{scenario-core,shim,scenario-runner}.js）ごと動かして確かめる。
 *
 * - 参照解は全シナリオ PASS、starter は 1 つ以上 FAIL することを確認する（seed を変えて複数回）
 * - jsdom ではレイアウト（getBoundingClientRect）と Tailwind を再現できないので、layout の判定はしない
 * - jsdom は img.loading などの一部の IDL 属性を反映しない。属性は setAttribute で付けると本番と同じに判定される
 *
 * jsdom はリポジトリの依存に入れていない（lockfile を増やさないため）。使うときは任意の場所に入れて場所を渡す:
 *   (cd /tmp/jsdom-env && npm i jsdom@26.1.0)
 *   LCI_JSDOM_DIR=/tmp/jsdom-env node --experimental-strip-types scripts/web-selftest.ts [--only fe-0002,fe-] [--seeds 1,2,3]
 */
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Problem } from "@lci/core";
import { loadEntries } from "../src/gates.ts";
import { REPO_ROOT, problemsRoot } from "../src/paths.ts";
import { renderTable } from "../src/report.ts";

const SANDBOX = path.join(REPO_ROOT, "apps/web/public/sandbox");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function loadJsdom(): Any {
  const tries = [import.meta.url, process.env.LCI_JSDOM_DIR ? path.join(process.env.LCI_JSDOM_DIR, "package.json") : null];
  for (const base of tries) {
    if (!base) continue;
    try {
      return createRequire(base)("jsdom");
    } catch {
      /* 次を試す */
    }
  }
  return null;
}

function matchesOnly(id: string, only: string): boolean {
  return only.split(",").some((x) => x !== "" && (id === x || (x.endsWith("-") && id.startsWith(x))));
}

interface ScenarioOutcome {
  name: string;
  seed: number;
  pass: boolean;
  messages: string[];
}

async function runScenarios(jsdom: Any, p: Problem, html: string, scripts: string[], seeds: number[]): Promise<ScenarioOutcome[]> {
  if (p.tests.kind !== "web") return [];
  const out: ScenarioOutcome[] = [];
  for (const sc of p.tests.scenarios) {
    for (const seed of seeds) {
      const cfg = { mockApi: p.tests.mockApi, seed, scenarioMode: "manual" };
      const doc = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<script id="lci-config" type="application/json">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script>
${scripts.map((s) => `<script>${s}</script>`).join("\n")}
</head>
${html}
<script>window.__lci && window.__lci.done();</script>
</html>`;
      const errors: string[] = [];
      const vc = new jsdom.VirtualConsole();
      vc.on("jsdomError", (e: Any) => errors.push(`jsdom: ${e?.message ?? e}`));
      const dom = new jsdom.JSDOM(doc, {
        runScripts: "dangerously",
        pretendToBeVisual: true,
        virtualConsole: vc,
        url: "https://sandbox.lci.local/",
        beforeParse(win: Any) {
          // shim.js が使う Response は jsdom に無いので Node のものを渡す
          win.Response = globalThis.Response;
          win.TextEncoder = globalThis.TextEncoder;
          win.TextDecoder = globalThis.TextDecoder;
        },
      });
      await new Promise((r) => setTimeout(r, 50));
      const res: Any = await dom.window.__lci.runScenario(sc, []);
      dom.window.close();
      const bad = (res.steps as Any[]).filter((s) => !s.ok).map((s) => `#${s.index}: ${s.message}`);
      out.push({ name: sc.name, seed, pass: res.verdict === "PASS", messages: [...bad, ...res.errors, ...errors] });
    }
  }
  return out;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let only: string | null = null;
  let seeds = [1, 2, 3];
  let root = problemsRoot();
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") only = argv[++i] ?? null;
    else if (argv[i] === "--seeds") seeds = (argv[++i] ?? "1").split(",").map(Number);
    else if (argv[i] === "--root") root = path.resolve(argv[++i] ?? root);
    else if (argv[i] === "--verbose") verbose = true;
  }
  const jsdom = loadJsdom();
  if (!jsdom) {
    console.error("jsdom が見つかりません。任意の場所に `npm i jsdom@26.1.0` して LCI_JSDOM_DIR にその場所を指定してください。");
    return 2;
  }
  const scripts = await Promise.all(["scenario-core.js", "shim.js", "scenario-runner.js"].map((f) => fs.readFile(path.join(SANDBOX, f), "utf8")));
  const entries = await loadEntries(root);
  const rows: string[][] = [];
  let bad = 0;
  for (const e of entries) {
    const p = e.problem;
    if (!p || p.tests.kind !== "web") continue;
    if (only && !matchesOnly(p.meta.id, only)) continue;
    const dir = path.join(root, e.dir);
    const refRel = p.meta.reference_solutions.html;
    const starterRel = p.meta.starter_files.find((s) => s.language === "html")?.content_ref;
    const ref = refRel ? await runScenarios(jsdom, p, await fs.readFile(path.join(dir, refRel), "utf8"), scripts, seeds) : [];
    const st = starterRel ? await runScenarios(jsdom, p, await fs.readFile(path.join(dir, starterRel), "utf8"), scripts, [seeds[0]!]) : [];
    const refFails = ref.filter((r) => !r.pass);
    const starterPasses = st.length > 0 && st.every((r) => r.pass);
    if (refFails.length || !ref.length) bad++;
    if (starterPasses) bad++;
    rows.push([
      p.meta.id,
      String(p.tests.scenarios.length),
      ref.length && !refFails.length ? "PASS" : "FAIL",
      st.length ? (starterPasses ? "PASSES!" : "FAILS") : "-",
      `seeds ${seeds.join(",")}`,
    ]);
    for (const f of refFails) console.error(`  ${p.meta.id} ${f.name} seed=${f.seed}: ${f.messages.join(" | ")}`);
    if (verbose) for (const r of ref) console.error(`  ${p.meta.id} ${r.name} seed=${r.seed}: ${r.pass ? "PASS" : "FAIL"}`);
  }
  console.log(renderTable(["id", "scenarios", "参照解", "starter", "note"], rows));
  console.log(`\nweb 問題 ${rows.length} 件、問題あり ${bad} 件（layout は jsdom では判定しない）`);
  return bad ? 1 : 0;
}

process.exit(await main());
