import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { estimateSayMs } from "../compile.ts";
import { sanitizeForSay } from "../readings.ts";
import { afinfoDurationMs, probeDurationMs, run, which } from "./exec.ts";

/**
 * 音声エンジン（02 §7.2）。MVP は macOS `say`（本番）と fake（Linux の CI・開発用）。
 * どちらも 1 区間 = 1 ファイル（AAC 32 kbps モノラル m4a）を書き、実測の長さ（ms）を返す。
 * voicevox / cloud は後からこの interface で足す。
 */

export interface TtsSynthResult {
  duration_ms: number;
  bytes: number;
}

export interface TtsEngine {
  readonly id: "say" | "fake";
  readonly voice: string;
  /** say -r（語/分）。0 は声の既定 */
  readonly rate: number;
  readonly info: string;
  synth(reading: string, outFile: string): Promise<TtsSynthResult>;
}

export interface TtsConfig {
  engine: "say" | "fake" | "none" | "auto";
  voice: string;
  rate: number;
  ffmpeg: string | null;
  ffprobe: string | null;
}

/** 区間ごとの合成の上限（02 §10） */
const SYNTH_TIMEOUT_MS = 60_000;

export const DEFAULT_VOICE = "Kyoko";

export function ttsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): Omit<TtsConfig, "ffmpeg" | "ffprobe"> & { ffmpegBin: string; ffprobeBin: string } {
  const e = (env.LCI_TTS_ENGINE ?? "auto").toLowerCase();
  const engine = e === "say" || e === "fake" || e === "none" ? e : "auto";
  const rate = Number(env.LCI_TTS_RATE ?? 0);
  return {
    engine,
    voice: env.LCI_TTS_VOICE?.trim() || DEFAULT_VOICE,
    rate: Number.isFinite(rate) && rate > 0 ? Math.round(rate) : 0,
    ffmpegBin: env.LCI_FFMPEG_BIN ?? "ffmpeg",
    ffprobeBin: env.LCI_FFPROBE_BIN ?? "ffprobe",
  };
}

/** 一時ファイルの作業場所。消し忘れても OS が掃除する場所に作る */
async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "lci-tts-"));
}

/** 前後の無音を 100ms 以下に削り（01 V-02）、音量を -16 LUFS にそろえて（V-05）AAC 32k モノラルにする */
const NORMALIZE_FILTER = [
  "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.08",
  "areverse",
  "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.08",
  "areverse",
  "loudnorm=I=-16:TP=-1.5:LRA=11",
].join(",");

function aacArgs(out: string): string[] {
  return ["-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", out];
}

export class SayEngine implements TtsEngine {
  readonly id = "say" as const;
  readonly voice: string;
  readonly rate: number;
  readonly info: string;
  private sayBin: string;
  private ffmpeg: string | null;
  private ffprobe: string | null;
  private afinfo: string | null;

  constructor(o: { sayBin: string; voice: string; rate: number; ffmpeg: string | null; ffprobe: string | null; afinfo: string | null }) {
    this.sayBin = o.sayBin;
    this.voice = o.voice;
    this.rate = o.rate;
    this.ffmpeg = o.ffmpeg;
    this.ffprobe = o.ffprobe;
    this.afinfo = o.afinfo;
    this.info = `say -v ${o.voice}${o.rate ? ` -r ${o.rate}` : ""}${o.ffmpeg ? " → ffmpeg aac 32k mono" : " → m4af aac（ffmpeg なし）"}`;
  }

  /** `say -v '?'` から ja_JP の声を拾う（02 §7.2-5） */
  static async japaneseVoices(sayBin: string): Promise<string[]> {
    const r = await run(sayBin, ["-v", "?"], { timeoutMs: 15_000 }).catch(() => null);
    if (!r || r.code !== 0) return [];
    return r.stdout
      .split("\n")
      .filter((l) => /\bja[_-]JP\b/.test(l))
      .map((l) => l.replace(/\s+ja[_-]JP.*$/, "").trim())
      .filter(Boolean);
  }

  async synth(reading: string, outFile: string): Promise<TtsSynthResult> {
    const text = sanitizeForSay(reading);
    const dir = await tmpDir();
    try {
      // 読みはファイル経由で渡す（先頭が "-" の文字列がオプション扱いになるのを防ぐ）
      const txt = path.join(dir, "in.txt");
      await fs.writeFile(txt, text, "utf8");
      const rateArgs = this.rate ? ["-r", String(this.rate)] : [];
      if (this.ffmpeg) {
        const aiff = path.join(dir, "out.aiff");
        const s = await run(this.sayBin, ["-v", this.voice, ...rateArgs, "-f", txt, "-o", aiff], { timeoutMs: SYNTH_TIMEOUT_MS });
        if (s.code !== 0) throw new Error(`say が失敗しました（${s.timedOut ? "60 秒で打ち切り" : `exit ${s.code}`}）: ${s.stderr.trim().slice(0, 200)}`);
        const tmpOut = path.join(dir, "out.m4a");
        let f = await run(this.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", aiff, "-af", NORMALIZE_FILTER, ...aacArgs(tmpOut)], { timeoutMs: SYNTH_TIMEOUT_MS });
        if (f.code !== 0) {
          // 短すぎて loudnorm / silenceremove が失敗する区間は素のまま変換する
          f = await run(this.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", aiff, ...aacArgs(tmpOut)], { timeoutMs: SYNTH_TIMEOUT_MS });
          if (f.code !== 0) throw new Error(`ffmpeg の AAC 変換に失敗しました: ${f.stderr.trim().slice(0, 200)}`);
        }
        await fs.mkdir(path.dirname(outFile), { recursive: true });
        await fs.copyFile(tmpOut, outFile + ".tmp");
        await fs.rename(outFile + ".tmp", outFile);
      } else {
        // ffmpeg が無い Mac: say の m4a 直接出力（要確認: --data-format=aac とビットレート指定の可否）
        const tmpOut = path.join(dir, "out.m4a");
        const s = await run(this.sayBin, ["-v", this.voice, ...rateArgs, "-f", txt, "--file-format=m4af", "--data-format=aac", "-o", tmpOut], { timeoutMs: SYNTH_TIMEOUT_MS });
        if (s.code !== 0) throw new Error(`say（m4a 直接出力）が失敗しました: ${s.stderr.trim().slice(0, 200)}`);
        await fs.mkdir(path.dirname(outFile), { recursive: true });
        await fs.copyFile(tmpOut, outFile + ".tmp");
        await fs.rename(outFile + ".tmp", outFile);
      }
      const ms = (this.ffprobe ? await probeDurationMs(this.ffprobe, outFile) : null) ?? (this.afinfo ? await afinfoDurationMs(this.afinfo, outFile) : null);
      if (!ms) throw new Error("合成した音声の長さを測れませんでした（ffprobe / afinfo）");
      const st = await fs.stat(outFile);
      return { duration_ms: ms, bytes: st.size };
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * テスト・開発用の偽エンジン（say の無い Linux）。推定の長さの音声を作る。
 * ffmpeg があれば「区間の頭に 0.15 秒のビープ＋残りは無音」の本物の m4a を作り（プレイヤーで区間の切れ目が聞こえる）、
 * ffprobe で実測する。無ければ数バイトの印だけを書いて推定値を返す（再生はできない）。
 */
export class FakeEngine implements TtsEngine {
  readonly id = "fake" as const;
  readonly voice: string;
  readonly rate: number;
  readonly info: string;
  private ffmpeg: string | null;
  private ffprobe: string | null;
  private cps: number;

  constructor(o: { voice?: string; rate?: number; ffmpeg: string | null; ffprobe: string | null; readingCps?: number }) {
    this.voice = o.voice ?? "fake";
    this.rate = o.rate ?? 0;
    this.ffmpeg = o.ffmpeg;
    this.ffprobe = o.ffprobe;
    this.cps = o.readingCps ?? 6.5;
    this.info = o.ffmpeg ? "fake: ffmpeg で推定の長さのビープ＋無音（AAC 32k mono）" : "fake: 印だけのファイル（再生不可）";
  }

  async synth(reading: string, outFile: string): Promise<TtsSynthResult> {
    const est = estimateSayMs(sanitizeForSay(reading), this.cps);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    if (this.ffmpeg) {
      const tmp = `${outFile}.${process.pid}.tmp.m4a`;
      const sec = (est / 1000).toFixed(3);
      const r = await run(
        this.ffmpeg,
        ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=0.15:sample_rate=24000", "-af", "volume=0.25,apad", "-t", sec, ...aacArgs(tmp)],
        { timeoutMs: SYNTH_TIMEOUT_MS },
      );
      if (r.code !== 0) throw new Error(`ffmpeg（fake 音声）が失敗しました: ${r.stderr.trim().slice(0, 200)}`);
      await fs.rename(tmp, outFile);
      const ms = (this.ffprobe ? await probeDurationMs(this.ffprobe, outFile) : null) ?? est;
      return { duration_ms: ms, bytes: (await fs.stat(outFile)).size };
    }
    const body = Buffer.from(`LCI-FAKE-TTS ${est}ms\n`);
    await fs.writeFile(outFile, body);
    return { duration_ms: est, bytes: body.length };
  }
}

export interface EngineResolution {
  engine: TtsEngine | null;
  /** engine が null のときの理由（UI の「字幕のみで再生します」に出す） */
  reason?: string;
}

/**
 * 環境変数から音声エンジンを決める。
 * LCI_TTS_ENGINE=auto（既定）: say があれば say、無ければ無し（字幕のみ、D10）。fake は明示したときだけ。
 * LCI_TTS_VOICE（既定 Kyoko）、LCI_TTS_RATE（say -r、既定は声の既定）。
 */
export async function resolveEngine(env: NodeJS.ProcessEnv = process.env, opts: { checkVoice?: boolean; readingCps?: number } = {}): Promise<EngineResolution> {
  const cfg = ttsConfigFromEnv(env);
  if (cfg.engine === "none") return { engine: null, reason: "音声合成は無効です（LCI_TTS_ENGINE=none）。字幕のみで再生します" };
  const ffmpeg = await which(cfg.ffmpegBin);
  const ffprobe = await which(cfg.ffprobeBin);
  if (cfg.engine === "fake") return { engine: new FakeEngine({ voice: "fake", rate: cfg.rate, ffmpeg, ffprobe, readingCps: opts.readingCps }) };
  const sayBin = await which("say");
  if (!sayBin) {
    return { engine: null, reason: cfg.engine === "say" ? "macOS の say コマンドが見つかりません（LCI_TTS_ENGINE=say）。字幕のみで再生します" : "この環境には macOS の say がありません。字幕のみで再生します（Mac でアプリを動かすと音声を作れます）" };
  }
  if (opts.checkVoice) {
    const voices = await SayEngine.japaneseVoices(sayBin);
    if (voices.length && !voices.includes(cfg.voice)) {
      return { engine: null, reason: `声 ${cfg.voice} が見つかりません。使える日本語の声: ${voices.join(", ")}（LCI_TTS_VOICE で指定）` };
    }
  }
  return { engine: new SayEngine({ sayBin, voice: cfg.voice, rate: cfg.rate, ffmpeg, ffprobe, afinfo: await which("afinfo") }) };
}
