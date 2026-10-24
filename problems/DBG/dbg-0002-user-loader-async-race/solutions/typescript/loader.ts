export interface User {
  id: string;
  name: string;
}

// ユーザー情報を取得してキャッシュする。
// 結果ではなく進行中の Promise をキャッシュする。has を見てから await までの間に同じ id の load が来ても、
// 2 回目以降は同じ Promise を待つので取得は 1 回で済む。
export class UserLoader {
  private readonly fetcher: (id: string) => Promise<User>;
  private readonly cache = new Map<string, Promise<User>>();

  constructor(fetcher: (id: string) => Promise<User>) {
    this.fetcher = fetcher;
  }

  load(id: string): Promise<User> {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const p = this.fetcher(id).catch((e: unknown) => {
      // 失敗した Promise を残すと、その id は永遠に失敗を返す。まだ自分が登録されているときだけ消す
      if (this.cache.get(id) === p) this.cache.delete(id);
      throw e;
    });
    this.cache.set(id, p);
    return p;
  }

  // Promise.all は入力の順番で結果を返し、1 つでも reject すれば全体が reject する
  loadMany(ids: string[]): Promise<User[]> {
    return Promise.all(ids.map((id) => this.load(id)));
  }

  clear(id: string): void {
    this.cache.delete(id);
  }
}
