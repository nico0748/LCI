import type { RunnerLanguage } from "./types.ts";

/**
 * 言語別の固定設定。docker / fake の両バックエンドで同じコマンド列を使う
 * （verdict の再現性のため、ローカル実行でもコンパイルフラグを揃える）。
 */

/** イメージ名。typescript だけは node イメージを共有する */
export const IMAGE_SHORT: Record<RunnerLanguage, string> = {
  c: "c",
  rust: "rust",
  python: "python",
  go: "go",
  typescript: "node",
  php: "php",
};

export const IMAGE_TAG = "v1";

export function imageName(lang: RunnerLanguage): string {
  return `lci/${IMAGE_SHORT[lang]}:${IMAGE_TAG}`;
}

export function containerName(lang: RunnerLanguage): string {
  return `lci-${IMAGE_SHORT[lang]}`;
}

/** 02 §スキーマ共通ルール: 言語別係数（Python ×3、PHP ×3、TS ×2） */
export const TIME_MULTIPLIER: Record<RunnerLanguage, number> = {
  c: 1,
  rust: 1,
  go: 1,
  python: 3,
  php: 3,
  typescript: 2,
};

export const DEFAULT_ENTRY: Record<RunnerLanguage, string> = {
  c: "main.c",
  rust: "main.rs",
  python: "main.py",
  go: "main.go",
  typescript: "main.ts",
  php: "main.php",
};

export const EXTENSIONS: Record<RunnerLanguage, string[]> = {
  c: [".c"],
  rust: [".rs"],
  python: [".py"],
  go: [".go"],
  typescript: [".ts", ".mts"],
  php: [".php"],
};

/** 既定の制限（02 FR-X-01-3）。問題側 limits → ケース limits の順で上書きされる */
export const DEFAULT_LIMITS = {
  timeMs: 2000,
  wallMs: 5000,
  memoryMb: 256,
  outputKb: 1024,
  compileMs: 10000,
  compileOutputKb: 256,
} as const;

/**
 * コンパイル段階の argv。null はコンパイル不要。
 * PHP は `php -l` を構文チェックとして使い、CE を実行前に検出する。
 */
export function compileCommand(lang: RunnerLanguage, entry: string): string[] | null {
  switch (lang) {
    case "c":
      // -lm は常時付与（02 言語別の決定）。警告も診断に載せたいので -Wall
      return ["gcc", "-O2", "-std=c17", "-Wall", "-o", "main", entry, "-lm"];
    case "rust":
      return ["rustc", "-O", "--edition", "2021", "--error-format=json", "-o", "main", entry];
    case "go":
      return ["go", "build", "-o", "main", entry];
    case "php":
      return ["php", "-l", entry];
    case "python":
    case "typescript":
      return null;
  }
}

/**
 * 実行段階の argv。
 * mode は Run（候補者が手元で試す 1 回の実行）か judge（採点）か。違いは Python の -u だけで、
 * Run では TLE で打ち切ったときも途中までの print を残したいので -u（バッファしない）を付け、
 * judge では付けない。-u のまま 1 行ずつ print すると、パイプ越しの書き込みが行ごとの write になって
 * 2×10^5 行で 10 倍遅くなり（05_cp_problems.md §4.3 の実測）、正しい解答が本番より不利に TLE しうるため。
 */
export function runCommand(lang: RunnerLanguage, entry: string, memoryMb: number, mode: "run" | "judge" = "run"): string[] {
  switch (lang) {
    case "c":
    case "rust":
    case "go":
      return ["./main"];
    case "python":
      // -I: cwd をインポートパスに入れない（作業ディレクトリ経由の汚染防止）。-u: 出力をバッファしない（Run のみ）
      return mode === "run" ? ["python3", "-I", "-u", entry] : ["python3", "-I", entry];
    case "typescript":
      // Node 22.6+ の strip-types。ヒープ上限で MLE を "heap out of memory" として検出する
      return ["node", "--experimental-strip-types", "--no-warnings", `--max-old-space-size=${memoryMb}`, entry];
    case "php":
      // log_errors=0 で stderr への二重出力を防ぐ
      return ["php", "-d", "display_errors=stderr", "-d", "log_errors=0", "-d", `memory_limit=${memoryMb}M`, entry];
  }
}

/** ulimit -v を掛けてよい言語。Go/Node はランタイムが巨大な仮想領域を予約するので cgroup に任せる */
export function usesVirtualMemLimit(lang: RunnerLanguage): boolean {
  return lang === "c" || lang === "rust" || lang === "python" || lang === "php";
}

export type UnitParserId = "tap" | "go-test-json" | "unittest-verbose" | "rust-test";

/** 02 FR-X-02-3: 言語別既定ハーネス。C/PHP は自前 assert が TAP を吐く */
export const DEFAULT_UNIT_PARSER: Record<RunnerLanguage, UnitParserId> = {
  c: "tap",
  php: "tap",
  typescript: "tap",
  go: "go-test-json",
  python: "unittest-verbose",
  rust: "rust-test",
};

/** 入力ファイル名の安全確認（コンテナ内の tar 展開に渡すため） */
export const SAFE_PATH = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;

export function isSafePath(p: string): boolean {
  return SAFE_PATH.test(p) && p.length <= 100 && !p.split("/").some((seg) => seg === "." || seg === "..");
}

/** entry 未指定時の推定: 1 ファイルならそれ、既定名があればそれ、なければ拡張子一致の先頭 */
export function pickEntry(lang: RunnerLanguage, files: { path: string }[], entry?: string): string | undefined {
  if (entry && files.some((f) => f.path === entry)) return entry;
  if (files.length === 1) return files[0]!.path;
  const def = files.find((f) => f.path === DEFAULT_ENTRY[lang]);
  if (def) return def.path;
  const byExt = files.find((f) => EXTENSIONS[lang].some((e) => f.path.endsWith(e)));
  return byExt?.path ?? files[0]?.path;
}
