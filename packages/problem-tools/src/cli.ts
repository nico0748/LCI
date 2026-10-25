import { Category } from "@lci/core";
import { problemsRoot } from "./paths.ts";
import { runValidate } from "./validate.ts";
import { runStats } from "./stats.ts";
import { scaffoldProblem } from "./scaffold.ts";

const USAGE = `使い方:
  lci-problems validate [--root <dir>] [--json]   G1/G1b/G3/G5/重複/CP ゲートを実行（エラーがあれば exit 1）
  lci-problems stats    [--root <dir>]            カテゴリ×難易度×tier の件数を 500 問目標と比較
  lci-problems new <category> <slug> [--root <dir>]  雛形ディレクトリを採番して作成（例: new BE webhook-retry）
  lci-problems new [<category>] [<slug>] --id <id>   採番せず id を指定して作成。カテゴリは id から、slug は種から決まれば省略可
                                                     （例: new --id cp-0003 → CP/cp-0003-bookshelf-min-width）

  CP の雛形は stdio・6 言語（c/rust/python/go/typescript/php）・共通 starter・gen/gen.py（決定的 PRNG、--check）・gen/brute.py。
  --root を省略すると LCI_PROBLEMS_ROOT、無ければ <repo>/problems を使う。
  参照解の実行（G2 相当）は pnpm problems:selftest [--only <id,...>] [--naive] [--timing]。`;

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
      let [category, slug] = rest as (string | undefined)[];
      const id = typeof flags.id === "string" ? flags.id : undefined;
      // `new --id cp-0003 [slug]` のようにカテゴリを省いたら id の接頭辞から決める
      if (id && category && !Category.safeParse(category.toUpperCase()).success) {
        slug = category;
        category = undefined;
      }
      category ??= id ? id.split("-")[0]!.toUpperCase() : undefined;
      if (flags.id === true) {
        console.error("--id には値が必要です（例: --id cp-0003）");
        return 2;
      }
      // slug を省略できるのは --id で種（seeds.json）の固定枠を指したときだけ（無ければ scaffoldProblem が理由付きで失敗する）
      if (!category || (!slug && !id)) {
        console.error("new には <category> <slug>（または <category> --id <id>）が必要です");
        console.error(USAGE);
        return 2;
      }
      const made = await scaffoldProblem(root, category, slug, { id });
      console.log(`${made.id} を作成しました: ${made.dir}`);
      if (made.seed) console.log(`種: ${made.seed.title}（${made.seed.difficulty} / ${made.seed.time_limit} 分 / ${made.seed.company_style}）`);
      if (made.id.startsWith("cp-")) {
        console.log(
          [
            "次の順で埋めてください（docs/requirements/05_cp_problems.md §4・§7）:",
            "  1. problem.md の問題文・制約・入出力例、gen/gen.py の solve / random_small / cases と gen/brute.py",
            `  2. python3 ${made.dir}/gen/gen.py で tests/ と tests.json を生成し、--check で再生成一致と stress を確認`,
            "  3. solutions/<lang>/main.* の参照解 6 言語（TLE の罠がある問題は gen/naive.py も）",
            `  4. pnpm problems:validate と pnpm problems:selftest --only ${made.id} [--naive] [--timing]`,
          ].join("\n"),
        );
      } else {
        console.log("problem.md の TODO を埋め、参照解とテストを書いたら `pnpm problems:validate` と `pnpm problems:selftest --only " + made.id + "` を実行してください。");
      }
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
