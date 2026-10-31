/**
 * 読み（音声合成に渡すテキスト）の生成（02 §7.3、01 §8 V-06、00 D11）。
 * 優先順: say.reading（Claude が書いたかな）→ 台本の glossary → 組み込み辞書 → そのまま。
 * 記号や英字の識別子は日本語音声が不安定に読むので、ここでカナに直す。直しきれないものは lint で警告する。
 */

export interface GlossaryEntry {
  term: string;
  reading: string;
}

/** 計算量・数式など、語より先に当てるパターン */
const PATTERNS: [RegExp, string | ((...m: string[]) => string)][] = [
  [/O\(\s*1\s*\)/g, "オーダー いち"],
  [/O\(\s*N\s*log\s*N\s*\)/gi, "オーダー エヌ ログ エヌ"],
  [/O\(\s*log\s*N\s*\)/gi, "オーダー ログ エヌ"],
  [/O\(\s*N\s*(?:\^\s*2|²)\s*\)/gi, "オーダー エヌ にじょう"],
  [/O\(\s*N\s*(?:\^\s*3|³)\s*\)/gi, "オーダー エヌ さんじょう"],
  [/O\(\s*N\s*\+\s*M\s*\)/gi, "オーダー エヌ プラス エム"],
  [/O\(\s*N\s*M\s*\)/gi, "オーダー エヌ エム"],
  [/O\(\s*N\s*\)/gi, "オーダー エヌ"],
  [/O\(\s*K\s*\)/g, "オーダー ケー"],
  [/(\d+)\s*[×x*]\s*10\s*\^\s*(\d+)/g, (_m, a, e) => `${a} かける 10 の ${e} じょう`],
  [/10\s*\^\s*(\d+)/g, (_m, e) => `10 の ${e} じょう`],
  [/(\d+)\s*\^\s*(\d+)/g, (_m, a, e) => `${a} の ${e} じょう`],
  [/([A-Za-z])_([A-Za-z0-9])\b/g, (_m, a, b) => `${a} ${b}`],
  [/<=|≤/g, " 以下 "],
  [/>=|≥/g, " 以上 "],
  [/!=|≠/g, " ノットイコール "],
  [/==/g, " イコールイコール "],
  [/->|→/g, " から "],
  [/=>/g, " アロー "],
  [/(^|[\s(（、])-(\d)/g, (_m, p, d) => `${p}マイナス ${d}`],
  [/\s[-−]\s/g, " マイナス "],
  [/\s\+\s/g, " プラス "],
  [/\s\*\s/g, " かける "],
  [/\s\/\s/g, " わる "],
  [/\s%\s/g, " あまり "],
  // ここまでで ==・<=・>=・!=・=> は置き換え済みなので、残る = は単独の等号（N=2×10^5 など）
  [/\s*=\s*/g, " イコール "],
  [/\s<\s/g, " より小さい "],
  [/\s>\s/g, " より大きい "],
];

/** 英字の語（大文字小文字を区別する辞書 → 区別しない辞書の順） */
const WORDS_CS: Record<string, string> = {
  N: "エヌ",
  K: "ケー",
  M: "エム",
  A: "エー",
  B: "ビー",
  Q: "キュー",
  T: "ティー",
  None: "ナン",
  True: "トゥルー",
  False: "フォルス",
  Map: "マップ",
  Set: "セット",
};
const WORDS: Record<string, string> = {
  i: "アイ",
  j: "ジェイ",
  k: "ケー",
  x: "エックス",
  y: "ワイ",
  n: "エヌ",
  m: "エム",
  a: "エー",
  b: "ビー",
  c: "シー",
  s: "エス",
  t: "ティー",
  dict: "ディクト",
  list: "リスト",
  tuple: "タプル",
  set: "セット",
  map: "マップ",
  hashmap: "ハッシュマップ",
  hash: "ハッシュ",
  seen: "シーン",
  get: "ゲット",
  key: "キー",
  value: "バリュー",
  int: "イント",
  str: "ストリング",
  len: "レン",
  range: "レンジ",
  enumerate: "イニューメレイト",
  print: "プリント",
  return: "リターン",
  for: "フォー",
  while: "ホワイル",
  if: "イフ",
  else: "エルス",
  in: "イン",
  not: "ノット",
  and: "アンド",
  or: "オア",
  null: "ヌル",
  undefined: "アンディファインド",
  true: "トゥルー",
  false: "フォルス",
  main: "メイン",
  input: "インプット",
  output: "アウトプット",
  stdin: "エスティーディーイン",
  stdout: "エスティーディーアウト",
  sys: "シス",
  split: "スプリット",
  append: "アペンド",
  push: "プッシュ",
  pop: "ポップ",
  sort: "ソート",
  sorted: "ソーテッド",
  heap: "ヒープ",
  queue: "キュー",
  deque: "デック",
  stack: "スタック",
  array: "アレイ",
  vector: "ベクター",
  string: "ストリング",
  number: "ナンバー",
  const: "コンスト",
  let: "レット",
  function: "ファンクション",
  def: "デフ",
  class: "クラス",
  async: "アシンク",
  await: "アウェイト",
  fetch: "フェッチ",
  promise: "プロミス",
  json: "ジェイソン",
  api: "エーピーアイ",
  url: "ユーアールエル",
  http: "エイチティーティーピー",
  ttl: "ティーティーエル",
  lru: "エルアールユー",
  cache: "キャッシュ",
  abortcontroller: "アボートコントローラー",
  debounce: "デバウンス",
  throttle: "スロットル",
  python: "パイソン",
  typescript: "タイプスクリプト",
  javascript: "ジャバスクリプト",
  go: "ゴー",
  rust: "ラスト",
  php: "ピーエイチピー",
  sql: "エスキューエル",
  bfs: "ビーエフエス",
  dfs: "ディーエフエス",
  dp: "ディーピー",
  ac: "エーシー",
  wa: "ダブリューエー",
  tle: "ティーエルイー",
  re: "アールイー",
  log: "ログ",
  max: "マックス",
  min: "ミン",
  sum: "サム",
  count: "カウント",
  index: "インデックス",
  id: "アイディー",
  ok: "オーケー",
  int32: "イント サンジュウニ",
  int64: "イント ロクジュウヨン",
};

/** say に渡す前の無害化（02 §10: 埋め込みコマンド・制御文字・長さ） */
export function sanitizeForSay(s: string, max = 640): string {
  return s
    .replace(/\[\[|\]\]/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 字幕（text）から読みを作る。reading があればそれを使う */
export function buildReading(text: string, reading: string | undefined, glossary: GlossaryEntry[] = []): string {
  if (reading) return sanitizeForSay(reading);
  let s = text.replace(/`([^`]*)`/g, " $1 ");
  // glossary は長い語から当てる（短い語が長い語の一部を食わないように）
  for (const g of [...glossary].sort((a, b) => b.term.length - a.term.length)) {
    const re = /^[A-Za-z0-9_]+$/.test(g.term) ? new RegExp(`(?<![A-Za-z0-9_])${escapeRe(g.term)}(?![A-Za-z0-9_])`, "g") : new RegExp(escapeRe(g.term), "g");
    s = s.replace(re, ` ${g.reading} `);
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep as string);
  // 識別子: a.b → a ドット b、a_b → a b、括弧は落とす
  s = s.replace(/([A-Za-z0-9])\.([A-Za-z])/g, "$1 ドット $2");
  s = s.replace(/[A-Za-z][A-Za-z0-9]*/g, (w) => WORDS_CS[w] ?? WORDS[w.toLowerCase()] ?? w);
  s = s.replace(/[()[\]{}]/g, " ").replace(/_/g, " ");
  return sanitizeForSay(s);
}

/** 読みに英字・記号が残っているか（音声が不安定に読む可能性があるもの） */
export function unreadableParts(reading: string): string[] {
  const out = new Set<string>();
  for (const m of reading.match(/[A-Za-z][A-Za-z0-9]*|[\^<>=|&~$#@\\]+/g) ?? []) out.add(m);
  return [...out];
}

/** 字幕に英字・記号（=読みを書くべきもの）が含まれるか */
export function needsReading(text: string): boolean {
  return /[A-Za-z^<>=_]/.test(text.replace(/[`]/g, ""));
}
