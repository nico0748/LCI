/** 端末用の簡易テーブル描画。日本語（全角）を幅 2 として桁を揃える */

export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    // CJK・全角記号・ハングル・絵文字あたりを幅 2 とみなす（厳密な East Asian Width ではないが表の桁揃えには十分）
    w += cp >= 0x1100 && (cp <= 0x115f || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || cp >= 0x1f300) ? 2 : 1;
  }
  return w;
}

export function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const gap = Math.max(0, width - displayWidth(s));
  return align === "left" ? s + " ".repeat(gap) : " ".repeat(gap) + s;
}

export function renderTable(headers: string[], rows: string[][], align: ("left" | "right")[] = []): string {
  const widths = headers.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i] ?? ""))));
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i] ?? 0, align[i] ?? "left")).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  return [line(headers), sep, ...rows.map(line)].join("\n");
}
