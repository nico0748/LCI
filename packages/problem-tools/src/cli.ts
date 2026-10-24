import { problemsRoot } from "./paths.ts";
import { runValidate } from "./validate.ts";
import { runStats } from "./stats.ts";
import { scaffoldProblem } from "./scaffold.ts";

const USAGE = `使い方:
  lci-problems validate [--root <dir>] [--json]   G1/G1b/G3/G5/重複ゲートを実行（エラーがあれば exit 1）
  lci-problems stats    [--root <dir>]            カテゴリ×難易度×tier の件数を 500 問目標と比較
  lci-problems new <category> <slug> [--root <dir>]  雛形ディレクトリを採番して作成（例: new BE webhook-retry）

  --root を省略すると LCI_PROBLEMS_ROOT、無ければ <repo>/problems を使う。
  参照解の実行（G2 相当）は pnpm --filter @lci/problem-tools selftest。`;

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

async function main(): Promise<number> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = positional;
  const root = typeof flags.root === "string" ? flags.root : problemsRoot();
  switch (cmd) {
    case "validate":
      return runValidate(root, { json: flags.json === true });
    case "stats":
      return runStats(root);
    case "new": {
      const [category, slug] = rest;
      if (!category || !slug) {
        console.error("new には <category> <slug> が必要です");
        console.error(USAGE);
        return 2;
      }
      const { dir, id } = await scaffoldProblem(root, category, slug);
      console.log(`${id} を作成しました: ${dir}`);
      console.log("problem.md の TODO を埋め、参照解とテストを書いたら `pnpm problems:validate` と `pnpm --filter @lci/problem-tools selftest` を実行してください。");
      return 0;
    }
    default:
      console.error(USAGE);
      return cmd ? 2 : 0;
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    process.exit(1);
  },
);
