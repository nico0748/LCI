import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { PageHeader } from "@/components/ui";
import { Showcase } from "./Showcase.tsx";

export const metadata: Metadata = { title: "デザインシステム — LCI" };

/**
 * スタイルガイド（トークン・タイポ・全部品の状態）。ライトとダークを同じページに並べる。
 * [data-theme] を <html> 以外に付けても globals.css の semantic が切り替わる作りを使っている。
 * 仕様は docs/design/DESIGN_SYSTEM.md。どの画面からも辿らせない（フッタの小さいリンクだけ）。
 */
export default function DesignPage() {
  return (
    <PageContainer as="main" width="full" className="max-w-[1600px]">
      <PageHeader
        title="デザインシステム"
        description="DADS（デジタル庁デザインシステム）を下敷きにした LCI のトークンと部品。上がライト、下がダーク。"
      />
      <div className="flex flex-col gap-8">
        {(["light", "dark"] as const).map((mode) => (
          <section
            key={mode}
            data-theme={mode}
            aria-labelledby={`design-${mode}`}
            className="rounded-12 border border-border bg-canvas p-4 desktop:p-6"
          >
            <h2 id={`design-${mode}`} className="mb-4 text-std-20B-150 text-fg">
              {mode === "light" ? "ライト" : "ダーク"}
            </h2>
            <Showcase mode={mode} />
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
