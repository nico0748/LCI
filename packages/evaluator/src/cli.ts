import path from "node:path";
import { promises as fs } from "node:fs";
import { SessionStore } from "@lci/core";
import { finalizeSession } from "./finalize.ts";
import { evaluateSession, NoApiKeyError } from "./evaluate.ts";

/**
 * Mac でのデバッグ用 CLI。
 *   pnpm --filter @lci/evaluator cli finalize <session_id> [--force] [--skip-stt] [--cam-frames]
 *   pnpm --filter @lci/evaluator cli evaluate <session_id> [--dry-run] [--model <id>] [--no-frames] [--out <file>]
 * データ・問題の場所は LCI_DATA_ROOT / LCI_PROBLEMS_ROOT（既定はリポジトリ直下の data/ と problems/）。
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

// Web アプリと同じ設定で動かすため apps/web/.env.local を読む（既に設定済みの環境変数は上書きしない）
for (const f of [path.join(REPO_ROOT, "apps/web/.env.local"), path.join(REPO_ROOT, ".env.local")]) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* 無ければ無視 */
  }
}
const DATA_ROOT = process.env.LCI_DATA_ROOT ?? path.join(REPO_ROOT, "data");
const PROBLEMS_ROOT = process.env.LCI_PROBLEMS_ROOT ?? path.join(REPO_ROOT, "problems");

function usage(): never {
  console.error(`usage:
  cli finalize <session_id> [--force] [--skip-stt] [--cam-frames]
  cli evaluate <session_id> [--dry-run] [--model <id>] [--no-frames] [--out <file>]
  cli list`);
  process.exit(2);
}

async function main() {
  const [cmd, id, ...rest] = process.argv.slice(2);
  const flag = (f: string) => rest.includes(f);
  const opt = (f: string) => {
    const i = rest.indexOf(f);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const store = new SessionStore(DATA_ROOT);
  const log = (m: string) => console.error(m);

  if (cmd === "list") {
    for (const s of await store.list()) console.log(`${s.session_id}\t${s.status}\t${s.problem.id}\t${s.stt?.status ?? "-"}`);
    return;
  }
  if (!cmd || !id) usage();

  if (cmd === "finalize") {
    const s = await finalizeSession(store, id, {
      problemsRoot: PROBLEMS_ROOT,
      force: flag("--force"),
      skipTranscribe: flag("--skip-stt"),
      allowCamFrames: flag("--cam-frames"),
      log,
    });
    console.log(JSON.stringify({ status: s.status, stt: s.stt, finalize: s.finalize, warnings: s.warnings, recorders: s.recorders }, null, 2));
    return;
  }
  if (cmd === "evaluate") {
    const out = opt("--out");
    try {
      const r = await evaluateSession({
        store,
        problemsRoot: PROBLEMS_ROOT,
        sessionId: id,
        model: opt("--model"),
        includeFrames: !flag("--no-frames"),
        dryRun: flag("--dry-run"),
        log,
      });
      if ("dry_run" in r) {
        // base64 画像は長すぎるので省いて表示する
        const printable = {
          ...r,
          messages: undefined,
          schema: out ? r.schema : "(--out で全体を保存)",
        };
        if (out) await fs.writeFile(out, JSON.stringify(r, null, 2));
        console.log(JSON.stringify(printable, null, 2).slice(0, out ? 4000 : 200_000));
        console.error(`estimated_tokens=${r.estimated_tokens} frames=${r.input_digest.frames} prompt_hash=${r.prompt_hash}`);
      } else {
        if (out) await fs.writeFile(out, JSON.stringify(r, null, 2));
        console.log(JSON.stringify(r, null, 2));
      }
    } catch (e) {
      if (e instanceof NoApiKeyError) {
        console.error(e.message);
        process.exit(3);
      }
      throw e;
    }
    return;
  }
  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
