"use client";

import dynamic from "next/dynamic";
import { LoadingText } from "@/components/ui";

/**
 * デモ画面は localStorage（ゲートの解除・表示の好み）・Audio・Monaco に依存するので SSR しない
 * （セッション画面の client.tsx と同じ方針。サーバで描くと初期状態がずれて作り直しになる）。
 */
export const DemoPageClient = dynamic(() => import("./DemoPage").then((m) => m.DemoPage), { ssr: false, loading: () => <LoadingText /> });
