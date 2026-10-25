/**
 * コントラストを保証するトークンの組み合わせ（WCAG 2.x）。
 * scripts/check-contrast.mjs（CI 用）と /design（スウォッチの数値）が同じ一覧を使う。
 * ここに無い組み合わせは「使わない」前提。新しい組み合わせを画面で使うなら、先にここへ足して検証する。
 */
import type { SemanticToken } from "./tokens.ts";

export type ContrastPair = {
  fg: SemanticToken;
  bg: SemanticToken;
  /** 4.5 = 本文（1.4.3）、3 = UI 部品・図形（1.4.11） */
  min: 4.5 | 3;
  note: string;
};

const TEXT_BGS: SemanticToken[] = ["bg-canvas", "bg-surface", "bg-raised", "bg-hover", "bg-selected"];
const TEXT_FGS: SemanticToken[] = [
  "fg",
  "fg-body",
  "fg-muted",
  "fg-link",
  "accent",
  "success",
  "warning",
  "danger",
  "eval-major-fg",
  "eval-minor-fg",
  "eval-good-fg",
];

const text = (fg: SemanticToken, bg: SemanticToken, note: string): ContrastPair => ({ fg, bg, min: 4.5, note });
const ui = (fg: SemanticToken, bg: SemanticToken, note: string): ContrastPair => ({ fg, bg, min: 3, note });

export const CONTRAST_PAIRS: ContrastPair[] = [
  // 文字 × 面（すべての面で本文 AA）
  ...TEXT_FGS.flatMap((fg) => TEXT_BGS.map((bg) => text(fg, bg, "文字 × 面"))),
  text("fg-body", "bg-sunken", "コードブロック"),
  text("fg-muted", "bg-sunken", "コードブロックの注記"),
  text("fg", "bg-hl-line", "コードのハイライト行"),
  text("fg-body", "bg-hl-line", "コードのハイライト行"),
  // ボタン
  text("fg-on-accent", "accent", "主ボタン"),
  text("fg-on-accent", "accent-hover", "主ボタン hover"),
  text("fg-on-accent", "accent-active", "主ボタン active"),
  text("fg-on-danger", "danger", "危険ボタン"),
  text("fg-on-danger", "danger-hover", "危険ボタン hover"),
  text("fg-inverse", "bg-inverse", "ツールチップ・再生ヘッドの時刻"),
  // 状態色の地（バナー・チップ）。地の上の文字は fg-body 以上（fg-muted は不可）
  text("success", "success-subtle", "状態チップ"),
  text("warning", "warning-subtle", "状態チップ"),
  text("danger", "danger-subtle", "状態チップ"),
  text("accent", "info-subtle", "状態チップ"),
  text("fg-body", "success-subtle", "バナー本文"),
  text("fg-body", "warning-subtle", "バナー本文"),
  text("fg-body", "danger-subtle", "バナー本文"),
  text("fg-body", "info-subtle", "バナー本文"),
  text("eval-major-fg", "eval-major-subtle", "評価チップ"),
  text("eval-minor-fg", "eval-minor-subtle", "評価チップ"),
  text("eval-good-fg", "eval-good-subtle", "評価チップ"),
  text("fg-body", "eval-major-subtle", "評価の選択 wash"),
  // UI 部品の境界
  ui("border-input", "bg-canvas", "入力欄の枠"),
  ui("border-input", "bg-surface", "入力欄の枠"),
  ui("border-input", "bg-raised", "入力欄の枠"),
  ui("border-strong", "bg-canvas", "意味を持つ境界"),
  ui("border-strong", "bg-surface", "意味を持つ境界"),
  ui("border-strong", "bg-raised", "意味を持つ境界"),
  ui("accent", "bg-canvas", "選択インジケータ・チェック"),
  ui("accent", "bg-surface", "選択インジケータ・チェック"),
  ui("accent", "bg-hover", "選択インジケータ（hover 行）"),
  ui("accent", "bg-selected", "選択行の左 2px"),
  ui("fg-disabled", "bg-surface", "無効（参考: 1.4.3 対象外）"),
  // フォーカス
  ui("focus-outer", "bg-canvas", "フォーカス外側"),
  ui("focus-outer", "bg-surface", "フォーカス外側"),
  ui("focus-outer", "bg-raised", "フォーカス外側"),
  ui("focus-outer", "bg-selected", "フォーカス外側"),
  // 録画
  ui("rec", "bg-canvas", "録画中の点"),
  ui("rec", "bg-surface", "録画中の点"),
  // 評価マーク（図形）。グラフは必ず surface の上に描く
  ui("eval-major", "bg-surface", "評価マーク ▲"),
  ui("eval-minor", "bg-surface", "評価マーク ◆"),
  ui("eval-good", "bg-surface", "評価マーク ●"),
  ui("eval-major", "bg-raised", "評価マーク（ポップオーバー）"),
  ui("eval-minor", "bg-raised", "評価マーク（ポップオーバー）"),
  ui("eval-good", "bg-raised", "評価マーク（ポップオーバー）"),
  // 可視化（surface 上）
  ui("viz-1", "bg-surface", "categorical"),
  ui("viz-2", "bg-surface", "categorical"),
  ui("viz-3", "bg-surface", "categorical"),
  ui("viz-4", "bg-surface", "categorical"),
  ui("viz-5", "bg-surface", "categorical"),
  ui("viz-seq-1", "bg-surface", "sequential（最淡段）"),
  ui("viz-seq-2", "bg-surface", "sequential"),
  ui("viz-seq-3", "bg-surface", "sequential"),
  ui("viz-seq-4", "bg-surface", "sequential"),
  ui("viz-neutral", "bg-surface", "沈黙・その他"),
];

/** [data-session] 内のフォーカス（2px accent 単色、X6） */
export const SESSION_FOCUS_PAIRS: ContrastPair[] = [
  ui("accent", "bg-canvas", "面接中のフォーカス"),
  ui("accent", "bg-surface", "面接中のフォーカス"),
  ui("accent", "bg-raised", "面接中のフォーカス"),
];
