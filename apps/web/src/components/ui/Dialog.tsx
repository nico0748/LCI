"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx.ts";
import { CloseIcon } from "./icons.tsx";

export type DialogProps = {
  open: boolean;
  /** 閉じる要求（Esc・閉じるボタン）を受けたとき。false を渡して閉じる */
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  /** 右下の操作。主操作（primary / danger）を最後に置く */
  actions?: ReactNode;
  /**
   * false にすると Esc と閉じるボタンを無効にする（保存中など、中断させたくないとき。03 §5.9）。
   * 閉じるのは画面側が open={false} にしたときだけになる。
   */
  dismissible?: boolean;
  closeLabel?: string;
  /** 本文の最大幅（既定 480px） */
  width?: number;
  className?: string;
};

/**
 * モーダルダイアログ。DADS `ModalDialog` + `useModalDialog`:
 * ネイティブ <dialog> の showModal()（フォーカストラップと背景の inert はブラウザに任せる）、
 * 開いたら見出しにフォーカス（Enter を押しても主操作が走らない）、cancel イベントで Esc を処理する。
 * 閉じたら開く前にフォーカスがあった要素へ戻す。
 */
export function Dialog({ open, onOpenChange, title, children, actions, dismissible = true, closeLabel = "閉じる", width = 480, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  // cancel ハンドラから最新の props を読むため（effect の張り直しを避ける）
  const latest = useRef({ open, dismissible, onOpenChange });
  useEffect(() => {
    latest.current = { open, dismissible, onOpenChange };
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      headingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      // Esc は常に自前で処理する（ブラウザに閉じさせると open の状態とずれる）
      e.preventDefault();
      if (latest.current.dismissible) latest.current.onOpenChange(false);
    };
    const onClose = () => {
      // Chrome は Esc の連打で cancel を取り消せないまま閉じることがある。props とずれたら合わせ直す
      if (latest.current.open) {
        if (latest.current.dismissible) latest.current.onOpenChange(false);
        else {
          dialog.showModal();
          return;
        }
      }
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && el.isConnected) el.focus();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className={cx(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-auto rounded-12 border border-border bg-raised p-0 text-fg-body shadow-3",
        "forced-colors:border-[CanvasText]",
        className,
      )}
      style={{ maxWidth: width }}
    >
      <div className="flex items-start gap-4 px-5 pt-5">
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="min-w-0 flex-1 text-std-20B-150 text-fg outline-none focus-visible:shadow-none">
          {title}
        </h2>
        {dismissible && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-6 px-2 text-dns-14N-130 text-fg-body can-hover:bg-hover can-hover:underline"
          >
            <CloseIcon />
            {closeLabel}
          </button>
        )}
      </div>
      {children && <div className="px-5 pt-3 text-std-14N-170 text-fg-body">{children}</div>}
      {actions && <div className="flex flex-wrap items-center justify-end gap-2 px-5 pt-5 pb-5">{actions}</div>}
      {!actions && <div className="pb-5" />}
    </dialog>
  );
}
