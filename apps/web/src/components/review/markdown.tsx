import type { ReactNode } from "react";

/**
 * 問題文・解説用の最小 Markdown 描画。
 * 依存を増やさないため、見出し・段落・箇条書き・番号リスト・コードブロック・インラインコード・強調だけを扱う。
 * HTML は一切解釈しない（問題ファイルは信頼できるが、生成問題が混ざる前提で安全側に倒す）。
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={`${keyBase}-c${i++}`} className="rounded-4 border border-border-subtle bg-sunken px-1 py-0.5 font-mono text-[0.92em] text-fg-body">{tok.slice(1, -1)}</code>);
    else out.push(<strong key={`${keyBase}-b${i++}`}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    // コードブロック
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) buf.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={k++} className="overflow-x-auto whitespace-pre rounded-6 border border-border bg-sunken p-3 text-mono-13N-150 text-fg-body">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const cls = level <= 2 ? "mt-4 text-dns-16B-130 text-fg" : "mt-3 text-dns-14B-130 text-fg";
      blocks.push(
        <p key={k++} role="heading" aria-level={Math.min(6, level + 2)} className={cls}>
          {inline(h[2]!, `h${k}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*]\s+/, ""));
      blocks.push(
        <ul key={k++} className="list-disc pl-5 space-y-1">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `li${k}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={k++} className="list-decimal pl-5 space-y-1">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `ol${k}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) buf.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={k++} className="border-l-2 border-border-strong pl-3 text-fg-muted">
          {inline(buf.join(" "), `q${k}`)}
        </blockquote>,
      );
      continue;
    }
    // 段落（空行まで連結）
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{1,6}\s|\s*[-*]\s+|\s*\d+[.)]\s+|\s*>)/.test(lines[i]!)) buf.push(lines[i++]!);
    if (buf.length === 0) {
      // 想定外の行は段落として 1 行だけ進める（無限ループ防止）
      buf.push(lines[i++]!);
    }
    blocks.push(<p key={k++}>{inline(buf.join(" "), `p${k}`)}</p>);
  }
  return <div className={`flex flex-col gap-2 text-std-14N-170 ${className ?? ""}`}>{blocks}</div>;
}
