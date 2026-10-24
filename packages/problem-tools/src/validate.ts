import { validateProblems, type Issue, type ValidationResult } from "./gates.ts";
import { renderTable } from "./report.ts";

export function formatValidation(result: ValidationResult): string {
  const rows = result.entries.map((e) => {
    const errs = e.issues.filter((i) => i.level === "error").length;
    const warns = e.issues.filter((i) => i.level === "warn").length;
    const m = e.problem?.meta;
    return [
      m?.id ?? "-",
      m?.tier ?? "-",
      m?.difficulty ?? "-",
      m ? String(m.time_limit) : "-",
      e.problem?.tests.kind ?? "-",
      m ? m.languages.join(",") : "-",
      errs ? String(errs) : "",
      warns ? String(warns) : "",
      errs ? "NG" : "OK",
      e.dir,
    ];
  });
  const out: string[] = [];
  out.push(`問題バンク: ${result.root}`);
  out.push(renderTable(["id", "tier", "lv", "min", "kind", "languages", "err", "warn", "判定", "dir"], rows, ["left", "left", "left", "right", "left", "left", "right", "right", "left", "left"]));
  const issues: Issue[] = result.entries.flatMap((e) => e.issues);
  if (issues.length) {
    out.push("");
    for (const i of issues) out.push(`[${i.level === "error" ? "ERROR" : "warn "}] ${i.gate.padEnd(5)} ${i.problem}: ${i.message}`);
  }
  out.push("");
  out.push(`${result.entries.length} 問 / エラー ${result.errors} / 警告 ${result.warnings}`);
  return out.join("\n");
}

/** CLI 本体。エラーがあれば 1 を返す */
export async function runValidate(root: string, opts: { json?: boolean } = {}): Promise<number> {
  const result = await validateProblems(root);
  if (opts.json) {
    const payload = {
      root: result.root,
      errors: result.errors,
      warnings: result.warnings,
      problems: result.entries.map((e) => ({ dir: e.dir, id: e.problem?.meta.id ?? null, tier: e.problem?.meta.tier ?? null, issues: e.issues })),
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatValidation(result));
  }
  return result.errors > 0 ? 1 : 0;
}
