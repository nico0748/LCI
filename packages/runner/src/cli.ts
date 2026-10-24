import path from "node:path";
import { createRunner } from "./runner.ts";
import { RUNNER_LANGUAGES, isRunnerLanguage, type RunnerLanguage } from "./types.ts";

/**
 * 開発者向け CLI（ルートの package.json から呼ぶ）:
 *   pnpm runner:status            Docker／イメージ／コンテナの状態
 *   pnpm runner:warm [lang...]    イメージを docker/ からビルドし、ウォームコンテナを起動
 *   pnpm runner:warm --rebuild    既存イメージも作り直す
 *   pnpm runner:bench [n]         各言語の hello world を n 回実行して p50/p95 を出す（02 実測タスク 1, 2）
 * LCI_RUNNER=fake で docker 無しのホスト実行にもできる。
 */

const SAMPLES: Record<RunnerLanguage, { path: string; content: string }> = {
  c: { path: "main.c", content: '#include <stdio.h>\nint main(void){char s[64]; if(scanf("%63s", s)==1) printf("%s\\n", s); return 0;}\n' },
  rust: { path: "main.rs", content: "use std::io::Read;\nfn main(){ let mut s=String::new(); std::io::stdin().read_to_string(&mut s).unwrap(); print!(\"{}\", s); }\n" },
  python: { path: "main.py", content: "print(input())\n" },
  go: { path: "main.go", content: 'package main\nimport "fmt"\nfunc main(){ var s string; fmt.Scan(&s); fmt.Println(s) }\n' },
  typescript: { path: "main.ts", content: 'import { readFileSync } from "node:fs";\nconst s: string = readFileSync(0, "utf8");\nprocess.stdout.write(s);\n' },
  php: { path: "main.php", content: "<?php\necho trim(fgets(STDIN)), \"\\n\";\n" },
};

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] ?? 0;
}

async function main() {
  const [cmd = "status", ...rest] = process.argv.slice(2);
  const repoRoot = process.env.LCI_ROOT ?? path.resolve(import.meta.dirname, "../../..");
  const runner = createRunner(process.env.LCI_RUNNER === "fake" ? "fake" : "docker", { dockerDir: path.join(repoRoot, "docker") });
  const langs = rest.filter(isRunnerLanguage);
  const selected = langs.length ? langs : [...RUNNER_LANGUAGES];

  if (cmd === "status") {
    console.log(JSON.stringify(await runner.status(), null, 2));
    return;
  }
  if (cmd === "warm") {
    let failed = false;
    for await (const p of runner.warm({ languages: selected, rebuild: rest.includes("--rebuild") })) {
      if (p.line !== undefined) {
        if (rest.includes("--verbose")) console.log(`  [${p.lang}] ${p.line}`);
        continue;
      }
      if (p.phase === "error") failed = true;
      console.log(`[${p.lang}] ${p.phase}${p.message ? ": " + p.message : ""}`);
    }
    process.exitCode = failed ? 1 : 0;
    return;
  }
  if (cmd === "bench") {
    const n = Number(rest.find((x) => /^\d+$/.test(x)) ?? 10);
    for (const lang of selected) {
      const times: number[] = [];
      let verdict = "";
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        const r = await runner.run({ language: lang, files: [SAMPLES[lang]], stdin: "hello\n" });
        times.push(performance.now() - t0);
        verdict = r.verdict;
        if (r.verdict !== "AC") {
          console.log(`[${lang}] ${r.verdict}: ${(r.stderr ?? r.compile?.stderr ?? "").slice(0, 300)}`);
          break;
        }
      }
      console.log(`[${lang}] ${verdict} n=${times.length} first=${times[0]?.toFixed(0)}ms p50=${pct(times, 0.5).toFixed(0)}ms p95=${pct(times, 0.95).toFixed(0)}ms`);
    }
    return;
  }
  console.error(`unknown command: ${cmd}（status | warm | bench）`);
  process.exitCode = 2;
}

await main();
