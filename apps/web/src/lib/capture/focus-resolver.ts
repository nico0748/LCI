import type { Language, Range } from "@lci/core";

/**
 * 「どこを編集しているか」の解決（要件書 01 FR-C-33〜35）。
 * 本命は web-tree-sitter（Worker）だが、まずは正規表現＋インデント／波括弧の粗い解決器を置き、
 * 同じ FocusResolver インタフェースで差し替えられるようにしておく。結果は常に confidence: "low"。
 */

export interface FocusSymbol {
  path: string[];
  kind: string;
  range: Range;
}

export interface FocusResult {
  symbol: FocusSymbol | null;
  confidence: "high" | "low";
  resolver: string;
}

export interface FocusResolver {
  readonly name: string;
  /** line は 1 始まり */
  resolve(text: string, line: number, language: Language): FocusResult | Promise<FocusResult>;
  dispose?(): void;
}

export interface OutlineNode {
  name: string;
  kind: string;
  /** 1 始まり、両端含む */
  startLine: number;
  endLine: number;
  children: OutlineNode[];
}

// ---- 言語別の定義行パターン -------------------------------------------------

type Def = { name: string; kind: string };
type DefMatcher = (line: string) => Def | null;

const CONTROL = new Set(["if", "for", "while", "switch", "return", "else", "do", "catch", "try", "sizeof", "defined", "match", "loop", "unless", "foreach", "elseif"]);

const jsLike: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(l))) return { name: m[1]!, kind: "class" };
  if ((m = /^\s*(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/.exec(l))) return { name: m[1]!, kind: "interface" };
  if ((m = /^\s*(?:export\s+)?(?:declare\s+)?(?:type|enum|namespace|module)\s+([A-Za-z_$][\w$]*)/.exec(l))) return { name: m[1]!, kind: "type" };
  if ((m = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(l))) return { name: m[1]!, kind: "function" };
  // const f = (…) => / const f = function / const f = async (…) =>
  if ((m = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/.exec(l))) return { name: m[1]!, kind: "function" };
  // obj.method = function / foo: function(
  if ((m = /^\s*([A-Za-z_$][\w$.]*)\s*[:=]\s*(?:async\s*)?function\b/.exec(l))) return { name: m[1]!.split(".").pop()!, kind: "function" };
  // クラス内メソッド: name(args) { / async name(args) { / get name() {
  if ((m = /^\s*(?:public|private|protected|static|async|get|set|override|readonly|\s)*\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^;]*\)\s*(?::\s*[^{;]+)?\{\s*$/.exec(l))) {
    if (!CONTROL.has(m[1]!) && m[1] !== "function" && m[1] !== "constructor") return { name: m[1]!, kind: "method" };
    if (m[1] === "constructor") return { name: "constructor", kind: "method" };
  }
  return null;
};

const goDef: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s*(\w+)/.exec(l))) return { name: `${m[1]}.${m[2]}`, kind: "method" };
  if ((m = /^\s*func\s+(\w+)/.exec(l))) return { name: m[1]!, kind: "function" };
  if ((m = /^\s*type\s+(\w+)\s+(struct|interface)\b/.exec(l))) return { name: m[1]!, kind: m[2]! };
  return null;
};

const rustDef: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+|const\s+|unsafe\s+|extern\s+"[^"]*"\s+)*fn\s+(\w+)/.exec(l))) return { name: m[1]!, kind: "function" };
  if ((m = /^\s*(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait|mod|union)\s+(\w+)/.exec(l))) return { name: m[2]!, kind: m[1]! };
  if ((m = /^\s*(?:unsafe\s+)?impl(?:<[^>]*>)?\s+(?:(\w+)(?:<[^>]*>)?\s+for\s+)?(\w+)/.exec(l))) return { name: m[1] ? `${m[1]} for ${m[2]}` : m[2]!, kind: "impl" };
  return null;
};

const cDef: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*(?:typedef\s+)?(struct|union|enum)\s+(\w+)\s*\{?\s*$/.exec(l))) return { name: m[2]!, kind: m[1]! };
  // 戻り値型 名前(引数) { — プロトタイプ（; で終わる）は除外
  if ((m = /^(?!\s*(?:return|else|typedef|#))\s*(?:static\s+|inline\s+|extern\s+|const\s+|unsigned\s+|signed\s+|struct\s+|enum\s+)*[A-Za-z_]\w*(?:\s*[*&]+\s*|\s+)[*&]*\s*([A-Za-z_]\w*)\s*\([^;]*\)?\s*(?:\{\s*)?$/.exec(l))) {
    if (!CONTROL.has(m[1]!) && !/;\s*$/.test(l)) return { name: m[1]!, kind: "function" };
  }
  return null;
};

const phpDef: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*(?:abstract\s+|final\s+)*(class|interface|trait|enum)\s+(\w+)/.exec(l))) return { name: m[2]!, kind: m[1]! };
  if ((m = /^\s*(?:public\s+|private\s+|protected\s+|static\s+|abstract\s+|final\s+)*function\s+&?\s*(\w+)/.exec(l))) return { name: m[1]!, kind: "function" };
  if ((m = /^\s*namespace\s+([\w\\]+)/.exec(l))) return { name: m[1]!, kind: "namespace" };
  return null;
};

const pyDef: DefMatcher = (l) => {
  let m: RegExpExecArray | null;
  if ((m = /^\s*(?:async\s+)?def\s+(\w+)/.exec(l))) return { name: m[1]!, kind: "function" };
  if ((m = /^\s*class\s+(\w+)/.exec(l))) return { name: m[1]!, kind: "class" };
  return null;
};

// ---- 文字列・コメント除去（波括弧カウント用の粗い前処理） ----------------------

interface ScanState {
  inBlockComment: boolean;
}

/** 文字列リテラル・コメントを空白に潰す。行をまたぐブロックコメントだけ状態を持つ */
export function stripLine(line: string, st: ScanState, lineComment = "//"): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (st.inBlockComment) {
      if (ch === "*" && line[i + 1] === "/") {
        st.inBlockComment = false;
        i += 2;
      } else i++;
      continue;
    }
    if (ch === "/" && line[i + 1] === "*") {
      st.inBlockComment = true;
      i += 2;
      continue;
    }
    if (lineComment && line.startsWith(lineComment, i)) break;
    if (ch === "#" && lineComment === "#") break;
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < line.length && line[i] !== q) {
        if (line[i] === "\\") i++;
        i++;
      }
      i++;
      out += " ";
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// ---- 波括弧ベースのアウトライン --------------------------------------------

interface Frame {
  node: OutlineNode;
  /** この `{` の深さ。未確定（まだ `{` を見ていない）なら -1 */
  openDepth: number;
  pendingSince: number;
  parentChildren: OutlineNode[];
}

function braceOutline(lines: string[], matcher: DefMatcher, lineComment = "//"): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: Frame[] = [];
  const st: ScanState = { inBlockComment: false };
  let depth = 0;
  const top = () => stack[stack.length - 1];
  const childrenOf = () => top()?.node.children ?? roots;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const raw = lines[idx]!;
    const wasInComment = st.inBlockComment;
    const clean = stripLine(raw, st, lineComment);
    const def = wasInComment ? null : matcher(raw);

    // 未確定の定義が `{` を見ないまま次の定義に到達 → 1 行シンボルとして確定
    const pending = top();
    if (def && pending && pending.openDepth === -1) {
      pending.node.endLine = lineNo - 1;
      stack.pop();
    }
    if (def) {
      const node: OutlineNode = { name: def.name, kind: def.kind, startLine: lineNo, endLine: lineNo, children: [] };
      const frame: Frame = { node, openDepth: -1, pendingSince: lineNo, parentChildren: childrenOf() };
      frame.parentChildren.push(node);
      stack.push(frame);
    }

    for (const ch of clean) {
      if (ch === "{") {
        depth++;
        const t = top();
        if (t && t.openDepth === -1) t.openDepth = depth;
      } else if (ch === "}") {
        depth--;
        while (stack.length && top()!.openDepth !== -1 && top()!.openDepth > depth) {
          top()!.node.endLine = lineNo;
          stack.pop();
        }
      }
    }
    // 1 行アロー関数など、`{` を持たず `;` で終わるもの
    const t = top();
    if (t && t.openDepth === -1 && (/;\s*$/.test(clean) || lineNo - t.pendingSince >= 2)) {
      t.node.endLine = lineNo;
      stack.pop();
    }
  }
  // 閉じられていないブロック（編集中）はファイル末尾まで
  while (stack.length) {
    top()!.node.endLine = lines.length;
    stack.pop();
  }
  return roots;
}

// ---- インデントベース（Python） -----------------------------------------------

function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
}

function indentOutline(lines: string[], matcher: DefMatcher): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { node: OutlineNode; indent: number }[] = [];
  let lastContent = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const raw = lines[idx]!;
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const ind = indentOf(raw);
    while (stack.length && stack[stack.length - 1]!.indent >= ind) {
      stack[stack.length - 1]!.node.endLine = lastContent;
      stack.pop();
    }
    const def = matcher(raw);
    if (def) {
      const node: OutlineNode = { name: def.name, kind: def.kind, startLine: lineNo, endLine: lineNo, children: [] };
      (stack[stack.length - 1]?.node.children ?? roots).push(node);
      stack.push({ node, indent: ind });
    }
    lastContent = lineNo;
  }
  while (stack.length) {
    stack[stack.length - 1]!.node.endLine = lastContent || lines.length;
    stack.pop();
  }
  return roots;
}

// ---- HTML（要素スタック＋ <script> 内 JS の二次解析） ------------------------------

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "param"]);

function elementName(tag: string, attrs: string): string {
  const id = /\bid\s*=\s*["']?([^"'\s>]+)/.exec(attrs)?.[1];
  if (id) return `${tag}#${id}`;
  const cls = /\bclass\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]?.trim().split(/\s+/)[0];
  if (cls) return `${tag}.${cls}`;
  return tag;
}

function cssOutline(lines: string[], offset: number): OutlineNode[] {
  const out: OutlineNode[] = [];
  let open: OutlineNode | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const m = /^\s*([^{}/@][^{}]*?)\s*\{/.exec(l);
    if (!open && m) {
      open = { name: m[1]!.trim(), kind: "rule", startLine: offset + i + 1, endLine: offset + i + 1, children: [] };
      out.push(open);
    }
    if (open && l.includes("}")) {
      open.endLine = offset + i + 1;
      open = null;
    }
  }
  if (open) open.endLine = offset + lines.length;
  return out;
}

function htmlOutline(lines: string[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { node: OutlineNode; tag: string }[] = [];
  const push = (node: OutlineNode, tag: string) => {
    (stack[stack.length - 1]?.node.children ?? roots).push(node);
    stack.push({ node, tag });
  };
  let embedded: { kind: "script" | "style"; start: number; node: OutlineNode } | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const line = lines[idx]!;
    if (embedded) {
      const close = new RegExp(`</${embedded.kind}\\s*>`, "i").exec(line);
      if (!close) continue;
      const inner = lines.slice(embedded.start, idx);
      embedded.node.children = embedded.kind === "script" ? braceOutline(inner, jsLike) : cssOutline(inner, embedded.start);
      if (embedded.kind === "script") shiftLines(embedded.node.children, embedded.start);
      embedded.node.endLine = lineNo;
      stack.pop();
      embedded = null;
      continue;
    }
    const re = /<(\/)?([A-Za-z][\w-]*)([^>]*?)(\/)?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const closing = !!m[1];
      const tag = m[2]!.toLowerCase();
      const attrs = m[3] ?? "";
      const selfClose = !!m[4] || VOID.has(tag);
      if (closing) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]!.tag === tag) {
            for (let j = stack.length - 1; j >= i; j--) stack[j]!.node.endLine = lineNo;
            stack.length = i;
            break;
          }
        }
        continue;
      }
      if (tag === "html" || tag === "head" || tag === "body") {
        // パスを短くするため html/head/body は階層に含めない（例: ["script","search"]）
        continue;
      }
      const node: OutlineNode = { name: elementName(tag, attrs), kind: "element", startLine: lineNo, endLine: lineNo, children: [] };
      if (selfClose) {
        (stack[stack.length - 1]?.node.children ?? roots).push(node);
        continue;
      }
      push(node, tag);
      if (tag === "script" || tag === "style") {
        // 同じ行に閉じタグがあれば埋め込みなし
        const rest = line.slice(re.lastIndex);
        const close = new RegExp(`</${tag}\\s*>`, "i").exec(rest);
        if (close) {
          node.endLine = lineNo;
          stack.pop();
          re.lastIndex += close.index + close[0].length;
          continue;
        }
        embedded = { kind: tag, start: lineNo, node };
        break;
      }
    }
  }
  while (stack.length) {
    stack[stack.length - 1]!.node.endLine = lines.length;
    stack.pop();
  }
  return roots;
}

function shiftLines(nodes: OutlineNode[], offset: number) {
  for (const n of nodes) {
    n.startLine += offset;
    n.endLine += offset;
    shiftLines(n.children, offset);
  }
}

// ---- 公開 API -----------------------------------------------------------------

export function outline(text: string, language: Language): OutlineNode[] {
  const lines = text.split(/\r?\n/);
  switch (language) {
    case "javascript":
    case "typescript":
      return braceOutline(lines, jsLike);
    case "go":
      return braceOutline(lines, goDef);
    case "rust":
      return braceOutline(lines, rustDef);
    case "c":
      return braceOutline(lines, cDef);
    case "php":
      return braceOutline(lines, phpDef, "//");
    case "python":
      return indentOutline(lines, pyDef);
    case "html":
      return htmlOutline(lines);
    default:
      return [];
  }
}

/** line を含む最内ノードまでの連鎖（外側→内側）。空なら該当なし */
export function chainAt(nodes: OutlineNode[], line: number): OutlineNode[] {
  for (const n of nodes) {
    if (line >= n.startLine && line <= n.endLine) {
      return [n, ...chainAt(n.children, line)];
    }
  }
  return [];
}

export function lineLength(text: string, line: number): number {
  const lines = text.split(/\r?\n/);
  return (lines[line - 1] ?? "").length;
}

export class RegexFocusResolver implements FocusResolver {
  readonly name = "regex";
  resolve(text: string, line: number, language: Language): FocusResult {
    const chain = chainAt(outline(text, language), line);
    if (chain.length === 0) return { symbol: null, confidence: "low", resolver: this.name };
    const inner = chain[chain.length - 1]!;
    return {
      symbol: {
        path: chain.map((n) => n.name),
        kind: inner.kind,
        range: [inner.startLine, 1, inner.endLine, lineLength(text, inner.endLine) + 1],
      },
      confidence: "low",
      resolver: this.name,
    };
  }
}

export function sameSymbol(a: FocusSymbol | null, b: FocusSymbol | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.path.length === b.path.length && a.path.every((p, i) => p === b.path[i]);
}
