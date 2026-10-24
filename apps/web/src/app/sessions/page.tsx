import Link from "next/link";
import { AXES, fmtT, type Axis, type Evaluation, type Session } from "@lci/core";
import { store } from "@/lib/server";
import { Sparkline } from "@/components/review/Sparkline";
import { sessionDuration } from "@/components/review/time";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Session["status"], string> = {
  preparing: "準備中",
  recording: "録画中",
  finalizing: "処理中",
  ready: "完了",
  failed: "失敗",
  recovering: "復旧中",
};

/**
 * S6 履歴。セッション一覧と、直近 10 評価の 8 軸推移。
 * 評価が 5 件未満のうちはグラフを出さず文章で示す（04 §6.5: 数値が少ないときのグラフは誤解を生む）。
 */
export default async function SessionsPage() {
  const s = store();
  const sessions = await s.list();
  const evalsBySession = new Map<string, Evaluation[]>();
  for (const sess of sessions) {
    if (sess.evaluations.length) evalsBySession.set(sess.session_id, await s.getEvaluations(sess.session_id));
  }
  const allEvals = [...evalsBySession.values()].flat().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const recent = allEvals.slice(-10);
  const series = (axis: Axis) => recent.map((e) => e.scores[axis].score);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">履歴</h1>
        <nav className="text-sm flex gap-4">
          <Link href="/" className="text-fg-muted hover:text-fg">ホーム</Link>
          <Link href="/problems" className="text-fg-muted hover:text-fg">問題一覧</Link>
        </nav>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-muted">セッション</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-fg-muted rounded-lg border border-border bg-bg-elev p-6 text-center">
            まだセッションがありません。<Link href="/problems" className="text-accent">問題を選んで</Link>始めてください。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-bg-elev">
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-muted text-left">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">問題</th>
                  <th className="px-4 py-2 font-medium">日時</th>
                  <th className="px-4 py-2 font-medium text-right">時間</th>
                  <th className="px-4 py-2 font-medium">状態</th>
                  <th className="px-4 py-2 font-medium text-right">評価</th>
                  <th className="px-4 py-2 font-medium text-right">総合</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((sess) => {
                  const evs = evalsBySession.get(sess.session_id) ?? [];
                  const latest = evs[evs.length - 1];
                  const dur = sess.ended_t != null || sess.recorders.some((r) => r.media_duration_ms != null) ? sessionDuration({ ended_t: sess.ended_t, recorders: sess.recorders }) : null;
                  return (
                    <tr key={sess.session_id} className="hover:bg-bg">
                      <td className="px-4 py-2">
                        <Link href={`/sessions/${sess.session_id}`} className="font-medium hover:text-accent">
                          {sess.problem.title}
                        </Link>
                        <div className="text-[11px] text-fg-muted font-mono">
                          {sess.problem.id} · {sess.problem.language}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-fg-muted whitespace-nowrap">{new Date(sess.started_at_wall).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="px-4 py-2 text-right font-mono text-fg-muted">{dur != null ? fmtT(dur) : "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${sess.status === "failed" ? "text-danger" : sess.status === "ready" ? "text-fg-muted" : "text-warn"}`}>{STATUS_LABEL[sess.status]}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-fg-muted">{evs.length || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{latest ? latest.scores.overall.toFixed(1) : <span className="text-fg-muted">—</span>}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <Link href={`/problems/${sess.problem.id}`} className="text-xs text-fg-muted hover:text-accent">
                          再挑戦
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg-muted">推移（直近 {recent.length} 評価）</h2>
        {allEvals.length === 0 ? (
          <p className="text-sm text-fg-muted">評価済みのセッションがまだありません。</p>
        ) : allEvals.length < 5 ? (
          <ProgressText recent={recent} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AXES.map((a) => {
              const v = series(a.id);
              const last = v[v.length - 1];
              const first = v[0];
              return (
                <div key={a.id} className="rounded-lg border border-border bg-bg-elev p-3 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-fg-muted">{a.label}</span>
                    <span className="font-mono text-sm">
                      {last}
                      {first != null && last != null && last !== first && <span className="text-[11px] text-fg-muted ml-1">({last > first ? "+" : ""}{last - first})</span>}
                    </span>
                  </div>
                  <Sparkline values={v} label={a.label} width={160} height={32} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

/** 件数が少ないうちは文章で。グラフにすると 1 点の揺れが傾向に見えてしまう */
function ProgressText({ recent }: { recent: Evaluation[] }) {
  const latest = recent[recent.length - 1]!;
  const sorted = [...AXES].sort((a, b) => latest.scores[a.id].score - latest.scores[b.id].score);
  const low = sorted.slice(0, 2);
  const high = sorted.slice(-2).reverse();
  return (
    <div className="rounded-lg border border-border bg-bg-elev p-4 text-sm space-y-1">
      <p>
        評価は {recent.length} 件です。5 件たまるまでは傾向グラフを出しません。直近の評価では{" "}
        {high.map((a) => `${a.label}（${latest.scores[a.id].score}）`).join("・")} が高く、{low.map((a) => `${a.label}（${latest.scores[a.id].score}）`).join("・")} が低めでした。
      </p>
      {latest.next_practice.length > 0 && <p className="text-fg-muted">次にやること: {latest.next_practice[0]!.action}</p>}
    </div>
  );
}
