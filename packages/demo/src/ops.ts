import type { CodeOp } from "./schema.ts";
import { lineOf, normalizeNewlines, numberedWindows, occurrences } from "./text.ts";

/**
 * コード操作（replace / append / write）の適用（02 §2）。位置は書かせないので、
 * replace の old が「今のファイルでちょうど 1 回」一致することをここで確かめ、
 * 外れたときは Claude がそのまま直せる形（理由・直し方・行番号付きの今のコード）で返す。
 */

export interface OpRegion {
  /** 置き換える範囲の開始（今のファイルのオフセット） */
  start: number;
  oldText: string;
  newText: string;
}

export interface OpFailure {
  code: "E_OP_NOT_FOUND" | "E_OP_AMBIGUOUS" | "E_OP_NOOP";
  message: string;
  hint: string;
  context: { before_numbered: string };
}

export type OpOutcome = { ok: true; text: string; region: OpRegion } | { ok: false; error: OpFailure };

const LINE_NO_PREFIX = /^\s*\d+\s*\|\s?/m;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function applyOp(text: string, op: CodeOp): OpOutcome {
  switch (op.op) {
    case "append": {
      const add = normalizeNewlines(op.text);
      return { ok: true, text: text + add, region: { start: text.length, oldText: "", newText: add } };
    }
    case "write": {
      const content = normalizeNewlines(op.content);
      if (content === text) {
        return {
          ok: false,
          error: {
            code: "E_OP_NOOP",
            message: "write の content が今のファイルと同じです（何も変わりません）",
            hint: "この操作を消すか、変えたい部分だけを replace で書いてください",
            context: { before_numbered: numberedWindows(text, []) },
          },
        };
      }
      return { ok: true, text: content, region: { start: 0, oldText: text, newText: content } };
    }
    case "replace": {
      const oldText = normalizeNewlines(op.old);
      const newText = normalizeNewlines(op.new);
      if (oldText === newText) {
        return {
          ok: false,
          error: {
            code: "E_OP_NOOP",
            message: "replace の old と new が同じです（何も変わりません）",
            hint: "この操作を消すか、new に変更後のテキストを書いてください",
            context: { before_numbered: numberedWindows(text, []) },
          },
        };
      }
      const hits = occurrences(text, oldText);
      if (hits.length === 1) return { ok: true, text: text.slice(0, hits[0]) + newText + text.slice(hits[0]! + oldText.length), region: { start: hits[0]!, oldText, newText } };
      if (hits.length > 1) {
        const lines = hits.map((h) => lineOf(text, h));
        return {
          ok: false,
          error: {
            code: "E_OP_AMBIGUOUS",
            message: `old が ${hits.length} 箇所（${lines.map((l) => `${l} 行目`).join("・")}）に一致しました`,
            hint: "前後の行を old に含めて、今のファイルで 1 箇所だけに一致するようにしてください",
            context: { before_numbered: numberedWindows(text, lines) },
          },
        };
      }
      // 見つからない: よくある原因を順に調べて直し方を具体的にする
      let hint = "old は今のファイル（get_problem_for_demo の file.content に、それまでの操作を当てたもの）から一字一句そのままコピーしてください";
      let centers: number[] = [];
      if (LINE_NO_PREFIX.test(oldText)) {
        hint = "old に行番号（`  12| ` のような接頭辞）が含まれています。行番号はエラー表示用です。生のテキストだけを書いてください";
      } else if (collapse(text).includes(collapse(oldText))) {
        hint = "空白・インデント・改行の数が違います（空白を無視すると一致します）。インデントの空白の数をそろえてください";
      }
      const firstLine = oldText.split("\n").find((l) => l.trim().length >= 3)?.trim();
      if (firstLine) {
        const at = text.indexOf(firstLine);
        if (at !== -1) centers = [lineOf(text, at)];
      }
      return {
        ok: false,
        error: {
          code: "E_OP_NOT_FOUND",
          message: "old が今のファイルに見つかりません",
          hint,
          context: { before_numbered: numberedWindows(text, centers, 6) },
        },
      };
    }
  }
}

/** highlight.find の範囲（一意一致）。見つからなければ null と出現数 */
export function findUnique(text: string, find: string): { start: number; end: number } | { count: number } {
  const needle = normalizeNewlines(find);
  const hits = occurrences(text, needle);
  if (hits.length === 1) return { start: hits[0]!, end: hits[0]! + needle.length };
  return { count: hits.length };
}
