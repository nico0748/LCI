import { promises as fs } from "node:fs";
import path from "node:path";
import { Language } from "@lci/core";
import { AudioManifest, DEMO_ID_RE, DemoScript, type RunSnapshot } from "./schema.ts";
import type { AudioStatus } from "./types.ts";

/**
 * デモの保存（02 §9、00 D13）。data/ は git 管理外。
 *
 * data/demos/<problem_id>/<language>/<demo_id>/
 *   demo.json                       索引（現在の版・版の一覧）
 *   script.json                     現在の版の DemoScript（revisions/ の最新と同じ内容）
 *   revisions/rev-0003.json         版ごとの DemoScript（最新 10 件まで）
 *   audio/<key>.m4a                 音声区間（内容ハッシュ名。版の間で共有し、参照が無くなったら消す）
 *   audio/manifest-rev-0003.json    AudioManifest（版ごと）
 *   audio/job-rev-0003.json         合成の進捗
 *
 * すべてのメソッドで id を正規表現で検査し、解決後のパスが data/demos 配下かも確かめる（F14 の穴を作らない）。
 * 書き込みは tmp → rename。採番は .lock（O_EXCL）で MCP プロセスと Next の同時保存を直列化する。
 */

export const KEEP_REVISIONS = 10;
export const AUDIO_KEY_RE = /^[a-f0-9]{16}$/;
const PROBLEM_ID_RE = /^[a-z]+-\d{4}$/;

export class DemoIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoIdError";
  }
}

export function assertDemoId(id: string): void {
  if (typeof id !== "string" || !DEMO_ID_RE.test(id)) throw new DemoIdError(`不正な demo_id: ${String(id).slice(0, 40)}`);
}
export function assertProblemId(id: string): void {
  if (typeof id !== "string" || !PROBLEM_ID_RE.test(id)) throw new DemoIdError(`不正な problem_id: ${String(id).slice(0, 40)}`);
}
export function assertLanguage(l: string): asserts l is Language {
  if (!Language.safeParse(l).success) throw new DemoIdError(`不正な language: ${String(l).slice(0, 20)}`);
}
export function assertAudioKey(k: string): void {
  if (typeof k !== "string" || !AUDIO_KEY_RE.test(k)) throw new DemoIdError(`不正な音声キー: ${String(k).slice(0, 20)}`);
}
export function assertRevision(r: number): void {
  if (!Number.isInteger(r) || r < 1 || r > 9999) throw new DemoIdError(`不正な revision: ${r}`);
}

export interface RevisionEntry {
  revision: number;
  created_at: string;
  title: string;
  digest: string;
  final_verdict: RunSnapshot["verdict"];
  passed: number;
  total: number;
  estimate_ms: number;
  runner_backend: "docker" | "fake";
  author_model: string;
  base_sha256: string;
  note?: string;
}

export interface DemoIndex {
  demo_id: string;
  problem_id: string;
  language: Language;
  title: string;
  created_at: string;
  updated_at: string;
  current_revision: number;
  revisions: RevisionEntry[];
}

export interface AudioJob {
  status: Exclude<AudioStatus, "none" | "unavailable" | "ready"> | "done";
  revision: number;
  done: number;
  total: number;
  engine: string;
  voice: string;
  pid: number;
  started_at: string;
  updated_at: string;
  error?: string;
}

export interface DemoLocation {
  problem_id: string;
  language: Language;
  demo_id: string;
  dir: string;
}

const pad = (n: number) => String(n).padStart(4, "0");

export function newDemoId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}T${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `d_${stamp}_${rand}`;
}

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let ents: import("node:fs").Dirent[] = [];
  try {
    ents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) total += (await fs.stat(p).catch(() => null))?.size ?? 0;
  }
  return total;
}

/** プロセス内の直列化（同じプロセスで同じデモを同時に保存するとき） */
const inproc = new Map<string, Promise<unknown>>();

export class DemoStore {
  readonly root: string;

  // パラメータプロパティは --experimental-strip-types で使えないので明示代入（core/session-store.ts と同じ）
  constructor(dataRoot: string) {
    this.root = path.resolve(dataRoot, "demos");
  }

  /** 解決後のパスが root 配下であることを確かめる */
  private inside(...parts: string[]): string {
    const p = path.resolve(this.root, ...parts);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new DemoIdError("data/demos の外は参照できません");
    return p;
  }

  dirOf(problemId: string, language: string, demoId: string): string {
    assertProblemId(problemId);
    assertLanguage(language);
    assertDemoId(demoId);
    return this.inside(problemId, language, demoId);
  }

  /** demo_id から場所を探す（API は demo_id だけで来るので、problem/language の 2 階層を走査する） */
  async locate(demoId: string): Promise<DemoLocation | null> {
    assertDemoId(demoId);
    let problems: string[] = [];
    try {
      problems = await fs.readdir(this.root);
    } catch {
      return null;
    }
    for (const pid of problems) {
      if (!PROBLEM_ID_RE.test(pid)) continue;
      let langs: string[] = [];
      try {
        langs = await fs.readdir(this.inside(pid));
      } catch {
        continue;
      }
      for (const lang of langs) {
        if (!Language.safeParse(lang).success) continue;
        const dir = this.inside(pid, lang, demoId);
        const st = await fs.stat(path.join(dir, "demo.json")).catch(() => null);
        if (st?.isFile()) return { problem_id: pid, language: lang as Language, demo_id: demoId, dir };
      }
    }
    return null;
  }

  async index(demoId: string): Promise<(DemoIndex & { dir: string }) | null> {
    const loc = await this.locate(demoId);
    if (!loc) return null;
    const idx = await readJson<DemoIndex>(path.join(loc.dir, "demo.json"));
    return idx ? { ...idx, dir: loc.dir } : null;
  }

  /** 一覧（新しい順）。problem / language で絞れる */
  async list(filter: { problem_id?: string; language?: string } = {}): Promise<DemoIndex[]> {
    if (filter.problem_id !== undefined) assertProblemId(filter.problem_id);
    if (filter.language !== undefined) assertLanguage(filter.language);
    const out: DemoIndex[] = [];
    let problems: string[] = [];
    try {
      problems = filter.problem_id ? [filter.problem_id] : await fs.readdir(this.root);
    } catch {
      return out;
    }
    for (const pid of problems) {
      if (!PROBLEM_ID_RE.test(pid)) continue;
      let langs: string[] = [];
      try {
        langs = filter.language ? [filter.language] : await fs.readdir(this.inside(pid));
      } catch {
        continue;
      }
      for (const lang of langs) {
        if (!Language.safeParse(lang).success) continue;
        let ids: string[] = [];
        try {
          ids = await fs.readdir(this.inside(pid, lang));
        } catch {
          continue;
        }
        for (const id of ids) {
          if (!DEMO_ID_RE.test(id)) continue;
          const idx = await readJson<DemoIndex>(path.join(this.inside(pid, lang, id), "demo.json"));
          if (idx) out.push(idx);
        }
      }
    }
    return out.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
  }

  async getScript(demoId: string, revision?: number): Promise<DemoScript | null> {
    if (revision !== undefined) assertRevision(revision);
    const idx = await this.index(demoId);
    if (!idx) return null;
    const rev = revision ?? idx.current_revision;
    const raw = await readJson<unknown>(path.join(idx.dir, "revisions", `rev-${pad(rev)}.json`));
    if (!raw) return null;
    const parsed = DemoScript.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private async withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
    const prev = inproc.get(dir) ?? Promise.resolve();
    const run = prev.then(async () => {
      await fs.mkdir(dir, { recursive: true });
      const lock = path.join(dir, ".lock");
      const deadline = Date.now() + 15_000;
      for (;;) {
        try {
          const h = await fs.open(lock, "wx");
          await h.writeFile(String(process.pid));
          await h.close();
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          const st = await fs.stat(lock).catch(() => null);
          // 30 秒より古いロックは落ちたプロセスの残骸とみなす
          if (st && Date.now() - st.mtimeMs > 30_000) await fs.rm(lock, { force: true });
          else if (Date.now() > deadline) throw new Error("デモの保存が混み合っています（ロックを取得できません）。少し待ってから再度保存してください");
          else await new Promise((r) => setTimeout(r, 100));
        }
      }
      try {
        return await fn();
      } finally {
        await fs.rm(lock, { force: true });
      }
    });
    inproc.set(dir, run.catch(() => undefined));
    return run;
  }

  /**
   * 新しい版を保存する。demoId を省略すると新しいデモを作る。
   * build には採番した revision と demo_id を渡し、DemoScript を返してもらう。
   */
  async saveRevision(
    loc: { problem_id: string; language: string; demo_id?: string },
    build: (ids: { demo_id: string; revision: number; created_at: string }) => DemoScript,
  ): Promise<{ script: DemoScript; index: DemoIndex; pruned: number[] }> {
    assertProblemId(loc.problem_id);
    assertLanguage(loc.language);
    let demoId = loc.demo_id;
    if (demoId !== undefined) {
      assertDemoId(demoId);
      const found = await this.locate(demoId);
      if (!found) throw new DemoIdError(`demo_id ${demoId} は見つかりません（新しく作るなら demo_id を省略してください）`);
      if (found.problem_id !== loc.problem_id || found.language !== loc.language) {
        throw new DemoIdError(`demo_id ${demoId} は ${found.problem_id} / ${found.language} のデモです（問題・言語が違います）`);
      }
    } else demoId = newDemoId();
    const id = demoId;
    const dir = this.dirOf(loc.problem_id, loc.language, id);
    return this.withLock(dir, async () => {
      const prev = await readJson<DemoIndex>(path.join(dir, "demo.json"));
      const revision = (prev?.revisions.reduce((a, r) => Math.max(a, r.revision), 0) ?? 0) + 1;
      const created_at = new Date().toISOString();
      const script = DemoScript.parse(build({ demo_id: id, revision, created_at }));
      if (script.demo_id !== id || script.revision !== revision) throw new Error("build が demo_id / revision を書き換えました");
      const body = JSON.stringify(script, null, 1);
      await writeAtomic(path.join(dir, "revisions", `rev-${pad(revision)}.json`), body);
      await writeAtomic(path.join(dir, "script.json"), body);
      const entry: RevisionEntry = {
        revision,
        created_at,
        title: script.draft.title,
        digest: script.digest,
        final_verdict: script.validation.final_judge.verdict,
        passed: script.validation.final_judge.passed,
        total: script.validation.final_judge.total,
        estimate_ms: script.validation.estimate_ms,
        runner_backend: script.validation.runner_backend,
        author_model: script.author.model,
        base_sha256: script.file.base_sha256,
        ...(script.note ? { note: script.note } : {}),
      };
      const all = [...(prev?.revisions ?? []), entry].sort((a, b) => a.revision - b.revision);
      const keep = all.slice(-KEEP_REVISIONS);
      const pruned = all.slice(0, all.length - keep.length).map((r) => r.revision);
      const index: DemoIndex = {
        demo_id: id,
        problem_id: loc.problem_id,
        language: loc.language as Language,
        title: script.draft.title,
        created_at: prev?.created_at ?? created_at,
        updated_at: created_at,
        current_revision: revision,
        revisions: keep,
      };
      await writeAtomic(path.join(dir, "demo.json"), JSON.stringify(index, null, 1));
      for (const r of pruned) {
        await fs.rm(path.join(dir, "revisions", `rev-${pad(r)}.json`), { force: true });
        await fs.rm(path.join(dir, "audio", `manifest-rev-${pad(r)}.json`), { force: true });
        await fs.rm(path.join(dir, "audio", `job-rev-${pad(r)}.json`), { force: true });
      }
      if (pruned.length) await this.gcAudio(id);
      return { script, index, pruned };
    });
  }

  /**
   * 削除。revision 省略でデモを丸ごと、指定でその版だけ。audioOnly なら台本は残して音声だけ消す。
   * 返り値は解放したバイト数（見つからなければ null）
   */
  async remove(demoId: string, opts: { revision?: number; audioOnly?: boolean } = {}): Promise<{ freed_bytes: number; demo_deleted: boolean } | null> {
    if (opts.revision !== undefined) assertRevision(opts.revision);
    const idx = await this.index(demoId);
    if (!idx) return null;
    const dir = idx.dir;
    if (opts.audioOnly) {
      const audio = this.inside(idx.problem_id, idx.language, demoId, "audio");
      const before = await dirSize(audio);
      if (opts.revision === undefined) await fs.rm(audio, { recursive: true, force: true });
      else {
        await fs.rm(path.join(audio, `manifest-rev-${pad(opts.revision)}.json`), { force: true });
        await fs.rm(path.join(audio, `job-rev-${pad(opts.revision)}.json`), { force: true });
        await this.gcAudio(demoId);
      }
      return { freed_bytes: before - (await dirSize(audio)), demo_deleted: false };
    }
    if (opts.revision === undefined || (idx.revisions.length === 1 && idx.revisions[0]!.revision === opts.revision)) {
      const before = await dirSize(dir);
      await fs.rm(dir, { recursive: true, force: true });
      return { freed_bytes: before, demo_deleted: true };
    }
    const rev = opts.revision;
    if (!idx.revisions.some((r) => r.revision === rev)) return null;
    return this.withLock(dir, async () => {
      const before = await dirSize(dir);
      await fs.rm(path.join(dir, "revisions", `rev-${pad(rev)}.json`), { force: true });
      await fs.rm(path.join(dir, "audio", `manifest-rev-${pad(rev)}.json`), { force: true });
      await fs.rm(path.join(dir, "audio", `job-rev-${pad(rev)}.json`), { force: true });
      const revisions = idx.revisions.filter((r) => r.revision !== rev);
      const current = revisions[revisions.length - 1]!;
      const next: DemoIndex = { demo_id: idx.demo_id, problem_id: idx.problem_id, language: idx.language, title: current.title, created_at: idx.created_at, updated_at: idx.updated_at, current_revision: current.revision, revisions };
      await writeAtomic(path.join(dir, "demo.json"), JSON.stringify(next, null, 1));
      if (idx.current_revision === rev) {
        const body = await fs.readFile(path.join(dir, "revisions", `rev-${pad(current.revision)}.json`), "utf8");
        await writeAtomic(path.join(dir, "script.json"), body);
      }
      await this.gcAudio(demoId);
      return { freed_bytes: before - (await dirSize(dir)), demo_deleted: false };
    });
  }

  // ---- 音声 ------------------------------------------------------------------

  async audioDir(demoId: string): Promise<string | null> {
    const loc = await this.locate(demoId);
    return loc ? this.inside(loc.problem_id, loc.language, demoId, "audio") : null;
  }

  async segmentPath(demoId: string, key: string): Promise<string | null> {
    assertAudioKey(key);
    const dir = await this.audioDir(demoId);
    return dir ? path.join(dir, `${key}.m4a`) : null;
  }

  async readManifest(demoId: string, revision: number): Promise<AudioManifest | null> {
    assertRevision(revision);
    const dir = await this.audioDir(demoId);
    if (!dir) return null;
    const raw = await readJson<unknown>(path.join(dir, `manifest-rev-${pad(revision)}.json`));
    if (!raw) return null;
    const p = AudioManifest.safeParse(raw);
    return p.success ? p.data : null;
  }

  async writeManifest(demoId: string, revision: number, m: AudioManifest): Promise<void> {
    assertRevision(revision);
    const dir = await this.audioDir(demoId);
    if (!dir) throw new DemoIdError(`demo_id ${demoId} は見つかりません`);
    await writeAtomic(path.join(dir, `manifest-rev-${pad(revision)}.json`), JSON.stringify(AudioManifest.parse(m), null, 1));
  }

  async readJob(demoId: string, revision: number): Promise<AudioJob | null> {
    assertRevision(revision);
    const dir = await this.audioDir(demoId);
    return dir ? readJson<AudioJob>(path.join(dir, `job-rev-${pad(revision)}.json`)) : null;
  }

  async writeJob(demoId: string, job: AudioJob): Promise<void> {
    assertRevision(job.revision);
    const dir = await this.audioDir(demoId);
    if (!dir) throw new DemoIdError(`demo_id ${demoId} は見つかりません`);
    await writeAtomic(path.join(dir, `job-rev-${pad(job.revision)}.json`), JSON.stringify(job, null, 1));
  }

  async audioBytes(demoId: string): Promise<number> {
    const dir = await this.audioDir(demoId);
    return dir ? dirSize(dir) : 0;
  }

  /** どの版のマニフェストからも参照されない区間ファイルを消す */
  async gcAudio(demoId: string): Promise<number> {
    const dir = await this.audioDir(demoId);
    if (!dir) return 0;
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      return 0;
    }
    const used = new Set<string>();
    for (const n of names.filter((x) => /^manifest-rev-\d{4}\.json$/.test(x))) {
      const m = await readJson<{ segments?: { key: string }[] }>(path.join(dir, n));
      for (const s of m?.segments ?? []) used.add(s.key);
    }
    // 合成中の版があるときは消さない（作りかけの区間を消してしまう）
    const generating = names.some((x) => /^job-rev-\d{4}\.json$/.test(x)) && (await Promise.all(names.filter((x) => /^job-rev-/.test(x)).map((x) => readJson<AudioJob>(path.join(dir, x))))).some((j) => j?.status === "generating" && Date.now() - Date.parse(j.updated_at) < 120_000);
    if (generating) return 0;
    let freed = 0;
    for (const n of names) {
      const m = /^([a-f0-9]{16})\.m4a$/.exec(n);
      if (m && !used.has(m[1]!)) {
        freed += (await fs.stat(path.join(dir, n)).catch(() => null))?.size ?? 0;
        await fs.rm(path.join(dir, n), { force: true });
      }
    }
    return freed;
  }

  /** data/demos 全体の音声の合計バイト（LCI_DEMO_AUDIO_MAX_MB の判定用） */
  async totalAudioBytes(): Promise<{ demo_id: string; bytes: number; updated: number }[]> {
    const out: { demo_id: string; bytes: number; updated: number }[] = [];
    for (const idx of await this.list()) {
      const dir = await this.audioDir(idx.demo_id);
      if (!dir) continue;
      const bytes = await dirSize(dir);
      if (!bytes) continue;
      const st = await fs.stat(dir).catch(() => null);
      out.push({ demo_id: idx.demo_id, bytes, updated: st?.mtimeMs ?? 0 });
    }
    return out;
  }
}
