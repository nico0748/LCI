import path from "node:path";

/**
 * selftest の --only の 1 要素が問題 id に当たるか。
 * 完全一致（cp-0003）・接頭辞（cp- / cp-00 / alg / CP）・問題ディレクトリ名（cp-0003-slug。末尾の / やパスも可）を受け付ける。
 * id は「接頭辞-4 桁」の固定長なので、接頭辞一致で完全一致も兼ねられる（cp-0001 が cp-00010 に当たることは無い）。
 */
export function matchesOnly(id: string, only: readonly string[]): boolean {
  return only.some((raw) => {
    const x = path.basename(raw.trim().replace(/\/+$/, "")).toLowerCase();
    if (x === "") return false;
    return id.startsWith(x) || x.startsWith(`${id}-`);
  });
}

/** "--only a,b --only c" や "--only a b"（シェルの展開結果）をまとめて要素の配列にする */
export function splitOnly(values: readonly string[]): string[] {
  return values.flatMap((v) => v.split(",")).map((s) => s.trim()).filter((s) => s !== "");
}
