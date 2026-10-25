"use client";

import type { CompiledStep, DemoScript } from "@lci/demo/browser";
import { StatusBadge, cx } from "@/components/ui";
import { RUN_MODE_LABEL, fmtT, isPassing, verdictView, type RunView } from "./demo-model.ts";
import type { DemoProblemInfo } from "./types.ts";

/**
 * 実行結果（FR-D-15）。デモ作成時に実際に実行して保存した結果を出す（再生では実行しない）ので、「デモ作成時の実行」と明記する。
 * stdio: 入力（サンプル、または自作の入力）・出力・判定。実行の開始から shown_until までは「実行中…」。
 * 色はシステム状態（X2: ✓ ✕ ！＋文字）。評価の色は使わない（01 §7）。
 */
export function RunPanel({
  run,
  runs,
  samples,
  script,
  onSeek,
  className,
}: {
  /** 今見せる実行（t 時点の直近） */
  run: RunView | null;
  /** すべての実行 step（t 以前のものだけ一覧に出す） */
  runs: CompiledStep[];
  samples: DemoProblemInfo["samples"];
  script: DemoScript | null;
  onSeek: (t: number) => void;
  className?: string;
}) {
  const past = run ? runs.filter((s) => s.run && s.run.t <= run.step.run!.t) : [];
  return (
    <div className={cx("flex min-h-0 flex-col gap-3 overflow-y-auto p-3", className)}>
      {!run ? (
        <p className="text-std-14N-170 text-fg-muted">まだ実行していません。検証の章で、予告してから実行します。</p>
      ) : (
        <RunDetail run={run} samples={samples} script={script} />
      )}
      {past.length > 1 && (
        <section aria-labelledby="demo-runs-h" className="flex flex-col gap-1 border-t border-border-subtle pt-2">
          <h4 id="demo-runs-h" className="text-dns-13N-130 text-fg-muted">
            これまでの実行
          </h4>
          <ul className="flex flex-col">
            {past.map((s) => {
              const v = verdictView(s.run!.result.verdict);
              const cur = s.id === run?.step.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSeek(s.run!.t)}
                    aria-current={cur ? "true" : undefined}
                    className={cx("flex w-full items-center gap-2 rounded-4 px-1.5 py-1 text-left focus-ring-inset", cur ? "bg-selected" : "can-hover:bg-hover")}
                  >
                    <span className="w-11 shrink-0 text-mono-12N-120 text-fg-muted">{fmtT(s.run!.t)}</span>
                    <span className="min-w-0 flex-1 truncate text-dns-13N-130 text-fg-body">{RUN_MODE_LABEL[s.run!.mode]}</span>
                    <StatusBadge tone={v.tone === "neutral" || v.tone === "info" ? "neutral" : v.tone} variant="text">
                      {s.run!.result.verdict} {s.run!.result.passed}/{s.run!.result.total}
                    </StatusBadge>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function RunDetail({ run, samples, script }: { run: RunView; samples: DemoProblemInfo["samples"]; script: DemoScript | null }) {
  const r = run.result;
  const v = verdictView(r.verdict);
  const draftRun = script?.draft.steps.find((s) => s.id === run.step.id)?.run;
  const stdin = run.step.run?.stdin ?? draftRun?.stdin;
  const expectOutput = run.step.run?.expect_output;
  const sampleOf = (name: string) => samples.find((s) => s.name === name);
  const anyFail = r.cases.some((c) => !isPassing(c.verdict));
  return (
    <section aria-labelledby="demo-run-h" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id="demo-run-h" className="text-dns-14B-130 text-fg">
          <span className="text-mono-13N-150">{fmtT(run.step.run!.t)}</span> の実行
        </h3>
        <StatusBadge variant="outlined" glyph={false}>
          デモ作成時の実行
        </StatusBadge>
        <span className="text-dns-13N-130 text-fg-muted">{RUN_MODE_LABEL[run.mode]}</span>
      </div>
      {run.phase === "running" ? (
        <p role="status" className="text-dns-14N-130 text-fg-body">
          実行中…
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={v.tone === "neutral" || v.tone === "info" ? "neutral" : v.tone}>{v.label}</StatusBadge>
            <span className="text-dns-13N-130 text-fg-muted tabular-nums">
              {r.total > 0 && `${r.passed}/${r.total} 通過 · `}
              {Math.round(r.duration_ms)}ms
            </span>
          </p>
          {run.mode === "stdin" ? (
            <div className="flex flex-col gap-2">
              <IO label="入力" text={stdin ?? ""} />
              {expectOutput != null && <IO label="予告した出力" text={expectOutput} />}
              <IO label="出力" text={r.stdout_head ?? r.cases[0]?.stdout_head ?? ""} />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {failFirst(r.cases).map((c) => {
                const cv = verdictView(c.verdict);
                const ok = isPassing(c.verdict);
                const input = c.stdin_head ?? sampleOf(c.name)?.stdin;
                // 落ちたケースがあればそれだけ中身を出す（先頭に並べる）。全部通ったときはサンプルだけ中身を出し、全ケース判定は畳む
                const showIO = !ok || (!anyFail && run.mode !== "judge");
                return (
                  <li key={c.name} className={cx("flex flex-col gap-1.5 rounded-6 border border-border p-2", !ok && "border-danger")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate text-mono-13N-150 text-fg">{c.name}</span>
                      <StatusBadge tone={cv.tone === "neutral" || cv.tone === "info" ? "neutral" : cv.tone} className="ml-auto">
                        {c.verdict}
                      </StatusBadge>
                    </div>
                    {showIO && (
                      <div className="grid gap-1.5 desktop:grid-cols-1">
                        {input != null && <IO label="入力" text={input} />}
                        {c.stdout_head != null && <IO label="出力" text={c.stdout_head} />}
                        {!ok && c.expected_head != null && <IO label="期待" text={c.expected_head} />}
                        {c.message && <p className="text-dns-13N-130 text-fg-body">{c.message}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {r.stderr_head && <IO label="標準エラー" text={r.stderr_head} />}
        </>
      )}
    </section>
  );
}

/** 落ちたケースを先に（同じ組の中では元の順） */
function failFirst<T extends { verdict: string }>(cases: T[]): T[] {
  return [...cases.filter((c) => !isPassing(c.verdict)), ...cases.filter((c) => isPassing(c.verdict))];
}

function IO({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-dns-13N-130 text-fg-muted">{label}</span>
      <pre className="max-h-40 overflow-auto rounded-4 bg-sunken px-2 py-1 whitespace-pre-wrap break-all text-mono-13N-150 text-fg-body">{text.replace(/\n$/, "") || "（なし）"}</pre>
    </div>
  );
}
