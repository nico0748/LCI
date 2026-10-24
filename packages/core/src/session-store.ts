import { promises as fs, createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { Event, Session, Transcript, RunResult } from "./session.ts";
import { Evaluation } from "./evaluation.ts";

/**
 * ファイルベースのセッションストア（要件書 01 §5）。
 * data/sessions/<id>/session.json, events.jsonl, media/, derived/
 * events.jsonl は追記専用。書き込みは fsync せずに OS に任せるが、
 * 2 秒チャンクごとの録画保存と同程度の粒度で失われないことを目標にする。
 */
export class SessionStore {
  private streams = new Map<string, WriteStream>();

  readonly root: string;

  // パラメータプロパティ（constructor(public root)）は Node の --experimental-strip-types（strip-only）で
  // ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX になり、@lci/core を import する全パッケージが落ちるため明示代入にしている
  constructor(root: string) {
    this.root = root;
  }

  dir(id: string) {
    return path.join(this.root, "sessions", id);
  }

  async create(session: Session): Promise<Session> {
    const d = this.dir(session.session_id);
    await fs.mkdir(path.join(d, "media"), { recursive: true });
    await fs.mkdir(path.join(d, "derived", "snapshots"), { recursive: true });
    await fs.mkdir(path.join(d, "derived", "runs"), { recursive: true });
    await fs.mkdir(path.join(d, "derived", "frames"), { recursive: true });
    await this.save(session);
    return session;
  }

  async save(session: Session): Promise<void> {
    const parsed = Session.parse(session);
    const p = path.join(this.dir(parsed.session_id), "session.json");
    const tmp = p + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(parsed, null, 2));
    await fs.rename(tmp, p);
  }

  /** セッションを丸ごと削除する（同意画面で約束している「完全に削除」）。id にパス区切りを含むものは拒否 */
  async remove(id: string): Promise<boolean> {
    if (!/^[\w.-]+$/.test(id) || id === "." || id === "..") throw new Error(`invalid session id: ${id}`);
    await this.closeEvents(id);
    const d = this.dir(id);
    try {
      await fs.access(d);
    } catch {
      return false;
    }
    await fs.rm(d, { recursive: true, force: true });
    return true;
  }

  async get(id: string): Promise<Session | null> {
    try {
      const raw = await fs.readFile(path.join(this.dir(id), "session.json"), "utf8");
      return Session.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async update(id: string, fn: (s: Session) => Session | void): Promise<Session> {
    const s = await this.get(id);
    if (!s) throw new Error(`session not found: ${id}`);
    const next = fn(s) ?? s;
    await this.save(next);
    return next;
  }

  async list(): Promise<Session[]> {
    const base = path.join(this.root, "sessions");
    let ids: string[] = [];
    try {
      ids = await fs.readdir(base);
    } catch {
      return [];
    }
    const out: Session[] = [];
    for (const id of ids) {
      const s = await this.get(id);
      if (s) out.push(s);
    }
    return out.sort((a, b) => (a.started_at_wall < b.started_at_wall ? 1 : -1));
  }

  async appendEvents(id: string, events: Event[]): Promise<void> {
    const p = path.join(this.dir(id), "events.jsonl");
    let ws = this.streams.get(id);
    if (!ws) {
      ws = createWriteStream(p, { flags: "a" });
      this.streams.set(id, ws);
    }
    const lines = events.map((e) => JSON.stringify(Event.parse(e))).join("\n") + "\n";
    await new Promise<void>((res, rej) => ws!.write(lines, (err) => (err ? rej(err) : res())));
  }

  async closeEvents(id: string): Promise<void> {
    const ws = this.streams.get(id);
    if (!ws) return;
    this.streams.delete(id);
    await new Promise<void>((res) => ws.end(res));
  }

  /** seq で重複排除し、t 昇順で返す（クラッシュ復旧で同じ seq が 2 回書かれることがある） */
  async readEvents(id: string): Promise<Event[]> {
    let raw = "";
    try {
      raw = await fs.readFile(path.join(this.dir(id), "events.jsonl"), "utf8");
    } catch {
      return [];
    }
    const seen = new Set<number>();
    const out: Event[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = Event.parse(JSON.parse(line));
        if (seen.has(e.seq)) continue;
        seen.add(e.seq);
        out.push(e);
      } catch {
        // 壊れた末尾行（クラッシュ時）は捨てる
      }
    }
    return out.sort((a, b) => a.t - b.t || a.seq - b.seq);
  }

  async writeSnapshot(id: string, fileId: string, t: number, text: string): Promise<string> {
    const rel = path.posix.join("derived", "snapshots", fileId, `${t}.txt`);
    const abs = path.join(this.dir(id), rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, text);
    return rel;
  }

  async readRel(id: string, rel: string): Promise<string> {
    return fs.readFile(path.join(this.dir(id), rel), "utf8");
  }

  async appendMediaChunk(id: string, recorder: string, chunk: Uint8Array): Promise<number> {
    const p = path.join(this.dir(id), "media", `${recorder}.webm.part`);
    await fs.appendFile(p, chunk);
    const st = await fs.stat(p);
    return st.size;
  }

  async getTranscript(id: string): Promise<Transcript | null> {
    try {
      return Transcript.parse(JSON.parse(await this.readRel(id, "derived/transcript.json")));
    } catch {
      return null;
    }
  }

  async saveTranscript(id: string, tr: Transcript): Promise<void> {
    await fs.writeFile(path.join(this.dir(id), "derived", "transcript.json"), JSON.stringify(Transcript.parse(tr), null, 2));
  }

  async saveRun(id: string, run: RunResult): Promise<string> {
    const rel = path.posix.join("derived", "runs", `${run.run_id}.json`);
    await fs.writeFile(path.join(this.dir(id), rel), JSON.stringify(RunResult.parse(run), null, 2));
    return rel;
  }

  async getRun(id: string, runId: string): Promise<RunResult | null> {
    try {
      return RunResult.parse(JSON.parse(await this.readRel(id, `derived/runs/${runId}.json`)));
    } catch {
      return null;
    }
  }

  async saveEvaluation(id: string, ev: Evaluation): Promise<string> {
    const s = await this.get(id);
    if (!s) throw new Error(`session not found: ${id}`);
    const n = s.evaluations.length + 1;
    const rel = path.posix.join("derived", `evaluation-${n}.json`);
    await fs.writeFile(path.join(this.dir(id), rel), JSON.stringify(Evaluation.parse(ev), null, 2));
    s.evaluations.push(rel);
    await this.save(s);
    return rel;
  }

  async getEvaluations(id: string): Promise<Evaluation[]> {
    const s = await this.get(id);
    if (!s) return [];
    const out: Evaluation[] = [];
    for (const rel of s.evaluations) {
      try {
        out.push(Evaluation.parse(JSON.parse(await this.readRel(id, rel))));
      } catch {
        /* skip broken */
      }
    }
    return out;
  }

  async saveMetrics(id: string, metrics: unknown): Promise<void> {
    await fs.writeFile(path.join(this.dir(id), "derived", "metrics.json"), JSON.stringify(metrics, null, 2));
  }

  async getMetrics<T = unknown>(id: string): Promise<T | null> {
    try {
      return JSON.parse(await this.readRel(id, "derived/metrics.json")) as T;
    } catch {
      return null;
    }
  }
}

export function newSessionId(problemSlug: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}_${problemSlug}_${rand}`;
}
