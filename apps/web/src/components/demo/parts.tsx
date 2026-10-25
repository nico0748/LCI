import { Fragment } from "react";
import { splitInlineCode } from "./demo-model.ts";

/** 字幕の文。インライン `code` だけを等幅で描き、それ以外の記法・HTML は解釈しない（02 §10） */
export function CaptionText({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((p, i) =>
        p.code ? (
          <code key={i} className="rounded-4 bg-sunken px-1 text-mono-13N-150 text-fg-body">
            {p.text}
          </code>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

const svg = { "aria-hidden": true as const, viewBox: "0 0 16 16", width: 16, height: 16, focusable: "false" as const };

export function PlayIcon() {
  return (
    <svg {...svg}>
      <path d="M4.5 2.8v10.4L13 8Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg {...svg}>
      <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
    </svg>
  );
}

/** 前 / 次の文（縦線＋三角） */
export function SentenceIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg {...svg} style={dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M4 3.5v9L10 8Z" fill="currentColor" />
      <path d="M12 3.5v9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** 前 / 次の章（二重の三角＋縦線） */
export function ChapterIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg {...svg} style={dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M2.5 3.5v9L8 8Zm5.5 0v9L13.5 8Z" fill="currentColor" />
      <path d="M14 3.5v9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** 音声（スピーカー）。muted のときは斜線 */
export function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg {...svg}>
      <path d="M2 6h2.5L8 3v10L4.5 10H2Z" fill="currentColor" />
      {muted ? (
        <path d="m10.5 5.5 4 5m0-5-4 5" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.3 3.6a6 6 0 0 1 0 8.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
    </svg>
  );
}

/** コピー（重なった四角） */
export function CopyIcon() {
  return (
    <svg {...svg}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10.5V3.8C3 3.3 3.3 3 3.8 3h6.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** 話すべきポイントの ✓（無彩色。評価の色は使わない、01 §7） */
export function CheckGlyph({ on }: { on: boolean }) {
  return on ? (
    <svg {...svg} width={14} height={14} className="shrink-0 text-fg-body">
      <path d="m3.2 8.4 3 3 6.6-7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ) : (
    <svg {...svg} width={14} height={14} className="shrink-0 text-border-strong">
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
