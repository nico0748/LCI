"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LANGUAGE_LABEL, fmtT, type Language, type Metrics } from "@lci/core/browser";
import type { DemoDetail, DemoSummary } from "@lci/demo/browser";
import { LinkButton, NotificationBanner, StatusBadge } from "@/components/ui";
import { demoMilestones, fmtLength, pickDemo, sortLanguages, startedAfterViewing, trustState, userWriteStart, VIEWED_KEY } from "./demo-model.ts";

/**
 * レビュー画面のデモカード（01 §5.1 の下段、FR-D-03a）。解説（ReviewNotes）の直前に置く。
 * - 一覧（ネタバレなし）から、このセッションの言語のデモを選ぶ。無ければデモがある別の言語、どれも無ければ作り方への案内だけ
 * - 自分の「書き始め／最初の実行」とデモの同じ時刻を並べる。デモ側の時刻は本体（reveal=1）から取る。
 *   レビュー画面は終えたセッションのものなので、参照解と同じ扱い（FR-U-15）で取ってよい
 * - このブラウザでデモを見た後に始めたセッションなら「デモ視聴後のセッション」と注記する（FR-D-04）
 */

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readViewed(problemId: string): string | null {
  try {
    const raw = localStorage.getItem(VIEWED_KEY(problemId));
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

type Loaded = { problemId: string; list: DemoSummary[] } | { problemId: string; error: true };

export function DemoCard({ problemId, language, metrics, startedAt }: { problemId: string; language: Language; metrics: Metrics | null; startedAt: string | null }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [detail, setDetail] = useState<DemoDetail | null>(null);
  const viewedAt = useSyncExternalStore(
    subscribeStorage,
    () => readViewed(problemId),
    () => null,
  );

  useEffect(() => {
    let alive = true;
    fetch(`/api/demos?problem=${encodeURIComponent(problemId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DemoSummary[];
      })
      .then((list) => alive && setLoaded({ problemId, list }))
      .catch(() => alive && setLoaded({ problemId, error: true }));
    return () => {
      alive = false;
    };
  }, [problemId]);

  const list = loaded && loaded.problemId === problemId && "list" in loaded ? loaded.list : null;
  const langs = list ? sortLanguages([...new Set(list.map((d) => d.language))]) : [];
  const demo = list ? (pickDemo(list, language) ?? (langs[0] ? pickDemo(list, langs[0]) : null)) : null;
  const demoId = demo?.demo_id ?? null;

  useEffect(() => {
    if (!demoId) return;
    let alive = true;
    fetch(`/api/demos/${encodeURIComponent(demoId)}?reveal=1`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as DemoDetail) : null))
      .then((d) => alive && d?.compiled && setDetail(d))
      .catch(() => {
        /* 時刻の比較が出せないだけ。カードは出す */
      });
    return () => {
      alive = false;
    };
  }, [demoId]);

  // 一覧が読めないときは何も出さない（解説の邪魔をしない）
  if (!loaded || "error" in loaded) return null;
  const after = startedAfterViewing(viewedAt, startedAt);
  const base = `/problems/${encodeURIComponent(problemId)}/demo`;

  if (!demo) {
    return (
      <section aria-labelledby="demo-card-h" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-8 border border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="demo-card-h" className="text-dns-16B-130 text-fg">
            模範解答デモ
          </h2>
          <p className="text-dns-13N-130 text-fg-muted">この問題のデモはまだありません。Claude（MCP）に頼むと作れます。</p>
        </div>
        <LinkButton href={`${base}?lang=${language}`} variant="tertiary" size="sm">
          作り方を見る
        </LinkButton>
      </section>
    );
  }

  const shown = detail && detail.summary.demo_id === demo.demo_id ? detail : null;
  const trust = trustState(demo);
  const audio = demo.audio_status === "ready" ? "音声と字幕" : "字幕のみ";
  const length = shown ? fmtLength(shown.compiled.duration) : `約 ${fmtLength(demo.estimate_ms)}`;
  const mine = metrics ? { writeStart: userWriteStart(metrics), firstRun: metrics.run_events[0]?.t ?? null } : null;
  const theirs = shown ? demoMilestones(shown.compiled) : null;
  const t = (ms: number | null | undefined) => (ms == null ? "—" : fmtT(ms));
  const q = `lang=${demo.language}&demo=${encodeURIComponent(demo.demo_id)}`;

  return (
    <section aria-labelledby="demo-card-h" className="flex flex-col gap-3 rounded-8 border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="demo-card-h" className="text-dns-16B-130 text-fg">
          模範解答デモ
          <span className="text-dns-14N-130 text-fg-muted">
            （{LANGUAGE_LABEL[demo.language]} · <span className="tabular-nums">{length}</span> · {audio}）
          </span>
        </h2>
        {trust.tone !== "success" && (
          <StatusBadge tone={trust.tone}>
            {trust.label}
          </StatusBadge>
        )}
      </div>
      {after && (
        <NotificationBanner tone="info" variant="compact" live="off">
          デモ視聴後のセッションです。要件確認（R1）と方針宣言（R2）は本番より有利な条件でした。
        </NotificationBanner>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 max-w-[60ch] flex-col gap-1">
          <p className="text-std-14N-170 text-fg-body">話し方と書く順序の手本です。理想化した進行なので、時間の差より、何をどの順で口にしたかを見比べてください。</p>
          {demo.language !== language && <p className="text-dns-13N-130 text-fg-muted">{LANGUAGE_LABEL[language]} のデモは無いので、{LANGUAGE_LABEL[demo.language]} のデモを案内しています。</p>}
        </div>
        <table className="border-collapse text-dns-13N-130">
          <caption className="sr-only">自分のセッションとデモの時刻</caption>
          <thead>
            <tr>
              <td />
              <th scope="col" className="px-3 pb-1 text-right text-dns-13N-130 text-fg-muted">
                書き始め
              </th>
              <th scope="col" className="pb-1 pl-3 text-right text-dns-13N-130 text-fg-muted">
                最初の実行
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="pr-3 text-left text-dns-13N-130 text-fg-muted">
                あなた
              </th>
              <td className="px-3 text-right text-mono-13N-150 text-fg-body">{t(mine?.writeStart)}</td>
              <td className="pl-3 text-right text-mono-13N-150 text-fg-body">{t(mine?.firstRun)}</td>
            </tr>
            <tr>
              <th scope="row" className="pr-3 text-left text-dns-13N-130 text-fg-muted">
                デモ
              </th>
              <td className="px-3 text-right text-mono-13N-150 text-fg-body">{t(theirs?.writeStart)}</td>
              <td className="pl-3 text-right text-mono-13N-150 text-fg-body">{t(theirs?.firstRun)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`${base}?${q}`} variant="secondary" size="sm">
          デモを見る
        </LinkButton>
        <LinkButton href={`${base}?${q}&chapter=plan`} variant="tertiary" size="sm">
          方針宣言から見る
        </LinkButton>
      </div>
    </section>
  );
}
