/**
 * 面接画面のキーボード操作（03 §4.2）。純関数（session-helpers.test.ts）。
 * ブラウザ予約のキー（⌘1〜9、⌘⌥←/→、⌘T/W/N/L、⌃Tab）は使わない。補助操作は ⌘K を起点にした 2 段入力にまとめる。
 * ⌘/ は Monaco の行コメントと衝突するので、操作一覧は ⌘K → ? に置く。
 */

export type Platform = "mac" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "other";
}

/** 表示用の修飾キー */
export function modLabel(p: Platform): string {
  return p === "mac" ? "⌘" : "Ctrl+";
}

export type KeyName = "run" | "judge" | "problem" | "end" | "chord";

/** ボタン内の kbd 表記と aria-keyshortcuts */
export function shortcut(name: KeyName, p: Platform): { kbd: string; aria: string } {
  const mac = p === "mac";
  const mod = mac ? "Meta" : "Control";
  const m = modLabel(p);
  const shift = mac ? "⇧" : "Shift+";
  switch (name) {
    case "run":
      return { kbd: `${m}↵`, aria: `${mod}+Enter` };
    case "judge":
      return { kbd: `${m}${shift}↵`, aria: `${mod}+Shift+Enter` };
    case "problem":
      return { kbd: `${m}B`, aria: `${mod}+B` };
    case "end":
      return { kbd: `${m}${shift}E`, aria: `${mod}+Shift+E` };
    case "chord":
      return { kbd: `${m}K`, aria: `${mod}+K` };
  }
}

/** ⌘K の次に押すキー → 操作 */
export type ChordAction = "focus-problem" | "focus-editor" | "focus-right" | "prev-file" | "next-file" | "toggle-timer" | "rec-detail" | "help";

export function chordAction(key: string): ChordAction | null {
  switch (key) {
    case "1":
      return "focus-problem";
    case "2":
      return "focus-editor";
    case "3":
      return "focus-right";
    case "ArrowLeft":
      return "prev-file";
    case "ArrowRight":
      return "next-file";
    case "t":
    case "T":
      return "toggle-timer";
    case "r":
    case "R":
      return "rec-detail";
    case "?":
    case "/":
      return "help";
    default:
      return null;
  }
}

/** 操作一覧（⌘K → ?）の行 */
export function shortcutList(p: Platform): { keys: string; label: string }[] {
  const k = (n: KeyName) => shortcut(n, p).kbd;
  const c = k("chord");
  return [
    { keys: k("run"), label: "実行（web はプレビューを更新）" },
    { keys: k("judge"), label: "公開サンプルで判定（何度でも可）" },
    { keys: k("problem"), label: "問題ペインを開く・畳む" },
    { keys: k("end"), label: "終了（確認ダイアログ → Tab → Enter）" },
    { keys: `${c} → 1 / 2 / 3`, label: "問題 / エディタ / 右ペインへ移動" },
    { keys: `${c} → ← / →`, label: "前 / 次のファイル" },
    { keys: `${c} → T`, label: "残り時間と経過時間を切り替え" },
    { keys: `${c} → R`, label: "録画の詳細" },
    { keys: `${c} → ?`, label: "この一覧" },
  ];
}
