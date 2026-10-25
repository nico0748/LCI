"use client";

import { useMemo, useSyncExternalStore } from "react";

/** ワークスペース（3 列＋全幅タイムライン）にする幅。未満は sticky プレイヤー＋タブ（04 §2.2） */
export const WIDE_QUERY = "(min-width: 80rem)";

function subscribe(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

/**
 * メディアクエリの一致。サーバと水和の直後は serverValue を返す（レイアウトの切替は CSS が先に済ませ、
 * これは ARIA の役割（タブとして読ませるか）など、CSS で表せない部分にだけ使う）。
 */
export function useMediaQuery(query: string, serverValue = true): boolean {
  const sub = useMemo(() => subscribe(query), [query]);
  return useSyncExternalStore(
    sub,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
