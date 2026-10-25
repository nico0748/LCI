import { toSummary, type Evaluation, type ProblemSummary } from "@lci/core";
import { problems, store } from "@/lib/server";
import { sessionDuration } from "@/components/review/time";
import { wallTime, type EvalLite, type SessionLite } from "./browse-model.ts";

/**
 * 閲覧画面のサーバ側の読み込み。セッション一覧（新しい順）と、各セッションの評価・指標を軽量表現にして返す。
 * 評価ファイルは件数ぶん読むが、ローカルの数十件規模なので一覧のたびに読んで構わない。
 */
export async function loadBrowseData(): Promise<{ problems: ProblemSummary[]; sessions: SessionLite[] }> {
  const s = store();
  const [ps, list] = await Promise.all([problems(), s.list()]);
  const sessions = await Promise.all(
    list.map(async (sess): Promise<SessionLite> => {
      const evals = sess.evaluations.length ? await s.getEvaluations(sess.session_id).catch(() => [] as Evaluation[]) : [];
      const metrics = sess.status === "ready" ? await s.getMetrics<{ silent_edit_ratio?: number }>(sess.session_id).catch(() => null) : null;
      const ended = sess.ended_t != null || sess.recorders.some((r) => r.media_duration_ms != null);
      return {
        session_id: sess.session_id,
        status: sess.status,
        started_at_wall: sess.started_at_wall,
        problem: { id: sess.problem.id, title: sess.problem.title, language: sess.problem.language },
        durationMs: ended ? sessionDuration({ ended_t: sess.ended_t, recorders: sess.recorders }) : null,
        evaluations: evals
          .map(
            (e): EvalLite => ({
              created_at: e.created_at,
              overall: e.scores.overall,
              scores: Object.fromEntries(Object.entries(e.scores).filter(([k]) => k !== "overall").map(([k, v]) => [k, (v as { score: number }).score])) as EvalLite["scores"],
              next_practice: e.next_practice.map((n) => ({ axis: n.axis, action: n.action })),
              summary: e.summary,
            }),
          )
          .sort((a, b) => wallTime(a.created_at) - wallTime(b.created_at)),
        silentEditRatio: typeof metrics?.silent_edit_ratio === "number" ? metrics.silent_edit_ratio : null,
      };
    }),
  );
  sessions.sort((a, b) => wallTime(b.started_at_wall) - wallTime(a.started_at_wall));
  return { problems: ps.map(toSummary), sessions };
}
