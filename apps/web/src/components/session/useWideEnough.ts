"use client";

import { useSyncExternalStore } from "react";

/** 面接画面に必要な幅（X13）。これ未満では開始させない */
export const INTERVIEW_MIN_WIDTH = 1280;

const query = `(min-width: ${INTERVIEW_MIN_WIDTH}px)`;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** ウィンドウ幅が 1280px 以上か（サーバでは true とみなす。セッション画面は SSR しない） */
export function useWideEnough(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
