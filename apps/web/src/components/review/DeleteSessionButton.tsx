"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 録画・文字起こし・評価をまとめて削除する。取り消せないので 2 段階で確認する */
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
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
      setError("削除できませんでした");
      setBusy(false);
    }
  }

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="rounded border border-border px-2 py-1 hover:text-danger">
        削除
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-danger">録画と評価を完全に削除します</span>
      <button type="button" disabled={busy} onClick={onDelete} className="rounded bg-danger px-2 py-1 text-white disabled:opacity-50">
        削除する
      </button>
      <button type="button" disabled={busy} onClick={() => setArmed(false)} className="rounded border border-border px-2 py-1">
        やめる
      </button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}
