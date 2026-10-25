/** className を結合する（falsy は捨てる）。Tailwind の競合解決はしないので、上書きしたいクラスは呼び出し側で避ける */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
