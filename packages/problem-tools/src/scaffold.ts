import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Category, Difficulty as DifficultySchema } from "@lci/core";
import { idPrefix } from "./gates.ts";

type Difficulty = z.infer<typeof DifficultySchema>;
import { readSeeds, type Seed } from "./stats.ts";

/**
 * `new <category> <slug>`: 次の id を採番し、スキーマを満たす雛形ディレクトリを書く。
 * seeds.json に同じ id の種があればタイトル・難易度・時間枠を引き継ぐ（種表と実問題の対応を保つため）。
 */

type Kind = "web" | "stdio" | "unit" | "none";

export function defaultKind(category: Category): Kind {
  switch (category) {
    case "FE":
      return "web";
    case "ALG":
    case "LOW":
      return "stdio";
    case "SYS":
      return "none";
    default:
      return "unit";
  }
}

export async function nextId(root: string, category: Category): Promise<string> {
  const prefix = idPrefix(category);
  let max = 0;
  try {
    for (const d of await fs.readdir(path.join(root, category))) {
      const m = new RegExp(`^${prefix}-(\\d{4})-`).exec(d);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {
    /* カテゴリディレクトリ未作成 */
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function yamlStr(s: string): string {
  return JSON.stringify(s);
}

function problemMd(opts: { id: string; slug: string; category: Category; kind: Kind; seed: Seed | null }): string {
  const { id, slug, category, kind, seed } = opts;
  const title = seed?.title ?? `TODO: ${slug}`;
  const difficulty: Difficulty = seed?.difficulty ?? "L2";
  const time = seed?.time_limit ?? 20;
  const style = seed?.company_style ?? (category === "FE" ? "pixiv" : category === "DATA" ? "m3" : "generic");
  const nfr = seed?.nfr ?? [];
  const langs = kind === "web" ? ["html"] : kind === "none" ? ["markdown"] : ["python", "typescript"];
  const starter =
    kind === "web"
      ? `  - path: index.html\n    language: html\n    content_ref: starter/index.html\n`
      : kind === "none"
        ? `  - path: answer.md\n    language: markdown\n    content_ref: starter/answer.md\n`
        : `  - path: ${slugMod(slug)}.py\n    language: python\n    content_ref: starter/python/${slugMod(slug)}.py\n  - path: ${slugMod(slug)}.ts\n    language: typescript\n    content_ref: starter/typescript/${slugMod(slug)}.ts\n`;
  const refs =
    kind === "web"
      ? `  html: solutions/html/index.html\n`
      : kind === "none"
        ? `  markdown: solutions/markdown/answer.md\n`
        : `  python: solutions/python/${slugMod(slug)}.py\n  typescript: solutions/typescript/${slugMod(slug)}.ts\n`;
  return `---
id: ${id}
slug: ${slug}
title: ${yamlStr(title)}
category: ${category}
tier: draft
difficulty: ${difficulty}
time_limit: ${time}
languages: [${langs.join(", ")}]
tags:
  company_style: [${style}]
  nfr: [${nfr.join(", ")}]
  security: []
  talk_focus: [requirements_clarify]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
${starter}talking_points:
  - id: tp1
    text: "TODO: 問題固有の名詞（API 名・データ構造・制約値）を含めて書く"
    weight: 2
  - id: tp2
    text: "TODO: トレードオフを 1 つ（例: TTL と LRU のどちらを先に入れるか）"
    weight: 2
  - id: tp3
    text: "TODO: 失敗モードや境界値（例: 空入力・同時実行）"
    weight: 1
requirements:
  - id: req1
    label: "TODO: 実装手段ではなく要件として書く（例: 同一入力で 2 回目は外部に問い合わせない）"
  - id: req2
    label: "TODO"
rubric_hints:
  correctness: "TODO: どのテストが通れば合格ラインか"
  explanation: "TODO: どこまで言えれば加点か"
  time_management: "TODO: 10 分時点で動いているべき骨格"
  red_flags:
    - "TODO"
  checklist:${kind === "none" ? `
    - "TODO: 言及すべき構成要素 1（例: CDN とオリジンの役割分担）"
    - "TODO: 構成要素 2"
    - "TODO: 構成要素 3"` : " []"}
reference_solutions:
${refs}source:
  origin: ${yamlStr(seed ? `seeds.json ${seed.id}` : "手書き")}
  license: internal
review:
  reviewed_by: none
  known_issues: []
---

## 問題文

TODO: 面接官が口頭で言う粒度で、80〜600 字。要件の裏にある非機能要件（${nfr.join("・") || "キャッシュ・中断・検証など"}）を候補者が自分で言い当てられる余地を残す。${seed ? `種: ${seed.one_line}` : ""}

## 制約

- TODO: 入出力形式、使ってよいライブラリ、id/セレクタの指定。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- TODO: 最初の 1 分で見たいこと。
- TODO: ヒントの出し順（1 → 2 → 3）。
- TODO: 想定される質問と答え。

## 振り返り用解説（終了後のみ表示）

1. TODO: 想定解答の方針。
2. TODO: 別解 A（別の設計選択）と、その利点と欠点。
3. TODO: 別解 B。
`;
}

function slugMod(slug: string): string {
  return slug.replace(/-/g, "_");
}

function testsJson(kind: Kind, slug: string): string | null {
  const mod = slugMod(slug);
  switch (kind) {
    case "web":
      return JSON.stringify(
        {
          kind: "web",
          preview: { tailwind: "local", viewport: { width: 800, height: 600 } },
          mockApi: {
            routes: [
              {
                match: { method: "GET", urlPattern: "^https://api\\.example\\.com/items\\?q=(.*)$" },
                latencyMs: [200, 500],
                failRate: 0,
                respond: { byQuery: { "": [] }, default: [{ id: 1, title: "TODO" }] },
              },
            ],
            unmatched: "block",
          },
          layout: [],
          scenarios: [
            {
              name: "basic-render",
              steps: [{ type: "input", value: "todo" }, { click: "button" }, { waitForRequestsSettled: 2000 }, { expectText: { selector: "body", contains: ["TODO"] } }],
            },
          ],
          rubricHints: [],
        },
        null,
        2,
      );
    case "stdio":
      return JSON.stringify(
        {
          kind: "stdio",
          limits: { timeMs: 2000, memoryMb: 256 },
          compare: { mode: "token" },
          cases: [
            { name: "sample-1", visibility: "sample", stdinFile: "tests/01.in", expectedFile: "tests/01.out" },
            { name: "hidden-1", visibility: "hidden", stdinFile: "tests/02.in", expectedFile: "tests/02.out" },
          ],
        },
        null,
        2,
      );
    case "unit":
      return JSON.stringify(
        {
          kind: "unit",
          limits: { timeMs: 3000, memoryMb: 256 },
          harness: {
            python: { files: [`tests/python/test_${mod}.py`], command: `python3 -I -m unittest discover -v -s . -p test_${mod}.py`, resultParser: "unittest-verbose" },
            typescript: { files: [`tests/typescript/${mod}.test.ts`], command: `node --experimental-strip-types --test ${mod}.test.ts`, resultParser: "tap" },
          },
          userEntry: { python: `${mod}.py`, typescript: `${mod}.ts` },
        },
        null,
        2,
      );
    case "none":
      return null;
  }
}

export async function scaffoldProblem(root: string, categoryRaw: string, slug: string): Promise<{ dir: string; id: string }> {
  const category = Category.parse(categoryRaw.toUpperCase());
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`slug は小文字英数字とハイフンのみ: ${slug}`);
  const id = await nextId(root, category);
  const kind = defaultKind(category);
  const seeds = await readSeeds(root).catch(() => null);
  const seed = seeds?.find((s) => s.id === id) ?? null;
  const dir = path.join(root, category, `${id}-${slug}`);
  // 親（カテゴリ）は作ってよいが、問題ディレクトリ自体が既にあれば上書きせず失敗させる
  await fs.mkdir(path.dirname(dir), { recursive: true });
  await fs.mkdir(dir, { recursive: false });
  const mod = slugMod(slug);
  const files: Record<string, string> = { "problem.md": problemMd({ id, slug, category, kind, seed }) };
  const tj = testsJson(kind, slug);
  if (tj) files["tests.json"] = tj + "\n";
  if (kind === "web") {
    files["starter/index.html"] = `<!doctype html>\n<html lang="ja">\n<head>\n  <meta charset="utf-8" />\n  <title>${slug}</title>\n</head>\n<body class="p-4">\n  <!-- TODO -->\n  <script>\n    // TODO\n  </script>\n</body>\n</html>\n`;
    files["solutions/html/index.html"] = files["starter/index.html"]!.replace("<!-- TODO -->", "<!-- TODO: 参照解 -->");
  } else if (kind === "none") {
    files["starter/answer.md"] = `# ${slug}\n\n<!-- 図（Mermaid 可）＋箇条書きで設計をスケッチする -->\n`;
    files["solutions/markdown/answer.md"] = `# ${slug} 参照回答\n\nTODO\n`;
  } else {
    files[`starter/python/${mod}.py`] = `# TODO: 問題文の関数を実装する\n\n\ndef solve():\n    raise NotImplementedError\n`;
    files[`starter/typescript/${mod}.ts`] = `// TODO: 問題文の関数を実装する\n\nexport function solve(): never {\n  throw new Error("not implemented");\n}\n`;
    files[`solutions/python/${mod}.py`] = `# TODO: 参照解\n\n\ndef solve():\n    raise NotImplementedError\n`;
    files[`solutions/typescript/${mod}.ts`] = `// TODO: 参照解\n\nexport function solve(): never {\n  throw new Error("not implemented");\n}\n`;
    if (kind === "unit") {
      files[`tests/python/test_${mod}.py`] = `import unittest\n\nfrom ${mod} import solve\n\n\nclass Test(unittest.TestCase):\n    def test_todo(self):\n        self.assertIsNotNone(solve)\n\n\nif __name__ == "__main__":\n    unittest.main()\n`;
      files[`tests/typescript/${mod}.test.ts`] = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { solve } from "./${mod}.ts";\n\ntest("todo", () => {\n  assert.ok(solve);\n});\n`;
    } else {
      files["tests/01.in"] = "TODO\n";
      files["tests/01.out"] = "TODO\n";
      files["tests/02.in"] = "TODO\n";
      files["tests/02.out"] = "TODO\n";
    }
  }
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
  }
  return { dir, id };
}
