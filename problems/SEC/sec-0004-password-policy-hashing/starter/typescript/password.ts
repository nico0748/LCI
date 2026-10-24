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

export function checkPassword(password: string, user: { userId: string; email: string }): string[] {
  throw new Error("not implemented");
}

export function hashPassword(password: string, opts: { iterations?: number; salt?: Buffer } = {}): string {
  throw new Error("not implemented");
}

export function verifyPassword(password: string, stored: string): boolean {
  throw new Error("not implemented");
}

export function needsRehash(stored: string, iterations = DEFAULT_ITERATIONS): boolean {
  throw new Error("not implemented");
}
