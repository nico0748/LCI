import type * as Monaco from "monaco-editor";
import type { Language, Range } from "@lci/core";
import type { EventLogger } from "./event-logger.ts";
import { RegexFocusResolver, sameSymbol, type FocusResolver, type FocusSymbol } from "./focus-resolver.ts";

/**
 * Monaco → イベントログの結線（要件書 01 FR-C-30〜36）。
 * - edit: onDidChangeModelContent の changes を全件そのまま（range は 1 始まり [sl,sc,el,ec]）
 * - cursor: 300ms デバウンス
 * - focus: カーソル行を包含するシンボルが変わったときだけ（500ms デバウンス）
 * - paste: onDidPaste
 * - snapshot: 60 秒ごと／ファイル切替時／isFlush の直後／実行直前（呼び出し側が requestSnapshot）
 */

export interface MonacoCaptureOptions {
  logger: EventLogger;
  /** 現在のファイル ID と言語（タブ切替で変わる） */
  current: () => { fileId: string; language: Language };
  /** 全文スナップショットの保存先（POST /snapshot）。seq は logger.nextSeq() で予約して渡す */
  saveSnapshot: (args: { fileId: string; t: number; version: number; text: string; seq: number }) => Promise<unknown>;
  /** 編集があったことの通知（followup の沈黙検出に使う） */
  onActivity?: () => void;
  focusResolver?: FocusResolver;
  snapshotIntervalMs?: number;
  cursorDebounceMs?: number;
  focusDebounceMs?: number;
}

export interface MonacoCapture {
  dispose(): void;
  /** 今すぐスナップショット（実行直前など） */
  requestSnapshot(reason?: string): Promise<void>;
  /** ファイルを切り替えたときに呼ぶ（file_open を出し、旧ファイルのスナップショットを撮る） */
  switchedFile(prev: { fileId: string; language: Language; text: string; version: number } | null): void;
}

export function toRange(r: Monaco.IRange): Range {
  return [r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn];
}

export function attachMonacoCapture(editor: Monaco.editor.IStandaloneCodeEditor, opts: MonacoCaptureOptions): MonacoCapture {
  const { logger } = opts;
  const resolver = opts.focusResolver ?? new RegexFocusResolver();
  const disposables: Monaco.IDisposable[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  let focusTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFocus: FocusSymbol | null = null;
  let lastFocusFile = "";
  let lastSnapshotVersion = new Map<string, number>();
  let disposed = false;

  const snapshotNow = async (reason = "interval") => {
    const model = editor.getModel();
    if (!model || disposed) return;
    const { fileId } = opts.current();
    const version = model.getVersionId();
    if (reason === "interval" && lastSnapshotVersion.get(fileId) === version) return; // 変化なし
    lastSnapshotVersion.set(fileId, version);
    const t = logger.clock.now();
    try {
      await opts.saveSnapshot({ fileId, t, version, text: model.getValue(), seq: logger.nextSeq() });
    } catch {
      // 失敗しても edit の全件ログから復元できる。次回の interval でまた試す
      lastSnapshotVersion.delete(fileId);
    }
  };

  // edit
  disposables.push(
    editor.onDidChangeModelContent((e) => {
      const { fileId } = opts.current();
      logger.log({
        type: "edit",
        file: fileId,
        version: e.versionId,
        changes: e.changes.map((c) => ({ range: toRange(c.range), rangeLength: c.rangeLength, text: c.text })),
        undo: e.isUndoing || e.isRedoing,
        flush: e.isFlush,
      });
      opts.onActivity?.();
      if (e.isFlush) void snapshotNow("flush");
      scheduleFocus();
    }),
  );

  // paste
  disposables.push(
    editor.onDidPaste((e) => {
      const model = editor.getModel();
      const chars = model ? model.getValueInRange(e.range).length : 0;
      logger.log({ type: "paste", file: opts.current().fileId, chars });
    }),
  );

  // cursor（デバウンス）＋ focus（デバウンス）
  const scheduleFocus = () => {
    if (focusTimer) clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      focusTimer = null;
      void resolveFocus();
    }, opts.focusDebounceMs ?? 500);
  };
  const resolveFocus = async () => {
    const model = editor.getModel();
    const pos = editor.getPosition();
    if (!model || !pos || disposed) return;
    const { fileId, language } = opts.current();
    const res = await resolver.resolve(model.getValue(), pos.lineNumber, language);
    if (disposed) return;
    if (fileId === lastFocusFile && sameSymbol(res.symbol, lastFocus)) return;
    lastFocus = res.symbol;
    lastFocusFile = fileId;
    logger.log({ type: "focus", file: fileId, symbol: res.symbol, confidence: res.confidence, resolver: res.resolver });
  };
  disposables.push(
    editor.onDidChangeCursorSelection((e) => {
      if (cursorTimer) clearTimeout(cursorTimer);
      cursorTimer = setTimeout(() => {
        cursorTimer = null;
        const sel = e.selection;
        const empty = sel.isEmpty();
        logger.log({
          type: "cursor",
          file: opts.current().fileId,
          pos: [sel.positionLineNumber, sel.positionColumn],
          sel: empty ? null : [sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn],
        });
      }, opts.cursorDebounceMs ?? 300);
      scheduleFocus();
    }),
  );

  // 定期スナップショット
  const interval = setInterval(() => void snapshotNow("interval"), opts.snapshotIntervalMs ?? 60_000);

  return {
    dispose() {
      disposed = true;
      clearInterval(interval);
      if (cursorTimer) clearTimeout(cursorTimer);
      if (focusTimer) clearTimeout(focusTimer);
      for (const t of timers) clearTimeout(t);
      for (const d of disposables) d.dispose();
      lastSnapshotVersion = new Map();
    },
    requestSnapshot: (reason = "manual") => snapshotNow(reason),
    switchedFile(prev) {
      if (prev) {
        // 旧ファイルの最終状態を保存してから切替イベント
        const t = logger.clock.now();
        void opts.saveSnapshot({ fileId: prev.fileId, t, version: prev.version, text: prev.text, seq: logger.nextSeq() }).catch(() => {});
      }
      const { fileId, language } = opts.current();
      logger.log({ type: "file_open", file: fileId, language });
      lastFocus = null;
      lastFocusFile = "";
      scheduleFocus();
    },
  };
}
