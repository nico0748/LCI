"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { fmtT, type Language, type Session } from "@lci/core/browser";
import type { OnMount } from "@monaco-editor/react";
import { loadMonacoReact } from "@/lib/monaco";
import type { editor as MonacoEditor } from "monaco-editor";

/**
 * 時刻 t のコード。`/api/sessions/[id]/snapshot-at` で再構成した全文を読み取り専用 Monaco に出す。
 * - スクラブ中は 150ms デバウンス、連続再生中は 700ms ごとに追従する（デバウンスだけだと再生中に一度も更新されない）
 * - Monaco が読み込めない（オフライン等）場合は <pre> にフォールバックする
 * - ピンの code_ref を選んだときは `pinned.at` 時点を表示し、行をハイライトする
 */

const MonacoEditorLazy = dynamic(() => loadMonacoReact().then((m) => m.default), { ssr: false, loading: () => <div className="h-full grid place-items-center text-xs text-fg-muted">エディタを読み込み中…</div> });

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

export function CodeAtT({
  sessionId,
  files,
  file,
  onFileChange,
  t,
  highlight,
  onClearHighlight,
}: {
  sessionId: string;
  files: Session["files"];
  file: string | null;
  onFileChange: (f: string) => void;
  t: number;
  highlight: CodeHighlight | null;
  onClearHighlight: () => void;
}) {
  const [text, setText] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [dark, setDark] = useState(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorations = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);
  const lastFetch = useRef(0);
  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const shownT = highlight?.file === file ? highlight.at : t;
  const lang = files.find((f) => f.file_id === file)?.language;

  // ダーク判定（Monaco のテーマ連動, 04 §7.2）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      setDark(attr === "dark" || (attr !== "light" && mq.matches));
    };
    update();
    mq.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", update);
      mo.disconnect();
    };
  }, []);

  // Monaco のローダ失敗を検知してフォールバック
  useEffect(() => {
    let cancelled = false;
    loadMonacoReact()
      .then((m) => m.loader.init())
      .then(() => undefined)
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
    if (!file) return;
    const doFetch = async () => {
      const seq = ++reqSeq.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      lastFetch.current = Date.now();
      setLoading(true);
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/snapshot-at?file=${encodeURIComponent(file)}&t=${Math.round(shownT)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { text: string; version: number };
        if (seq !== reqSeq.current) return;
        setText(data.text);
        setVersion(data.version);
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    };
    const since = Date.now() - lastFetch.current;
    if (since > 700) {
      void doFetch();
      return;
    }
    const timer = setTimeout(doFetch, 150);
    return () => clearTimeout(timer);
  }, [sessionId, file, shownT]);

  // 行ハイライト
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const ranges =
      highlight && highlight.file === file
        ? [
            {
              range: { startLineNumber: highlight.lines[0], startColumn: 1, endLineNumber: highlight.lines[1], endColumn: 1 },
              options: { isWholeLine: true, className: "lci-hl-line", linesDecorationsClassName: "lci-hl-gutter" },
            },
          ]
        : [];
    if (!decorations.current) decorations.current = ed.createDecorationsCollection(ranges);
    else decorations.current.set(ranges);
    if (ranges.length) ed.revealLinesInCenter(highlight!.lines[0], highlight!.lines[1]);
  }, [highlight, file, text]);

  const onMount: OnMount = (ed) => {
    editorRef.current = ed;
  };

  const lineCount = text ? text.split("\n").length : 0;

  return (
    <div className="rounded-lg border border-border bg-bg-elev flex flex-col min-h-0 h-[52vh] xl:h-[calc(100vh-380px)] xl:min-h-[420px]">
      <style>{`.lci-hl-line{background:color-mix(in srgb, var(--warn) 18%, transparent)} .lci-hl-gutter{background:var(--warn);width:3px !important;margin-left:3px}`}</style>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border text-xs">
        {files.length > 1 ? (
          <select value={file ?? ""} onChange={(e) => onFileChange(e.target.value)} className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono" aria-label="ファイル">
            {files.map((f) => (
              <option key={f.file_id} value={f.file_id}>
                {f.path}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono">{files[0]?.path ?? file ?? "—"}</span>
        )}
        <span className="text-fg-muted">
          {fmtT(shownT)} 時点 · v{version} · {lineCount} 行{loading ? " · 読み込み中" : ""}
        </span>
        {highlight && highlight.file === file && (
          <button type="button" onClick={onClearHighlight} className="ml-auto rounded border border-warn/60 text-warn px-1.5 py-0.5 hover:bg-warn/10">
            ピンの時点を表示中 · 解除
          </button>
        )}
        {error && <span className="ml-auto text-danger">{error}</span>}
      </div>
      <div className="flex-1 min-h-0 relative">
        {!file ? (
          <div className="h-full grid place-items-center text-sm text-fg-muted">ファイルがありません</div>
        ) : fallback ? (
          <PreView text={text} highlight={highlight && highlight.file === file ? highlight.lines : null} />
        ) : (
          <MonacoEditorLazy
            height="100%"
            language={lang ? MONACO_LANG[lang] : "plaintext"}
            value={text}
            theme={dark ? "vs-dark" : "vs"}
            onMount={onMount}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "off",
              renderLineHighlight: "none",
              folding: false,
              occurrencesHighlight: "off",
              selectionHighlight: false,
              contextmenu: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Monaco 無しの簡易表示。行番号つき、ハイライト行は背景色 */
function PreView({ text, highlight }: { text: string; highlight: [number, number] | null }) {
  const lines = text.split("\n");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight) return;
    ref.current?.querySelector<HTMLElement>(`[data-line="${highlight[0]}"]`)?.scrollIntoView({ block: "center" });
  }, [highlight, text]);
  return (
    <div ref={ref} className="h-full overflow-auto font-mono text-[13px] leading-5">
      {lines.map((l, i) => {
        const n = i + 1;
        const hl = highlight && n >= highlight[0] && n <= highlight[1];
        return (
          <div key={n} data-line={n} className={`flex ${hl ? "bg-warn/15" : ""}`}>
            <span className="w-12 shrink-0 text-right pr-3 text-fg-muted select-none border-r border-border">{n}</span>
            <pre className="pl-3 whitespace-pre">{l}</pre>
          </div>
        );
      })}
    </div>
  );
}
