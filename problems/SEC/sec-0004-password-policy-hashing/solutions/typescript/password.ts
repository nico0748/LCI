import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// よく使われるパスワード（本番では漏えい済みパスワードの大規模リストや API を使う）
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiopas",
  "iloveyou1234",
  "letmein12345",
  "adminadmin12",
  "welcome12345",
  "abcdefghijkl",
  "passw0rd1234",
]);

export const DEFAULT_ITERATIONS = 600_000;
const ALGORITHM = "pbkdf2_sha256";
const MIN_LEN = 12;
// 上限はハッシュ計算を重くする DoS への対策
const MAX_LEN = 128;
const SALT_BYTES = 16;
const DK_BYTES = 32;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

// 全角英数・半角カナなどの表記ゆれを吸収する
const norm = (s: string) => s.normalize("NFKC");

// 受け入れられない理由のコードを決まった順に返す。文字種のルールは課さない（NIST SP 800-63B）
export function checkPassword(password: string, user: { userId: string; email: string }): string[] {
  const p = norm(password);
  const low = p.toLowerCase();
  const reasons: string[] = [];
  const n = [...p].length; // length は UTF-16 単位なのでコードポイントで数え直す
  if (n < MIN_LEN) reasons.push("too_short");
  if (n > MAX_LEN) reasons.push("too_long");
  if (COMMON_PASSWORDS.has(low)) reasons.push("common");
  const local = norm(user.email).toLowerCase().split("@")[0] ?? "";
  const personal = [norm(user.userId).toLowerCase(), local].filter((t) => [...t].length >= 3);
  if (personal.some((t) => low.includes(t))) reasons.push("contains_user_info");
  if (/(.)\1{3,}/su.test(p)) reasons.push("repetitive");
  return reasons;
}

function derive(password: string, salt: Buffer, iterations: number): Buffer {
  return pbkdf2Sync(Buffer.from(norm(password), "utf8"), salt, iterations, DK_BYTES, "sha256");
}

export function hashPassword(password: string, opts: { iterations?: number; salt?: Buffer } = {}): string {
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const salt = opts.salt ?? randomBytes(SALT_BYTES); // パスワードごとにランダム
  const dk = derive(password, salt, iterations);
  return `${ALGORITHM}$${iterations}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

function parse(stored: string): { iterations: number; salt: Buffer; dk: Buffer } | null {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length !== 4) return null;
  const [alg, it, s, h] = parts as [string, string, string, string];
  if (alg !== ALGORITHM || !/^\d+$/.test(it) || !B64.test(s) || !B64.test(h)) return null;
  const iterations = Number(it);
  const salt = Buffer.from(s, "base64");
  const dk = Buffer.from(h, "base64");
  if (iterations < 1 || !Number.isSafeInteger(iterations) || salt.length === 0 || dk.length !== DK_BYTES) return null;
  return { iterations, salt, dk };
}

// 壊れた保存値は不一致として扱う（例外でログイン処理を落とさない）
export function verifyPassword(password: string, stored: string): boolean {
  const p = parse(stored);
  if (!p) return false;
  return timingSafeEqual(derive(password, p.salt, p.iterations), p.dk);
}

export function needsRehash(stored: string, iterations = DEFAULT_ITERATIONS): boolean {
  const p = parse(stored);
  return p === null || p.iterations < iterations;
}
