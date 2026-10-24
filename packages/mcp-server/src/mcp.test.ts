import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SessionStore, type Event } from "@lci/core";

const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const MAIN = path.join(import.meta.dirname, "main.ts");

async function seed(root: string) {
  const store = new SessionStore(root);
  const id = "s_mcp";
  await store.create({
    schema_version: "1.0",
    session_id: id,
    status: "ready",
    problem: { id: "fe-0001", title: "検索フォームとサーバーに優しいキャッシュ", time_limit_sec: 1200, language: "html", dir: "FE/fe-0001-search-form-cache" },
    started_at_wall: "2026-10-24T10:00:00.000+09:00",
    ended_t: 60_000,
    clock: { origin: "performance.now", unit: "ms" },
    recorders: [],
    capture_options: { camera: true, screen: false, live_stt: false },
    warnings: [],
    files: [{ file_id: "f1", path: "index.html", language: "html" }],
    evaluations: [],
  });
  const ref = await store.writeSnapshot(id, "f1", 100, "<html>\n</html>\n");
  const events: Event[] = [
    { t: 0, seq: 1, type: "session_start" },
    { t: 100, seq: 2, type: "snapshot", file: "f1", version: 1, ref, sha1: "" },
    { t: 5000, seq: 3, type: "edit", file: "f1", version: 2, changes: [{ range: [2, 1, 2, 1], rangeLength: 0, text: "<input>\n" }], undo: false, flush: false },
    { t: 60_000, seq: 4, type: "session_end", reason: "user" },
  ];
  await store.appendEvents(id, events);
  await store.closeEvents(id);
  await store.saveTranscript(id, {
    schema_version: "1.0",
    recorder: "cam",
    engine: "test",
    segments: [{ id: 1, start_ms: 0, end_ms: 3000, t_start: 1000, t_end: 4000, text: "まず空のクエリはリクエストを送らないようにします", is_filler: false, words: [] }],
  });
  return { store, id };
}

function textOf(r: unknown): string {
  const c = (r as { content: { type: string; text?: string }[] }).content;
  return c.map((x) => x.text ?? "").join("");
}

test("stdio smoke: list_sessions, overview, transcript, prompt, resource, save_evaluation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-mcp-"));
  const { store, id } = await seed(root);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-strip-types", "--no-warnings", MAIN],
    env: { ...(process.env as Record<string, string>), LCI_DATA_ROOT: root, LCI_PROBLEMS_ROOT: PROBLEMS_ROOT },
    stderr: "pipe",
  });
  const client = new Client({ name: "lci-test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    for (const n of ["list_sessions", "get_session_overview", "get_session_timeline", "get_transcript", "get_edit_log", "get_code_snapshot_at", "get_problem_reference", "get_rubric", "get_metrics", "save_evaluation", "get_video_frames"]) {
      assert.ok(names.includes(n), `tool ${n}`);
    }

    const list = JSON.parse(textOf(await client.callTool({ name: "list_sessions", arguments: {} })));
    assert.equal(list.length, 1);
    assert.equal(list[0].session_id, id);
    assert.equal(list[0].has_transcript, false);

    const ov = JSON.parse(textOf(await client.callTool({ name: "get_session_overview", arguments: { session_id: id } })));
    assert.equal(ov.duration_s, 60);
    assert.ok(ov.final_code[0].code.includes("<input>"));

    const tr = JSON.parse(textOf(await client.callTool({ name: "get_transcript", arguments: { session_id: id, t0: 0, t1: 30 } })));
    assert.equal(tr.rows[0].at, "00:01–00:04");
    assert.deepEqual(tr.rows[0].markers, ["plan"]);

    const el = JSON.parse(textOf(await client.callTool({ name: "get_edit_log", arguments: { session_id: id, t0: 0, t1: 60 } })));
    assert.equal(el.rows[0].kind, "insert");

    const tl = JSON.parse(textOf(await client.callTool({ name: "get_session_timeline", arguments: { session_id: id } })));
    assert.equal(tl.total_bins, 6);

    const ref = JSON.parse(textOf(await client.callTool({ name: "get_problem_reference", arguments: { problem_id: "fe-0001" } })));
    assert.ok(ref.requirements.some((r: { id: string }) => r.id === "no_empty_query"));

    const cam = await client.callTool({ name: "get_video_frames", arguments: { session_id: id, t0: 0, t1: 60, source: "camera" } });
    assert.equal(cam.isError, true);

    const prompt = await client.getPrompt({ name: "evaluate_session", arguments: { session_id: id } });
    const ptext = (prompt.messages[0]!.content as { text: string }).text;
    assert.ok(ptext.includes("save_evaluation"));
    assert.ok(ptext.includes("R1_requirements"));

    const res = await client.readResource({ uri: `lci://sessions/${id}/transcript` });
    assert.ok(String((res.contents[0] as { text: string }).text).includes("[00:01–00:04]"));

    const axis = { score: 3, confidence: 0.6, rationale: "r", evidence: [{ type: "metric", name: "run_events" }] };
    const evaluation = {
      scores: { R1_requirements: axis, R2_plan: axis, R3_tradeoffs: axis, R4_correctness: axis, R5_testing: axis, R6_time: axis, R7_sync: axis, R8_attitude: axis },
      requirement_checklist: [{ id: "no_empty_query", label: "空クエリ", status: "mentioned_only", mentioned_at: "00:01" }],
      feedback: [
        { id: "f1", t: "00:01", axis: "R1_requirements", severity: "positive", kind: "strength", title: "t", detail: "d", evidence: [{ type: "transcript", t0: 1, t1: 4, quote: "空のクエリはリクエストを送らない" }], speculative: false },
        { id: "f2", t: 30, axis: "R7_sync", severity: "major", kind: "gap", title: "t", detail: "d", evidence: [{ type: "transcript", t0: 30, t1: 31, quote: "存在しない発言をでっち上げた" }], speculative: false },
      ],
      model_answer_comparison: { covered: [], missing: ["no_empty_query"], beyond_model: [], notes: "" },
      next_practice: [{ axis: "R5_testing", action: "区切りで実行する", based_on: ["f2"] }],
      summary: "s",
      uncertainties: [],
      self_check: "ok",
    };
    const saved = await client.callTool({ name: "save_evaluation", arguments: { session_id: id, evaluation } });
    assert.ok(!saved.isError, textOf(saved));
    const out = JSON.parse(textOf(saved));
    assert.equal(out.overall, 3);
    assert.deepEqual(out.demoted_to_speculative, ["f2"]);
    const evs = await store.getEvaluations(id);
    assert.equal(evs.length, 1);
    assert.equal(evs[0]!.route, "mcp");
    assert.equal(evs[0]!.feedback[0]!.t, 1000, "mm:ss → ms");
    assert.equal(evs[0]!.requirement_checklist[0]!.mentioned_at, 1000);

    const bad = await client.callTool({ name: "save_evaluation", arguments: { session_id: id, evaluation: { ...evaluation, summary: undefined } } });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
  }
});
