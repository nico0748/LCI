/**
 * stdio 判定の出力比較（02 FR-X-02-1）。
 * - exact: 改行コードと末尾の空白だけ正規化し、それ以外は完全一致
 * - token: 空白区切りトークン列が一致
 * - float: token と同じだが、数値トークンは絶対／相対誤差で比較
 */
export interface CompareOptions {
  mode: "exact" | "token" | "float";
  floatAbs?: number;
  floatRel?: number;
}

export interface CompareResult {
  ok: boolean;
  /** 不一致の説明（最初の差分）。UI と Claude の講評向けに短く */
  message?: string;
}

function normalizeExact(s: string): string[] {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
    .split("\n");
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

function numEq(a: number, b: number, abs: number, rel: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const d = Math.abs(a - b);
  return d <= abs || d <= rel * Math.max(Math.abs(a), Math.abs(b));
}

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function compareOutput(actual: string, expected: string, opts: CompareOptions): CompareResult {
  if (opts.mode === "exact") {
    const a = normalizeExact(actual);
    const e = normalizeExact(expected);
    const n = Math.max(a.length, e.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== e[i]) {
        return { ok: false, message: `${i + 1} 行目: 期待 ${fmt(e[i])} / 実際 ${fmt(a[i])}` };
      }
    }
    return { ok: true };
  }
  const a = tokens(actual);
  const e = tokens(expected);
  const abs = opts.floatAbs ?? 1e-6;
  const rel = opts.floatRel ?? 1e-6;
  const n = Math.max(a.length, e.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = e[i];
    if (x === undefined || y === undefined) {
      return { ok: false, message: x === undefined ? `出力が短い（${e.length} トークン期待、${a.length} トークン）` : `出力が長い（${e.length} トークン期待、${a.length} トークン）` };
    }
    if (x === y) continue;
    if (opts.mode === "float" && NUM.test(x) && NUM.test(y) && numEq(Number(x), Number(y), abs, rel)) continue;
    return { ok: false, message: `トークン ${i + 1}: 期待 ${fmt(y)} / 実際 ${fmt(x)}` };
  }
  return { ok: true };
}

function fmt(s: string | undefined): string {
  if (s === undefined) return "(なし)";
  const t = s.length > 40 ? s.slice(0, 40) + "…" : s;
  return JSON.stringify(t);
}

/** 保存用に先頭だけ残す（02 FR-X-02-9: stdout 先頭 4 KiB） */
export function head(s: string, max = 4096): string {
  return s.length > max ? s.slice(0, max) + `\n…(${s.length - max} 文字省略)` : s;
}
