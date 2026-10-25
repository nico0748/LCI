"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { fmtT, type Language, type Session } from "@lci/core/browser";
import type { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { Button, LoadingText, StatusBadge, cx, tabClass, tabListClass, useTabs } from "@/components/ui";
import { LCI_MONACO_OPTIONS, loadMonacoReact, useMonacoTheme } from "@/lib/monaco";

/**
 * 時刻 t のコード。`/api/sessions/[id]/snapshot-at` で再構成した全文を読み取り専用 Monaco に出す。
 * - スクラブ中は 150ms デバウンス、連続再生中は 700ms ごとに追従する（デバウンスだけだと再生中に一度も更新されない）
 * - Monaco が読み込めない（オフライン等）場合は <pre> にフォールバックする
 * - 指摘の code_ref を選んだときは `pinned.at` 時点を表示し、行を --bg-hl-line でハイライトする（黄は使わない、X3）
 * 高さは親が決める（ワークスペースの列いっぱい / モバイルはタブのパネル）。
 */

const MonacoEditorLazy = dynamic(() => loadMonacoReact().then((m) => m.default), {
  ssr: false,
  loading: () => <LoadingText className="p-3">エディタを読み込み中…</LoadingText>,
});

const MONACO_LANG: Record<Language, string> = {
  c: "c",
  rust: "rust",
  python: "python",
  go: "go",
  typescript: "typescript",
  javascript: "javascript",
  html: "html",
  php: "php",
  sql: "sql",
  markdown: "markdown",
};

export interface CodeHighlight {
  file: string;
  lines: [number, number];
  at: number;
}

const HL_CSS = `.lci-review-hl-line{background:var(--bg-hl-line)} .lci-review-hl-gutter{background:var(--accent);width:3px !important;margin-left:3px}`;

export function CodeAtT({
  sessionId,
  files,
  file,
  onFileChange,
  t,
  highlight,
  onClearHighlight,
  className,
}: {
  sessionId: string;
  files: Session["files"];
  file: string | null;
  onFileChange: (f: string) => void;
  t: number;
  highlight: CodeHighlight | null;
  onClearHighlight: () => void;
  className?: string;
}) {
  const [snap, setSnap] = useState<{ text: string; version: number; key: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const theme = useMonacoTheme();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorations = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const lastFetch = useRef(0);
  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const pinned = !!highlight && highlight.file === file;
  const shownT = pinned ? highlight.at : t;
  const lang = files.find((f) => f.file_id === file)?.language;
  const text = snap?.text ?? "";
  const reqKey = file ? `${file}@${Math.round(shownT)}` : null;
  const loading = pendingKey != null && pendingKey !== snap?.key;

  // Monaco のローダ失敗を検知してフォールバック
  useEffect(() => {
    let cancelled = false;
    loadMonacoReact()
      .then((m) => m.loader.init())
      .catch(() => {
        if (!cancelled) setFallback(true);
      });
    const timer = setTimeout(() => {
      if (!cancelled && !editorRef.current) setFallback(true);
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // スナップショット取得（デバウンス＋スロットル）
  useEffect(() => {
    if (!file || !reqKey) return;
    const doFetch = async () => {
      const seq = ++reqSeq.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      lastFetch.current = Date.now();
      setPendingKey(reqKey);
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/snapshot-at?file=${encodeURIComponent(file)}&t=${Math.round(shownT)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { text: string; version: number };
        if (seq !== reqSeq.current) return;
        setSnap({ text: data.text, version: data.version, key: reqKey });
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (seq === reqSeq.current) {
          setError((e as Error).message);
          setPendingKey(null);
        }
      }
    };
    const since = Date.now() - lastFetch.current;
    const timer = setTimeout(doFetch, since > 700 ? 0 : 150);
    return () => clearTimeout(timer);
  }, [sessionId, file, shownT, reqKey]);

  // 行ハイライト
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const ranges =
      pinned && highlight
        ? [
            {
              range: { startLineNumber: highlight.lines[0], startColumn: 1, endLineNumber: highlight.lines[1], endColumn: 1 },
              options: { isWholeLine: true, className: "lci-review-hl-line", linesDecorationsClassName: "lci-review-hl-gutter" },
            },
          ]
        : [];
    if (!decorations.current) decorations.current = ed.createDecorationsCollection(ranges);
    else decorations.current.set(ranges);
    if (ranges.length && highlight) ed.revealLinesInCenter(highlight.lines[0], highlight.lines[1]);
  }, [highlight, pinned, text]);

  const onMount: OnMount = (ed) => {
    editorRef.current = ed;
  };

  const fileIndex = Math.max(0, files.findIndex((f) => f.file_id === file));
  const tabs = useTabs({ count: files.length, selectedIndex: fileIndex, onSelectedIndexChange: (i) => onFileChange(files[i]!.file_id) });
  const lineCount = text ? text.split("\n").length : 0;

  return (
    <div className={cx("flex min-h-0 flex-col overflow-hidden rounded-8 border border-border bg-surface", className)}>
      <style>{HL_CSS}</style>
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1">
        {files.length > 1 ? (
          <div {...tabs.getListProps("ファイル")} className={cx(tabListClass, "-mb-px border-b-0")}>
            {files.map((f, i) => (
              <button key={f.file_id} {...tabs.getTabProps(i)} aria-controls={undefined} className={cx(tabClass, "text-mono-13N-150")}>
                {f.path}
              </button>
            ))}
          </div>
        ) : (
          <h3 className="text-mono-13N-150 text-fg">{files[0]?.path ?? file ?? "—"}</h3>
        )}
        <span className="text-dns-13N-130 text-fg-muted tabular-nums" aria-live="off">
          {fmtT(shownT)} 時点 · v{snap?.version ?? 0} · {lineCount} 行{loading ? " · 読み込み中…" : ""}
        </span>
        {pinned && highlight && (
          <span className="ml-auto flex items-center gap-1.5">
            <StatusBadge tone="info" glyph={false}>
              指摘の時点 {fmtT(highlight.at)} · {highlight.lines[0]}–{highlight.lines[1]} 行
            </StatusBadge>
            <Button size="2xs" variant="tertiary" onClick={onClearHighlight}>
              再生位置に戻す
            </Button>
          </span>
        )}
        {error && (
          <StatusBadge tone="danger" className="ml-auto">
            この時点のコードを再構成できませんでした（{error}）
          </StatusBadge>
        )}
      </div>
      <div className="relative min-h-0 flex-1" role="region" aria-label={`${fmtT(shownT)} 時点のコード（読み取り専用）`}>
        {!file ? (
          <p className="p-4 text-dns-14N-130 text-fg-muted">このセッションにはファイルがありません。</p>
        ) : fallback ? (
          <PreView text={text} highlight={pinned && highlight ? highlight.lines : null} />
        ) : (
          <MonacoEditorLazy
            height="100%"
            language={lang ? MONACO_LANG[lang] : "plaintext"}
            value={text}
            theme={theme}
            onMount={onMount}
            options={{
              ...LCI_MONACO_OPTIONS,
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "off",
              renderLineHighlight: "none",
              folding: false,
              occurrencesHighlight: "off",
              selectionHighlight: false,
              contextmenu: false,
              automaticLayout: true,
              ariaLabel: "時刻 t のコード（読み取り専用）",
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Monaco 無しの簡易表示。行番号つき、ハイライト行は --bg-hl-line */
function PreView({ text, highlight }: { text: string; highlight: [number, number] | null }) {
  const lines = text.split("\n");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight) return;
    const box = ref.current;
    const row = box?.querySelector<HTMLElement>(`[data-line="${highlight[0]}"]`);
    if (box && row) box.scrollTop = row.offsetTop - box.clientHeight / 2;
  }, [highlight, text]);
  return (
    <div ref={ref} className="h-full overflow-auto bg-surface text-mono-13N-150" tabIndex={0}>
      {lines.map((l, i) => {
        const n = i + 1;
        const hl = highlight && n >= highlight[0] && n <= highlight[1];
        return (
          <div key={n} data-line={n} className={cx("flex", hl && "bg-hl-line shadow-[inset_3px_0_0_var(--accent)]")}>
            <span className={cx("w-12 shrink-0 select-none border-r border-border-subtle pr-3 text-right", hl ? "text-fg-body" : "text-fg-muted")}>{n}</span>
            <pre className="pl-3 whitespace-pre text-fg-body">{l}</pre>
          </div>
        );
      })}
    </div>
  );
}
