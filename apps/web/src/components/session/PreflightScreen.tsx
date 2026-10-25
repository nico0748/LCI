"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@lci/core/browser";
import { probeDevices } from "@/lib/capture/recorder";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Breadcrumbs,
  Button,
  Card,
  ChoiceGroup,
  Disclosure,
  Dl,
  Field,
  Kbd,
  LinkButton,
  NotificationBanner,
  Radio,
  SYSTEM_ICON,
  Select,
  StatusBadge,
  Switch,
  cx,
} from "@/components/ui";
import { METER_SEGMENTS, VOICE_CONFIRM_MS, VOICE_DB, VOICE_SEGMENT, levelSegments, rmsToDb } from "./meter";
import { detectPlatform, shortcut } from "./keys";
import { NarrowNotice, PendingIcon } from "./parts";
import { useWideEnough } from "./useWideEnough";
import { AUTOSTART_KEY, CHIME_KEY, CONSENT_KEY, DEVICE_KEY } from "./types";

/**
 * S2 開始前の確認（04 §6, FR-U-03, FR-C-06, FR-C-63、03 §2）。
 * - 初回だけ同意文（記録するもの・保存場所・外部に送るもの）を出し localStorage に記録する
 * - ウィザードにしない: 互いに独立した確認を「準備状況リスト」に並べ、✕ の行だけが開始を止める（03 §2.1）
 * - 「開始」1 回で面接が始まる（X9）: POST /api/sessions → /start → /session/[id]（自動開始の印を付けて遷移）。
 *   画面録画を選んだときだけ、getDisplayMedia にユーザー操作が要るので S3 にもう一度ボタンが出る
 * - 1280px 未満では開始させない（X13）
 * 問題文はここでは見せない（初見で読む練習のため。開始と同時に表示する）。
 */

export interface PreflightProps {
  problemId: string;
  title: string;
  timeLimitMin: number;
  language: Language;
  languages: { value: Language; label: string }[];
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

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* プライベートモード等。既定値に戻るだけ */
  }
}

function savedDevices(): { audio?: string; video?: string } {
  try {
    return JSON.parse(readLocal(DEVICE_KEY) ?? "{}") as { audio?: string; video?: string };
  } catch {
    return {};
  }
}

type DockerState = { state: "loading" } | { state: "ok" | "not_running" | "missing" } | { state: "unknown" } | { state: "not_needed" };
type RowStatus = "ok" | "warning" | "danger" | "pending" | "neutral";

export function PreflightScreen(props: PreflightProps) {
  const router = useRouter();
  const wide = useWideEnough();
  const platform = detectPlatform();
  // SSR しない（client.tsx）ので localStorage を初期値に直接使える
  const [consented, setConsented] = useState<boolean>(() => readLocal(CONSENT_KEY) === "1");
  const [language, setLanguage] = useState<Language>(props.language);
  const [cameraOn, setCamera] = useState(true);
  const [screen, setScreen] = useState(false);
  const [chime, setChime] = useState(() => readLocal(CHIME_KEY) !== "0");
  const [mode, setMode] = useState<"silent" | "followup">(props.defaultMode);
  const [permError, setPermError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [streamOk, setStreamOk] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioId, setAudioId] = useState(() => savedDevices().audio ?? "");
  const [videoId, setVideoId] = useState(() => savedDevices().video ?? "");
  const [labels, setLabels] = useState({ audio: "", video: "" });
  const [level, setLevel] = useState(0);
  const [voiceHeard, setVoiceHeard] = useState(false);
  const [docker, setDocker] = useState<DockerState>(props.kind === "web" || props.kind === "none" ? { state: "not_needed" } : { state: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);
  // 二重開始の防止（state の反映を待たずに止める。03 P1-3）
  const startingRef = useRef(false);

  useEffect(() => {
    if (docker.state !== "loading") return;
    let cancelled = false;
    fetch("/api/runner/status")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setDocker({ state: "unknown" });
          return;
        }
        const j = (await r.json()) as { docker?: "ok" | "not_running" | "missing" };
        setDocker(j.docker ? { state: j.docker } : { state: "unknown" });
      })
      .catch(() => !cancelled && setDocker({ state: "unknown" }));
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
  const check = useCallback(
    async (over: { camera?: boolean; audioId?: string; videoId?: string } = {}) => {
      const camera = over.camera ?? cameraOn;
      const aId = over.audioId ?? audioId;
      const vId = over.videoId ?? videoId;
      releaseMedia();
      setStreamOk(false);
      setLevel(0);
      setVoiceHeard(false);
      setChecking(true);
      setPermError(null);
      const { stream, error, devices: devs } = await probeDevices(camera);
      setChecking(false);
      if (!stream) {
        setPermError(error);
        // 既定のデバイスで失敗しても別のデバイスを選べるように、一覧だけは取っておく（03 P2-13）
        try {
          setDevices(await navigator.mediaDevices.enumerateDevices());
        } catch {
          /* 一覧も取れなければ選択欄を出さない */
        }
        return;
      }
      // 選択済みデバイスがあれば取り直す
      let s = stream;
      if (aId || (camera && vId)) {
        try {
          const alt = await navigator.mediaDevices.getUserMedia({
            audio: aId ? { deviceId: { exact: aId } } : true,
            video: camera ? (vId ? { deviceId: { exact: vId } } : true) : false,
          });
          stream.getTracks().forEach((t) => t.stop());
          s = alt;
        } catch {
          /* 選んだデバイスが無くなっていたら既定のまま */
        }
      }
      streamRef.current = s;
      setLabels({ audio: s.getAudioTracks()[0]?.label ?? "", video: s.getVideoTracks()[0]?.label ?? "" });
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
        let loudMs = 0;
        const timer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
          const rms = Math.sqrt(sum / buf.length);
          setLevel(rms);
          // 目安を超えた時間の合計が 1 秒になったら「声を検出しました」（03 §2.3）
          if (rmsToDb(rms) >= VOICE_DB) {
            loudMs += 150;
            if (loudMs >= VOICE_CONFIRM_MS) setVoiceHeard(true);
          }
        }, 150);
        meterRef.current = { ctx, timer };
      } catch {
        /* 音量メーターは補助 */
      }
    },
    [audioId, cameraOn, releaseMedia, videoId],
  );

  // ページを直接開いたときは AudioContext が止まった状態で作られる。最初の操作で動かす
  useEffect(() => {
    const resume = () => {
      const ctx = meterRef.current?.ctx;
      if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

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

  const runnerOff = docker.state === "not_running" || docker.state === "missing";
  const canStart = consented && wide && streamOk && !starting;

  const start = useCallback(
    async (noRecording = false) => {
      if (startingRef.current || !wide) return;
      startingRef.current = true;
      setStarting(true);
      setStartError(null);
      writeLocal(DEVICE_KEY, JSON.stringify({ audio: audioId || undefined, video: videoId || undefined }));
      writeLocal(CHIME_KEY, chime ? "1" : "0");
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problem_id: props.problemId, language, capture_options: { camera: cameraOn && !noRecording, screen: screen && !noRecording, live_stt: false } }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
        const session = (await res.json()) as { session_id: string };
        const st = await fetch(`/api/sessions/${encodeURIComponent(session.session_id)}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recorders: [] }) });
        if (!st.ok) throw new Error(`開始に失敗しました (HTTP ${st.status})`);
        // S3 で取り直すのでプレビューは解放する
        releaseMedia();
        // S3 はこの印があれば「問題を表示して開始」を出さずに始める（X9）。直接開いた・再開したときは印が無い
        try {
          sessionStorage.setItem(AUTOSTART_KEY(session.session_id), "1");
        } catch {
          /* 印が無ければ S3 で開始ボタンを 1 回押すだけ */
        }
        const q = new URLSearchParams();
        if (mode !== props.defaultMode || mode === "followup") q.set("mode", mode);
        if (noRecording) q.set("norec", "1");
        if (runnerOff && (props.kind === "stdio" || props.kind === "unit")) q.set("runner", "off");
        const qs = q.toString();
        router.push(`/session/${encodeURIComponent(session.session_id)}${qs ? `?${qs}` : ""}`);
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
        startingRef.current = false;
        setStarting(false);
      }
    },
    [audioId, cameraOn, chime, language, mode, props.defaultMode, props.kind, props.problemId, releaseMedia, router, runnerOff, screen, videoId, wide],
  );

  // Enter 1 回で開始（FR-U-03）。IME 変換中と、Enter に別の意味がある要素の上では除く
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing || e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || tag === "INPUT") return;
      if (!canStart) return;
      e.preventDefault();
      void start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canStart, start]);

  const crumbs = (
    <Breadcrumbs
      items={[
        { label: "問題", href: "/problems" },
        { label: props.title, href: `/problems/${encodeURIComponent(props.problemId)}` },
        { label: "開始前の確認" },
      ]}
    />
  );

  if (!consented) {
    return (
      <PageContainer as="main" width="reading" className="flex flex-col gap-6">
        {crumbs}
        <div className="flex flex-col gap-2">
          <h1 className="text-std-24B-150 text-fg">はじめに：記録と保存について</h1>
          <p className="text-std-16N-170 text-fg-body">初回だけ確認します。練習を始める前に、何をどこに残すかを読んでください。</p>
        </div>
        <Card>
          <Dl
            layout="stack"
            className="gap-4 [&_dd]:text-std-16N-170 [&_dt]:text-dns-14B-130 [&_dt]:text-fg"
            items={[
              {
                term: "記録するもの",
                description: "練習中のカメラ映像・マイク音声・エディタの編集操作。画面録画は選んだときだけで、このタブに限ります。",
              },
              {
                term: "保存場所",
                description: (
                  <>
                    すべてこの Mac のリポジトリ内 <code className="rounded-4 bg-sunken px-1 text-mono-14N-150">data/sessions/</code> に保存します。セッションは履歴画面からいつでも完全に削除できます。
                  </>
                ),
              },
              {
                term: "外部に送るもの・送らないもの",
                description:
                  "文字起こしはローカルの whisper.cpp で行います。外部に送るのは、評価を Claude（Anthropic API または MCP 経由）に依頼したときだけで、送るのは文字起こし・編集ログ・実行結果と、選んだ場合の静止画です。動画そのものは送りません。",
              },
            ]}
          />
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            autoFocus
            onClick={() => {
              writeLocal(CONSENT_KEY, "1");
              setConsented(true);
              void check();
            }}
          >
            理解して続ける
          </Button>
          <LinkButton variant="tertiary" size="md" href={`/problems/${encodeURIComponent(props.problemId)}`}>
            問題に戻る
          </LinkButton>
        </div>
      </PageContainer>
    );
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  const mod = (n: "run" | "judge" | "problem" | "end") => shortcut(n, platform).kbd;

  const camRow: { status: RowStatus; detail: ReactNode } = !cameraOn
    ? { status: "neutral", detail: "使いません（音声のみで記録します）" }
    : permError
      ? { status: "danger", detail: "使えません" }
      : checking || !streamOk
        ? { status: "pending", detail: "確認しています…" }
        : { status: "ok", detail: labels.video || "既定のカメラ" };
  const micRow: { status: RowStatus; detail: ReactNode } = permError
    ? { status: "danger", detail: "使えません" }
    : checking || !streamOk
      ? { status: "pending", detail: "確認しています…" }
      : voiceHeard
        ? { status: "ok", detail: <>{labels.audio || "既定のマイク"} · 声を検出しました</> }
        : { status: "pending", detail: <>{labels.audio || "既定のマイク"} · 話してみてください</> };
  const dockerRow: { status: RowStatus; detail: ReactNode } =
    docker.state === "not_needed"
      ? { status: "ok", detail: "ブラウザ内で実行します（Docker は不要）" }
      : docker.state === "loading"
        ? { status: "pending", detail: "確認しています…" }
        : docker.state === "ok"
          ? { status: "ok", detail: "Docker を利用できます" }
          : docker.state === "not_running"
            ? { status: "warning", detail: "Docker が起動していません。実行・判定なしで練習できます" }
            : docker.state === "missing"
              ? { status: "warning", detail: "Docker が見つかりません。実行・判定なしで練習できます" }
              : { status: "warning", detail: "確認できませんでした（実行・判定が使えない可能性があります）" };

  const deviceSelect = (kind: "audio" | "video") => {
    const list = kind === "audio" ? audioInputs : videoInputs;
    if (list.length === 0) return null;
    const value = kind === "audio" ? audioId : videoId;
    return (
      <Field label={kind === "audio" ? "マイクを選ぶ" : "カメラを選ぶ"} labelHidden className="mt-2 max-w-[320px]">
        {(p) => (
          <Select
            {...p}
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (kind === "audio") {
                setAudioId(v);
                void check({ audioId: v });
              } else {
                setVideoId(v);
                void check({ videoId: v });
              }
            }}
          >
            <option value="">既定の{kind === "audio" ? "マイク" : "カメラ"}</option>
            {list.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `${kind === "audio" ? "マイク" : "カメラ"} ${i + 1}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  };

  const notes: string[] = [];
  if (runnerOff || docker.state === "unknown") notes.push("実行環境なしで開始します（実行・判定は使えません）");
  if (screen) notes.push("次の画面で、共有する画面に「このタブ」を選んでから始まります");

  return (
    <PageContainer as="main" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {crumbs}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dns-13N-130 text-fg-muted">
          <span className="text-mono-12N-120">{props.problemId}</span>
          <span aria-hidden="true">·</span>
          {props.languages.length > 1 ? (
            <Field label="言語" labelHidden className="w-40">
              {(p) => (
                <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  {props.languages.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <span>{props.languages[0]?.label ?? language}</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{props.timeLimitMin} 分</span>
        </div>
        <h1 className="text-std-24B-150 text-fg">{props.title}</h1>
        <p className="text-std-16N-170 text-fg-muted">問題文は開始と同時に表示されます。準備が整ったら Enter で開始してください。</p>
      </header>

      {!wide && <NarrowNotice />}

      {permError && (
        <NotificationBanner
          tone="danger"
          title="カメラとマイクを使えません"
          actions={
            <>
              <Button size="sm" onClick={() => void check()}>
                もう一度確認
              </Button>
              <Button size="sm" variant="tertiary" disabled={!wide || starting} loading={starting} onClick={() => void start(true)}>
                録画なしで続行（編集ログのみ）
              </Button>
            </>
          }
        >
          <p>{permError}</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>Chrome のアドレスバー左のアイコン → サイトの設定で、カメラとマイクを「許可」にする</li>
            <li>macOS の「システム設定 → プライバシーとセキュリティ → カメラ／マイク」で Chrome をオンにする</li>
          </ol>
        </NotificationBanner>
      )}

      <div className="grid items-start gap-6 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex flex-col gap-3">
          <h2 className="text-dns-16B-130 text-fg">カメラとマイク</h2>
          <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-6 border border-border bg-sunken">
            {cameraOn ? <video ref={videoRef} muted playsInline aria-label="カメラのプレビュー（鏡像）" className={cx("h-full w-full -scale-x-100 object-cover", !streamOk && "hidden")} /> : null}
            {!cameraOn ? (
              <span className="text-dns-14N-130 text-fg-muted">カメラは使いません（音声のみで記録します）</span>
            ) : !streamOk ? (
              <span className="text-dns-14N-130 text-fg-muted">{checking ? "カメラを確認しています…" : "プレビューなし"}</span>
            ) : null}
          </div>
          {cameraOn && <p className="text-dns-13N-130 text-fg-muted">プレビューは鏡像です。録画は反転しません。面接中は自分の映像を表示しません。</p>}
          <MicMeter level={streamOk ? level : 0} heard={voiceHeard} active={streamOk} />
        </Card>

        <Card className="flex flex-col gap-5">
          <section aria-labelledby="pf-ready" className="flex flex-col gap-1">
            <h2 id="pf-ready" className="text-dns-16B-130 text-fg">
              準備状況
            </h2>
            <ul aria-live="polite" className="flex flex-col">
              <ReadyRow label="カメラ" {...camRow}>
                {cameraOn && deviceSelect("video")}
              </ReadyRow>
              <ReadyRow label="マイク" {...micRow}>
                {deviceSelect("audio")}
              </ReadyRow>
              <ReadyRow label="実行環境" {...dockerRow}>
                {(runnerOff || docker.state === "unknown") && (
                  <div className="mt-2 flex flex-col items-start gap-1">
                    <Button size="2xs" onClick={() => setDocker({ state: "loading" })}>
                      再確認
                    </Button>
                    <Disclosure summary="起動方法" summaryClassName="text-dns-13N-130">
                      <ol className="list-decimal pl-5 text-std-14N-170 text-fg-body">
                        <li>{docker.state === "missing" ? "Docker Desktop をインストールして起動します" : "Docker Desktop を起動します"}（メニューバーのアイコンが落ち着くまで待つ）</li>
                        <li>上の「再確認」を押します</li>
                      </ol>
                    </Disclosure>
                  </div>
                )}
              </ReadyRow>
            </ul>
          </section>

          <section aria-labelledby="pf-rec" className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h2 id="pf-rec" className="text-dns-16B-130 text-fg">
              記録するもの
            </h2>
            <p className="flex items-center gap-2 text-dns-14N-130 text-fg-body">
              <StatusBadge tone="neutral">常に記録</StatusBadge>
              マイク音声と編集ログ
            </p>
            <Switch
              checked={cameraOn}
              onCheckedChange={(v) => {
                setCamera(v);
                void check({ camera: v });
              }}
              hint="セッション中は自分の映像を表示しません"
            >
              カメラ映像
            </Switch>
            <Switch checked={screen} onCheckedChange={setScreen} hint="開始時にブラウザの共有ダイアログが出ます。「このタブ」を選んでください">
              画面録画（このタブのみ）
            </Switch>
            <Switch checked={chime} onCheckedChange={setChime} hint="録音に入らないよう、小さく短い音です">
              残り 1 分で小さな音を鳴らす
            </Switch>
          </section>

          {props.hasFollowups && (
            <section className="border-t border-border-subtle pt-4">
              <ChoiceGroup legend="面接官">
                <Radio name="mode" checked={mode === "silent"} onChange={() => setMode("silent")} hint="本番の Pixiv 形式と同じく、質問は出ません">
                  無反応
                </Radio>
                <Radio name="mode" checked={mode === "followup"} onChange={() => setMode("followup")} hint="決まった時刻と 60 秒以上の無言のときに、画面下に質問が出ます">
                  ときどき質問する
                </Radio>
              </ChoiceGroup>
            </section>
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md" kbd="↵" keyshortcuts="Enter" disabled={!canStart} loading={starting} onClick={() => void start()}>
              開始
            </Button>
            <p className="text-dns-14N-130 text-fg-body">開始すると、問題文・タイマー・録画が同時に始まります。</p>
          </div>
          {!wide ? (
            <p className="text-dns-13N-130 text-fg-muted">幅 1280px 以上のウィンドウで開始できます。</p>
          ) : !streamOk && !permError ? (
            <p className="text-dns-13N-130 text-fg-muted">カメラとマイクの確認が終わると開始できます。</p>
          ) : null}
          {notes.map((n) => (
            <p key={n} className="flex items-center gap-1.5 text-dns-13N-130 text-fg-body">
              <span className="text-warning">
                <SYSTEM_ICON.warning size={14} />
              </span>
              {n}
            </p>
          ))}
          {startError && (
            <p role="alert" className="flex items-center gap-1.5 text-dns-14N-130 text-danger">
              <SYSTEM_ICON.danger size={14} />
              開始できませんでした: {startError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-dns-14B-130 text-fg">セッション中の操作</h2>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-dns-13N-130 text-fg-body">
            <dt>
              <Kbd>{mod("run")}</Kbd>
            </dt>
            <dd>実行</dd>
            <dt>
              <Kbd>{mod("judge")}</Kbd>
            </dt>
            <dd>公開サンプルで判定</dd>
            <dt>
              <Kbd>{mod("problem")}</Kbd>
            </dt>
            <dd>問題ペインを開く・畳む</dd>
            <dt>
              <Kbd>{mod("end")}</Kbd>
            </dt>
            <dd>終了（確認あり）</dd>
          </dl>
          <p className="text-dns-13N-130 text-fg-muted">
            ほかの操作は <Kbd>{shortcut("chord", platform).kbd}</Kbd> → <Kbd>?</Kbd> で一覧できます。
          </p>
        </div>
      </Card>
    </PageContainer>
  );
}

const ROW_TONE: Record<RowStatus, { className: string; word: string }> = {
  ok: { className: "text-success", word: "準備完了" },
  warning: { className: "text-warning", word: "注意" },
  danger: { className: "text-danger", word: "使えません" },
  pending: { className: "text-fg-muted", word: "確認中" },
  neutral: { className: "text-fg-muted", word: "使わない" },
};

/** 準備状況の 1 行: 図形＋項目名＋検出内容＋操作。色だけに頼らず、図形と sr-only の語でも状態を伝える */
function ReadyRow({ label, status, detail, children }: { label: string; status: RowStatus; detail: ReactNode; children?: ReactNode }) {
  const tone = ROW_TONE[status];
  const Icon = status === "ok" ? SYSTEM_ICON.success : status === "warning" ? SYSTEM_ICON.warning : status === "danger" ? SYSTEM_ICON.danger : PendingIcon;
  return (
    <li className="grid grid-cols-[20px_72px_minmax(0,1fr)] items-start gap-x-2 border-b border-border-subtle py-3 last:border-b-0">
      <span className={cx("pt-px", tone.className)}>
        <Icon size={16} />
      </span>
      <span className="text-dns-14B-130 text-fg">
        {label}
        <span className="sr-only">: {tone.word}</span>
      </span>
      <div className="min-w-0">
        <p className="text-dns-14N-130 break-words text-fg-body">{detail}</p>
        {children}
      </div>
    </li>
  );
}

/** 12 段の静止セグメントのメーター＋目安線（03 §2.3）。滑らかに動かさない */
function MicMeter({ level, heard, active }: { level: number; heard: boolean; active: boolean }) {
  const lit = levelSegments(level);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-dns-13N-130 text-fg-muted">マイク</span>
        <div className="relative flex flex-1 gap-[3px]" role="meter" aria-label="マイクの入力音量" aria-valuemin={0} aria-valuemax={METER_SEGMENTS} aria-valuenow={lit}>
          {Array.from({ length: METER_SEGMENTS }, (_, i) => (
            <span key={i} className={cx("h-2.5 flex-1 rounded-[2px]", i < lit ? "bg-accent" : "bg-disabled")} />
          ))}
          {/* 目安線（この位置を超えれば十分な音量） */}
          <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 bg-fg-muted" style={{ left: `calc(${(VOICE_SEGMENT / METER_SEGMENTS) * 100}% - 2px)` }} />
        </div>
      </div>
      <p className="pl-[60px] text-dns-13N-130 text-fg-muted">
        {!active ? (
          "マイクの確認待ち"
        ) : heard ? (
          <span className="inline-flex items-center gap-1 text-success">
            <SYSTEM_ICON.success size={14} />
            声を検出しました
          </span>
        ) : (
          "縦線を超える大きさで話してみてください"
        )}
      </p>
    </div>
  );
}
