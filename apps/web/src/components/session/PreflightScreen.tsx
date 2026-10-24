"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@lci/core/browser";
import { probeDevices } from "@/lib/capture/recorder";

/**
 * S2 セッション開始前（04 §6, FR-U-03, FR-C-06, FR-C-63）。
 * - 初回のみ同意文（保存場所・外部送信の範囲）を表示し localStorage に記録
 * - カメラ／マイク許可とプレビュー、音量メーター、デバイス選択
 * - 録画オプション（カメラ／画面／ライブ字幕）
 * - Docker 状態（/api/runner/status。未実装なら 404 を許容）
 * - 「開始」（Enter）: POST /api/sessions → POST /start → /session/[id]
 * 問題文はここでは見せない（初見で読む練習のため。S3 の開始操作で表示する）。
 */

const CONSENT_KEY = "lci-consent-v1";
const DEVICE_KEY = "lci-devices";

export interface PreflightProps {
  problemId: string;
  title: string;
  timeLimitMin: number;
  language: Language;
  languageLabel: string;
  kind: "stdio" | "unit" | "web" | "none";
  hasFollowups: boolean;
  defaultMode: "silent" | "followup";
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savedDevices(): { audio?: string; video?: string } {
  try {
    return JSON.parse(readLocal(DEVICE_KEY) ?? "{}") as { audio?: string; video?: string };
  } catch {
    return {};
  }
}

type DockerState = { state: "loading" } | { state: "ok" | "not_running" | "missing" } | { state: "unknown"; detail: string } | { state: "not_needed" };

export function PreflightScreen(props: PreflightProps) {
  const router = useRouter();
  // SSR しない（client.tsx）ので localStorage を初期値に直接使える
  const [consented, setConsented] = useState<boolean>(() => readLocal(CONSENT_KEY) === "1");
  const [cameraOn, setCamera] = useState(true);
  const camera = cameraOn;
  const [screen, setScreen] = useState(false);
  const [liveStt, setLiveStt] = useState(false);
  const [mode, setMode] = useState<"silent" | "followup">(props.defaultMode);
  const [permError, setPermError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [streamOk, setStreamOk] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioSel, setAudioId] = useState(() => savedDevices().audio ?? "");
  const [videoSel, setVideoId] = useState(() => savedDevices().video ?? "");
  const audioId = audioSel;
  const videoId = videoSel;
  const [level, setLevel] = useState(0);
  const [docker, setDocker] = useState<DockerState>(props.kind === "web" || props.kind === "none" ? { state: "not_needed" } : { state: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);

  useEffect(() => {
    if (docker.state !== "loading") return;
    let cancelled = false;
    fetch("/api/runner/status")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setDocker({ state: "unknown", detail: r.status === 404 ? "実行環境の状態 API がまだありません" : `HTTP ${r.status}` });
          return;
        }
        const j = (await r.json()) as { docker?: "ok" | "not_running" | "missing" };
        setDocker(j.docker ? { state: j.docker } : { state: "unknown", detail: "応答を解釈できません" });
      })
      .catch(() => !cancelled && setDocker({ state: "unknown", detail: "サーバに接続できません" }));
    return () => {
      cancelled = true;
    };
  }, [docker.state]);

  /** カメラ・マイクと音量メーターを解放する（状態は触らない: effect の cleanup からも呼ぶため） */
  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (meterRef.current) {
      clearInterval(meterRef.current.timer);
      void meterRef.current.ctx.close().catch(() => {});
      meterRef.current = null;
    }
  }, []);

  /** 権限確認とプレビュー。設定変更のハンドラから、変更後の値を引数で受けて呼ぶ（state の反映を待たない） */
  const check = useCallback(async (over: { camera?: boolean; audioId?: string; videoId?: string } = {}) => {
    const camera = over.camera ?? cameraOn;
    const audioId = over.audioId ?? audioSel;
    const videoId = over.videoId ?? videoSel;
    releaseMedia();
    setStreamOk(false);
    setLevel(0);
    setChecking(true);
    setPermError(null);
    const constraintsCamera = camera;
    const { stream, error, devices: devs } = await probeDevices(constraintsCamera);
    setChecking(false);
    if (!stream) {
      setPermError(error);
      return;
    }
    // 選択済みデバイスがあれば取り直す
    let s = stream;
    if (audioId || (camera && videoId)) {
      try {
        const alt = await navigator.mediaDevices.getUserMedia({
          audio: audioId ? { deviceId: { exact: audioId } } : true,
          video: camera ? (videoId ? { deviceId: { exact: videoId } } : true) : false,
        });
        stream.getTracks().forEach((t) => t.stop());
        s = alt;
      } catch {
        /* 選んだデバイスが無くなっていたら既定のまま */
      }
    }
    streamRef.current = s;
    setDevices(devs);
    setStreamOk(true);
    if (videoRef.current) {
      videoRef.current.srcObject = camera ? s : null;
      void videoRef.current.play().catch(() => {});
    }
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6));
      }, 150);
      meterRef.current = { ctx, timer };
    } catch {
      /* 音量メーターは補助 */
    }
  }, [audioSel, cameraOn, releaseMedia, videoSel]);

  // 同意済みで開いたときだけ、マウント直後に 1 度確認する。離脱時はデバイスを解放する
  const consentedAtMount = useRef(consented);
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });
  useEffect(() => {
    const timer = consentedAtMount.current ? setTimeout(() => void checkRef.current(), 0) : null;
    return () => {
      if (timer) clearTimeout(timer);
      releaseMedia();
    };
  }, [releaseMedia]);

  const start = useCallback(
    async (noRecording = false) => {
      if (starting) return;
      setStarting(true);
      setStartError(null);
      try {
        localStorage.setItem(DEVICE_KEY, JSON.stringify({ audio: audioId || undefined, video: videoId || undefined }));
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problem_id: props.problemId, language: props.language, capture_options: { camera: camera && !noRecording, screen: screen && !noRecording, live_stt: liveStt } }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
        const session = (await res.json()) as { session_id: string };
        const st = await fetch(`/api/sessions/${encodeURIComponent(session.session_id)}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recorders: [] }) });
        if (!st.ok) throw new Error(`開始に失敗しました (HTTP ${st.status})`);
        // S3 で取り直すのでプレビューは解放する
        releaseMedia();
        const q = new URLSearchParams();
        if (mode !== props.defaultMode || mode === "followup") q.set("mode", mode);
        if (noRecording) q.set("norec", "1");
        const qs = q.toString();
        router.push(`/session/${encodeURIComponent(session.session_id)}${qs ? `?${qs}` : ""}`);
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
        setStarting(false);
      }
    },
    [audioId, camera, liveStt, mode, props.defaultMode, props.language, props.problemId, router, screen, starting, releaseMedia, videoId],
  );

  // Enter 1 回で開始（FR-U-03）。入力要素にフォーカスがあるときは除く
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (!consented || !streamOk) return;
      e.preventDefault();
      void start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [consented, start, streamOk]);

  if (!consented) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 space-y-6">
        <h1 className="text-xl font-semibold">はじめに：記録と保存について</h1>
        <div className="space-y-3 text-sm leading-relaxed rounded-lg border border-border bg-bg-elev p-5">
          <p>このアプリは練習中の <strong>カメラ映像・マイク音声・エディタの編集操作</strong> を記録します（画面録画は選んだときだけ、このタブのみ）。</p>
          <p>記録はすべてこの Mac のリポジトリ内 <code className="font-mono">data/sessions/</code> に保存され、ユーザの操作なしにネットワークへ送られることはありません。</p>
          <p>文字起こしはローカルの whisper.cpp で行います。外部への送信が起きるのは、評価を Claude（Anthropic API または MCP 経由）に依頼したときだけで、送るのは文字起こし・編集ログ・実行結果と、選んだ場合の静止画です。動画そのものは送りません。</p>
          <p>セッションは履歴画面からいつでも完全に削除できます。</p>
        </div>
        <button
          type="button"
          autoFocus
          className="rounded-md bg-accent px-4 py-2 text-accent-fg text-sm font-medium"
          onClick={() => {
            try {
              localStorage.setItem(CONSENT_KEY, "1");
            } catch {
              /* ignore */
            }
            setConsented(true);
            void check();
          }}
        >
          理解して続ける
        </button>
      </main>
    );
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <p className="text-xs text-fg-muted font-mono">{props.problemId} · {props.languageLabel} · {props.timeLimitMin} 分</p>
        <h1 className="text-xl font-semibold">{props.title}</h1>
        <p className="text-sm text-fg-muted">問題文は開始と同時に表示されます。準備ができたら Enter で開始してください。</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3" aria-label="デバイス確認">
          <h2 className="text-sm font-medium">カメラとマイク</h2>
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-bg-elev grid place-items-center">
            {camera ? <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${streamOk ? "" : "hidden"}`} /> : null}
            {!camera ? <span className="text-sm text-fg-muted">カメラは使いません（音声のみ）</span> : !streamOk ? <span className="text-sm text-fg-muted">{checking ? "確認中…" : "プレビューなし"}</span> : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span>マイク</span>
            <div className="h-1.5 flex-1 rounded bg-border overflow-hidden" aria-label="入力音量">
              <div className="h-full bg-ok" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          {permError ? (
            <div className="rounded-md border border-danger/40 p-3 text-sm space-y-2">
              <p className="text-danger">{permError}</p>
              <div className="flex gap-2">
                <button type="button" className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => void check()}>
                  もう一度確認
                </button>
                <button type="button" className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => void start(true)}>
                  録画なしで続行（編集ログのみ）
                </button>
              </div>
            </div>
          ) : null}
          {streamOk ? (
            <div className="grid gap-2 text-sm">
              <label className="grid gap-1">
                <span className="text-xs text-fg-muted">マイク</span>
                <select className="rounded-md border border-border bg-bg-elev px-2 py-1" value={audioId} onChange={(e) => {
                  setAudioId(e.target.value);
                  void check({ audioId: e.target.value });
                }}>
                  <option value="">既定</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "マイク"}
                    </option>
                  ))}
                </select>
              </label>
              {camera ? (
                <label className="grid gap-1">
                  <span className="text-xs text-fg-muted">カメラ</span>
                  <select className="rounded-md border border-border bg-bg-elev px-2 py-1" value={videoId} onChange={(e) => {
                    setVideoId(e.target.value);
                    void check({ videoId: e.target.value });
                  }}>
                    <option value="">既定</option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "カメラ"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-4" aria-label="記録オプション">
          <h2 className="text-sm font-medium">記録するもの</h2>
          <fieldset className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked disabled />
              <span>マイク音声と編集ログ<span className="block text-xs text-fg-muted">常に記録します</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={camera} onChange={(e) => {
                  setCamera(e.target.checked);
                  void check({ camera: e.target.checked });
                }} />
              <span>カメラ映像<span className="block text-xs text-fg-muted">セッション中は自分の映像を表示しません</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={screen} onChange={(e) => setScreen(e.target.checked)} />
              <span>画面録画（このタブのみ）<span className="block text-xs text-fg-muted">開始時にブラウザの共有ダイアログが出ます。「このタブ」を選んでください</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={liveStt} onChange={(e) => setLiveStt(e.target.checked)} />
              <span>ライブ字幕<span className="block text-xs text-fg-muted">未対応です（確定版の文字起こしは終了後に行います）</span></span>
            </label>
          </fieldset>

          {props.hasFollowups ? (
            <fieldset className="space-y-2 text-sm">
              <legend className="text-sm font-medium mb-1">面接官モード</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "silent"} onChange={() => setMode("silent")} />
                無反応（Pixiv 形式）
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "followup"} onChange={() => setMode("followup")} />
                ときどき質問が表示される
              </label>
            </fieldset>
          ) : null}

          <div className="space-y-1 text-sm">
            <h2 className="font-medium">実行環境</h2>
            <p className="text-fg-muted">
              {docker.state === "not_needed" && "ブラウザ内で実行します（Docker 不要）"}
              {docker.state === "loading" && "確認中…"}
              {docker.state === "ok" && "Docker: 利用可能"}
              {docker.state === "not_running" && <span className="text-warn">Docker が起動していません。実行・判定は使えませんが、練習と記録はできます。</span>}
              {docker.state === "missing" && <span className="text-warn">Docker が見つかりません。実行・判定は使えませんが、練習と記録はできます。</span>}
              {docker.state === "unknown" && <span>未確認（{docker.detail}）</span>}
            </p>
          </div>
        </section>
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          disabled={!streamOk || starting}
          className="rounded-md bg-accent px-5 py-2 text-accent-fg font-medium disabled:opacity-50"
          onClick={() => void start()}
        >
          {starting ? "準備中…" : "開始"}
        </button>
        <span className="text-xs text-fg-muted">Enter で開始</span>
        {startError ? <span className="text-sm text-danger">{startError}</span> : null}
      </div>
    </main>
  );
}
