import type { SourceFile } from "./types.ts";

/**
 * 最小の ustar 書き出し。ソースファイルを `docker exec -i ... tar -x` の stdin へ流すために使う。
 * `docker cp` は Docker Desktop の共有 FS を経由して遅いことがある（02 R4）ので exec + tar を選ぶ。
 * ホスト側の tar コマンドにも依存しない。
 */
const BLOCK = 512;

function octal(n: number, len: number): Buffer {
  // 末尾 NUL、その前までを 0 埋め 8 進数で
  const s = n.toString(8).padStart(len - 1, "0");
  return Buffer.from(s.slice(-(len - 1)) + "\0", "ascii");
}

function header(name: string, size: number, mtime: number, mode = 0o644, uid = 1000, gid = 1000): Buffer {
  const h = Buffer.alloc(BLOCK, 0);
  const nameBuf = Buffer.from(name, "utf8");
  if (nameBuf.length > 100) throw new Error(`tar: ファイル名が長すぎます: ${name}`);
  nameBuf.copy(h, 0);
  octal(mode, 8).copy(h, 100);
  octal(uid, 8).copy(h, 108);
  octal(gid, 8).copy(h, 116);
  octal(size, 12).copy(h, 124);
  octal(mtime, 12).copy(h, 136);
  Buffer.from("        ", "ascii").copy(h, 148); // チェックサム欄は空白で計算
  h.write("0", 156); // 通常ファイル
  Buffer.from("ustar\0", "ascii").copy(h, 257);
  Buffer.from("00", "ascii").copy(h, 263);
  Buffer.from("runner", "ascii").copy(h, 265);
  Buffer.from("runner", "ascii").copy(h, 297);
  let sum = 0;
  for (const b of h) sum += b;
  const cs = sum.toString(8).padStart(6, "0") + "\0 ";
  Buffer.from(cs, "ascii").copy(h, 148);
  return h;
}

export function buildTar(files: SourceFile[], mtime = Math.floor(Date.now() / 1000)): Buffer {
  const parts: Buffer[] = [];
  for (const f of files) {
    const data = Buffer.from(f.content, "utf8");
    parts.push(header(f.path, data.length, mtime));
    parts.push(data);
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return Buffer.concat(parts);
}
