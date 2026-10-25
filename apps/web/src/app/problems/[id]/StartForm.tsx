"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_LABEL, type Language } from "@lci/core/browser";
import { ChoiceGroup, Field, Kbd, Radio, Select, buttonClasses, cx } from "@/components/ui";

/** 面接画面を使える最小の幅（X13）。これ未満では開始前に注意を出す（開始ボタンの無効化は面接画面側で行う） */
const INTERVIEW_MIN_WIDTH = "(min-width: 80rem)";

/**
 * 言語を選んで開始。Enter 1 回で /session/new（事前確認）へ（04 §5.2、FR-U-03）。
 * URL の約束（`/session/new?problem=<id>&lang=<lang>`）は変えない。面接官モードは事前確認の画面で選ぶ。
 * - 広い画面では開始ボタンに最初からフォーカスを置く（Enter はフォーカス中のボタンを押す、02 §2.3）。
 * - それ以外の場所で Enter を押しても開始する（従来の挙動）。ただし操作要素・折りたたみ・文字選択中は除く。
 */
export function StartForm({ problemId, languages, timeLimit }: { problemId: string; languages: Language[]; timeLimit: number }) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(languages[0]!);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const groupName = useId();
  const href = `/session/new?problem=${encodeURIComponent(problemId)}&lang=${encodeURIComponent(lang)}`;

  useEffect(() => {
    if (window.matchMedia(INTERVIEW_MIN_WIDTH).matches && document.activeElement === document.body) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (["SELECT", "INPUT", "TEXTAREA", "A", "BUTTON", "SUMMARY"].includes(el.tagName) || el.isContentEditable || el.closest("details, dialog"))) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      router.push(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      {languages.length === 1 ? (
        <p className="flex flex-col gap-1">
          <span className="text-dns-14B-130 text-fg">言語</span>
          <span className="text-dns-14N-130 text-fg-body">{LANGUAGE_LABEL[languages[0]!]}</span>
        </p>
      ) : languages.length <= 4 ? (
        <ChoiceGroup legend="言語">
          {languages.map((l) => (
            <Radio key={l} name={groupName} value={l} checked={lang === l} onChange={() => setLang(l)}>
              {LANGUAGE_LABEL[l]}
            </Radio>
          ))}
        </ChoiceGroup>
      ) : (
        <Field label="言語">
          {(p) => (
            <Select {...p} size="md" value={lang} onChange={(e) => setLang(e.target.value as Language)}>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div className="flex flex-col gap-2">
        {/* フォーカスを当てるため ref が要るので、Button ではなく同じ見た目の素の button にする */}
        <button ref={buttonRef} type="submit" data-ui="button" className={cx(buttonClasses({ variant: "primary", size: "md" }), "w-full")}>
          開始する（{timeLimit} 分）
        </button>
        <p className="text-center text-dns-13N-130 text-fg-muted">
          <Kbd>Enter</Kbd> でも開始
        </p>
      </div>
    </form>
  );
}
