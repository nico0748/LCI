"use client";

import { useId, useState } from "react";
import { LANGUAGE_LABEL } from "@lci/core/browser";
import type { DemoDetail, DemoRevisionInfo } from "@lci/demo/browser";
import { Button, Dialog, Disclosure, Dl, Radio, StatusBadge, Table, TableScroll, TBody, Td, Th, THead, Tr, Textarea, cx } from "@/components/ui";
import { demoMilestones, fmtBytes, fmtLength, fmtT, trustState, userWriteStart } from "./demo-model.ts";
import { CopyIcon } from "./parts.tsx";
import type { DemoProblemInfo, DemoUserRecord } from "./types.ts";

/**
 * ワークスペースの下に置く「このデモについて」と「版と容量」（FR-D-42, 45, 60）と、評価のダイアログ（FR-D-18 / 43）。
 */

// ---- 自分のセッションとの比較（FR-D-60）とデモ自身の指標（FR-D-45） ---------------------------

export function DemoAbout({ detail, problem, record }: { detail: DemoDetail; problem: DemoProblemInfo; record: DemoUserRecord }) {
  const d = detail.compiled;
  const v = detail.script.validation;
  const runs = d.steps.filter((s) => s.run);
  const ms = demoMilestones(d);
  const tpIds = new Set(problem.talking_points.map((p) => p.id));
  const covered = new Set(d.steps.flatMap((s) => s.covers).filter((id) => tpIds.has(id)));
  const m = record.latestMetrics;
  const fmtS = (ms: number | null | undefined) => (ms == null ? "—" : fmtT(ms));
  const pct = (r: number | null | undefined) => (r == null ? "—" : `${Math.round(r * 100)}%`);
  const rows: { label: string; demo: string; you: string }[] = [
    { label: "書き始め（実装に入った時刻）", demo: fmtS(ms.writeStart), you: m ? fmtS(userWriteStart(m)) : "—" },
    { label: "最初の実行", demo: fmtS(ms.firstRun), you: m ? fmtS(m.run_events[0]?.t) : "—" },
    { label: "実行の回数", demo: `${runs.length} 回`, you: m ? `${m.run_events.length} 回` : "—" },
    { label: "無発話で編集した割合", demo: pct(v.self_metrics.silent_edit_ratio), you: m ? pct(m.silent_edit_ratio) : "—" },
    {
      label: "話すべきポイントに触れた数",
      demo: `${covered.size}/${problem.talking_points.length}`,
      you: m ? `${m.talking_point_hits.filter((h) => h.t != null).length}/${problem.talking_points.length}` : "—",
    },
    { label: "全体の長さ", demo: fmtLength(d.duration), you: record.latestDurationMs != null ? fmtLength(record.latestDurationMs) : "—" },
  ];
  return (
    <section aria-labelledby="demo-about-h" className="flex flex-col gap-3">
      <h2 id="demo-about-h" className="text-std-20B-150 text-fg">
        このデモについて
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="demo-compare" className="flex scroll-mt-4 flex-col gap-2 rounded-8 border border-border bg-surface p-4">
          <h3 className="text-dns-16B-130 text-fg">自分のセッションとの比較</h3>
          <p className="text-dns-13N-130 text-fg-muted">
            {m ? "最新の終了済みセッションと並べます。" : "この問題を終えたセッションの指標がまだありません。"}デモは理想化した進行です。
          </p>
          <TableScroll>
            <Table>
              <THead>
                <Tr>
                  <Th>指標</Th>
                  <Th className="text-right">デモ</Th>
                  <Th className="text-right">あなた</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td numeric>{r.demo}</Td>
                    <Td numeric>{r.you}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </div>
        <div className="flex flex-col gap-3 rounded-8 border border-border bg-surface p-4">
          <h3 className="text-dns-16B-130 text-fg">デモ自身の指標</h3>
          <p className="text-dns-13N-130 text-fg-muted">セッションと同じ物差し（説明先行・無発話の編集）で、手本が R7 を満たしているかを示します。</p>
          <Dl
            items={[
              { term: "説明先行の中央値", description: v.self_metrics.lead_time_median_s == null ? "—" : `${v.self_metrics.lead_time_median_s.toFixed(1)} 秒`, numeric: true },
              { term: "最長の無発話タイプ", description: `${v.self_metrics.silent_typing_max_s.toFixed(1)} 秒`, numeric: true },
              { term: "無発話で編集した割合", description: pct(v.self_metrics.silent_edit_ratio), numeric: true },
              { term: "検証", description: `${v.runner_backend === "docker" ? "Docker で実行" : "隔離なし（開発用）で実行"} · ${new Date(v.validated_at).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}` },
            ]}
          />
          {detail.script.draft.summary && <p className="text-std-14N-170 text-fg-body">{detail.script.draft.summary}</p>}
          {detail.script.draft.self_check && (
            <p className="text-std-14N-170 text-fg-body">
              <span className="text-dns-13N-130 text-fg-muted">Claude の自己申告（参照解との違い・弱点）: </span>
              {detail.script.draft.self_check}
            </p>
          )}
          {v.warnings.length > 0 && (
            <Disclosure summary="保存時の警告" meta={`${v.warnings.length} 件`}>
              <ul className="list-disc pl-5 text-std-14N-170 text-fg-body">
                {v.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      </div>
    </section>
  );
}

// ---- 版と容量（FR-D-42） --------------------------------------------------------------------------

export function DemoVersions({
  detail,
  revisions,
  currentRevision,
  onOpenRevision,
  onDeleted,
}: {
  detail: DemoDetail;
  revisions: DemoRevisionInfo[];
  currentRevision: number;
  onOpenRevision: (rev: number) => void;
  /** 削除の後（whole = デモごと消えた） */
  onDeleted: (whole: boolean) => void;
}) {
  const s = detail.summary;
  const [confirm, setConfirm] = useState<{ kind: "revision" | "audio"; rev: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptBytes = new Blob([JSON.stringify(detail.script)]).size;

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (confirm.kind === "audio") q.set("audio_only", "1");
      if (revisions.length > 1 || confirm.kind === "audio") q.set("revision", String(confirm.rev));
      const res = await fetch(`/api/demos/${encodeURIComponent(s.demo_id)}?${q}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { demo_deleted?: boolean; error?: string; message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`);
      setConfirm(null);
      onDeleted(confirm.kind === "revision" && (body?.demo_deleted ?? revisions.length <= 1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="demo-versions-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="demo-versions-h" className="text-std-20B-150 text-fg">
          版と容量
        </h2>
        <p className="text-dns-13N-130 text-fg-muted tabular-nums">
          台本 {fmtBytes(scriptBytes)} · 音声 {fmtBytes(s.audio_bytes)}（音声は台本から作り直せます）
        </p>
      </div>
      {error && <p className="text-dns-14N-130 text-danger">削除できませんでした: {error}</p>}
      <TableScroll className="rounded-8 border border-border bg-surface">
        <Table>
          <THead>
            <Tr>
              <Th>版</Th>
              <Th>作成</Th>
              <Th>長さ</Th>
              <Th>テスト</Th>
              <Th>メモ</Th>
              <Th className="text-right">操作</Th>
            </Tr>
          </THead>
          <TBody>
            {revisions.map((r) => {
              const tr = trustState(r);
              const cur = r.revision === currentRevision;
              return (
                <Tr key={r.revision} selected={cur}>
                  <Td mono>
                    版 {r.revision}
                    {cur && <span className="sr-only">（表示中）</span>}
                  </Td>
                  <Td>{new Date(r.created_at).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td numeric>{fmtLength(r.estimate_ms)}</Td>
                  <Td>
                    <StatusBadge tone={tr.tone} variant="text">
                      {tr.label}
                    </StatusBadge>
                  </Td>
                  <Td className="max-w-[28ch] truncate text-fg-muted">{r.note ?? "—"}</Td>
                  <Td className="text-right">
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      {!cur && (
                        <Button size="2xs" onClick={() => onOpenRevision(r.revision)}>
                          開く
                        </Button>
                      )}
                      {cur && s.audio_bytes != null && s.audio_bytes > 0 && (
                        <Button size="2xs" onClick={() => setConfirm({ kind: "audio", rev: r.revision })}>
                          音声だけ削除
                        </Button>
                      )}
                      <Button size="2xs" variant="danger-outline" onClick={() => setConfirm({ kind: "revision", rev: r.revision })}>
                        削除
                      </Button>
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableScroll>
      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && !busy && setConfirm(null)}
        dismissible={!busy}
        title={confirm?.kind === "audio" ? `版 ${confirm.rev} の音声を削除しますか？` : `版 ${confirm?.rev ?? ""} を削除しますか？`}
        actions={
          <>
            <Button onClick={() => setConfirm(null)} disabled={busy}>
              やめる
            </Button>
            <Button variant="danger" onClick={run} loading={busy}>
              {confirm?.kind === "audio" ? "音声を削除" : "版を削除"}
            </Button>
          </>
        }
      >
        {confirm?.kind === "audio" ? (
          <p>台本は残ります。音声はあとで台本から作り直せます。削除するまでは字幕と音声で再生できます。</p>
        ) : (
          <p>
            この版の台本と音声を消します。元に戻せません。
            {revisions.length <= 1 && " これが最後の版なので、この言語のデモは無くなります。"}
          </p>
        )}
      </Dialog>
    </section>
  );
}

// ---- 評価（FR-D-18「評価する」、FR-D-43 の簡易版） ---------------------------------------------------

const RATE_KEY = "lci:demo:ratings";

/**
 * 「役に立った / 問題がある」とメモ。評価の保存先（API）はまだ無いので、このブラウザに残し、
 * 作り直しを Claude に頼む文としてコピーできるようにする（作成経路は MCP だけ、D16）。
 */
export function RateDialog({ open, onOpenChange, detail, problemTitle }: { open: boolean; onOpenChange: (o: boolean) => void; detail: DemoDetail; problemTitle: string }) {
  const key = `${detail.summary.demo_id}@${detail.script.revision}`;
  // 開くたびに親が key を変えて作り直すので、保存済みの評価は初期値として読むだけでよい
  const [saved] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? "{}") as Record<string, { value: "good" | "issue"; memo: string }>;
      return all[key] ?? null;
    } catch {
      return null; // 読めなければ空から
    }
  });
  const [value, setValue] = useState<"good" | "issue" | null>(saved?.value ?? null);
  const [memo, setMemo] = useState(saved?.memo ?? "");
  const [status, setStatus] = useState("");
  const memoId = useId();
  const save = () => {
    try {
      const all = JSON.parse(localStorage.getItem(RATE_KEY) ?? "{}") as Record<string, unknown>;
      all[key] = { value, memo, at: new Date().toISOString() };
      localStorage.setItem(RATE_KEY, JSON.stringify(all));
      setStatus("このブラウザに保存しました");
    } catch {
      setStatus("保存できませんでした");
    }
  };
  const request = [
    `LCI の模範解答デモ ${detail.summary.demo_id}（${problemTitle}・${LANGUAGE_LABEL[detail.summary.language]}・版 ${detail.script.revision}）について、${value === "good" ? "良かった点" : "問題点"}です。`,
    memo.trim() || "（メモなし）",
    value === "issue" ? "get_demo_script で台本を読み、直した版を validate_demo_script → save_demo_script で保存してください。" : "",
  ]
    .filter(Boolean)
    .join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request);
      setStatus("Claude に頼む文をコピーしました");
    } catch {
      setStatus("コピーできませんでした");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="このデモを評価する"
      width={520}
      actions={
        <>
          <Button icon={<CopyIcon />} onClick={copy} disabled={!value}>
            作り直しを頼む文をコピー
          </Button>
          <Button variant="primary" onClick={save} disabled={!value}>
            保存
          </Button>
        </>
      }
    >
      <fieldset className="m-0 flex flex-wrap gap-x-4 border-0 p-0">
        <legend className="mb-1 text-dns-14B-130 text-fg">評価</legend>
        <Radio name="demo-rate" checked={value === "good"} onChange={() => setValue("good")}>
          役に立った
        </Radio>
        <Radio name="demo-rate" checked={value === "issue"} onChange={() => setValue("issue")}>
          問題がある
        </Radio>
      </fieldset>
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor={memoId} className="text-dns-14B-130 text-fg">
          メモ
        </label>
        <Textarea id={memoId} value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="例: 02:10 の説明と書いたコードがずれている" />
      </div>
      <p className="mt-2 text-dns-13N-130 text-fg-muted">評価はこのブラウザに残します。直してほしいときは、頼む文を Claude（MCP）に貼ってください。</p>
      <p role="status" className={cx("mt-1 text-dns-13N-130", status.includes("でき") && !status.includes("しました") ? "text-danger" : "text-fg-muted")}>
        {status}
      </p>
    </Dialog>
  );
}

