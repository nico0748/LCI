export interface User {
  id: string;
  name: string;
}

// ユーザー情報を取得してキャッシュする
export class UserLoader {
  private readonly fetcher: (id: string) => Promise<User>;
  private readonly cache = new Map<string, User>();

  constructor(fetcher: (id: string) => Promise<User>) {
    this.fetcher = fetcher;
  }

  async load(id: string): Promise<User> {
    if (this.cache.has(id)) return this.cache.get(id)!;
    const user = await this.fetcher(id);
    this.cache.set(id, user);
    return user;
  }

  async loadMany(ids: string[]): Promise<User[]> {
    const results: User[] = [];
    ids.forEach(async (id) => {
      results.push(await this.load(id));
    });
    return results;
  }

  clear(id: string): void {
    this.cache.delete(id);
  }
}
