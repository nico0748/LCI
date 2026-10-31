import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRunner } from "@lci/runner";
import type { DemoScript } from "./schema.ts";
import { DemoIdError, DemoStore, KEEP_REVISIONS, assertAudioKey, assertDemoId, assertProblemId, assertRevision, newDemoId } from "./store.ts";
import { DemoService } from "./service.ts";
import { FakeEngine, type TtsEngine } from "./tts/engines.ts";
import { audioStatusOf, segmentKey, synthesizeDemo } from "./tts/synth.ts";
import { which } from "./tts/exec.ts";

const tmpDirs: string[] = [];
after(async () => {
  for (const d of tmpDirs) await fs.rm(d, { recursive: true, force: true });
});
const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const FIXTURE = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/alg-0001-python.draft.json"), "utf8"));

async function savedDemo() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lci-demo-store-"));
  tmpDirs.push(dataRoot);
  const svc = new DemoService({ dataRoot, problemsRoot: PROBLEMS_ROOT, runner: () => createRunner("fake"), env: { LCI_DEMO_ALLOW_FAKE: "1", LCI_TTS_ENGINE: "none" } });
  const r = await svc.save({ problem_id: "alg-0001", language: "python", draft: FIXTURE, model: "test" });
  assert.ok(r.ok, JSON.stringify(!r.ok && r.report.errors));
  return { dataRoot, svc, store: svc.store, base: r.script, id: r.demo_id };
}

const again = (store: DemoStore, base: DemoScript, mut: (s: DemoScript) => void = () => undefined) =>
  store.saveRevision({ problem_id: "alg-0001", language: "python", demo_id: base.demo_id }, (ids) => {
    const s = { ...structuredClone(base), ...ids };
    mut(s);
    return s;
  });

test("id の検証: パス走査・エンコード・NUL・全角・長さ", async () => {
  const good = newDemoId(new Date(2026, 9, 25, 9, 8, 7));
  assert.match(good, /^d_20261025T090807_[a-z0-9]{4}$/);
  assertDemoId(good);
  for (const bad of [
    "../d_20261025T090807_abcd",
    "d_20261025T090807_abcd/..",
    "%2e%2e%2fd_20261025T090807_abcd",
    "/etc/passwd",
    "d_20261025T090807_abcd\0",
    "d_20261025T090807_abcd\n",
    "d_20261025T090807_abc．",
    "d_20261025T090807_ABCD",
    `d_20261025T090807_abcd${"a".repeat(300)}`,
    "",
  ]) {
    assert.throws(() => assertDemoId(bad), DemoIdError, JSON.stringify(bad));
  }
  for (const bad of ["../alg-0001", "alg-0001/..", "ALG-0001", "alg-0001\0", "alg_0001", "ａｌｇ-0001"]) assert.throws(() => assertProblemId(bad), DemoIdError, bad);
  assertProblemId("alg-0001");
  for (const bad of ["../../etc/passwd", "0123456789abcdeg", "0123456789ABCDEF", "0123456789abcdef.m4a"]) assert.throws(() => assertAudioKey(bad), DemoIdError, bad);
  assertAudioKey("0123456789abcdef");
  for (const bad of [0, -1, 1.5, Number.NaN, 10_000]) assert.throws(() => assertRevision(bad), DemoIdError, String(bad));

  const idsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lci-demo-ids-"));
  tmpDirs.push(idsRoot);
  const store = new DemoStore(idsRoot);
  await assert.rejects(store.locate("../../../etc"), DemoIdError);
  await assert.rejects(store.getScript("d_20261025T090807_abcd/../../x"), DemoIdError);
  assert.equal(await store.locate("d_20261025T090807_abcd"), null);
  assert.throws(() => store.dirOf("alg-0001", "python", "../x"), DemoIdError);
  assert.throws(() => store.dirOf("alg-0001", "../../python", good), DemoIdError);
  await assert.rejects(store.list({ problem_id: "../x" }), DemoIdError);
});

test("保存: 版は最新 10 件まで。古い版は消え、別の問題の demo_id では保存できない", async () => {
  const { store, base, id } = await savedDemo();
  for (let i = 0; i < KEEP_REVISIONS + 1; i++) await again(store, base, (s) => (s.note = `rev ${s.revision}`));
  const idx = await store.index(id);
  assert.ok(idx);
  assert.equal(idx.current_revision, KEEP_REVISIONS + 2);
  assert.equal(idx.revisions.length, KEEP_REVISIONS);
  assert.equal(idx.revisions[0]!.revision, 3);
  assert.equal(await store.getScript(id, 1), null);
  await assert.rejects(fs.access(path.join(idx.dir, "revisions", "rev-0002.json")));
  assert.equal((await store.getScript(id))!.revision, KEEP_REVISIONS + 2);
  assert.equal((await store.getScript(id, 5))!.note, "rev 5");
  await assert.rejects(store.saveRevision({ problem_id: "alg-0002", language: "python", demo_id: id }, () => base), DemoIdError);
  await assert.rejects(store.saveRevision({ problem_id: "alg-0001", language: "python", demo_id: "d_20000101T000000_zzzz" }, () => base), DemoIdError);
  const list = await store.list({ problem_id: "alg-0001" });
  assert.equal(list.length, 1);
});

test("削除: 版だけ・音声だけ・丸ごと", async () => {
  const { store, base, id, svc } = await savedDemo();
  await again(store, base);
  const dir = (await store.audioDir(id))!;
  await fs.mkdir(dir, { recursive: true });
  const orphan = path.join(dir, "0123456789abcdef.m4a");
  await fs.writeFile(orphan, Buffer.alloc(1000));

  const r1 = await store.remove(id, { revision: 2 });
  assert.deepEqual(r1 && r1.demo_deleted, false);
  assert.equal((await store.index(id))!.current_revision, 1, "最新版を消すと 1 つ前が現在の版になる");
  assert.equal((await store.getScript(id))!.revision, 1);
  await assert.rejects(fs.access(orphan), "どの版からも参照されない区間は消える");

  await fs.writeFile(orphan, Buffer.alloc(1000));

  const a = await store.remove(id, { audioOnly: true });
  assert.ok(a && a.freed_bytes >= 1000);
  assert.ok(await store.getScript(id), "音声だけ消しても台本は残る");

  const all = await store.remove(id);
  assert.equal(all?.demo_deleted, true);
  assert.equal(await store.index(id), null);
  assert.deepEqual(await svc.summaries(), []);
  assert.equal(await store.remove(id), null);
});

class CountingEngine implements TtsEngine {
  readonly id = "fake" as const;
  readonly voice = "count";
  readonly rate = 0;
  readonly info = "counting";
  calls: string[] = [];
  private inner: FakeEngine;
  constructor(inner: FakeEngine) {
    this.inner = inner;
  }
  async synth(reading: string, out: string) {
    this.calls.push(reading);
    return this.inner.synth(reading, out);
  }
}

test("音声: 偽エンジンでマニフェストを書き、同じ読みの区間は作り直さない", async () => {
  const { store, base, id, svc } = await savedDemo();
  const engine = new CountingEngine(new FakeEngine({ ffmpeg: await which("ffmpeg"), ffprobe: await which("ffprobe") }));
  const st0 = await audioStatusOf(store, id, 1, { engineAvailable: true });
  assert.equal(st0.status, "none");

  const m1 = await synthesizeDemo(store, id, { engine });
  const sayCount = base.draft.steps.filter((s) => s.say).length;
  assert.equal(m1.segments.length, sayCount);
  assert.equal(engine.calls.length, sayCount);
  for (const s of m1.segments) {
    assert.match(s.key, /^[a-f0-9]{16}$/);
    assert.ok(s.duration_ms > 0);
    const st = await fs.stat((await store.segmentPath(id, s.key))!);
    assert.equal(st.size, s.bytes);
  }
  assert.equal((await audioStatusOf(store, id, 1, { engineAvailable: true })).status, "ready");

  // 1 ステップだけ読みを変えた版: その区間だけ作る
  await again(store, base, (s) => {
    const st = s.draft.steps.find((x) => x.id === "rev-4")!;
    st.say = { ...st.say!, text: `${st.say!.text}以上です。`, reading: undefined };
  });
  engine.calls = [];
  const m2 = await synthesizeDemo(store, id, { engine, revision: 2 });
  assert.equal(engine.calls.length, 1);
  assert.equal(m2.segments.filter((s, i) => s.key !== m1.segments[i]!.key).length, 1);
  assert.equal(segmentKey("fake", "count", 0, engine.calls[0]!), m2.segments.find((s) => s.step_id === "rev-4")!.key);

  // 再生用の詳細: 実測の長さで組み直し、音声キーを付ける
  const d = await svc.detail(id, 2);
  assert.ok(d);
  assert.equal(d.compiled.timing_source, "measured");
  assert.ok(d.compiled.steps.filter((s) => s.say).every((s) => s.say!.audio_key));
  assert.equal(d.audio_url_template, `/api/demos/${id}/audio/{key}?reveal=1`);
  assert.deepEqual(
    d.revisions?.map((r) => r.revision),
    [2, 1],
  );
});
