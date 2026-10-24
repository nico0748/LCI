import { getRunner, type Runner } from "@lci/runner";
import type { RunResult } from "@lci/core";
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "@/lib/paths";
import { store } from "@/lib/server";

/**
 * /api/run・/api/judge・/api/runner/* で共有するヘルパ（R 担当）。
 * `_shared` は Next の private folder なのでルートにはならない。
 */

export function runner(): Runner {
  // warm() が docker/ の Dockerfile を見つけられるよう、リポジトリルートから渡す（Next の cwd は apps/web）
  return getRunner({ dockerDir: process.env.LCI_DOCKER_DIR ?? path.join(REPO_ROOT, "docker") });
}

export const FileInput = z.object({ path: z.string().min(1).max(100), content: z.string().max(512 * 1024) });

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/**
 * サーバ側で追記する run イベントの seq 帯。
 * ブラウザの連番（小さい値）とも、W1 の `1_000_000_000 + t` 帯とも重ならない 1_000_000〜999_999_999 を使う。
 * readEvents は seq で重複排除するので、プロセス内カウンタだとサーバ再起動後に同じ seq を再発行して
 * イベントが消える。そのため既存イベントの最大値から次を決める。
 */
const RUN_SEQ_BASE = 1_000_000;
const RUN_SEQ_MAX = 1_000_000_000;
const locks = new Map<string, Promise<unknown>>();

async function nextRunSeq(sessionId: string): Promise<number> {
  const events = await store().readEvents(sessionId);
  let max = RUN_SEQ_BASE;
  for (const e of events) if (e.seq > max && e.seq < RUN_SEQ_MAX) max = e.seq;
  return max + 1;
}

/** RunResult を保存し run イベントを追記する。セッションが無ければ null */
export async function recordRun(sessionId: string, run: RunResult, opts: { file?: string; seq?: number } = {}): Promise<string | null> {
  const s = store();
  if (!(await s.get(sessionId))) return null;
  // 同一セッションへの同時記録で seq が衝突しないよう直列化する
  const prev = locks.get(sessionId) ?? Promise.resolve();
  const task = prev.then(async () => {
    const ref = await s.saveRun(sessionId, run);
    const seq = opts.seq && opts.seq > 0 ? opts.seq : await nextRunSeq(sessionId);
    await s.appendEvents(sessionId, [
      {
        t: Math.round(run.t),
        seq,
        type: "run",
        run_id: run.run_id,
        mode: run.mode,
        file: opts.file,
        language: run.language,
        verdict: run.verdict,
        exit_code: run.exit_code,
        duration_ms: run.duration_ms,
        ref,
      },
    ]);
    return ref;
  });
  locks.set(sessionId, task.catch(() => undefined));
  return task;
}
