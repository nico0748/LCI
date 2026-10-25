import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyEdit, type Event } from "@lci/core/browser";
import type { DemoDetail, DemoSummary } from "@lci/demo/browser";
import {
  buildCues,
  captionIndexAt,
  chapterIndexAt,
  coverageTimes,
  cueIndexAt,
  defaultLanguage,
  demoKeyAction,
  fmtBytes,
  fmtLength,
  mcpRequestText,
  nextChapterStart,
  nextCueStart,
  pickDemo,
  prevChapterStart,
  prevCueStart,
  roundSeek,
  runAt,
  seekPoints,
  sliderKeyAction,
  sortLanguages,
  splitInlineCode,
  splitSentences,
  stepSpeed,
  trustState,
  versionsFor,
  type DemoKeyTarget,
  demoMilestones,
  fmtClock,
  startedAfterViewing,
  userWriteStart,
} from "./demo-model.ts";
import { caretAt, changedLines, codeSource, effectiveCodeTime, minimalReplace, nextIndexAfter, planUpdate, positionOf, textAt } from "./code-state.ts";
import { DemoClock, type VoiceDriver, type VoiceSegment } from "./demo-clock.ts";

// 開発用フィクスチャ（alg-0001 / python）。再生側の試験だけで使い、本番のコードからは読まない
const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/alg-0001-python.json", import.meta.url), "utf8")) as DemoDetail;
const demo = fixture.compiled;
const src = codeSource(demo);

// ---- 文と字幕 ----------------------------------------------------------------------

test("splitSentences は句点で切り、インラインコードの中では切らない", () => {
  assert.deepEqual(splitSentences("問題を言い換えます。和が K です！どうでしょう？"), ["問題を言い換えます。", "和が K です！", "どうでしょう？"]);
  assert.deepEqual(splitSentences("`a。b` を使います。次へ"), ["`a。b` を使います。", "次へ"]);
  assert.deepEqual(splitSentences("「はい。」と言います。"), ["「はい。」と言います。"]);
  assert.deepEqual(splitSentences("句点なし"), ["句点なし"]);
});

test("buildCues は step の区間を文に分け、文字数の比で隙間なく割り振る", () => {
  const cues = buildCues(demo);
  const multi = demo.narration.segments.find((s) => splitSentences(s.text).length > 1)!;
  const mine = cues.filter((c) => c.t0 >= multi.t_start && c.t1 <= multi.t_end);
  assert.ok(mine.length >= 2);
  assert.equal(mine[0]!.t0, multi.t_start);
  assert.equal(mine[mine.length - 1]!.t1, multi.t_end);
  for (let i = 1; i < mine.length; i++) assert.equal(mine[i]!.t0, mine[i - 1]!.t1);
  // 通し番号・step・章が付く
  cues.forEach((c, i) => assert.equal(c.idx, i));
  assert.ok(cues.every((c) => c.stepId && c.chapterId));
});

test("buildCues は文ごとの narration でもそのまま 1 文 = 1 区間にする", () => {
  const steps = [{ id: "a", chapter: "c", t0: 0, t1: 5000, say: { t0: 0, t1: 2000, text: "一つ目。二つ目。" }, covers: [] }];
  const narration = {
    schema_version: "1.0" as const,
    recorder: "demo",
    engine: "x",
    segments: [
      { id: 0, start_ms: 0, end_ms: 900, t_start: 0, t_end: 900, text: "一つ目。", is_filler: false, words: [] },
      { id: 1, start_ms: 1000, end_ms: 2000, t_start: 1000, t_end: 2000, text: "二つ目。", is_filler: false, words: [] },
    ],
  };
  const cues = buildCues({ narration, steps });
  assert.deepEqual(
    cues.map((c) => [c.t0, c.t1, c.stepId]),
    [
      [0, 900, "a"],
      [1000, 2000, "a"],
    ],
  );
});

test("cueIndexAt は文の間で -1、captionIndexAt は直前の文を残す", () => {
  const cues = [
    { idx: 0, stepId: "a", chapterId: "c", t0: 100, t1: 900, text: "x" },
    { idx: 1, stepId: "a", chapterId: "c", t0: 2000, t1: 3000, text: "y" },
  ];
  assert.equal(cueIndexAt(cues, 50), -1);
  assert.equal(cueIndexAt(cues, 500), 0);
  assert.equal(cueIndexAt(cues, 1500), -1);
  assert.equal(captionIndexAt(cues, 1500), 0);
  assert.equal(captionIndexAt(cues, 2500), 1);
});

test("splitInlineCode はバッククォートの中をコードとして分ける", () => {
  assert.deepEqual(splitInlineCode("辞書 `seen` を持つ"), [
    { code: false, text: "辞書 " },
    { code: true, text: "seen" },
    { code: false, text: " を持つ" },
  ]);
  assert.deepEqual(splitInlineCode("`<b>`"), [{ code: true, text: "<b>" }]);
});

// ---- シークと移動 -----------------------------------------------------------------------

test("roundSeek はその時刻以前で最も近い区切り（文・打鍵・実行・章の開始）に丸める", () => {
  const cues = buildCues(demo);
  const pts = seekPoints(demo, cues);
  assert.ok(pts.includes(0));
  const typing = demo.steps.find((s) => s.typing)!.typing!;
  const run = demo.steps.find((s) => s.run)!.run!;
  assert.ok(pts.includes(typing.t0) && pts.includes(run.t));
  // 打鍵の途中を離すと、その打鍵の開始（または途中の文の頭）に戻る
  const mid = Math.round((typing.t0 + typing.t1) / 2);
  const r = roundSeek(mid, pts);
  assert.ok(r <= mid && r >= Math.min(typing.t0, ...cues.filter((c) => c.t0 <= mid).map((c) => c.t0).slice(-1)));
  assert.equal(roundSeek(run.t + 1, pts), run.t);
  assert.equal(roundSeek(-5, pts), 0);
  // 区切りの上なら動かない
  for (const p of pts) assert.equal(roundSeek(p, pts), p);
});

test("← は文の頭から 1.5 秒以上なら今の文の頭、未満なら前の文。→ は次の文", () => {
  const cues = [
    { idx: 0, stepId: "a", chapterId: "c", t0: 0, t1: 3000, text: "x" },
    { idx: 1, stepId: "a", chapterId: "c", t0: 3000, t1: 8000, text: "y" },
  ];
  assert.equal(prevCueStart(cues, 5000), 3000);
  assert.equal(prevCueStart(cues, 3500), 0);
  assert.equal(prevCueStart(cues, 200), 0);
  assert.equal(nextCueStart(cues, 0), 3000);
  assert.equal(nextCueStart(cues, 3000), null);
});

test("j/k は章の頭へ。k は章の頭から 1.5 秒以内なら前の章", () => {
  const ch = demo.chapters;
  assert.equal(chapterIndexAt(ch, ch[2]!.t0 + 10), 2);
  assert.equal(nextChapterStart(ch, ch[0]!.t0), ch[1]!.t0);
  assert.equal(nextChapterStart(ch, demo.duration), null);
  assert.equal(prevChapterStart(ch, ch[2]!.t0 + 5000), ch[2]!.t0);
  assert.equal(prevChapterStart(ch, ch[2]!.t0 + 500), ch[1]!.t0);
  assert.equal(prevChapterStart(ch, 0), ch[0]!.t0);
});

test("速度は 0.75〜2x の 5 段で、端では止まる", () => {
  assert.equal(stepSpeed(1, 1), 1.25);
  assert.equal(stepSpeed(2, 1), 2);
  assert.equal(stepSpeed(0.75, -1), 0.75);
  assert.equal(stepSpeed(1.5, -1), 1.25);
  assert.equal(stepSpeed(3, 1), 1.25);
});

// ---- 実行・話すべきポイント・検証状態 ------------------------------------------------------

test("runAt は shown_until までは実行中、その後は結果を次の実行まで出す", () => {
  const runs = demo.steps.filter((s) => s.run);
  const r0 = runs[0]!.run!;
  assert.equal(runAt(demo.steps, r0.t - 1), null);
  assert.equal(runAt(demo.steps, r0.t)!.phase, "running");
  assert.equal(runAt(demo.steps, r0.shown_until)!.phase, "done");
  assert.equal(runAt(demo.steps, runs[1]!.run!.t - 1)!.step.id, runs[0]!.id);
  assert.equal(runAt(demo.steps, demo.duration)!.step.id, runs[runs.length - 1]!.id);
});

test("coverageTimes は各ポイントに初めて触れた step の発話の開始", () => {
  const cov = coverageTimes(demo.steps);
  const first = demo.steps.find((s) => s.covers.includes("tp3"))!;
  assert.equal(cov.get("tp3"), first.say!.t0);
  assert.equal(cov.get("unknown"), undefined);
});

test("trustState は全通過で success、0 件や IE は未検証、それ以外は失敗", () => {
  assert.deepEqual(trustState({ final_verdict: "AC", passed: 8, total: 8 }), { tone: "success", label: "全テスト通過 8/8" });
  assert.equal(trustState({ final_verdict: "WA", passed: 6, total: 8 }).tone, "danger");
  assert.equal(trustState({ final_verdict: "AC", passed: 7, total: 8 }).tone, "danger");
  assert.equal(trustState({ final_verdict: "IE", passed: 0, total: 0 }).tone, "warning");
});

// ---- 言語と版 ----------------------------------------------------------------------------

const sum = (id: string, lang: DemoSummary["language"], at: string, ok = true): DemoSummary => ({
  demo_id: id,
  revision: 1,
  problem_id: "alg-0001",
  language: lang,
  title: id,
  created_at: at,
  author_model: "m",
  final_verdict: ok ? "AC" : "WA",
  passed: ok ? 8 : 6,
  total: 8,
  estimate_ms: 1,
  audio_status: "none",
  audio_bytes: null,
});

test("defaultLanguage は 入口 → 最新セッション → D13 の順", () => {
  const languages = ["c", "rust", "python", "go", "typescript"] as const;
  assert.equal(defaultLanguage({ requested: "go", latestSession: "python", languages: [...languages] }), "go");
  assert.equal(defaultLanguage({ requested: "php", latestSession: "python", languages: [...languages] }), "python");
  assert.equal(defaultLanguage({ requested: null, latestSession: null, languages: [...languages] }), "typescript");
  assert.equal(defaultLanguage({ requested: null, latestSession: null, languages: [...languages], available: ["go", "python"] }), "python");
  assert.equal(defaultLanguage({ requested: null, latestSession: "go", languages: [...languages], available: ["python"] }), "go");
  assert.deepEqual(sortLanguages(["c", "python", "typescript", "html"]), ["typescript", "python", "c", "html"]);
});

test("versionsFor は古い順に版番号を振って新しい順に並べ、pickDemo は指定 → 最新の検証済み → 最新", () => {
  const list = [sum("d3", "python", "2026-10-25T03:00:00Z", false), sum("d1", "python", "2026-10-24T01:00:00Z"), sum("d2", "python", "2026-10-25T01:00:00Z"), sum("dx", "go", "2026-10-25T05:00:00Z")];
  const v = versionsFor(list, "python");
  assert.deepEqual(
    v.map((d) => [d.demo_id, d.n]),
    [
      ["d3", 3],
      ["d2", 2],
      ["d1", 1],
    ],
  );
  assert.equal(pickDemo(list, "python")!.demo_id, "d2");
  assert.equal(pickDemo(list, "python", "d3")!.demo_id, "d3");
  assert.equal(pickDemo(list, "python", "dx")!.demo_id, "d2");
  assert.equal(pickDemo(list, "rust"), null);
});

test("fmtBytes / fmtLength / mcpRequestText", () => {
  assert.equal(fmtBytes(null), "—");
  assert.equal(fmtBytes(3_100_000), "3.0 MB");
  assert.equal(fmtBytes(20_480), "20 KB");
  assert.equal(fmtLength(520_400), "8:40");
  const text = mcpRequestText({ id: "alg-0001", title: "Two Sum" }, "Python");
  assert.match(text, /alg-0001/);
  assert.match(text, /Python/);
  assert.match(text, /save_demo_script/);
});

// ---- キーボード --------------------------------------------------------------------------

const body: DemoKeyTarget = { tag: "BODY", role: null, editable: false, inEditor: false, inArrowWidget: false };

test("demoKeyAction は 01 §6 のキーを割り当て、入力欄・エディタ・修飾キーでは奪わない", () => {
  assert.equal(demoKeyAction(" ", body, false), "toggle");
  assert.equal(demoKeyAction("ArrowLeft", body, false), "prevSentence");
  assert.equal(demoKeyAction("ArrowRight", body, false), "nextSentence");
  assert.equal(demoKeyAction("j", body, false), "nextChapter");
  assert.equal(demoKeyAction("k", body, false), "prevChapter");
  assert.equal(demoKeyAction("Home", body, false), "start");
  assert.equal(demoKeyAction("End", body, false), "end");
  assert.equal(demoKeyAction(">", body, false), "faster");
  assert.equal(demoKeyAction("<", body, false), "slower");
  assert.equal(demoKeyAction("m", body, false), "mute");
  assert.equal(demoKeyAction("?", body, false), "help");
  assert.equal(demoKeyAction("x", body, false), null);
  assert.equal(demoKeyAction("j", body, true), null);
  assert.equal(demoKeyAction("j", { ...body, tag: "INPUT" }, false), null);
  assert.equal(demoKeyAction("j", { ...body, inEditor: true }, false), null);
  // Space はボタン・タブの上では押下を奪わない
  assert.equal(demoKeyAction(" ", { ...body, tag: "BUTTON" }, false), null);
  assert.equal(demoKeyAction(" ", { ...body, tag: "DIV", role: "tab" }, false), null);
  // 矢印・Home/End は自前で扱う部品の中では止める
  assert.equal(demoKeyAction("ArrowLeft", { ...body, inArrowWidget: true }, false), null);
  assert.equal(demoKeyAction("End", { ...body, inArrowWidget: true }, false), null);
  assert.equal(demoKeyAction("j", { ...body, inArrowWidget: true }, false), "nextChapter");
});

test("sliderKeyAction はスライダー上の矢印を文、PageUp/PageDown を章に読み替える", () => {
  assert.equal(sliderKeyAction("ArrowLeft"), "prevSentence");
  assert.equal(sliderKeyAction("ArrowUp"), "nextSentence");
  assert.equal(sliderKeyAction("PageUp"), "nextChapter");
  assert.equal(sliderKeyAction("PageDown"), "prevChapter");
  assert.equal(sliderKeyAction("Home"), null);
});

// ---- コードの状態 ---------------------------------------------------------------------------

const replayAll = (events: Event[], initial: string, upTo: number) => {
  let text = initial;
  for (const e of events) {
    if (e.t > upTo) break;
    if (e.type === "edit") text = applyEdit(text, e.changes);
  }
  return text;
};

test("textAt は各 step の開始で keyframe と一致し、最初から全部当てた結果とも一致する", () => {
  for (const s of demo.steps) {
    const kf = demo.keyframes[`kf:${s.id}`]!;
    assert.equal(textAt(src, s.t0).text, kf, s.id);
    assert.equal(replayAll(demo.events, demo.initial, s.t0), kf, s.id);
  }
  assert.equal(textAt(src, -1).text, demo.initial);
  const final = textAt(src, demo.duration).text;
  assert.match(final, /i = seen\.get\(k - x\)/);
  assert.ok(final.indexOf("i = seen.get(k - x)") < final.indexOf("seen[x] = j"));
});

test("planUpdate の差分適用を続けた結果は、どの時刻でも textAt と一致する", () => {
  let prev: { next: number; t: number } | null = null;
  let text = "";
  for (let t = 0; t <= demo.duration; t += 137) {
    const u = planUpdate(src, prev, t);
    if (u.kind === "reset") text = u.text;
    else if (u.kind === "incremental") for (const ch of u.edits) text = applyEdit(text, ch);
    prev = { next: u.kind === "incremental" ? u.to : u.next, t };
    assert.equal(text, textAt(src, t).text, `t=${t}`);
  }
  // 戻るときは作り直す
  assert.equal(planUpdate(src, prev, 1000).kind, "reset");
  assert.equal(planUpdate(src, null, 1000).kind, "reset");
  // 遠くへ飛ぶときも作り直す
  assert.equal(planUpdate(src, { next: 0, t: 0 }, demo.duration, 10).kind, "reset");
});

test("「まとめて」では打鍵の開始でグループ全体を出し、打鍵の外では時刻を変えない", () => {
  const s = demo.steps.find((x) => x.typing)!;
  const ty = s.typing!;
  assert.equal(effectiveCodeTime(demo.steps, ty.t0, "group"), ty.t1);
  assert.equal(effectiveCodeTime(demo.steps, ty.t0 + 5, "group"), ty.t1);
  assert.equal(effectiveCodeTime(demo.steps, ty.t0 - 1, "group"), ty.t0 - 1);
  assert.equal(effectiveCodeTime(demo.steps, ty.t1 + 3, "group"), ty.t1 + 3);
  assert.equal(effectiveCodeTime(demo.steps, ty.t0 + 5, "char"), ty.t0 + 5);
  // 単調（差分適用が使える）
  let last = -1;
  for (let t = 0; t <= demo.duration; t += 50) {
    const e = effectiveCodeTime(demo.steps, t, "group");
    assert.ok(e >= last);
    last = e;
  }
});

test("minimalReplace は変わった部分だけを返し、サロゲートペアを割らない", () => {
  assert.equal(minimalReplace("abc", "abc"), null);
  assert.deepEqual(minimalReplace("abcdef", "abXYef"), { start: 2, end: 4, text: "XY" });
  const r = minimalReplace("a😀b", "a😃b")!;
  assert.equal("a😀b".slice(0, r.start) + r.text + "a😀b".slice(r.end), "a😃b");
  assert.ok(r.start <= 1 && r.end >= 3);
});

test("positionOf と changedLines", () => {
  assert.deepEqual(positionOf("ab\ncd", 0), [1, 1]);
  assert.deepEqual(positionOf("ab\ncd", 4), [2, 2]);
  assert.deepEqual(changedLines("a\nb\nc", "a\nB\nX\nc"), [2, 3]);
  assert.deepEqual(changedLines("a\nb\nc", "a\nc"), [2, 2]);
  assert.equal(changedLines("a", "a"), null);
  // フィクスチャ: 方針コメントの step は 4 行のコメントを足す
  const s = demo.steps.find((x) => x.id === "s04")!;
  const r = changedLines(demo.keyframes["kf:s04"]!, textAt(src, s.t1 - 1).text)!;
  assert.equal(r[1] - r[0] + 1, 4);
});

test("caretAt は直近の打鍵の終わりにカーソルを置き、削除の前は選択を見せる", () => {
  const sel = demo.events.find((e) => e.type === "cursor" && e.sel);
  assert.ok(sel && sel.type === "cursor");
  const c = caretAt(src, sel.t)!;
  assert.ok(c.sel);
  const edit = demo.events.find((e) => e.type === "edit" && e.changes[0]!.text === "s")!;
  const c2 = caretAt(src, edit.t)!;
  assert.equal(c2.sel, null);
  assert.equal(caretAt(src, -1), null);
  assert.equal(nextIndexAfter(demo.events, -1), 0);
});

// ---- 再生クロック -------------------------------------------------------------------------

class FakeVoice implements VoiceDriver {
  log: string[] = [];
  seg: VoiceSegment | null = null;
  startedAt = 0;
  offset = 0;
  rate = 1;
  playing = false;
  resolvePlay: (() => void) | null = null;
  rejectPlay: ((e: Error) => void) | null = null;
  autoStart = true;
  private clock: { now: number };
  constructor(clock: { now: number }) {
    this.clock = clock;
  }
  prepare(segs: VoiceSegment[]) {
    this.log.push(`prepare:${segs.map((s) => s.key).join(",")}`);
  }
  play(seg: VoiceSegment, offsetMs: number, rate: number) {
    this.log.push(`play:${seg.key}@${Math.round(offsetMs)}`);
    this.seg = seg;
    this.offset = offsetMs;
    this.rate = rate;
    return new Promise<void>((res, rej) => {
      const go = () => {
        this.playing = true;
        this.startedAt = this.clock.now;
        res();
      };
      if (this.autoStart) go();
      else {
        this.resolvePlay = go;
        this.rejectPlay = rej;
      }
    });
  }
  pause() {
    if (this.playing) this.offset = this.position()!;
    this.playing = false;
    this.log.push("pause");
  }
  stop() {
    this.playing = false;
    this.seg = null;
    this.log.push("stop");
  }
  position() {
    if (!this.seg || !this.playing) return null;
    return Math.min(this.seg.t1 - this.seg.t0, this.offset + (this.clock.now - this.startedAt) * this.rate);
  }
  ended() {
    return !!this.seg && this.playing && this.position()! >= this.seg.t1 - this.seg.t0;
  }
  setRate(r: number) {
    if (this.playing) {
      this.offset = this.position()!;
      this.startedAt = this.clock.now;
    }
    this.rate = r;
    this.log.push(`rate:${r}`);
  }
  setMuted(m: boolean) {
    this.log.push(`muted:${m}`);
  }
}

const flush = () => new Promise<void>((r) => setImmediate(r));

const segs: VoiceSegment[] = [
  { key: "a", stepId: "s1", t0: 1000, t1: 3000, url: "a" },
  { key: "b", stepId: "s2", t0: 5000, t1: 6000, url: "b" },
];

function setup(o?: { autoStart?: boolean }) {
  const clk = { now: 0 };
  const voice = new FakeVoice(clk);
  voice.autoStart = o?.autoStart ?? true;
  const clock = new DemoClock({ duration: 8000, segments: segs, voice, now: () => clk.now });
  const step = async (ms: number, frame = 50) => {
    for (let i = 0; i < ms; i += frame) {
      clk.now += frame;
      clock.tick();
      await flush();
    }
  };
  return { clk, voice, clock, step };
}

test("DemoClock: 区間の外は仮想時計、区間の頭で音声を始め、区間の中は音声の位置に従う", async () => {
  const { voice, clock, step } = setup();
  clock.play();
  await step(500);
  assert.equal(clock.getState().t, 500);
  await step(600);
  assert.ok(voice.log.includes("play:a@0"));
  const t = clock.getState().t;
  assert.ok(t >= 1000 && t <= 1100, `t=${t}`);
  await step(1000);
  assert.ok(Math.abs(clock.getState().t - (1000 + (voice.position() ?? 0))) < 1);
  await step(4000);
  assert.ok(voice.log.includes("play:b@0"));
  await step(3000);
  assert.equal(clock.getState().t, 8000);
  assert.equal(clock.getState().playing, false);
  assert.equal(clock.getState().ended, true);
});

test("DemoClock: 鳴り始めるまで t を止め、1.5 秒を超えたら字幕だけで進める", async () => {
  const { voice, clock, step } = setup({ autoStart: false });
  clock.seek(1000);
  clock.play();
  await step(1000);
  assert.equal(clock.getState().t, 1000);
  assert.equal(clock.getState().waiting, true);
  await step(700);
  assert.ok(clock.getState().t > 1000, "待ちの上限を超えたら進む");
  assert.equal(clock.getState().voiceFailures, 1);
  assert.equal(clock.getState().waiting, false);
  // 次の区間は改めて試す
  await step(4000);
  assert.ok(voice.log.some((l) => l.startsWith("play:b")));
});

test("DemoClock: 一時停止して再開すると、区間の途中から鳴らし直す", async () => {
  const { voice, clock, step } = setup();
  clock.seek(1000);
  clock.play();
  await step(800);
  clock.pause();
  const t = clock.getState().t;
  assert.ok(t > 1500 && t < 2000, `t=${t}`);
  await step(500);
  assert.equal(clock.getState().t, t, "止まっている間は進まない");
  clock.play();
  await step(50);
  assert.ok(voice.log.some((l) => l === `play:a@${Math.round(t - 1000)}`), voice.log.join(" "));
});

test("DemoClock: シークは区間内なら頭出し、速度は音声にも仮想時計にも効き、消音は進み方を変えない", async () => {
  const { voice, clock, step } = setup();
  clock.play();
  clock.seek(2500);
  await step(50);
  assert.ok(voice.log.includes("play:a@1500"));
  clock.seek(3500);
  clock.setRate(2);
  clock.setMuted(true);
  await step(500);
  assert.equal(clock.getState().t, 4500);
  assert.ok(voice.log.includes("rate:2") && voice.log.includes("muted:true"));
  assert.equal(clock.getState().rate, 2);
});

test("DemoClock: 音声なし（区間なし）は全体が仮想時計で進む", async () => {
  const clk = { now: 0 };
  const clock = new DemoClock({ duration: 1000, segments: [], voice: new FakeVoice(clk), now: () => clk.now });
  clock.play();
  for (let i = 0; i < 30; i++) {
    clk.now += 50;
    clock.tick();
  }
  assert.equal(clock.getState().t, 1000);
  assert.equal(clock.getState().ended, true);
  // 終端からの再生は頭から
  clock.play();
  assert.equal(clock.getState().t, 0);
});

test("比較の時刻: 自分の書き始めは phase_estimate の implement、デモは実装の章の頭と最初の実行", () => {
  assert.equal(userWriteStart({ phase_estimate: [{ phase: "design", t0: 0, t1: 250_000 }, { phase: "implement", t0: 250_000, t1: 600_000 }] }), 250_000);
  assert.equal(userWriteStart({ phase_estimate: [{ phase: "design", t0: 0, t1: 10 }] }), null);
  const m = demoMilestones(fixture.compiled);
  const impl = fixture.compiled.chapters.find((c) => c.phase === "implement")!;
  assert.equal(m.writeStart, impl.t0);
  assert.equal(m.firstRun, fixture.compiled.steps.find((s) => s.run)!.run!.t);
});

test("視聴後のセッション: 見た時刻より後に始めたものだけ。壊れた値は注記しない", () => {
  assert.equal(startedAfterViewing("2026-10-20T10:00:00.000Z", "2026-10-21T09:00:00.000Z"), true);
  assert.equal(startedAfterViewing("2026-10-22T10:00:00.000Z", "2026-10-21T09:00:00.000Z"), false);
  assert.equal(startedAfterViewing(null, "2026-10-21T09:00:00.000Z"), false);
  assert.equal(startedAfterViewing("x", "2026-10-21T09:00:00.000Z"), false);
});

test("fmtClock は 0.1 秒単位で切り捨て、長さの表示（fmtT）を越えない", () => {
  assert.equal(fmtClock(159_955), "02:39.9");
  assert.equal(fmtClock(59_970), "00:59.9");
  assert.equal(fmtClock(60_000), "01:00.0");
  assert.equal(fmtClock(-5), "00:00.0");
});
