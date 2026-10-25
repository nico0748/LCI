"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Button, Dialog, NotificationBanner, SYSTEM_ICON, cx } from "@/components/ui";
import type { RecorderStatus } from "@/lib/capture/recorder";
import { recLabel, recorderDetail, type RecState } from "./recording-state";
import { remainingSentence, timerView, type TimerMode } from "./timer";
import type { Platform } from "./keys";
import { shortcutList } from "./keys";

/**
 * 面接画面（S3）のヘッダ部品と終了ダイアログ。静か・密・曖昧さなし（録画に映る前提）。
 * アニメーションは [data-session] で全停止しているので、ここでも動く表現は使わない。
 */

/* ───────── タイマー（03 §3.3、X4） ───────── */

export function SessionTimer({ remainingMs, limitMs, mode, onToggle }: { remainingMs: number; limitMs: number; mode: TimerMode; onToggle: () => void }) {
  const v = timerView(remainingMs, limitMs, mode);
  return (
    <button
      type="button"
      onClick={onToggle}
      title={mode === "remaining" ? "経過時間の表示に切り替え" : "残り時間の表示に切り替え"}
      className={cx(
        // 幅を固定して、秒表示への切り替えでヘッダのボタンがずれないようにする。左 3px の縦線は警告時だけ色が付く
        "inline-flex h-7 w-[7.5rem] shrink-0 items-center gap-1.5 rounded-4 border-l-[3px] pr-2 pl-2 can-hover:bg-hover",
        v.warn ? "border-l-warning text-warning" : "border-l-transparent text-fg",
      )}
    >
      <span role="timer" aria-live="off" aria-label={v.spoken} className="inline-flex items-baseline gap-1.5">
        <span aria-hidden="true" className={cx("text-dns-13N-130", v.warn ? "text-warning" : "text-fg-muted")}>
          {v.label}
        </span>
        <span aria-hidden="true" className="text-mono-16B-100">
          {v.value}
        </span>
      </span>
    </button>
  );
}

/* ───────── 録画インジケータ（03 §3.4） ───────── */

export function RecIndicator({
  state,
  camera,
  statuses,
  open,
  onOpenChange,
}: {
  state: RecState;
  camera: boolean;
  statuses: RecorderStatus[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const popId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onOpenChange, open]);

  const label = recLabel(state, camera);
  const stopped = state.kind === "stopped";
  const silent = state.kind === "recording" && state.silent;
  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => onOpenChange(!open)}
        className={cx(
          "inline-flex h-7 items-center gap-1.5 rounded-4 px-1.5 text-dns-13N-130 can-hover:bg-hover",
          stopped ? "font-bold text-danger" : silent ? "text-warning" : "text-fg-muted",
        )}
      >
        {stopped ? (
          <SYSTEM_ICON.danger size={14} />
        ) : state.kind === "recording" ? (
          // 静止した点（点滅させない）。色は非テキストの --rec
          <span aria-hidden="true" className="size-2 rounded-full bg-rec" />
        ) : (
          <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-current" />
        )}
        {label}
        {silent && <span>· 音声が届いていません</span>}
      </button>
      {open && (
        <div id={popId} role="region" aria-label="録画の詳細" className="absolute top-full right-0 z-10 mt-1.5 w-96 rounded-8 border border-border bg-raised p-3 text-dns-13N-130 text-fg-body shadow-1">
          <p className="mb-1.5 text-dns-14B-130 text-fg">録画の詳細</p>
          {statuses.length === 0 ? (
            <p className="text-fg-muted">{state.kind === "off" ? "録画・録音なしで開始しました。編集ログだけを記録しています。" : "録画はまだ始まっていません。"}</p>
          ) : (
            <ul className="flex flex-col gap-1 tabular-nums">
              {statuses.map((s) => (
                <li key={s.id}>{recorderDetail(s)}</li>
              ))}
            </ul>
          )}
          {silent && <p className="mt-1.5 text-fg-body">10 秒以上、マイクの音量がほぼ 0 です。考えていて黙っているだけなら問題ありません。</p>}
          <p className="mt-1.5 text-fg-muted">編集ログは録画と別に記録しています。</p>
        </div>
      )}
    </div>
  );
}

/* ───────── ペインの区切り（03 §3.2、FR-U-04） ───────── */

export function PaneSeparator({
  label,
  controls,
  value,
  min,
  max,
  onKeyDown,
  onPointerDown,
}: {
  label: string;
  controls: string;
  value: number;
  min: number;
  max: number;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuetext={`${Math.round(value)}px`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      className={cx(
        // 見た目は 1px の線、当たり判定は左右 4px ずつ広げる。hover と操作中は accent
        "relative z-[1] w-px shrink-0 cursor-col-resize touch-none bg-border can-hover:bg-accent",
        "before:absolute before:inset-y-0 before:-right-1 before:-left-1 before:content-['']",
      )}
    />
  );
}

/* ───────── 終了ダイアログ（03 §3.9、P0-1） ───────── */

export type EndDialogState = "closed" | "confirm" | "timeup" | "saving" | "error";

export function EndDialog({
  state,
  remainingMs,
  sessionId,
  error,
  onCancel,
  onConfirm,
  onRetry,
  onLeave,
}: {
  state: EndDialogState;
  remainingMs: number;
  sessionId: string;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const cancelId = useId();
  const retryId = useId();
  // 開いた直後のフォーカスは「続ける」（取り消し）に置く。⌘⇧E の誤操作や Monaco での Enter の勢いで終了しないため。
  // Dialog は開いたとき見出しにフォーカスするので、子の effect の後に走るここで上書きする
  useEffect(() => {
    if (state === "confirm") document.getElementById(cancelId)?.focus();
    if (state === "error") document.getElementById(retryId)?.focus();
  }, [cancelId, retryId, state]);

  const rest = remainingSentence(remainingMs);
  const title =
    state === "timeup" ? "時間になりました" : state === "saving" ? "保存しています" : state === "error" ? "終了処理を完了できませんでした" : "セッションを終了しますか？";
  return (
    <Dialog
      open={state !== "closed"}
      onOpenChange={(o) => {
        if (!o && state === "confirm") onCancel();
      }}
      dismissible={state === "confirm"}
      title={title}
      width={460}
      actions={
        state === "confirm" ? (
          <>
            <Button id={cancelId} onClick={onCancel}>
              続ける
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              終了して保存
            </Button>
          </>
        ) : state === "error" ? (
          <>
            <Button onClick={onLeave}>保存せずに振り返りへ</Button>
            <Button id={retryId} variant="primary" onClick={onRetry}>
              もう一度
            </Button>
          </>
        ) : undefined
      }
    >
      {state === "confirm" && (
        <div className="flex flex-col gap-1">
          {rest && <p className="tabular-nums">{rest}</p>}
          <p>終了すると録画を保存し、振り返り画面へ移動します。終了したセッションは再開できません。</p>
        </div>
      )}
      {state === "timeup" && <p>最後の発話を録画に残すため、5 秒後に保存して終了します。エディタはもう編集できません。</p>}
      {state === "saving" && <p role="status">録画と記録を保存しています…。このタブを閉じないでください。</p>}
      {state === "error" && (
        <NotificationBanner tone="danger" title="保存できませんでした">
          <p>{error}</p>
          <p>
            記録は <code className="text-mono-13N-150 break-all">data/sessions/{sessionId}/</code> に残っています。
          </p>
        </NotificationBanner>
      )}
    </Dialog>
  );
}

/* ───────── 操作一覧（⌘K → ?） ───────── */

export function ShortcutsDialog({ open, onOpenChange, platform }: { open: boolean; onOpenChange: (o: boolean) => void; platform: Platform }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="キーボード操作" width={520}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        {shortcutList(platform).map((s) => (
          <div key={s.keys} className="contents">
            <dt className="text-mono-13N-150 whitespace-nowrap text-fg">{s.keys}</dt>
            <dd className="m-0 text-dns-14N-130 text-fg-body">{s.label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-dns-13N-130 text-fg-muted">この一覧を開いている間もタイマーと録画は止まりません。</p>
    </Dialog>
  );
}

/** ヘルプの図形（円の中に ?） */
export function HelpIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M8 11.3v.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
