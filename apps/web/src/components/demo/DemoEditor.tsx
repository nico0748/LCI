"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Language } from "@lci/core/browser";
import type { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { LoadingText, cx } from "@/components/ui";
import { LCI_MONACO_OPTIONS, loadMonacoReact, useMonacoTheme } from "@/lib/monaco";
import { caretAt, changedLines, minimalReplace, planUpdate, textAt, type CaretView, type CodeSource } from "./code-state.ts";

/**
 * デモのコード（01 FR-D-14、02 §8.1）。読み取り専用の Monaco に、コンパイル済みの edit イベントを
 * model.applyEdits で順に当てて「打っている途中」を見せる（CodeAtT のように全文を差し替えない、02 F3）。
 * - 進むときは差分だけ、戻る・遠くへ飛ぶときは code(t) を作り直して変わった部分だけ置き換える
 * - 今の step で変えている行を --bg-hl-line＋左 3px の accent（黄は使わない、X3）
 * - 疑似カーソル（点滅しない）と、削除・置換の前の選択範囲を装飾で描く
 * - カーソル行を画面内に入れ続ける。ユーザーがスクロールしたら 5 秒間は追従を止める
 * - 打った文字は読み上げない（aria-live を付けない、01 §7）
 * Monaco を読み込めないときは <pre> に落とす。
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

const CSS = [
  ".lci-demo-hl-line{background:var(--bg-hl-line)}",
  ".lci-demo-hl-gutter{background:var(--accent);width:3px !important;margin-left:3px}",
  // 疑似カーソル: 文字の前に 2px の縦線（点滅させない）
  ".lci-demo-caret{position:relative}",
  ".lci-demo-caret::before{content:'';position:absolute;left:-1px;top:2px;bottom:2px;width:2px;background:var(--fg)}",
  ".lci-demo-caret-eol::after{content:'';display:inline-block;width:2px;height:16px;vertical-align:-3px;margin-left:1px;background:var(--fg)}",
  ".lci-demo-sel{background:color-mix(in srgb,var(--accent) 24%,transparent)}",
].join(" ");

/** 追従を止める時間（01 FR-D-14） */
const FOLLOW_PAUSE_MS = 5000;

export interface DemoEditorProps {
  src: CodeSource;
  language: Language;
  /** 表示モードを反映した実効時刻（effectiveCodeTime） */
  t: number;
  /** 今の step の開始時刻と、その時点の全文（変えている行の計算とカーソル探索の起点） */
  step: { t0: number; base: string; typing: boolean; highlight?: [number, number, number, number] } | null;
  /** カーソル・選択を出すか（「まとめて」では選択を見せない） */
  showSelection: boolean;
  /** 読み上げ名（「03:12 時点のデモのコード（読み取り専用）」）。スクロールは常に瞬時（LCI_MONACO_OPTIONS） */
  label: string;
  className?: string;
}

export function DemoEditor({ src, language, t, step, showSelection, label, className }: DemoEditorProps) {
  const theme = useMonacoTheme();
  const [fallback, setFallback] = useState(false);
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const applied = useRef<{ next: number; t: number } | null>(null);
  const followPausedUntil = useRef(0);
  // 初期値（マウント時点の全文）。以後は差分で当てる
  const [initialText] = useState(() => textAt(src, t).text);
  const srcRef = useRef(src);

  // フォールバック（<pre>）の本文。Monaco が使えるときは計算しない
  const fallbackText = useMemo(() => (fallback ? textAt(src, t).text : ""), [fallback, src, t]);

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

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    applied.current = null;
    // ユーザーのスクロール（ホイール・タッチ・スクロールバー・キー）で 5 秒間は追従を止める
    const dom = ed.getDomNode();
    const pause = () => {
      followPausedUntil.current = performance.now() + FOLLOW_PAUSE_MS;
    };
    dom?.addEventListener("wheel", pause, { passive: true });
    dom?.addEventListener("touchmove", pause, { passive: true });
    ed.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.SCROLLBAR) pause();
    });
    ed.onKeyDown((e) => {
      if ([monaco.KeyCode.PageUp, monaco.KeyCode.PageDown, monaco.KeyCode.UpArrow, monaco.KeyCode.DownArrow].includes(e.keyCode)) pause();
    });
    setMounted(true);
  };

  // 時刻 t に合わせてモデルを更新する
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const model = ed?.getModel();
    if (!ed || !monaco || !model) return;
    if (srcRef.current !== src) {
      srcRef.current = src;
      applied.current = null;
    }
    // マウント直後・デモが変わった直後（applied が null）は作り直す。差分は minimalReplace で最小にする
    const u = planUpdate(src, applied.current, t);
    if (u.kind === "incremental") {
      for (const changes of u.edits) {
        model.applyEdits(changes.map((c) => ({ range: new monaco.Range(c.range[0], c.range[1], c.range[2], c.range[3]), text: c.text, forceMoveMarkers: true })));
      }
      applied.current = { next: u.to, t };
    } else if (u.kind === "reset") {
      const cur = model.getValue();
      const r = minimalReplace(cur, u.text);
      if (r) {
        const a = model.getPositionAt(r.start);
        const b = model.getPositionAt(r.end);
        model.applyEdits([{ range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column), text: r.text, forceMoveMarkers: true }]);
      }
      applied.current = { next: u.next, t };
    } else applied.current = { next: u.next, t };

    // 装飾: 変えている行・強調・カーソル・選択
    const text = model.getValue();
    const decos: Monaco.editor.IModelDeltaDecoration[] = [];
    const lines = step?.typing ? changedLines(step.base, text) : null;
    const hl = step?.highlight;
    const hlLines: [number, number] | null = lines ?? (hl ? [hl[0], hl[2]] : null);
    if (hlLines) {
      decos.push({
        range: new monaco.Range(hlLines[0], 1, hlLines[1], 1),
        options: { isWholeLine: true, className: "lci-demo-hl-line", linesDecorationsClassName: "lci-demo-hl-gutter" },
      });
    }
    const caret: CaretView | null = step ? caretAt(src, t, step.t0) : caretAt(src, t);
    if (caret) {
      if (caret.sel && showSelection) {
        decos.push({ range: new monaco.Range(caret.sel[0], caret.sel[1], caret.sel[2], caret.sel[3]), options: { className: "lci-demo-sel" } });
      }
      const [ln, col] = clampPos(model, caret.pos);
      const eol = col > model.getLineMaxColumn(ln) - 1;
      decos.push({
        range: eol ? new monaco.Range(ln, Math.max(1, col - 1), ln, col) : new monaco.Range(ln, col, ln, col + 1),
        options: eol ? { afterContentClassName: "lci-demo-caret-eol" } : { inlineClassName: "lci-demo-caret" },
      });
      // 追従（ユーザーがスクロールした直後は止める）
      if (performance.now() >= followPausedUntil.current) {
        const target = hlLines && !(ln >= hlLines[0] && ln <= hlLines[1]) ? hlLines[0] : ln;
        ed.revealLineInCenterIfOutsideViewport(target, monaco.editor.ScrollType.Immediate);
      }
    } else if (hlLines && performance.now() >= followPausedUntil.current) {
      ed.revealLinesInCenterIfOutsideViewport(hlLines[0], hlLines[1], monaco.editor.ScrollType.Immediate);
    }
    if (!decoRef.current) decoRef.current = ed.createDecorationsCollection(decos);
    else decoRef.current.set(decos);
  }, [src, t, step, showSelection, mounted]);

  // 読み上げ名（時刻つき）は秒が変わったときだけ更新する
  useEffect(() => {
    editorRef.current?.updateOptions({ ariaLabel: label });
  }, [label, mounted]);

  return (
    <div className={cx("relative min-h-0", className)} role="region" aria-label={label}>
      <style>{CSS}</style>
      {fallback ? (
        <PreView text={fallbackText} highlight={step?.typing ? changedLines(step.base, fallbackText) : null} />
      ) : (
        <MonacoEditorLazy
          height="100%"
          language={MONACO_LANG[language] ?? "plaintext"}
          defaultValue={initialText}
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
            hideCursorInOverviewRuler: true,
            overviewRulerLanes: 0,
            cursorStyle: "line-thin",
            matchBrackets: "never",
            guides: { indentation: true },
            ariaLabel: label,
          }}
        />
      )}
    </div>
  );
}

function clampPos(model: Monaco.editor.ITextModel, pos: [number, number]): [number, number] {
  const ln = Math.min(Math.max(1, pos[0]), model.getLineCount());
  const col = Math.min(Math.max(1, pos[1]), model.getLineMaxColumn(ln));
  return [ln, col];
}

/** Monaco 無しの簡易表示。行番号つき、変えている行は --bg-hl-line */
function PreView({ text, highlight }: { text: string; highlight: [number, number] | null }) {
  const lines = text.split("\n");
  return (
    <div className="h-full overflow-auto bg-surface text-mono-13N-150" tabIndex={0}>
      {lines.map((l, i) => {
        const n = i + 1;
        const hl = highlight && n >= highlight[0] && n <= highlight[1];
        return (
          <div key={n} className={cx("flex", hl && "bg-hl-line shadow-[inset_3px_0_0_var(--accent)]")}>
            <span className={cx("w-12 shrink-0 select-none border-r border-border-subtle pr-3 text-right", hl ? "text-fg-body" : "text-fg-muted")}>{n}</span>
            <pre className="pl-3 whitespace-pre text-fg-body">{l}</pre>
          </div>
        );
      })}
    </div>
  );
}
