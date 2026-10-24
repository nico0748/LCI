import type { UnitParserId } from "./languages.ts";

/**
 * ユニットテスト型（02 FR-X-02-2/3）の結果パーサ。
 * どの言語でも「テスト名・pass/fail・メッセージ」の配列に落とす。
 */
export interface UnitTestResult {
  name: string;
  ok: boolean;
  message?: string;
  timeMs?: number;
}

/**
 * TAP v13（node:test の --test-reporter=tap、および C/PHP 用 lci_assert）。
 * node:test は describe/it を入れ子で出す。子の結果行は親の結果行より前に来るので、
 * 「直前の結果行がより深いインデント」なら親（集約行）とみなして捨て、葉だけを残す。
 */
export function parseTap(text: string): UnitTestResult[] {
  const lines = text.split("\n");
  const results: { indent: number; r: UnitTestResult; i: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(not ok|ok)\b\s*(\d+)?\s*(?:-\s*)?(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const indent = m[1]!.length;
    const ok = m[2] === "ok";
    let name = (m[4] ?? "").trim();
    // `# SKIP` / `# TODO` ディレクティブは名前から外す
    name = name.replace(/\s*#\s*(SKIP|TODO).*$/i, "").trim() || `test ${m[3] ?? results.length + 1}`;
    let message: string | undefined;
    let timeMs: number | undefined;
    if (lines[i + 1]?.trim() === "---") {
      // YAML ブロックから error / duration_ms を拾う
      let k = i + 2;
      while (k < lines.length && lines[k]!.trim() !== "...") {
        const l = lines[k]!;
        const d = /^\s*duration_ms:\s*([\d.]+)/.exec(l);
        if (d) timeMs = Number(d[1]);
        const e = /^\s*error:\s*(.*)$/.exec(l);
        if (e && message === undefined) {
          const v = e[1]!.trim();
          if (v === "|-" || v === "|" || v === ">-" || v === ">") {
            const buf: string[] = [];
            const base = (/^(\s*)/.exec(l)?.[1] ?? "").length;
            let j = k + 1;
            while (j < lines.length) {
              const ind = (/^(\s*)/.exec(lines[j]!)?.[1] ?? "").length;
              if (lines[j]!.trim() !== "" && ind <= base) break;
              buf.push(lines[j]!.slice(base + 2));
              j++;
            }
            message = buf.join("\n").trim();
          } else {
            message = v.replace(/^'(.*)'$/, "$1");
          }
        }
        // C/PHP の lci_assert は YAML を使わず `# ` コメント行にメッセージを置く
        k++;
      }
    } else if (!ok) {
      const buf: string[] = [];
      let k = i + 1;
      while (k < lines.length && /^\s*#\s?/.test(lines[k]!) && !/^\s*# Subtest/.test(lines[k]!)) {
        buf.push(lines[k]!.replace(/^\s*#\s?/, ""));
        k++;
      }
      if (buf.length) message = buf.join("\n").trim();
    }
    results.push({ indent, r: { name, ok, message, timeMs }, i });
  }
  const leaves: UnitTestResult[] = [];
  for (let idx = 0; idx < results.length; idx++) {
    const cur = results[idx]!;
    const prev = results[idx - 1];
    const isParent = prev !== undefined && prev.indent > cur.indent;
    if (isParent) continue;
    leaves.push(cur.r);
  }
  return leaves;
}

/** `go test -json`: 1 行 1 JSON。Test 付きの pass/fail を集め、output からメッセージを拾う */
export function parseGoTestJson(text: string): UnitTestResult[] {
  const outputs = new Map<string, string[]>();
  const order: string[] = [];
  const status = new Map<string, { ok: boolean; timeMs?: number }>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    let j: { Action?: string; Test?: string; Output?: string; Elapsed?: number };
    try {
      j = JSON.parse(t);
    } catch {
      continue;
    }
    if (!j.Test) continue;
    if (!outputs.has(j.Test)) {
      outputs.set(j.Test, []);
      order.push(j.Test);
    }
    if (j.Action === "output" && j.Output) {
      // `=== RUN` / `--- PASS` 行は捨て、t.Errorf 等の本文だけ残す
      if (!/^\s*(=== |--- )/.test(j.Output)) outputs.get(j.Test)!.push(j.Output.replace(/\n$/, "").trim());
    } else if (j.Action === "pass" || j.Action === "fail") {
      status.set(j.Test, { ok: j.Action === "pass", timeMs: j.Elapsed !== undefined ? Math.round(j.Elapsed * 1000) : undefined });
    } else if (j.Action === "skip") {
      status.set(j.Test, { ok: true, timeMs: 0 });
    }
  }
  return order
    .filter((n) => status.has(n))
    .map((n) => {
      const s = status.get(n)!;
      const msg = outputs.get(n)!.filter(Boolean).join("\n");
      return { name: n, ok: s.ok, message: s.ok ? undefined : msg || undefined, timeMs: s.timeMs };
    });
}

/**
 * python -m unittest -v（stderr）:
 *   test_bad (__main__.T.test_bad) ... FAIL
 *   ======================================================================
 *   FAIL: test_bad (__main__.T.test_bad)
 *   ----------------------------------------------------------------------
 *   Traceback ...
 *   AssertionError: 1 != 2 : nope
 */
export function parseUnittestVerbose(text: string): UnitTestResult[] {
  const results: UnitTestResult[] = [];
  const byName = new Map<string, UnitTestResult>();
  for (const line of text.split("\n")) {
    const m = /^(\S+) \((\S+)\)(?: .*?)? \.\.\. (ok|FAIL|ERROR|skipped.*|expected failure|unexpected success)\s*$/.exec(line);
    if (!m) continue;
    const name = m[1]!;
    const st = m[3]!;
    const r: UnitTestResult = { name, ok: st === "ok" || st.startsWith("skipped") || st === "expected failure" };
    results.push(r);
    byName.set(name, r);
  }
  // 詳細ブロック: 区切り線に挟まれた `FAIL: name (...)` と末尾の例外行
  const blocks = text.split(/^={70}$/m).slice(1);
  for (const b of blocks) {
    const h = /^(FAIL|ERROR): (\S+) \(/m.exec(b);
    if (!h) continue;
    const r = byName.get(h[2]!);
    if (!r) continue;
    const body = b.split(/^-{70}$/m)[1] ?? "";
    const tail = body
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l && !/^\s/.test(l) && !/^Traceback/.test(l) && !/^-{10,}|^Ran \d+ tests|^FAILED|^OK/.test(l));
    const last = tail[tail.length - 1];
    if (last) r.message = last;
  }
  return results;
}

/**
 * rustc --test の出力:
 *   test ok_one ... ok
 *   test bad_one ... FAILED
 *   ---- bad_one stdout ----
 *   thread 'bad_one' panicked at rt.rs:2:24:
 *   assertion `left == right` failed: nope
 */
export function parseRustTest(text: string): UnitTestResult[] {
  const results: UnitTestResult[] = [];
  const byName = new Map<string, UnitTestResult>();
  for (const line of text.split("\n")) {
    const m = /^test (\S+) \.\.\. (ok|FAILED|ignored|FAILED \(.*\))\s*$/.exec(line);
    if (!m) continue;
    const r: UnitTestResult = { name: m[1]!, ok: m[2] === "ok" || m[2] === "ignored" };
    results.push(r);
    byName.set(r.name, r);
  }
  // `---- name stdout ----` ブロックを次のブロック見出しか "failures:" 行まで切り出す
  const chunks = text.split(/^---- (\S+) stdout ----$/m);
  for (let i = 1; i + 1 < chunks.length; i += 2) {
    const r = byName.get(chunks[i]!);
    if (!r) continue;
    const body = chunks[i + 1]!.split(/^failures:$/m)[0]!;
    const p = /panicked at (.+?):\n([\s\S]*?)(?:\nstack backtrace:|\nnote: run with|\n\n|$)/.exec(body);
    r.message = p ? `${p[2]!.trim()} (${p[1]})` : body.trim().split("\n")[0];
  }
  return results;
}

export function parseUnitResults(parser: UnitParserId, stdout: string, stderr: string): UnitTestResult[] {
  switch (parser) {
    case "tap":
      return parseTap(stdout + "\n" + stderr);
    case "go-test-json":
      return parseGoTestJson(stdout);
    case "unittest-verbose":
      return parseUnittestVerbose(stderr + "\n" + stdout);
    case "rust-test":
      return parseRustTest(stdout + "\n" + stderr);
  }
}

export function isUnitParserId(x: string | undefined): x is UnitParserId {
  return x === "tap" || x === "go-test-json" || x === "unittest-verbose" || x === "rust-test";
}
