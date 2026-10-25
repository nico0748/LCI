/**
 * globals.css からトークンの値を取り出す小さなパーサ（ビルドには含めない。テストと check-contrast 用）。
 * 汎用の CSS パーサではない。globals.css のブロックの書き方（セレクタごとに 1 ブロック）を前提にしている。
 */

export type Declarations = Record<string, string>;

export type ParsedTokens = {
  /** :root の primitive（--dads-* / --lci-*） */
  primitives: Declarations;
  /** `:root, [data-theme="light"]` */
  light: Declarations;
  /** `:root[data-theme="dark"], [data-theme="dark"]` */
  dark: Declarations;
  /** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` */
  darkMedia: Declarations;
};

const SELECTOR_PRIMITIVES = ":root";
const SELECTOR_LIGHT = ':root,[data-theme="light"]';
const SELECTOR_DARK = ':root[data-theme="dark"],[data-theme="dark"]';
const SELECTOR_DARK_MEDIA = ':root:not([data-theme="light"])';

const normalizeSelector = (s: string) => s.replace(/\s+/g, "").replace(/'/g, '"');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseDeclarations(body: string): Declarations {
  const out: Declarations = {};
  for (const part of body.split(";")) {
    const m = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m) out[m[1]!] = m[2]!.replace(/\s+/g, " ");
  }
  return out;
}

/** 波括弧の対応を取りながら、`selector { body }` のうち中に入れ子を持たないブロックだけを集める */
function innermostBlocks(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  // セレクタの捕捉は直前の `}` から始まるので、`@import ...;` のような文が混ざる。最後の `;` より後だけを使う
  while ((m = re.exec(css))) out.push({ selector: m[1]!.split(";").pop()!.trim(), body: m[2]! });
  return out;
}

/** `@media (...) {` の中身を取り出す（波括弧の対応で終わりを探す） */
function extractAtBlock(css: string, header: RegExp): string {
  const m = header.exec(css);
  if (!m) return "";
  let depth = 0;
  const start = m.index + m[0].length;
  for (let i = start; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) return css.slice(start, i);
      depth--;
    }
  }
  throw new Error("@media ブロックが閉じていません");
}

export function parseGlobalsCss(source: string): ParsedTokens {
  const css = stripComments(source);
  const media = extractAtBlock(css, /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/);
  const outside = media ? css.replace(media, "") : css;
  const find = (text: string, selector: string): Declarations => {
    const blocks = innermostBlocks(text).filter((b) => normalizeSelector(b.selector) === selector);
    return Object.assign({}, ...blocks.map((b) => parseDeclarations(b.body)));
  };
  return {
    primitives: find(outside, SELECTOR_PRIMITIVES),
    light: find(outside, SELECTOR_LIGHT),
    dark: find(outside, SELECTOR_DARK),
    darkMedia: find(media, SELECTOR_DARK_MEDIA),
  };
}

/** var(--x) を再帰的に解決する。scopes は前から順に探す（モードのブロック → primitive） */
export function resolveValue(value: string, scopes: Declarations[], depth = 0): string {
  if (depth > 10) throw new Error(`var() の参照が深すぎます: ${value}`);
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_all, name: string, fallback?: string) => {
    for (const s of scopes) {
      if (name in s) return resolveValue(s[name]!, scopes, depth + 1);
    }
    if (fallback !== undefined) return fallback.trim();
    throw new Error(`未定義の変数: ${name}`);
  });
}

const HEX = /^#[0-9a-f]{6}$/i;

/** モードのブロックのうち、hex に解決できる宣言だけを {名前(-- なし): #rrggbb} で返す */
export function resolveColorTokens(block: Declarations, primitives: Declarations): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(block)) {
    let v: string;
    try {
      v = resolveValue(raw, [block, primitives]);
    } catch {
      continue;
    }
    if (HEX.test(v)) out[name.replace(/^--/, "")] = v.toLowerCase();
  }
  return out;
}
