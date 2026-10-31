import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEdit, type Event, type EventOf, type ProblemMeta } from "@lci/core";
import { DemoDraft, type AudioManifest } from "./schema.ts";
import { TIMING, compileDraft, estimateSayMs, type StepTimingReport } from "./compile.ts";
import { checkTiming } from "./checks.ts";
import { demoFileFor, findProblemById } from "./problem.ts";
import { stableStringify } from "./text.ts";

const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const FIXTURE = DemoDraft.parse(JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/alg-0001-python.draft.json"), "utf8")));
const FILE = { path: "main.py", language: "python" as const };

async function starter(): Promise<string> {
  const p = await findProblemById(PROBLEMS_ROOT, "alg-0001");
  assert.ok(p);
  return demoFileFor(p, "python").content;
}

function draftOf(steps: unknown[], extra: Record<string, unknown> = {}): DemoDraft {
  return DemoDraft.parse({
    title: "t",
    summary: "s",
    chapters: [
      { id: "a", title: "A", phase: "plan" },
      { id: "b", title: "B", phase: "implement" },
    ],
    steps,
    self_check: "",
    ...extra,
  });
}

test("再生の性質: イベントを順に当てると各ステップ開始のキーフレームと最終コードに一致する", async () => {
  const initial = await starter();
  const { compiled, final, opErrors } = compileDraft({ draft: FIXTURE, initial, file: FILE });
  assert.deepEqual(opErrors, []);
  let text = compiled.initial;
  let lastT = -1;
  let lastSeq = 0;
  let lastVersion = 0;
  for (const e of compiled.events as Event[]) {
    assert.ok(e.t >= lastT, `時刻は単調（${e.type} t=${e.t}）`);
    assert.ok(e.seq > lastSeq);
    lastT = e.t;
    lastSeq = e.seq;
    if (e.type === "snapshot") {
      const s = e as EventOf<"snapshot">;
      assert.equal(compiled.keyframes[s.ref], text, `${s.ref} の時点のコード`);
      assert.ok(s.version >= lastVersion);
      lastVersion = s.version;
    }
    if (e.type === "edit") {
      const ed = e as EventOf<"edit">;
      assert.equal(ed.version, lastVersion + 1, "version は 1 ずつ増える");
      lastVersion = ed.version;
      text = applyEdit(text, ed.changes);
    }
  }
  assert.equal(text, final, "最終コード");
  assert.ok(final.includes("if x not in seen:"), "寄り道で直したコード");
  // 章は時刻順、ナレーションは say のあるステップと 1 対 1
  assert.deepEqual(
    compiled.chapters.map((c) => c.id),
    ["req", "plan", "impl", "test", "detour", "review"],
  );
  assert.equal(compiled.narration.segments.length, FIXTURE.steps.filter((s) => s.say).length);
  assert.equal(compiled.timing_source, "estimated");
  // run は「実行中」の開始と結果表示の時刻を持ち、イベントにも verdict 付きで出る
  const runs = compiled.events.filter((e) => e.type === "run");
  assert.equal(runs.length, FIXTURE.steps.filter((s) => s.run).length);
  for (const s of compiled.steps) if (s.run) assert.ok(s.run.shown_until > s.run.t && s.t1 >= s.run.shown_until);
});

test("決定的: 同じ入力から同じ出力（ゆらぎなし、D4）", async () => {
  const initial = await starter();
  const a = compileDraft({ draft: FIXTURE, initial, file: FILE });
  const b = compileDraft({ draft: structuredClone(FIXTURE), initial, file: FILE });
  assert.equal(stableStringify(a.compiled), stableStringify(b.compiled));
});

test("打鍵の速さは説明の長さに合わせ、8〜25 字/秒に収める。説明が足りないと無発話の打鍵になる", () => {
  const code = Array.from({ length: 8 }, (_, i) => `x${i} = ${i} * ${i} + ${i}\n`).join("");
  const longSay = "ここでは前処理として八つの変数を順に用意します。それぞれ添字の二乗に添字を足した値で、後で表の初期値に使います。打ちながら意図を説明します。";
  const ok = compileDraft({
    draft: draftOf([
      { id: "p1", chapter: "a", say: { text: "方針です。" } },
      { id: "i1", chapter: "b", say: { text: longSay }, code: [{ op: "append", text: code }] },
      { id: "i2", chapter: "b", say: { text: "終わりです。" } },
    ]),
    initial: "",
    file: FILE,
  });
  const t1 = ok.timings.find((t) => t.id === "i1")!;
  assert.ok(t1.cps! >= TIMING.typeCpsMin && t1.cps! <= TIMING.typeCpsMax, `cps=${t1.cps}`);
  assert.equal(t1.silent_typing_ms, 0, "説明の間に打ち終える");
  const st = ok.compiled.steps.find((s) => s.id === "i1")!;
  assert.ok(st.typing!.t0 > st.say!.t0, "with: 1 文目を言い終えてから打ち始める");

  const bad = compileDraft({
    draft: draftOf([
      { id: "p1", chapter: "a", say: { text: "方針です。" } },
      { id: "i1", chapter: "b", say: { text: "書きます。" }, code: [{ op: "append", text: code + code }] },
      { id: "i2", chapter: "b", say: { text: "終わりです。" } },
    ]),
    initial: "",
    file: FILE,
  });
  const b1 = bad.timings.find((t) => t.id === "i1")!;
  assert.equal(b1.cps, TIMING.typeCpsMax, "上限の速さに張り付く");
  assert.ok(b1.silent_typing_ms > TIMING.silentErrorMs, `silent=${b1.silent_typing_ms}`);
});

test("code_timing: before は話し始めと同時、after は言い終えてから", () => {
  const mk = (code_timing: string) =>
    compileDraft({
      draft: draftOf([
        { id: "p1", chapter: "a", say: { text: "方針です。" } },
        { id: "i1", chapter: "b", say: { text: "一行だけ書きます。値を一つ増やします。" }, code: [{ op: "append", text: "x += 1\n" }], code_timing },
        { id: "i2", chapter: "b", say: { text: "終わりです。" } },
      ]),
      initial: "",
      file: FILE,
    }).compiled.steps.find((s) => s.id === "i1")!;
  const before = mk("before");
  assert.equal(before.typing!.t0, before.say!.t0);
  const after = mk("after");
  assert.equal(after.typing!.t0, after.say!.t1 + TIMING.afterGapMs);
  const withT = mk("with");
  assert.ok(withT.typing!.t0 > withT.say!.t0 && withT.typing!.t0 < withT.say!.t1);
});

test("実測の音声マニフェストがあれば、その長さで割り付け直す（timing_source=measured）", () => {
  const draft = draftOf([
    { id: "p1", chapter: "a", say: { text: "方針です。" } },
    { id: "i1", chapter: "b", say: { text: "書きます。" }, code: [{ op: "append", text: "x = 1\n" }] },
    { id: "i2", chapter: "b", say: { text: "終わりです。" } },
  ]);
  const est = compileDraft({ draft, initial: "", file: FILE });
  assert.equal(est.compiled.steps[0]!.say!.t1 - est.compiled.steps[0]!.say!.t0, estimateSayMs("方針です。"));
  const manifest: AudioManifest = {
    engine: "fake",
    voice: "v",
    rate: 0,
    format: "m4a",
    engine_info: "test",
    total_bytes: 3,
    generated_at: "2026-10-25T00:00:00Z",
    segments: [
      { step_id: "p1", key: "0000000000000001", duration_ms: 4321, bytes: 1 },
      { step_id: "i1", key: "0000000000000002", duration_ms: 5000, bytes: 1 },
      { step_id: "i2", key: "0000000000000003", duration_ms: 1000, bytes: 1 },
    ],
  };
  const m = compileDraft({ draft, initial: "", file: FILE, manifest });
  assert.equal(m.compiled.timing_source, "measured");
  assert.equal(m.compiled.narration.engine, "tts:fake");
  const s0 = m.compiled.steps[0]!;
  assert.equal(s0.say!.t1 - s0.say!.t0, 4321);
  assert.equal(s0.say!.audio_key, "0000000000000001");
  assert.equal(m.compiled.steps[1]!.t0, s0.t1);
  // 一部だけ実測なら estimated
  const partial = compileDraft({ draft, initial: "", file: FILE, manifest: { ...manifest, segments: manifest.segments.slice(0, 2) } });
  assert.equal(partial.compiled.timing_source, "estimated");
});

test("checkTiming: 無発話の打鍵 3 秒・8 秒の境界と全体の長さ（D5・D6）", () => {
  const meta = { time_limit: 10, rubric_hints: { time_management: "" } } as unknown as ProblemMeta;
  const draft = draftOf([
    { id: "p1", chapter: "a", say: { text: "x" } },
    { id: "p2", chapter: "a", say: { text: "x" } },
    { id: "p3", chapter: "b", say: { text: "x" } },
  ]);
  const tm = (id: string, silent: number): StepTimingReport => ({ id, chapter: "a", t0: 0, t1: 1000, say_ms: 0, say_measured: false, typing_ms: 0, cps: null, silent_typing_ms: silent, typed_chars: 0 });
  const compiled = (duration: number) => ({ duration, chapters: [], steps: [] }) as never;
  const r = checkTiming(draft, compiled(6 * 60_000), [tm("p1", 3000), tm("p2", 3001), tm("p3", 8000)], { meta, judgeKind: "stdio" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.warnings.map((w) => [w.code, w.step_id]),
    [
      ["W_SILENT_TYPING", "p2"],
      ["W_SILENT_TYPING", "p3"],
    ],
  );
  const e = checkTiming(draft, compiled(6 * 60_000), [tm("p1", 8001)], { meta, judgeKind: "stdio" });
  assert.equal(e.errors[0]!.code, "E_SILENT_TYPING");
  assert.equal(e.errors[0]!.step_id, "p1");
  assert.equal(e.errors[0]!.path, "steps[0]");

  assert.equal(checkTiming(draft, compiled(10 * 60_000 + 1), [], { meta, judgeKind: "stdio" }).errors[0]!.code, "E_TOO_LONG");
  assert.equal(checkTiming(draft, compiled(7.5 * 60_000), [], { meta, judgeKind: "stdio" }).warnings[0]!.code, "W_LONG");
  assert.equal(checkTiming(draft, compiled(4 * 60_000), [], { meta, judgeKind: "stdio" }).warnings[0]!.code, "W_TOO_SHORT");
  // 制限時間が 30 分でも 20 分が上限
  const long = { ...meta, time_limit: 30 } as ProblemMeta;
  assert.equal(checkTiming(draft, compiled(20 * 60_000 + 1), [], { meta: long, judgeKind: "stdio" }).errors[0]!.code, "E_TOO_LONG");
});
