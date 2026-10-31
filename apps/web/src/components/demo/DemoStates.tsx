"use client";

import { useState } from "react";
import { LANGUAGE_LABEL, type Language } from "@lci/core/browser";
import { Button, Dialog, LinkButton, NotificationBanner, cx } from "@/components/ui";
import { mcpRequestText } from "./demo-model.ts";
import { CopyIcon } from "./parts.tsx";

/**
 * ゲート（FR-D-04）: その問題の終了済みセッションが 0 件なら、プレイヤーの代わりに出す。
 * 「解かずに見る」は確認ダイアログを経て許可する（初見で解く機会は 1 問に 1 回しかないため、01 §11-1）。
 */
export function DemoGate({ problemId, onUnlock }: { problemId: string; onUnlock: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-labelledby="demo-gate-h" className="flex max-w-[720px] flex-col gap-3 rounded-8 border border-border bg-surface p-5">
      <h2 id="demo-gate-h" className="text-std-20B-150 text-fg">
        先に 1 回解くと、デモとの違いから学べます
      </h2>
      <p className="text-std-14N-170 text-fg-body">
        このデモは参照解と同じ答えを、話しながら書く順序で見せます。見てから解くと、要件確認（R1）と方針宣言（R2）の練習が本番より有利な条件になります。
      </p>
      <p className="text-std-14N-170 text-fg-muted">この問題を終えたセッションはまだありません。</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <LinkButton href={`/problems/${problemId}`} variant="primary" size="md">
          解く
        </LinkButton>
        <Button variant="tertiary" onClick={() => setConfirm(true)}>
          解かずに見る
        </Button>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="解かずにデモを見ますか？"
        actions={
          <>
            <Button onClick={() => setConfirm(false)}>やめる</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false);
                onUnlock();
              }}
            >
              見る
            </Button>
          </>
        }
      >
        <p>答えと書く順序が分かります。この問題を初見で解く練習はできなくなります。</p>
        <p className="mt-2 text-fg-muted">見たことはこのブラウザに記録し、次からはこの確認を出しません。</p>
      </Dialog>
    </section>
  );
}

/**
 * デモが無いときの空状態（FR-D-50）。MCP で頼む文（問題 ID・言語入り）とコピー。
 * 画面が見えている間は 5 秒ごとに確認しているので、保存されれば再読み込みせずに現れる（FR-D-51）。
 */
export function DemoEmpty({
  problem,
  language,
  otherLanguages,
  onPickLanguage,
  polling,
}: {
  problem: { id: string; title: string };
  language: Language;
  /** デモがある他の言語 */
  otherLanguages: Language[];
  onPickLanguage: (l: Language) => void;
  polling: boolean;
}) {
  const text = mcpRequestText(problem, LANGUAGE_LABEL[language]);
  const [copied, setCopied] = useState<"ok" | "ng" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("ng");
    }
  };
  return (
    <section aria-labelledby="demo-empty-h" className="flex max-w-[760px] flex-col gap-3 rounded-8 border border-dashed border-border-strong bg-surface p-5">
      <h2 id="demo-empty-h" className="text-dns-16B-130 text-fg">
        {LANGUAGE_LABEL[language]} の模範解答デモはまだありません
      </h2>
      <p className="text-std-14N-170 text-fg-body">
        デモは Claude が MCP で作ります。Claude Code（LCI の MCP サーバを登録したもの）に次の文を貼ってください。Claude が台本を書き、全テストに通ることを確かめてから保存します。
      </p>
      <div className="flex flex-col gap-2">
        <pre id="demo-mcp-text" className="overflow-auto rounded-6 border border-border bg-sunken p-3 whitespace-pre-wrap text-mono-13N-150 text-fg-body" tabIndex={0}>
          {text}
        </pre>
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<CopyIcon />} onClick={copy} aria-describedby="demo-mcp-text">
            頼む文をコピー
          </Button>
          <span role="status" className={cx("text-dns-13N-130", copied === "ng" ? "text-danger" : "text-fg-muted")}>
            {copied === "ok" ? "コピーしました" : copied === "ng" ? "コピーできませんでした。上の文を選択してコピーしてください" : ""}
          </span>
        </div>
      </div>
      <p className="text-dns-13N-130 text-fg-muted">{polling ? "保存されると、この画面に自動で現れます（5 秒ごとに確認しています）。" : "画面に戻ると、保存されたかを確認します。"}</p>
      {otherLanguages.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dns-14N-130 text-fg-body">
          ほかの言語のデモ:
          {otherLanguages.map((l) => (
            <Button key={l} size="2xs" variant="tertiary" onClick={() => onPickLanguage(l)}>
              {LANGUAGE_LABEL[l]}
            </Button>
          ))}
        </p>
      )}
    </section>
  );
}

/** 録画中（D15）。デモの API は 409 を返し、音声を鳴らさない */
export function DemoRecording({ onRetry }: { onRetry: () => void }) {
  return (
    <NotificationBanner tone="warning" title="録画中のセッションがあるため、デモを再生できません" actions={<Button size="xs" onClick={onRetry}>もう一度確かめる</Button>}>
      デモの音声がマイクに入ると、セッションの文字起こしが汚れます。セッションを終えてから開いてください（5 秒ごとに確認しています）。
    </NotificationBanner>
  );
}
