"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, NotificationBanner } from "@/components/ui";

/**
 * 録画・文字起こし・評価をまとめて削除する。取り消せないので 2 段階: ボタン → 確認ダイアログの「削除する」。
 * 塗りの danger ボタンは確認ダイアログの中だけに置く（DESIGN_SYSTEM §6）。削除中はダイアログを閉じさせない。
 */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      router.push("/sessions");
      router.refresh();
    } catch {
      setError("削除できませんでした。もう一度試すか、アプリのログを確認してください。");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="danger-outline" onClick={() => setOpen(true)}>
        削除
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null);
        }}
        dismissible={!busy}
        title="このセッションを削除しますか"
        actions={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              やめる
            </Button>
            <Button variant="danger" onClick={onDelete} loading={busy}>
              削除する
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>録画・文字起こし・コードの記録・評価をすべて削除します。元に戻せません。</p>
          <p className="text-mono-13N-150 text-fg-muted break-all">{sessionId}</p>
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
