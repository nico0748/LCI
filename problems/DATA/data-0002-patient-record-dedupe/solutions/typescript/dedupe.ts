export interface PatientRecord {
  id: string;
  name_kana: string;
  birth_date: string;
  phone: string | null;
}

export interface DedupeResult {
  merge: string[][];
  review: string[][];
  invalid: string[];
}

const DATE_PATTERNS = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, /^(\d{4})年(\d{1,2})月(\d{1,2})日$/];

// NFKC（半角カナ→全角、濁点の合成）→ ひらがな→カタカナ → 空白と中黒を除く。ァ/ア などは同一視しない
export function normalizeKana(s: string): string {
  let out = "";
  for (const ch of (s ?? "").normalize("NFKC")) {
    const cp = ch.codePointAt(0)!;
    const c = cp >= 0x3041 && cp <= 0x3096 ? String.fromCodePoint(cp + 0x60) : ch;
    if (/\s/u.test(c) || c === "・") continue;
    out += c;
  }
  return out;
}

export function normalizeDate(s: string): string | null {
  const t = (s ?? "").normalize("NFKC").trim();
  for (const re of DATE_PATTERNS) {
    const m = re.exec(t);
    if (!m) continue;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // Date は 2/30 を 3/2 に繰り上げるので、組み立て直して一致するかで存在確認する
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

const digits = (p: string | null) => [...(p ?? "").normalize("NFKC")].filter((c) => c >= "0" && c <= "9").join("");

// 文字列比較（コードポイント順）。localeCompare は環境で結果が変わるので使わない
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// (正規化カナ, 生年月日) をキーにグループ化する（O(n)）。電話番号が食い違うグループは review に回す
export function findDuplicates(records: PatientRecord[]): DedupeResult {
  const groups = new Map<string, PatientRecord[]>();
  const invalid: string[] = [];
  for (const r of records) {
    const kana = normalizeKana(r.name_kana);
    const birth = normalizeDate(r.birth_date);
    if (!kana || birth === null) {
      invalid.push(r.id);
      continue;
    }
    const key = `${kana}\u0000${birth}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const merge: string[][] = [];
  const review: string[][] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const ids = members.map((m) => m.id).sort(cmp);
    const phones = new Set(members.map((m) => digits(m.phone)).filter(Boolean));
    (phones.size >= 2 ? review : merge).push(ids);
  }
  const byFirst = (a: string[], b: string[]) => cmp(a[0]!, b[0]!);
  return { merge: merge.sort(byFirst), review: review.sort(byFirst), invalid: invalid.sort(cmp) };
}
