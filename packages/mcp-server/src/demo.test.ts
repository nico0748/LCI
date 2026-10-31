import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SessionStore } from "@lci/core";
import { DEMO_ID_RE, DemoStore, GUIDE_VERSION } from "@lci/demo";

const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const FIXTURE = path.resolve(import.meta.dirname, "../../demo/fixtures/alg-0001-python.draft.json");
const MAIN = path.join(import.meta.dirname, "main.ts");

function textOf(r: unknown): string {
  const c = (r as { content: { type: string; text?: string }[] }).content;
  return c.map((x) => x.text ?? "").join("");
}

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms: number): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

test("stdio: demo tools — get_problem_for_demo → validate → save → list/get/resource → 音声 → delete", { timeout: 120_000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-mcp-demo-"));
  const draft = JSON.parse(await fs.readFile(FIXTURE, "utf8"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", "--no-warnings", MAIN],
    env: {
      ...(process.env as Record<string, string>),
      LCI_DATA_ROOT: root,
      LCI_PROBLEMS_ROOT: PROBLEMS_ROOT,
      LCI_RUNNER: "fake",
      LCI_DEMO_ALLOW_FAKE: "1",
      LCI_TTS_ENGINE: "fake",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "lci-test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const byName = new Map(tools.tools.map((t) => [t.name, t]));
    for (const n of ["list_problems", "get_problem_for_demo", "validate_demo_script", "save_demo_script", "list_demos", "get_demo_script", "delete_demo", "list_sessions"]) {
      assert.ok(byName.has(n), `tool ${n}`);
    }
    // draft は SDK で弾かず（構造化エラーを返すため）、JSON Schema は DemoDraft のものを見せる
    const draftSchema = (byName.get("validate_demo_script")!.inputSchema.properties as Record<string, { properties?: Record<string, unknown> }>).draft!;
    assert.ok(draftSchema.properties?.steps && draftSchema.properties?.chapters, "draft の JSON Schema");
    assert.equal(byName.get("validate_demo_script")!.annotations?.readOnlyHint, true);
    assert.equal(byName.get("delete_demo")!.annotations?.destructiveHint, true);

    const probs = JSON.parse(textOf(await client.callTool({ name: "list_problems", arguments: {} })));
    assert.equal(probs.find((p: { id: string }) => p.id === "alg-0001").demo_supported, true);
    assert.equal(probs.find((p: { id: string }) => p.id === "fe-0001").demo_supported, false);

    // D7: web 問題は作れない
    const web = await client.callTool({ name: "get_problem_for_demo", arguments: { problem_id: "fe-0001", language: "html" } });
    assert.equal(web.isError, true);
    assert.match(textOf(web), /v1\.1|web/);

    const gp = JSON.parse(textOf(await client.callTool({ name: "get_problem_for_demo", arguments: { problem_id: "alg-0001", language: "python" } })));
    assert.equal(gp.problem.id, "alg-0001");
    assert.equal(gp.judge.kind, "stdio");
    assert.ok(gp.file.content.includes("# ここに実装する"));
    assert.doesNotMatch(gp.file.content, /^\s*\d+\| /m, "行番号なし");
    assert.ok(gp.reference.content.length > 0);
    assert.doesNotMatch(gp.reference.content, /^\s*\d+\| /m, "参照解も生テキスト");
    assert.ok(gp.talking_points.length > 0 && gp.cover_ids.tp.includes("tp1"));
    assert.ok(gp.guide.includes(GUIDE_VERSION));
    assert.ok(gp.judge.sample_cases.length > 0);

    // スキーマ違反は isError にせず ok:false の構造化エラー
    const bad = await client.callTool({ name: "validate_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft: { title: "x" } } });
    assert.ok(!bad.isError);
    const badR = JSON.parse(textOf(bad));
    assert.equal(badR.ok, false);
    assert.equal(badR.errors[0].code, "E_SCHEMA");

    // replace の old が見つからない: その時点のコード（行番号付き）を返す
    const broken = structuredClone(draft);
    const impl = broken.steps.find((s: { id: string }) => s.id === "impl-1");
    impl.code[0].old = "    print(-2)\n";
    const nf = JSON.parse(textOf(await client.callTool({ name: "validate_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft: broken } })));
    assert.equal(nf.ok, false);
    const e = nf.errors.find((x: { code: string }) => x.code === "E_OP_NOT_FOUND");
    assert.ok(e, JSON.stringify(nf.errors));
    assert.equal(e.step_id, "impl-1");
    assert.match(e.context.before_numbered, /^\s*1\| /m);

    const ok = JSON.parse(textOf(await client.callTool({ name: "validate_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft } })));
    assert.equal(ok.ok, true, JSON.stringify(ok.errors));
    assert.equal(ok.judge.verdict, "AC");
    assert.equal(ok.runner_backend, "fake");

    // 保存（検証に通らないものは保存しない）
    const nsave = await client.callTool({ name: "save_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft: broken } });
    assert.equal(nsave.isError, true);

    const saved = await client.callTool({ name: "save_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft, model: "test-model" } });
    assert.ok(!saved.isError, textOf(saved));
    const sv = JSON.parse(textOf(saved));
    assert.match(sv.demo_id, DEMO_ID_RE);
    assert.equal(sv.revision, 1);
    assert.equal(sv.url, `/problems/alg-0001/demo?lang=python&demo=${sv.demo_id}`);
    assert.equal(sv.audio, "generating");
    assert.ok(!sv.warnings.some((w: string) => w.startsWith("W_PROCEDURE")), "手順どおりなら手順の警告は出ない");
    const dir = path.join(root, "demos", "alg-0001", "python", sv.demo_id);
    const script = JSON.parse(await fs.readFile(path.join(dir, "script.json"), "utf8"));
    assert.equal(script.author.model, "test-model");
    assert.equal(script.author.route, "mcp");
    assert.equal(script.validation.final_judge.verdict, "AC");
    await fs.access(path.join(dir, "revisions", "rev-0001.json"));

    // 2 版目（demo_id 付き）
    const s2 = JSON.parse(textOf(await client.callTool({ name: "save_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft, demo_id: sv.demo_id, note: "再保存" } })));
    assert.equal(s2.revision, 2);

    const list = JSON.parse(textOf(await client.callTool({ name: "list_demos", arguments: { problem_id: "alg-0001" } })));
    assert.equal(list.length, 1);
    assert.equal(list[0].revision, 2);
    assert.equal(list[0].revisions_count, 2);

    const got = JSON.parse(textOf(await client.callTool({ name: "get_demo_script", arguments: { demo_id: sv.demo_id, revision: 1 } })));
    assert.deepEqual(got.draft.steps.map((s: { id: string }) => s.id), draft.steps.map((s: { id: string }) => s.id));
    assert.equal(got.revisions.length, 2);

    const guide = await client.readResource({ uri: "lci://guides/demo-authoring" });
    assert.ok(String((guide.contents[0] as { text: string }).text).includes("DemoDraft"));
    const res = await client.readResource({ uri: `lci://demos/${sv.demo_id}/script.json` });
    assert.equal(JSON.parse(String((res.contents[0] as { text: string }).text)).revision, 2);

    const prompt = await client.getPrompt({ name: "author_demo", arguments: { problem_id: "alg-0001", language: "python", target_minutes: "6" } });
    const ptext = (prompt.messages[0]!.content as { text: string }).text;
    assert.ok(ptext.includes("get_problem_for_demo") && ptext.includes("save_demo_script") && ptext.includes("6 分"));

    // save が切り離した子プロセス（cli.ts synth、偽エンジン）が音声のマニフェストを書く
    const store = new DemoStore(root);
    const m1 = await waitFor(() => store.readManifest(sv.demo_id, 1), 60_000);
    assert.ok(m1, "rev1 の音声マニフェスト");
    assert.equal(m1.engine, "fake");
    assert.equal(m1.segments.length, draft.steps.filter((s: { say?: unknown }) => s.say).length);
    // rev2 は同じ読みなので区間を作り直さず、同じキーを再利用する
    const m2 = await waitFor(() => store.readManifest(sv.demo_id, 2), 60_000);
    assert.ok(m2, "rev2 の音声マニフェスト");
    assert.deepEqual(m2.segments.map((s) => s.key), m1.segments.map((s) => s.key));

    // D15: 録画中は検証も保存もしない
    const sessions = new SessionStore(root);
    await sessions.create({
      schema_version: "1.0",
      session_id: "s_rec",
      status: "recording",
      problem: { id: "alg-0001", title: "t", time_limit_sec: 900, language: "python", dir: "ALG/alg-0001-two-sum" },
      started_at_wall: new Date().toISOString(),
      clock: { origin: "performance.now", unit: "ms" },
      recorders: [],
      capture_options: { camera: false, screen: false, live_stt: false },
      warnings: [],
      files: [],
      evaluations: [],
    });
    const busy = JSON.parse(textOf(await client.callTool({ name: "validate_demo_script", arguments: { problem_id: "alg-0001", language: "python", draft } })));
    assert.equal(busy.ok, false);
    assert.equal(busy.errors[0].code, "E_BUSY_RECORDING");
    await fs.rm(path.join(root, "sessions", "s_rec"), { recursive: true, force: true });

    const del = JSON.parse(textOf(await client.callTool({ name: "delete_demo", arguments: { demo_id: sv.demo_id } })));
    assert.equal(del.demo_deleted, true);
    const after = JSON.parse(textOf(await client.callTool({ name: "list_demos", arguments: {} })));
    assert.equal(after.length, 0);
    const gone = await client.callTool({ name: "get_demo_script", arguments: { demo_id: "../../etc" } });
    assert.equal(gone.isError, true);
  } finally {
    await client.close();
    // rev2 の合成が残っていても消せるよう少し待つ
    await new Promise((r) => setTimeout(r, 300));
    await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
});
