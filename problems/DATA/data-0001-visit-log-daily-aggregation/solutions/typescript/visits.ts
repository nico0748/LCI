export interface Row {
  date: string;
  department: string;
  visits: number;
  patients: number;
}

export interface RowError {
  line: number;
  reason: string;
}

const REQUIRED = ["visit_id", "patient_id", "department", "visited_at"] as const;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // 日本は夏時間が無いので固定オフセットで正しい
const TS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):(\d{2}))?$/;

// RFC 4180 の 1 行を分割する（フィールド内改行は無い前提）。引用符内のカンマと "" を扱う
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// UTC の epoch ms を返す。オフセットが無い時刻は推測せず missing_timezone
function parseTs(s: string): { ms: number } | { reason: string } {
  const m = TS.exec(s);
  if (!m) return { reason: "invalid_timestamp" };
  if (!m[7]) return { reason: "missing_timezone" };
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo) || h > 23 || mi > 59 || se > 59) return { reason: "invalid_timestamp" };
  let offsetMin = 0;
  if (m[7] !== "Z") {
    const oh = Number(m[9]);
    const om = Number(m[10]);
    if (oh > 23 || om > 59) return { reason: "invalid_timestamp" };
    offsetMin = (m[8] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  return { ms: Date.UTC(y, mo - 1, d, h, mi, se) - offsetMin * 60_000 };
}

const jstDate = (ms: number) => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);

// 文字列をコードポイント順で比べる（localeCompare は環境で結果が変わる）
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// 受付ログ CSV を日本時間の日付×診療科で集計する。不正な行は理由付きで errors に積んで続行する
export function aggregateVisits(csvText: string): { rows: Row[]; errors: RowError[] } {
  const lines = csvText.replace(/^﻿/, "").split(/\r?\n/);
  const header = parseLine(lines[0] ?? "").map((h) => h.trim());
  const pos = new Map(header.map((h, i) => [h, i]));
  const missing = REQUIRED.filter((c) => !pos.has(c));
  if (lines.length === 0 || missing.length) throw new Error(`必要な列がありません: ${missing.join(",")}`);

  const errors: RowError[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, { date: string; department: string; visits: number; patients: Set<string> }>();
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = i + 1;
    if (!raw.trim()) continue;
    const fields = parseLine(raw);
    if (fields.length !== header.length) {
      errors.push({ line, reason: "column_count" });
      continue;
    }
    const rec = Object.fromEntries(REQUIRED.map((c) => [c, (fields[pos.get(c)!] ?? "").trim()])) as Record<(typeof REQUIRED)[number], string>;
    if (REQUIRED.some((c) => !rec[c])) {
      errors.push({ line, reason: "missing_field" });
      continue;
    }
    const ts = parseTs(rec.visited_at);
    if ("reason" in ts) {
      errors.push({ line, reason: ts.reason });
      continue;
    }
    if (seen.has(rec.visit_id)) {
      errors.push({ line, reason: "duplicate_visit_id" });
      continue;
    }
    seen.add(rec.visit_id);
    const date = jstDate(ts.ms);
    const key = `${date}\u0000${rec.department}`;
    let g = groups.get(key);
    if (!g) {
      g = { date, department: rec.department, visits: 0, patients: new Set() };
      groups.set(key, g);
    }
    g.visits++;
    g.patients.add(rec.patient_id);
  }
  const rows = [...groups.values()]
    .sort((a, b) => cmp(a.date, b.date) || cmp(a.department, b.department))
    .map((g) => ({ date: g.date, department: g.department, visits: g.visits, patients: g.patients.size }));
  return { rows, errors };
}
