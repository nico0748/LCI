"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, NotificationBanner, type ButtonSize } from "@/components/ui";

/**
 * 未完了セッションの破棄（ホーム・履歴）。録画・ログをまとめて消すので、確認ダイアログを挟む。
 * 削除は既存の DELETE /api/sessions/[id] を使う。消したら同じ画面を読み直す。
 */
export function DiscardSessionButton({ sessionId, label, size = "sm" }: { sessionId: string; label: string; size?: ButtonSize }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discard() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setOpen(false);
      router.refresh();
    } catch {
      setError("破棄できませんでした。サーバが動いているか確かめて、もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant="tertiary" onClick={() => setOpen(true)} aria-label={`${label} を破棄`}>
        破棄…
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        dismissible={!busy}
        title="このセッションを破棄しますか"
        actions={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              やめる
            </Button>
            <Button variant="danger" onClick={discard} loading={busy}>
              破棄する
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-std-14N-170 text-fg-body">
            「{label}」の録画・編集ログ・文字起こしを、この Mac から削除します。元に戻せません。
          </p>
          {error && (
            <NotificationBanner tone="danger" variant="compact">
              {error}
            </NotificationBanner>
          )}
        </div>
      </Dialog>
    </>
  );
}
