import { createHash } from "node:crypto";
import { z } from "zod";
import { Event, Language, Recorder, RunResult, SessionFile, newSessionId, type Event as EventT, type Session } from "@lci/core";
import { problem, store } from "@/lib/server";
import { initialSessionFiles } from "./session-files.ts";

/**
 * セッション API の書き込み系（W1: 作成・イベント・スナップショット・メディア・開始・終了・実行結果）。
 * W2 と同じく本体をここに置き、route.ts からは 1 行で re-export する。
 *
 * 復旧について（TODO）: ブラウザが落ちた場合も media/*.webm.part と events.jsonl はこの API で
 * 届いた分まで残る。status が recording のまま heartbeat が 3 分以上止まったセッションを
 * "recovering" に遷移させ、finalize で .part を再 mux する流れは別タスク（本ファイルでは状態遷移しない）。
 */

type Ctx<P> = { params: Promise<P> };

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function bad(message: string, status = 400) {
  return json({ error: message }, { status });
}

/** 送信中のチャンク数・バイト数。session.json へは一定間隔でしか書かないのでメモリにも持つ */
const g = globalThis as unknown as { __lciMediaCounters?: Map<string, { chunks: number; bytes: number; dirty: number }> };
function counters() {
  g.__lciMediaCounters ??= new Map();
  return g.__lciMediaCounters;
}

// ---- POST /api/sessions --------------------------------------------------

const CreateBody = z.object({
  problem_id: z.string(),
  language: Language,
  capture_options: z.object({ camera: z.boolean().default(true), screen: z.boolean().default(false), live_stt: z.boolean().default(false) }).default({ camera: true, screen: false, live_stt: false }),
});

export async function POST_sessions(req: Request) {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("problem_id / language / capture_options が不正です");
  const { problem_id, language, capture_options } = parsed.data;
  const p = await problem(problem_id);
  if (!p) return bad("問題が見つかりません", 404);
  if (!p.meta.languages.includes(language)) return bad(`この問題は ${language} に対応していません`);

  // 選んだ言語の starter だけを開く（無ければ言語既定の 1 ファイル）。他言語のファイルが混ざると Run/判定の entry がずれる
  const files = initialSessionFiles(p.meta.starter_files, language).map((f) => SessionFile.parse(f));
  const session: Session = {
    schema_version: "1.0",
    session_id: newSessionId(p.meta.slug),
    status: "preparing",
    problem: { id: p.meta.id, title: p.meta.title, time_limit_sec: p.meta.time_limit * 60, language, dir: p.dir },
    started_at_wall: new Date().toISOString(),
    clock: { origin: "performance.now", unit: "ms" },
    recorders: [],
    capture_options,
    warnings: [],
    files,
    evaluations: [],
  };
  await store().create(session);
  return json(session, { status: 201 });
}

// ---- POST /api/sessions/[id]/events ---------------------------------------

export async function POST_events(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  let body: unknown;
  try {
    // sendBeacon は Blob で届くので text → JSON
    body = JSON.parse(await req.text());
  } catch {
    return bad("JSON を解釈できません");
  }
  const raw = (body as { events?: unknown })?.events;
  if (!Array.isArray(raw)) return bad("events 配列がありません");
  const events: EventT[] = [];
  let dropped = 0;
  for (const e of raw) {
    const r = Event.safeParse(e);
    if (r.success) events.push(r.data);
    else dropped++;
  }
  if (events.length > 0) await s.appendEvents(id, events);
  const lastSeq = events.reduce((m, e) => Math.max(m, e.seq), 0);
  return json({ ok: true, last_seq: lastSeq, accepted: events.length, dropped });
}

// ---- POST /api/sessions/[id]/snapshot -------------------------------------

const SnapshotBody = z.object({ file: z.string(), t: z.number(), version: z.number(), text: z.string(), seq: z.number().optional() });

export async function POST_snapshot(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  const parsed = SnapshotBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("file / t / version / text が必要です");
  const { file, t, version, text } = parsed.data;
  const ref = await s.writeSnapshot(id, file, Math.round(t), text);
  const sha1 = createHash("sha1").update(text).digest("hex");
  // seq はブラウザ側の連番空間を壊さないよう、クライアントが予約した値を使う。無ければ t 由来の大きな値（重複排除に影響しない範囲）
  const seq = parsed.data.seq ?? 1_000_000_000 + Math.round(t);
  await s.appendEvents(id, [{ t: Math.round(t), seq, type: "snapshot", file, version, ref, sha1 }]);
  return json({ ref, sha1 });
}

// ---- PUT /api/sessions/[id]/media/[recorder] -------------------------------

export async function PUT_media(req: Request, ctx: Ctx<{ id: string; recorder: string }>) {
  const { id, recorder } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(recorder)) return bad("recorder 名が不正です");
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  if (session.status === "ready" || session.status === "failed") return bad("終了済みのセッションです", 409);
  const chunk = new Uint8Array(await req.arrayBuffer());
  if (chunk.byteLength === 0) return json({ bytes: 0 });
  const total = await s.appendMediaChunk(id, recorder, chunk);
  const key = `${id}/${recorder}`;
  const c = counters().get(key) ?? { chunks: 0, bytes: 0, dirty: 0 };
  c.chunks++;
  c.bytes = total;
  c.dirty++;
  counters().set(key, c);
  // 15 チャンク（約 30 秒）ごとに session.json にも反映して、クラッシュ時に受領状況が残るようにする
  if (c.dirty >= 15) {
    c.dirty = 0;
    await s
      .update(id, (sess) => {
        const r = sess.recorders.find((x) => x.id === recorder);
        if (r) {
          r.chunks_received = c.chunks;
          r.bytes = c.bytes;
        }
      })
      .catch(() => {});
  }
  return json({ bytes: total, chunks: c.chunks });
}

// ---- POST /api/sessions/[id]/start ----------------------------------------

const StartBody = z.object({ recorders: z.array(Recorder).default([]), started_at_wall: z.string().optional() });

/** 冪等: ブリーフィング画面から recorders: [] で呼び、録画開始後に実際の Recorder 情報でもう一度呼ぶ */
export async function POST_start(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  if (session.status !== "preparing" && session.status !== "recording") return bad(`status ${session.status} のセッションは開始できません`, 409);
  const parsed = StartBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("recorders が不正です");
  const next = await s.update(id, (sess) => {
    sess.status = "recording";
    // t=0（S3 で「開始」を押した瞬間）の壁時計。作成時刻より正確なので上書きする
    if (parsed.data.started_at_wall) sess.started_at_wall = parsed.data.started_at_wall;
    for (const r of parsed.data.recorders) {
      const i = sess.recorders.findIndex((x) => x.id === r.id);
      if (i >= 0) sess.recorders[i] = { ...sess.recorders[i], ...r };
      else sess.recorders.push(r);
    }
  });
  return json(next);
}

// ---- POST /api/sessions/[id]/end ------------------------------------------

const EndBody = z.object({
  ended_t: z.number(),
  reason: z.enum(["user", "timeout", "crash"]).default("user"),
  recorders: z.array(Recorder.partial().required({ id: true })).optional(),
  warnings: z.array(z.object({ t: z.number(), code: z.string(), detail: z.string().optional() })).optional(),
});

export async function POST_end(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  if (session.status === "finalizing" || session.status === "ready") return json(session); // 冪等
  const parsed = EndBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("ended_t / reason が必要です");
  const { ended_t, reason, recorders, warnings } = parsed.data;
  const next = await s.update(id, (sess) => {
    sess.status = "finalizing";
    sess.ended_t = Math.round(ended_t);
    sess.end_reason = reason;
    for (const r of recorders ?? []) {
      const i = sess.recorders.findIndex((x) => x.id === r.id);
      const c = counters().get(`${id}/${r.id}`);
      const merged = { ...(i >= 0 ? sess.recorders[i] : {}), ...r, ...(c ? { chunks_received: c.chunks, bytes: c.bytes } : {}) };
      const ok = Recorder.safeParse(merged);
      if (!ok.success) continue;
      if (i >= 0) sess.recorders[i] = ok.data;
      else sess.recorders.push(ok.data);
    }
    // recorders 指定が無くても、受領カウンタは反映しておく
    for (const rec of sess.recorders) {
      const c = counters().get(`${id}/${rec.id}`);
      if (c) {
        rec.chunks_received = c.chunks;
        rec.bytes = c.bytes;
      }
    }
    if (warnings?.length) sess.warnings.push(...warnings);
  });
  await s.closeEvents(id);
  for (const r of next.recorders) counters().delete(`${id}/${r.id}`);

  // finalize（E 担当）は時間がかかるので fire-and-forget。未実装・失敗は無視する
  const origin = new URL(req.url).origin;
  fetch(`${origin}/api/sessions/${encodeURIComponent(id)}/finalize`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  return json(next);
}

// ---- POST /api/sessions/[id]/runs -----------------------------------------

export async function POST_runs(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return bad("セッションが見つかりません", 404);
  const parsed = RunResult.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("RunResult が不正です: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const run = parsed.data;
  const ref = await s.saveRun(id, run);
  const seqParam = Number(new URL(req.url).searchParams.get("seq"));
  const seq = Number.isFinite(seqParam) && seqParam > 0 ? seqParam : 1_000_000_000 + Math.round(run.t);
  const file = new URL(req.url).searchParams.get("file") ?? undefined;
  await s.appendEvents(id, [
    {
      t: Math.round(run.t),
      seq,
      type: "run",
      run_id: run.run_id,
      mode: run.mode,
      file,
      language: run.language,
      verdict: run.verdict,
      exit_code: run.exit_code,
      duration_ms: run.duration_ms,
      ref,
    },
  ]);
  return json({ ref });
}
