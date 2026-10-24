import fs from "node:fs";
import path from "node:path";

export class PathError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

// startsWith だと /srv/files と /srv/files-secret を区別できないので path.relative で比べる。
// "..foo" という名前のファイルを外側と誤判定しないよう、".." の完全一致か ".." + sep で始まるかを見る
function inside(base: string, target: string): boolean {
  const rel = path.relative(base, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function isLink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// 文字列の .. を消すのではなく、正規化した結果が内側かで判定する。
// シンボリックリンクで外に出られるので、実体（realpath）でもう一度判定する。
export function resolveUserFile(baseDir: string, userPath: string): string {
  if (!userPath || userPath.includes("\0") || userPath.includes("\\") || userPath.startsWith("/")) {
    throw new PathError("invalid_path");
  }
  const base = fs.realpathSync(baseDir);
  const candidate = path.resolve(base, userPath);
  // 存在確認より先に判定し、外側のファイルの有無を漏らさない
  if (!inside(base, candidate)) throw new PathError("outside_base");
  if (!fs.existsSync(candidate) && !isLink(candidate)) throw new PathError("not_found");
  let real: string;
  try {
    // 途中のディレクトリや末端がシンボリックリンクの場合に備えて常に実体へ解決する
    real = fs.realpathSync(candidate);
  } catch {
    throw new PathError("not_found"); // 切れたリンク
  }
  if (!inside(base, real)) throw new PathError("outside_base");
  if (!fs.statSync(real).isFile()) throw new PathError("not_a_file");
  return real;
}
