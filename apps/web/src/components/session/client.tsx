"use client";

import dynamic from "next/dynamic";

/**
 * セッション画面はカメラ・localStorage・Monaco などブラウザ専用の API に依存するので SSR しない。
 * （サーバで描くと初期状態がクライアントとずれ、ハイドレーション後に作り直しになる）
 */
const Loading = () => <main className="flex-1 grid place-items-center text-sm text-fg-muted">読み込み中…</main>;

export const PreflightScreenClient = dynamic(() => import("./PreflightScreen").then((m) => m.PreflightScreen), { ssr: false, loading: Loading });
export const InterviewScreenClient = dynamic(() => import("./InterviewScreen").then((m) => m.InterviewScreen), { ssr: false, loading: Loading });
