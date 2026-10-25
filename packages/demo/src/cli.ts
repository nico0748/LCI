import path from "node:path";
import { DemoStore } from "./store.ts";
import { resolveEngine, SayEngine } from "./tts/engines.ts";
import { synthesizeDemo } from "./tts/synth.ts";
import { which } from "./tts/exec.ts";

/**
 * デモ用 CLI。
 *   node --experimental-strip-types packages/demo/src/cli.ts synth <demo_id> [--revision N] [--force]
 *   node --experimental-strip-types packages/demo/src/cli.ts voices
 * synth は MCP の save_demo_script が切り離した子プロセスとして起動する（MCP の応答を待たせない、02 §6.1）。
 * 手で音声を作り直すときも使う。エンジンは LCI_TTS_ENGINE / LCI_TTS_VOICE / LCI_TTS_RATE で決まる。
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const dataRoot = process.env.LCI_DATA_ROOT ?? path.join(REPO_ROOT, "data");

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === "voices") {
    const say = await which("say");
    if (!say) {
      console.error("say が見つかりません（macOS 以外では音声を作れません。LCI_TTS_ENGINE=fake で偽の音声を作れます）");
      return 1;
    }
    for (const v of await SayEngine.japaneseVoices(say)) console.log(v);
    return 0;
  }
  if (cmd === "synth") {
    const demoId = rest.find((a) => !a.startsWith("--"));
    if (!demoId) {
      console.error("使い方: cli.ts synth <demo_id> [--revision N] [--force]");
      return 2;
    }
    const ri = rest.indexOf("--revision");
    const revision = ri !== -1 ? Number(rest[ri + 1]) : undefined;
    const r = await resolveEngine(process.env, { checkVoice: true });
    if (!r.engine) {
      console.error(`[demo-tts] ${r.reason}`);
      return 3;
    }
    const store = new DemoStore(dataRoot);
    const m = await synthesizeDemo(store, demoId, { engine: r.engine, revision, force: rest.includes("--force"), log: (s) => console.error(s), waitMs: 10 * 60_000 });
    console.log(JSON.stringify({ demo_id: demoId, engine: m.engine, voice: m.voice, segments: m.segments.length, total_bytes: m.total_bytes, total_ms: m.segments.reduce((a, s) => a + s.duration_ms, 0) }));
    return 0;
  }
  console.error("使い方: cli.ts synth <demo_id> [--revision N] [--force] | voices");
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(`[demo-tts] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
