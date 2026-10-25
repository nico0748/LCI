import type { HTMLAttributes } from "react";
import { cx } from "@/components/ui/cx.ts";

export type PageContainerProps = HTMLAttributes<HTMLElement> & {
  /** default = 最大 1200px（一覧・レビュー）、reading = 720px（説明文・事前確認・総評）、full = 制限なし */
  width?: "default" | "reading" | "full";
  as?: "main" | "div" | "section";
};

const widthClass = { default: "max-w-[1200px]", reading: "max-w-[720px]", full: "max-w-none" } as const;

/**
 * ページの横幅と余白。左右 16px（desktop 24px）、上下 24px。
 * ページの最上位で使うなら as="main"（layout.tsx はランドマークを持たないので、各ページが <main> を出す）。
 */
export function PageContainer({ width = "default", as: As = "div", className, ...rest }: PageContainerProps) {
  return <As className={cx("mx-auto w-full px-4 py-6 desktop:px-6", widthClass[width], className)} {...rest} />;
}
