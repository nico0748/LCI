"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABEL } from "@lci/core/browser";
import type { DemoSummary } from "@lci/demo/browser";
import { LinkButton } from "@/components/ui";
import { sortLanguages } from "./demo-model.ts";

/**
 * 問題詳細の「前回の記録」パネルに置くデモへのリンク（FR-D-03b）。
 * パネル自体が「終えたセッションがある」ときだけ出るので、ここではゲートを気にしなくてよい。
 * 一覧（ネタバレなし）だけを読み、デモがある言語を添える。無ければ作り方の案内へ。
 */
export function DemoEntryLink({ problemId }: { problemId: string }) {
  const [list, setList] = useState<DemoSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/demos?problem=${encodeURIComponent(problemId)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as DemoSummary[]) : null))
      .then((l) => alive && l && setList(l))
      .catch(() => {
        /* 読めなければリンクを出さない */
      });
    return () => {
      alive = false;
    };
  }, [problemId]);
  if (!list) return null;
  const href = `/problems/${encodeURIComponent(problemId)}/demo`;
  const langs = sortLanguages([...new Set(list.map((d) => d.language))]);
  if (langs.length === 0) {
    return (
      <LinkButton href={href} variant="tertiary" size="xs" className="self-start">
        模範解答デモ（未作成）
      </LinkButton>
    );
  }
  return (
    <LinkButton href={href} variant="tertiary" size="xs" className="self-start">
      模範解答デモを見る（{langs.map((l) => LANGUAGE_LABEL[l]).join("・")}）
    </LinkButton>
  );
}
