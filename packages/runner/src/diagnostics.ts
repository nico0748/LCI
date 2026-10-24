import type { Diagnostic } from "@lci/core";
import type { RunnerLanguage } from "./types.ts";

/**
 * コンパイラ／ランタイムの stderr を core の Diagnostic[]（Monaco マーカー用）へ変換する。
 * 02 FR-X-04-2: rustc は JSON、それ以外は正規表現。
 * ファイル名はコンテナ内の絶対パス（/work/<id>/main.py）や file:// を剥がして相対名にする。
 */

export function normalizeFile(f: string): string {
  let s = f.trim();
  if (s.startsWith("file://")) s = s.slice("file://".length);
  // /work/<runId>/foo.ts → foo.ts、/tmp/xyz/foo.py → foo.py
  const m = /^\/work\/[^/]+\/(.+)$/.exec(s);
  if (m) return m[1]!;
  if (s.startsWith("./")) s = s.slice(2);
  if (s.startsWith("/")) s = s.slice(s.lastIndexOf("/") + 1);
  return s;
}

function sev(level: string): Diagnostic["severity"] {
  const l = level.toLowerCase();
  if (l.startsWith("error") || l === "fatal error" || l === "parse error" || l === "fatal") return "error";
  if (l.startsWith("warn") || l === "deprecated") return "warning";
  return "info";
}

/** gcc / clang のテキスト診断: `main.c:2:35: error: 'y' undeclared` とリンカの `undefined reference` */
export function parseGcc(stderr: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const re = /^(.+?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/;
  for (const line of stderr.split("\n")) {
    const m = re.exec(line);
    if (m) {
      out.push({ file: normalizeFile(m[1]!), line: Number(m[2]), col: Number(m[3]), severity: sev(m[4]!), message: m[5]!.trim() });
      continue;
    }
    // リンカエラー: `/usr/bin/ld: main.c:(.text+0x1a): undefined reference to `foo'` → 行番号なし
    const l = /undefined reference to [`'](.+?)'/.exec(line);
    if (l) out.push({ severity: "error", message: `undefined reference to ${l[1]}（リンクエラー）` });
  }
  return out;
}

/** rustc --error-format=json。1 行 1 JSON。primary span のみ採用し、"aborting due to" は捨てる */
export function parseRustcJson(stderr: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of stderr.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    let j: unknown;
    try {
      j = JSON.parse(t);
    } catch {
      continue;
    }
    const d = j as {
      message?: string;
      level?: string;
      code?: { code?: string } | null;
      spans?: { file_name: string; line_start: number; column_start: number; is_primary: boolean }[];
    };
    if (!d.message || !d.level) continue;
    if (d.level === "failure-note") continue;
    if (/^aborting due to/.test(d.message)) continue;
    if (/^For more information about this error/.test(d.message)) continue;
    if (d.level === "warning" && /warning(s)? emitted$/.test(d.message)) continue;
    const span = d.spans?.find((s) => s.is_primary) ?? d.spans?.[0];
    const code = d.code?.code ? `[${d.code.code}] ` : "";
    out.push({
      file: span ? normalizeFile(span.file_name) : undefined,
      line: span?.line_start,
      col: span?.column_start,
      severity: sev(d.level),
      message: code + d.message,
    });
  }
  return out;
}

/**
 * rustc の人間向け形式（unit 判定でハーネス command が --error-format=json を付けていない場合）:
 *   error[E0308]: mismatched types
 *    --> main.rs:1:26
 */
export function parseRustcText(stderr: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const lines = stderr.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(error|warning)(?:\[(E\d+)\])?: (.*)$/.exec(lines[i]!);
    if (!m) continue;
    if (/^aborting due to|^\d+ warnings? emitted/.test(m[3]!)) continue;
    const loc = /^\s*-->\s+(.+?):(\d+):(\d+)\s*$/.exec(lines[i + 1] ?? "");
    out.push({
      file: loc ? normalizeFile(loc[1]!) : undefined,
      line: loc ? Number(loc[2]) : undefined,
      col: loc ? Number(loc[3]) : undefined,
      severity: m[1] === "error" ? "error" : "warning",
      message: (m[2] ? `[${m[2]}] ` : "") + m[3]!,
    });
  }
  return out;
}

/** rustc JSON から人間向けテキスト（rendered）を復元する。UI の生 stderr 表示用 */
export function renderRustcStderr(stderr: string): string {
  const parts: string[] = [];
  for (const line of stderr.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) {
      if (t) parts.push(line);
      continue;
    }
    try {
      const j = JSON.parse(t) as { rendered?: string };
      if (j.rendered) parts.push(j.rendered.replace(/\n+$/, ""));
    } catch {
      parts.push(line);
    }
  }
  return parts.join("\n");
}

/** go build / go vet / go test のビルド失敗: `./main.go:3:15: declared and not used: x` */
export function parseGo(stderr: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const re = /^(?:#\s.*|\s*)?(\.?\/?[\w./-]+\.go):(\d+):(\d+):\s+(.*)$/;
  for (const line of stderr.split("\n")) {
    const m = re.exec(line);
    if (!m) continue;
    const msg = m[4]!.trim();
    // `too many errors` などは行付きでも情報扱い
    out.push({ file: normalizeFile(m[1]!), line: Number(m[2]), col: Number(m[3]), severity: /^warning:/.test(msg) ? "warning" : "error", message: msg });
  }
  // ランタイム panic: `panic: runtime error: index out of range [3] with length 3` + `main.go:7 +0x1d`
  if (out.length === 0) {
    const p = /^panic: (.*)$/m.exec(stderr);
    if (p) {
      const loc = /\n\s+(?:\/work\/[^/]+\/|\.\/)?([\w./-]+\.go):(\d+)/.exec(stderr);
      out.push({ file: loc ? normalizeFile(loc[1]!) : undefined, line: loc ? Number(loc[2]) : undefined, severity: "error", message: p[1]!.trim() });
    }
  }
  return out;
}

/**
 * node --experimental-strip-types の構文エラー／実行時例外:
 *   /work/x/main.ts:3
 *   const x: number = ;
 *                     ^
 *   SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX]: Expression expected
 * 列はキャレット行の位置から求める（source map が無いため strip 後の列＝元の列で一致する）。
 */
export function parseNode(stderr: string): Diagnostic[] {
  const lines = stderr.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const head = /^(\S.*?\.(?:ts|mts|js|mjs|cjs)):(\d+)$/.exec(lines[i]!);
    if (!head) continue;
    let col: number | undefined;
    for (let k = i + 1; k < Math.min(lines.length, i + 6); k++) {
      const c = /^(\s*)\^+\s*$/.exec(lines[k]!);
      if (c) {
        col = c[1]!.length + 1;
        break;
      }
    }
    for (let k = i + 1; k < Math.min(lines.length, i + 12); k++) {
      const e = /^([A-Za-z]*Error)(?:\s+\[([A-Z_]+)\])?:\s*(.*)$/.exec(lines[k]!);
      if (e) {
        return [{ file: normalizeFile(head[1]!), line: Number(head[2]), col, severity: "error", message: `${e[1]}: ${e[3]}` }];
      }
    }
    return [{ file: normalizeFile(head[1]!), line: Number(head[2]), col, severity: "error", message: lines[i + 1]?.trim() || "error" }];
  }
  // ファイル位置なしの例外（`Error: boom` のみ）
  const bare = /^([A-Za-z]*Error):\s*(.*)$/m.exec(stderr);
  if (bare) return [{ severity: "error", message: `${bare[1]}: ${bare[2]}` }];
  return [];
}

/**
 * Python の traceback / SyntaxError。ユーザーファイル内で最も内側（最後）のフレームに付ける。
 *   File "/work/x/main.py", line 2, in f
 *   ZeroDivisionError: division by zero
 */
export function parsePython(stderr: string): Diagnostic[] {
  const lines = stderr.split("\n");
  let last: { file: string; line: number } | undefined;
  for (const l of lines) {
    const m = /^\s*File "(.+?)", line (\d+)/.exec(l);
    if (m && !/site-packages|\/usr\/lib\/python|<frozen/.test(m[1]!)) last = { file: m[1]!, line: Number(m[2]) };
  }
  // 最終行の `ErrorType: message`（空行を除く）
  let msg: string | undefined;
  let col: number | undefined;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trimEnd();
    if (!t) continue;
    const m = /^([A-Za-z_.]*(?:Error|Exception|Exit|Interrupt|Warning)[A-Za-z_]*)(?::\s*(.*))?$/.exec(t);
    if (m) msg = m[2] ? `${m[1]}: ${m[2]}` : m[1]!;
    break;
  }
  if (!msg) return [];
  // SyntaxError のキャレットは「行番号の次の次」に来る: `    x = (` / `        ^`
  if (last && /^SyntaxError|^IndentationError|^TabError/.test(msg)) {
    const idx = lines.findIndex((l) => l.includes(`line ${last!.line}`) && l.includes(last!.file));
    const src = lines[idx + 1];
    const caret = lines[idx + 2];
    if (src !== undefined && caret !== undefined && /^\s*\^/.test(caret)) {
      const indent = src.length - src.trimStart().length;
      col = Math.max(1, caret.indexOf("^") - indent + 1);
    }
  }
  return [{ file: last ? normalizeFile(last.file) : undefined, line: last?.line, col, severity: "error", message: msg }];
}

/**
 * PHP: `PHP Parse error:  syntax error, ... in /work/x/main.php on line 3`
 *      `Fatal error: Uncaught Exception: boom in /work/x/main.php:2`
 *      `Warning: Undefined variable $x in ... on line 5`
 */
export function parsePhp(stderr: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const re = /^(?:PHP )?(Parse error|Fatal error|Warning|Notice|Deprecated):\s+(.*?) in (\S+?)(?::(\d+)| on line (\d+))\s*$/;
  const seen = new Set<string>();
  for (const line of stderr.split("\n")) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const file = normalizeFile(m[3]!);
    const ln = Number(m[4] ?? m[5]);
    const key = `${m[1]}|${file}|${ln}|${m[2]}`;
    if (seen.has(key)) continue; // log_errors と display_errors の二重出力を畳む
    seen.add(key);
    out.push({ file, line: ln, severity: sev(m[1]!), message: `${m[1]}: ${m[2]}` });
  }
  return out;
}

/** 言語ごとの入口。コンパイル段階と実行段階で同じ関数を使う */
export function parseDiagnostics(lang: RunnerLanguage, stderr: string): Diagnostic[] {
  switch (lang) {
    case "c":
      return parseGcc(stderr);
    case "rust": {
      const j = parseRustcJson(stderr);
      return j.length ? j : parseRustcText(stderr);
    }
    case "go":
      return parseGo(stderr);
    case "typescript":
      return parseNode(stderr);
    case "python":
      return parsePython(stderr);
    case "php":
      return parsePhp(stderr);
  }
}

/** 実行時 panic（Rust）は JSON ではなくテキストなので別扱い */
export function parseRustPanic(stderr: string): Diagnostic[] {
  const m = /thread '.*?' (?:\(\d+\) )?panicked at (.+?):(\d+):(\d+):\n(.*)/.exec(stderr);
  if (!m) return [];
  return [{ file: normalizeFile(m[1]!), line: Number(m[2]), col: Number(m[3]), severity: "error", message: `panic: ${m[4]!.trim()}` }];
}
