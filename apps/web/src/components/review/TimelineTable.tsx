"use client";

import type { ReactNode } from "react";
import { fmtT, type Metrics } from "@lci/core/browser";
import { Button, Dialog, EvalMark, StatusBadge, Table, TableScroll, TBody, Td, Th, THead, Tr, evalLevelOf } from "@/components/ui";
import { fmtRange } from "./review-model";
import type { Pin } from "./types";

/**
 * タイムラインの表ビュー（04 §3.6、dataviz の table view twin）。
 * ツールチップでしか読めない情報を残さないため、全イベントを時刻順の表で出す。行の「移動」で seek して閉じる。
 */
export function TimelineTable({
  open,
  onOpenChange,
  pins,
  eventPins,
  metrics,
  onSelectPin,
  onSeek,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pins: Pin[];
  eventPins: Pin[];
  metrics: Metrics | null;
  onSelectPin: (id: string) => void;
  onSeek: (t: number) => void;
}) {
  type Row = { key: string; t: number; tEnd?: number; kind: ReactNode; text: ReactNode; go: () => void };
  const rows: Row[] = [];
  for (const p of pins) {
    const level = evalLevelOf(p.severity ?? "");
    rows.push({
      key: p.id,
      t: p.t,
      tEnd: p.tEnd,
      kind: level ? <EvalMark level={level} showLabel label={`#${p.n ?? ""} ${level === "major" ? "重大" : level === "minor" ? "改善" : "良い"}`} /> : "指摘",
      text: p.label,
      go: () => onSelectPin(p.id),
    });
  }
  for (const p of eventPins) {
    const ok = p.verdict === "AC" || p.verdict === "PASS";
    rows.push({
      key: p.id,
      t: p.t,
      kind: p.kind === "run" ? <StatusBadge tone={p.verdict ? (ok ? "success" : "danger") : "neutral"}>実行</StatusBadge> : <StatusBadge>面接官</StatusBadge>,
      text: p.label,
      go: () => onSelectPin(p.id),
    });
  }
  for (const [i, s] of (metrics?.silence_gt15s ?? []).entries()) {
    rows.push({ key: `sil${i}`, t: s.t0, tEnd: s.t1, kind: <StatusBadge variant="outlined">沈黙</StatusBadge>, text: `${s.dur_s.toFixed(0)} 秒 · ${s.editing ? "編集あり" : "編集なし"}`, go: () => onSeek(s.t0) });
  }
  for (const [i, d] of (metrics?.direction_changes ?? []).entries()) {
    rows.push({ key: `dc${i}`, t: d.t, kind: <StatusBadge variant="outlined">方針変更</StatusBadge>, text: d.detail, go: () => onSeek(d.t) });
  }
  rows.sort((a, b) => a.t - b.t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="タイムラインの出来事" width={760}>
      <TableScroll maxHeight="60vh">
        <Table caption="時刻順の出来事。移動を押すとその時刻を再生します" captionHidden>
          <THead sticky>
            <tr>
              <Th className="w-28">時刻</Th>
              <Th className="w-32">種別</Th>
              <Th>内容</Th>
              <Th className="w-20">
                <span className="sr-only">操作</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td mono>{fmtRange(r.t, r.tEnd)}</Td>
                <Td>{r.kind}</Td>
                <Td className="text-std-14N-170">{r.text}</Td>
                <Td>
                  <Button
                    size="2xs"
                    variant="tertiary"
                    onClick={() => {
                      r.go();
                      onOpenChange(false);
                    }}
                    aria-label={`${fmtT(r.t)} へ移動`}
                  >
                    移動
                  </Button>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-fg-muted">
                  記録された出来事はありません。
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </TableScroll>
    </Dialog>
  );
}
