"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import type { RunResult } from "@lci/core/browser";
import { Markdown } from "@/components/review/markdown";
import { Button, IconButton, Kbd, LoadingText, NotificationBanner, StatusBadge, Table, THead, TBody, Tr, Th, Td, tabClass, useTabs, cx } from "@/components/ui";
import { SessionController, readStoredOrigin } from "@/lib/capture/session-controller";
import { attachMonacoCapture, type MonacoCapture } from "@/lib/capture/monaco-hooks";
import type { RecorderStatus } from "@/lib/capture/recorder";
import { SandboxHost } from "@/lib/capture/sandbox/host";
import { judgeWeb, newRunId } from "@/lib/capture/sandbox/judge";
import type { FromFrameMessage, RequestRecord } from "@/lib/capture/sandbox/protocol";
import { LCI_MONACO_OPTIONS, loadMonacoReact, useMonacoTheme } from "@/lib/monaco";
import { playChime } from "./chime";
import { MONACO_LANGUAGE, AUTOSTART_KEY, CHIME_KEY, DEVICE_KEY, type InterviewData } from "./types";
import { PANE_KEY_STEP, PANE_MIN, paneStorageKey, parsePaneRatios, resizePane, resolvePaneWidths, type PaneKind, type PaneRatios } from "./pane-layout";
import { TIMER_MODE_KEY, parseTimerMode, timerAnnouncement, type TimerMode } from "./timer";
import { recState, stoppedMessage, type StopCause } from "./recording-state";
import { trackSilence } from "./meter";
import { chordAction, detectPlatform, shortcut, type ChordAction } from "./keys";
import { judgeLine, runHeadline, REQUEST_STATUS_LABEL } from "./run-view";
import { EndDialog, HelpIcon, PaneSeparator, RecIndicator, SessionTimer, ShortcutsDialog, type EndDialogState } from "./SessionChrome";
import { NarrowNotice, QuietButton } from "./parts";
import { useWideEnough } from "./useWideEnough";

/**
 * S3 面接セッション画面（04 §6.2、03 §3）。録画に映るので、静か・密・曖昧さなしを優先する。
 * ヘッダ 40px（問題名｜録画状態｜残り時間｜実行・判定｜終了…）／問題｜エディタ｜プレビュー・コンソール（幅は可変）／面接官の質問（followup のときだけ）。
 * - 動くのはタイマーの数字だけ（5 分前までは分単位）。アニメーション・トーストは置かない（[data-session] で全停止）
 * - 赤は「録画停止」だけ。終了は無彩色のテキストボタン、確認ダイアログの初期フォーカスは「続ける」
 * - テーマ（ページと Monaco）は開始時の値で固定し、セッション中に切り替えない（X11）
 * - S2 の「開始」から来たときは開始ボタンを出さずに始める。画面録画（getDisplayMedia にユーザー操作が要る）と再開のときだけ出す（X9）
 */

const Editor = dynamic(() => loadMonacoReact().then((m) => m.default), {
  ssr: false,
  loading: () => <LoadingText className="grid h-full place-items-center">エディタを読み込み中…</LoadingText>,
});

type Phase = "ready" | "starting" | "live" | "timeup" | "ending" | "error";

interface ConsoleLine {
  id: number;
  level: "log" | "info" | "warn" | "error" | "debug" | "system";
  text: string;
}

type Notice = { id: number; text: string };

/** 時間切れから保存までの猶予（最後の 1 文を録画で切らないため。03 §3.3） */
const TIMEUP_GRACE_MS = 5000;
/** 判定用フレームの実寸（judge.ts のレイアウト検証と同じ） */
const JUDGE_FRAME_WIDTH = 800;
/** 編集ログの未送信がこれ以上続いたら知らせる */
const SAVE_LAG_MS = 15_000;

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
    /* キャッシュ用途。保存できなくても既定値に戻るだけ */
  }
}

export function InterviewScreen({ data, recordingEnabled }: { data: InterviewData; recordingEnabled: boolean }) {
  const router = useRouter();
  const wide = useWideEnough();
  const platform = useMemo(() => detectPlatform(), []);
  // テーマは開始時の値で固定する（録画中に配色を変えない。X11）
  const liveMonacoTheme = useMonacoTheme();
  const [monacoTheme] = useState(liveMonacoTheme);
  const themeMode = monacoTheme === "lci-dark" ? "dark" : "light";

  const [phase, setPhase] = useState<Phase>("ready");
  // SSR しない（client.tsx）ので localStorage / sessionStorage を初期値に直接使える
  const [resuming] = useState(() => !!readStoredOrigin(data.sessionId));
  const needsGesture = data.capture.screen && recordingEnabled;
  const [autoStart] = useState(() => {
    try {
      return sessionStorage.getItem(AUTOSTART_KEY(data.sessionId)) === "1";
    } catch {
      return false;
    }
  });
  const [files, setFiles] = useState(data.files);
  const [active, setActive] = useState(0);
  const [remaining, setRemaining] = useState(data.timeLimitSec * 1000);
  const [timerMode, setTimerMode] = useState<TimerMode>(() => parseTimerMode(readLocal(TIMER_MODE_KEY)));
  const [announce, setAnnounce] = useState("");
  const [recStatus, setRecStatus] = useState<RecorderStatus[]>([]);
  const [stopCause, setStopCause] = useState<StopCause | null>(null);
  const [camUnavailable, setCamUnavailable] = useState(false);
  const [silent, setSilent] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saveLag, setSaveLag] = useState(false);
  const [busy, setBusy] = useState<null | "run" | "judge">(null);
  // 右ペイン最下部の状態行（高さ固定で中身だけ差し替える。03 §3.6）
  const [statusLine, setStatusLine] = useState<{ main: string; note?: string } | null>(null);
  const [runnerOff, setRunnerOff] = useState(data.runnerOff);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [stdin, setStdin] = useState(data.sampleStdin);
  const [runOutput, setRunOutput] = useState<RunResult | null>(null);
  const [followup, setFollowup] = useState<string | null>(null);
  const [problemOpen, setProblemOpen] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chordArmed, setChordArmed] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState(0);
  const [fit, setFit] = useState(true);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const paneKind: PaneKind = data.language === "html" ? "web" : "code";
  const [ratios, setRatios] = useState<PaneRatios>(() => parsePaneRatios(readLocal(paneStorageKey(paneKind)), paneKind));
  const [rowWidth, setRowWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));

  const ctrlRef = useRef<SessionController | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const captureRef = useRef<MonacoCapture | null>(null);
  const modelsRef = useRef(new Map<string, Monaco.editor.ITextModel>());
  const activeRef = useRef(0);
  const prevActiveRef = useRef(0);
  const lastEditRef = useRef(0);
  const shownFollowups = useRef(new Set<number>());
  const chimed = useRef(false);
  const endingRef = useRef(false);
  // 二重開始・二重実行の防止（state の反映を待たずに止める。03 P1-3）
  const beganRef = useRef(false);
  const busyRef = useRef(false);
  const timeUpRef = useRef(false);
  const prevRemainingRef = useRef(data.timeLimitSec * 1000);
  const pendingSinceRef = useRef<number | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeId = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const judgeBox = useRef<HTMLDivElement>(null);
  const previewHost = useRef<SandboxHost | null>(null);
  const judgeHost = useRef<SandboxHost | null>(null);
  const lineId = useRef(0);
  const frameErrors = useRef(0);
  const isWeb = data.language === "html";
  const hasJudge = isWeb ? !!data.webTests : data.testsKind !== "none";
  const runDisabled = !isWeb && runnerOff;

  const showNotice = useCallback((text: string) => setNotice({ id: ++noticeId.current, text }), []);

  const pushConsole = useCallback((level: ConsoleLine["level"], text: string) => {
    setConsoleLines((ls) => [...ls.slice(-199), { id: ++lineId.current, level, text }]);
  }, []);

  // ---- ファイル内容 ------------------------------------------------------------
  const textOf = useCallback(
    (idx: number) => {
      const f = files[idx]!;
      return modelsRef.current.get(f.fileId)?.getValue() ?? f.initial;
    },
    [files],
  );
  const allFiles = useCallback(() => files.map((f, i) => ({ path: f.path, content: textOf(i) })), [files, textOf]);
  const htmlIndex = useMemo(() => Math.max(0, files.findIndex((f) => f.language === "html")), [files]);

  // ---- 開始 ---------------------------------------------------------------------
  const begin = useCallback(async () => {
    if (beganRef.current) return;
    beganRef.current = true;
    try {
      sessionStorage.removeItem(AUTOSTART_KEY(data.sessionId));
    } catch {
      /* ignore */
    }
    setPhase("starting");
    let devices: { audio?: string; video?: string } | undefined;
    try {
      devices = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "{}") as { audio?: string; video?: string };
    } catch {
      devices = undefined;
    }
    const ctrl = new SessionController({
      sessionId: data.sessionId,
      record: { enabled: recordingEnabled, camera: data.capture.camera, screen: data.capture.screen },
      deviceIds: devices,
      onRecorderStatus: setRecStatus,
      onWarning: (code, detail) => {
        switch (code) {
          case "track_ended":
          case "recorder_error":
            setStopCause(code);
            break;
          case "cam_unavailable":
            setCamUnavailable(true);
            setStopCause("cam_unavailable");
            break;
          case "screen_unavailable":
          case "screen_denied":
            showNotice("画面録画を開始できませんでした（共有がキャンセルされたか、許可されていません）。カメラ・マイクの録画と編集ログは続けています。");
            break;
          case "upload_failed":
            showNotice("録画データの送信に失敗しています。再送を続けています。サーバが起動しているか確認してください。");
            break;
          case "run_save_failed":
            showNotice("実行結果を保存できませんでした。編集ログは記録を続けています。");
            break;
          case "session_resumed":
          case "recorder_restarted":
            break;
          default:
            showNotice(`${code}${detail ? `: ${detail}` : ""}`);
        }
      },
    });
    ctrlRef.current = ctrl;
    const resumed = !!readStoredOrigin(data.sessionId);
    try {
      await ctrl.begin();
    } catch (e) {
      showNotice(`開始処理でエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (resumed) {
      // リロード後: 保存済みの編集内容を復元（W2 の snapshot-at が events から再構成する）
      const restored = await Promise.all(
        data.files.map(async (f) => {
          try {
            const r = await fetch(`/api/sessions/${encodeURIComponent(data.sessionId)}/snapshot-at?file=${encodeURIComponent(f.fileId)}&t=${Number.MAX_SAFE_INTEGER}`);
            if (!r.ok) return f;
            const j = (await r.json()) as { text?: string };
            return typeof j.text === "string" && j.text.length > 0 ? { ...f, initial: j.text } : f;
          } catch {
            return f;
          }
        }),
      );
      setFiles(restored);
    } else {
      // 初期スナップショット: 復元の起点（reconstructFileAt は snapshot からしか始められない）
      for (const f of data.files) {
        ctrl.logger.log({ type: "file_open", file: f.fileId, language: f.language });
        void ctrl.saveSnapshot({ fileId: f.fileId, t: ctrl.clock.now(), version: 1, text: f.initial, seq: ctrl.logger.nextSeq() }).catch(() => {});
      }
    }
    lastEditRef.current = ctrl.clock.now();
    setPhase("live");
  }, [data, recordingEnabled, showNotice]);

  // S2 の「開始」から来たときは、そのまま始める（X9）。画面録画・再開・幅不足のときはボタンを待つ
  useEffect(() => {
    if (phase !== "ready" || !autoStart || resuming || needsGesture || !wide) return;
    const timer = setTimeout(() => void begin(), 0);
    return () => clearTimeout(timer);
  }, [autoStart, begin, needsGesture, phase, resuming, wide]);

  // Docker が無いと S2 で分かっていても、開始時に 1 度だけ確かめ直す（起動し直した場合に実行を使えるように）
  useEffect(() => {
    if (phase !== "live" || !data.runnerOff) return;
    let cancelled = false;
    fetch("/api/runner/status")
      .then((r) => (r.ok ? (r.json() as Promise<{ docker?: string }>) : null))
      .then((j) => {
        if (!cancelled && j?.docker === "ok") setRunnerOff(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data.runnerOff, phase]);

  // ---- 終了 ---------------------------------------------------------------------
  const finish = useCallback(
    async (reason: "user" | "timeout") => {
      const ctrl = ctrlRef.current;
      if (!ctrl || endingRef.current) return;
      endingRef.current = true;
      setConfirmEnd(false);
      setHelpOpen(false);
      setPhase("ending");
      try {
        await captureRef.current?.requestSnapshot("end");
        captureRef.current?.dispose();
        await ctrl.end(reason);
        router.push(`/sessions/${encodeURIComponent(data.sessionId)}`);
      } catch (e) {
        endingRef.current = false;
        setEndError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [data.sessionId, router],
  );
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  /** 0 分: 入力を止め、録画は 5 秒延ばしてから保存する（03 §3.3） */
  const timeUp = useCallback(() => {
    if (timeUpRef.current) return;
    timeUpRef.current = true;
    setConfirmEnd(false);
    setHelpOpen(false);
    editorRef.current?.updateOptions({ readOnly: true });
    setPhase("timeup");
    setTimeout(() => void finishRef.current("timeout"), TIMEUP_GRACE_MS);
  }, []);

  // ---- タイマー・followup・保存の遅れ ----------------------------------------------
  useEffect(() => {
    if (phase !== "live") return;
    const chimeOn = readLocal(CHIME_KEY) !== "0";
    const iv = setInterval(() => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      const t = ctrl.clock.now();
      const rem = data.timeLimitSec * 1000 - t;
      setRemaining((prev) => (Math.ceil(prev / 1000) === Math.ceil(rem / 1000) ? prev : rem));
      const said = timerAnnouncement(prevRemainingRef.current, rem);
      prevRemainingRef.current = rem;
      if (said) setAnnounce(said);
      if (!chimed.current && rem <= 60_000 && rem > 0) {
        chimed.current = true;
        if (chimeOn) playChime();
      }
      if (rem <= 0) timeUp();
      if (data.interviewerMode === "followup") {
        data.followups.forEach((f, i) => {
          if (shownFollowups.current.has(i)) return;
          const byTime = f.at_sec !== undefined && t >= f.at_sec * 1000;
          const bySilence = f.silence_sec !== undefined && t - lastEditRef.current >= f.silence_sec * 1000;
          if (byTime || bySilence) {
            shownFollowups.current.add(i);
            setFollowup(f.text);
            ctrl.logger.log({ type: "followup_shown", text: f.text });
          }
        });
      }
      // 編集ログが送れないまま 15 秒続いたら知らせる（IndexedDB には残っている）
      const now = performance.now();
      if (ctrl.logger.stats.pending > 0) pendingSinceRef.current ??= now;
      else pendingSinceRef.current = null;
      const lag = pendingSinceRef.current !== null && now - pendingSinceRef.current >= SAVE_LAG_MS;
      setSaveLag((v) => (v === lag ? v : lag));
    }, 250);
    return () => clearInterval(iv);
  }, [data, phase, timeUp]);

  // ---- 無音検知（FR-C-06）: 録音中のマイクが 10 秒以上ほぼ無音ならヘッダで知らせる ----------------
  const recording = recStatus.some((s) => s.id === "cam" && s.state === "recording");
  useEffect(() => {
    if (phase !== "live" || !recording) return;
    const stream = ctrlRef.current?.recorder?.cameraStream();
    if (!stream || stream.getAudioTracks().length === 0) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let state: { since: number | null } = { since: null };
    const iv = setInterval(() => {
      // 止まった AudioContext（ユーザー操作の前）では測れないので判定しない
      if (ctx.state !== "running") {
        void ctx.resume().catch(() => {});
        return;
      }
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
      const next = trackSilence(state, Math.sqrt(sum / buf.length), performance.now());
      state = next;
      setSilent((v) => (v === next.silent ? v : next.silent));
    }, 500);
    return () => {
      clearInterval(iv);
      void ctx.close().catch(() => {});
      setSilent(false);
    };
  }, [phase, recording]);

  // ---- sandbox -----------------------------------------------------------------------
  const onFrameMessage = useCallback(
    (m: FromFrameMessage) => {
      if (m.type === "console") pushConsole(m.level, m.args.join(" "));
      else if (m.type === "error") {
        frameErrors.current++;
        pushConsole("error", m.message + (m.line ? `（${m.line} 行目）` : ""));
      } else if (m.type === "request") setRequests((rs) => [...rs.slice(-99), m.request]);
    },
    [pushConsole],
  );

  useEffect(() => {
    if (phase !== "live" || !isWeb) return;
    // iframe の地は白（候補者の HTML の既定の地）。ダークでも中身は変えず、周りの余白と枠で「紙」として見せる（03 P1-7）
    if (previewBox.current && !previewHost.current) previewHost.current = new SandboxHost({ container: previewBox.current, onMessage: onFrameMessage, className: "block h-full w-full border-0 bg-[#ffffff]", title: "プレビュー" });
    if (judgeBox.current && !judgeHost.current) judgeHost.current = new SandboxHost({ container: judgeBox.current, className: "h-[600px] w-[800px] bg-[#ffffff]", title: "判定用フレーム" });
  }, [isWeb, onFrameMessage, phase]);

  useEffect(
    () => () => {
      previewHost.current?.destroy();
      judgeHost.current?.destroy();
      captureRef.current?.dispose();
    },
    [],
  );

  const reloadPreview = useCallback(async () => {
    const host = previewHost.current;
    const ctrl = ctrlRef.current;
    if (!host || !ctrl || !data.webTests) return;
    setConsoleLines([]);
    setRequests([]);
    const t = ctrl.clock.now();
    const t0 = performance.now();
    frameErrors.current = 0;
    try {
      await host.load({ html: textOf(htmlIndex), mockApi: data.webTests.mockApi ?? null, scenarioMode: "preview", tailwind: (data.webTests.preview?.tailwind ?? "local") === "local" });
    } catch (e) {
      pushConsole("system", e instanceof Error ? e.message : String(e));
    }
    // 実行の記録（R5 テスト意識の材料）。プレビューには合否が無いので、読込直後のエラー有無だけ残す
    await new Promise((r) => setTimeout(r, 800));
    const errors = frameErrors.current;
    const run: RunResult = {
      run_id: newRunId("preview"),
      mode: "run",
      language: data.language,
      started_at_wall: new Date().toISOString(),
      t,
      verdict: errors > 0 ? "RE" : "AC",
      duration_ms: Math.round(performance.now() - t0),
      cases: [],
      infra: { backend: "iframe" },
    };
    void ctrl.saveRun(run, files[htmlIndex]?.fileId);
  }, [data.language, data.webTests, files, htmlIndex, pushConsole, textOf]);

  // 初回はすぐプレビューを出す
  const firstPreview = useRef(false);
  useEffect(() => {
    if (phase === "live" && isWeb && !firstPreview.current && previewHost.current) {
      firstPreview.current = true;
      void reloadPreview();
    }
  });

  // ---- 実行・判定 ----------------------------------------------------------------------
  const runNonWeb = useCallback(
    async (mode: "run" | "judge") => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      const filesPayload = allFiles();
      const entry = files[0]?.path ?? "";
      // session_id は付けない: 記録は W1 の /runs で一元化する（二重記録を避ける）
      const url = mode === "run" ? "/api/run" : "/api/judge";
      const body = mode === "run" ? { language: data.language, files: filesPayload, entry, stdin } : { problem_id: data.problemId, language: data.language, files: filesPayload };
      let res: Response;
      try {
        res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        setStatusLine({ main: `${mode === "run" ? "実行" : "判定"}できませんでした: 実行環境に接続できません` });
        return;
      }
      if (res.status === 404 || res.status === 503 || res.status === 501) {
        setRunnerOff(true);
        setStatusLine(null);
        return;
      }
      const json = (await res.json().catch(() => null)) as RunResult | { error?: string } | null;
      if (!res.ok || !json || !("run_id" in json)) {
        setStatusLine({ main: `${mode === "run" ? "実行" : "判定"}できませんでした: ${(json as { error?: string } | null)?.error ?? `HTTP ${res.status}`}` });
        return;
      }
      // 実行時刻はクライアントの時計で上書き（サーバはセッション時計を知らない）
      const run: RunResult = { ...json, t: ctrl.clock.now() - json.duration_ms };
      if (mode === "run") {
        setRunOutput(run);
        setStatusLine(null);
      } else {
        const passed = run.cases.filter((c) => c.verdict === "AC" || c.verdict === "PASS").length;
        setStatusLine(judgeLine(run.t, passed, run.cases.length));
        if (run.compile && !run.compile.ok) setRunOutput(run);
      }
      void ctrl.saveRun(run, files[0]?.fileId);
    },
    [allFiles, data.language, data.problemId, files, stdin],
  );

  const run = useCallback(async () => {
    if (phase !== "live" || busyRef.current || runDisabled) return;
    busyRef.current = true;
    setBusy("run");
    try {
      await captureRef.current?.requestSnapshot("run");
      if (isWeb) await reloadPreview();
      else await runNonWeb("run");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [isWeb, phase, reloadPreview, runDisabled, runNonWeb]);

  const judge = useCallback(async () => {
    if (phase !== "live" || busyRef.current || runDisabled || !hasJudge) return;
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    busyRef.current = true;
    setBusy("judge");
    setStatusLine({ main: "判定中…" });
    try {
      await captureRef.current?.requestSnapshot("judge");
      if (isWeb) {
        if (!judgeHost.current || !data.webTests) {
          setStatusLine({ main: "この問題には判定がありません" });
          return;
        }
        const { run } = await judgeWeb({ host: judgeHost.current, html: textOf(htmlIndex), tests: data.webTests, language: data.language, clock: ctrl.clock });
        const passed = run.cases.filter((c) => c.verdict === "PASS").length;
        setStatusLine(judgeLine(run.t, passed, run.cases.length));
        await ctrl.saveRun(run, files[htmlIndex]?.fileId);
      } else {
        await runNonWeb("judge");
      }
    } catch (e) {
      setStatusLine({ main: `判定できませんでした: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, [data.language, data.webTests, files, hasJudge, htmlIndex, isWeb, phase, runDisabled, runNonWeb, textOf]);

  // ---- ペインの幅（FR-U-04） --------------------------------------------------------------
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRowWidth(el.clientWidth));
    ro.observe(el);
    setRowWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [phase]);
  useEffect(() => {
    writeLocal(paneStorageKey(paneKind), JSON.stringify(ratios));
  }, [paneKind, ratios]);
  // 区切り線 2 本（1px ずつ）を除いた幅
  const paneTotal = Math.max(0, rowWidth - 2);
  const widths = resolvePaneWidths(paneTotal, ratios, problemOpen);

  const dragPane = (which: "problem" | "right") => (e: ReactPointerEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = row.getBoundingClientRect();
    const total = paneTotal;
    const move = (ev: PointerEvent) => {
      const px = which === "problem" ? ev.clientX - rect.left : rect.right - ev.clientX;
      setRatios((r) => resizePane(total, r, problemOpen, which, px));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const keyPane = (which: "problem" | "right") => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    // 右ペインの区切りは左へ動かすと右ペインが広がる
    const grow = (e.key === "ArrowRight") === (which === "problem") ? PANE_KEY_STEP : -PANE_KEY_STEP;
    setRatios((r) => resizePane(paneTotal, r, problemOpen, which, widths[which] + grow));
  };

  // ---- プレビューの縮小表示（判定と同じ 800px を幅に合わせる。03 §3.7） ----------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // タブで隠れている間は 0 になるので、前の値を保つ
      if (el.clientWidth > 0 && el.clientHeight > 0) setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);
  const scale = viewport.w > 0 ? Math.min(1, viewport.w / JUDGE_FRAME_WIDTH) : 1;

  // ---- キーボード ----------------------------------------------------------------------
  const toggleTimer = useCallback(
    () =>
      setTimerMode((m) => {
        const next = m === "remaining" ? "elapsed" : "remaining";
        writeLocal(TIMER_MODE_KEY, next);
        return next;
      }),
    [],
  );
  const focusPane = useCallback(
    (a: ChordAction) => {
      if (a === "focus-problem") {
        setProblemOpen(true);
        setTimeout(() => document.getElementById("pane-problem")?.focus(), 0);
      } else if (a === "focus-editor") editorRef.current?.focus();
      else if (a === "focus-right") {
        const el = document.querySelector<HTMLElement>("#pane-right [role=tab][aria-selected=true], #pane-right textarea");
        el?.focus();
      }
    },
    [],
  );
  // Monaco のコマンドは onMount で 1 度だけ登録するので、最新のハンドラを ref 経由で呼ぶ
  const handlers = useRef<{ run: () => Promise<void>; judge: () => Promise<void>; toggleProblem: () => void; askEnd: () => void; chord: (a: ChordAction) => void }>({
    run: async () => {},
    judge: async () => {},
    toggleProblem: () => {},
    askEnd: () => {},
    chord: () => {},
  });
  useEffect(() => {
    handlers.current = {
      run,
      judge,
      toggleProblem: () => setProblemOpen((v) => !v),
      askEnd: () => {
        if (phase === "live") {
          setHelpOpen(false);
          setConfirmEnd(true);
        }
      },
      chord: (a) => {
        if (phase !== "live") return;
        if (a === "prev-file" || a === "next-file") setActive((i) => (i + (a === "next-file" ? 1 : -1) + files.length) % files.length);
        else if (a === "toggle-timer") toggleTimer();
        else if (a === "rec-detail") setRecOpen((v) => !v);
        else if (a === "help") setHelpOpen(true);
        else focusPane(a);
      },
    };
  });

  const disarmChord = useCallback(() => {
    if (chordTimer.current) clearTimeout(chordTimer.current);
    chordTimer.current = null;
    setChordArmed(false);
  }, []);
  const chordRef = useRef(false);
  useEffect(() => {
    chordRef.current = chordArmed;
  }, [chordArmed]);

  useEffect(() => {
    // ⌘K の 2 段入力は capture で先に拾う（Monaco に 2 打目の文字を入れさせない。⌘K 始まりの Monaco のコードは使えなくなる）
    const onCapture = (e: KeyboardEvent) => {
      if (chordRef.current) {
        if (e.key === "Meta" || e.key === "Control" || e.key === "Shift" || e.key === "Alt") return;
        e.preventDefault();
        e.stopPropagation();
        disarmChord();
        const a = chordAction(e.key);
        if (a) handlers.current.chord(a);
        return;
      }
      if (phase === "live" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setChordArmed(true);
        if (chordTimer.current) clearTimeout(chordTimer.current);
        chordTimer.current = setTimeout(() => setChordArmed(false), 2000);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (phase === "ready" && e.key === "Enter" && !e.isComposing && !e.repeat) {
        // ボタンの上の Enter はボタンの click が処理する（二重に begin しない）
        if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return;
        e.preventDefault();
        if (wide) void begin();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) void handlers.current.judge();
        else void handlers.current.run();
      } else if (e.key.toLowerCase() === "b" && !e.shiftKey) {
        e.preventDefault();
        handlers.current.toggleProblem();
      } else if (e.key.toLowerCase() === "e" && e.shiftKey) {
        e.preventDefault();
        handlers.current.askEnd();
      }
    };
    window.addEventListener("keydown", onCapture, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onCapture, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [begin, disarmChord, phase, wide]);

  // ---- Monaco ---------------------------------------------------------------------------
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const f = files[activeRef.current]!;
    const model = editor.getModel();
    if (model) modelsRef.current.set(f.fileId, model);
    const ctrl = ctrlRef.current;
    if (ctrl && !captureRef.current) {
      captureRef.current = attachMonacoCapture(editor, {
        logger: ctrl.logger,
        current: () => ({ fileId: files[activeRef.current]!.fileId, language: files[activeRef.current]!.language }),
        saveSnapshot: (a) => ctrl.saveSnapshot(a),
        onActivity: () => {
          lastEditRef.current = ctrl.clock.now();
        },
      });
    }
    // Monaco 内ではキーが editor に吸われるので、同じショートカットをコマンドとしても登録する
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void handlers.current.run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => void handlers.current.judge());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => handlers.current.toggleProblem());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => handlers.current.askEnd());
    if (timeUpRef.current) editor.updateOptions({ readOnly: true });
    editor.focus();
  };

  // タブ切替: Editor が path に応じてモデルを差し替えた後（子の effect の後）に呼ばれる
  useEffect(() => {
    activeRef.current = active;
    const prevIdx = prevActiveRef.current;
    if (prevIdx === active) return;
    prevActiveRef.current = active;
    const editor = editorRef.current;
    const model = editor?.getModel();
    const cur = files[active]!;
    if (model) modelsRef.current.set(cur.fileId, model);
    const prevFile = files[prevIdx];
    const prevModel = prevFile ? modelsRef.current.get(prevFile.fileId) : undefined;
    captureRef.current?.switchedFile(prevFile && prevModel ? { fileId: prevFile.fileId, language: prevFile.language, text: prevModel.getValue(), version: prevModel.getVersionId() } : null);
    editor?.focus();
  }, [active, files]);

  const fileTabs = useTabs({ count: files.length, selectedIndex: active, onSelectedIndexChange: setActive });
  const rightTabs = useTabs({ count: 3, selectedIndex: rightTab, onSelectedIndexChange: setRightTab });

  // ---- 表示 -------------------------------------------------------------------------------
  const k = (n: Parameters<typeof shortcut>[0]) => shortcut(n, platform);
  const rec = recState({ enabled: recordingEnabled, statuses: recStatus, camUnavailable, silent });
  const current = files[active]!;
  const endState: EndDialogState =
    phase === "timeup" ? "timeup" : phase === "ending" ? "saving" : phase === "error" ? "error" : confirmEnd ? "confirm" : "closed";

  if (phase === "ready" || phase === "starting") {
    const auto = autoStart && !resuming && !needsGesture && wide;
    return (
      <div data-theme={themeMode} className="flex flex-1 flex-col">
        <main data-session className="grid flex-1 place-items-center bg-canvas px-4 py-10 text-fg-body">
          {auto ? (
            <LoadingText>開始しています…</LoadingText>
          ) : (
            <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
              <p className="flex items-center gap-2 text-dns-13N-130 text-fg-muted">
                <span className="text-mono-12N-120">{data.problemId}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{Math.round(data.timeLimitSec / 60)} 分</span>
              </p>
              <h1 className="text-std-20B-150 text-fg">{data.title}</h1>
              <p className="text-std-14N-170 text-fg-body">
                {resuming ? "前回の続きから再開します。録画は新しいファイルとして続きを記録します。" : "開始すると問題文が表示され、タイマーと記録が始まります。"}
                {needsGesture ? " 画面共有のダイアログでは「このタブ」を選んでください。" : ""}
              </p>
              {!wide && <NarrowNotice className="text-left" />}
              <Button variant="primary" size="md" kbd="↵" keyshortcuts="Enter" autoFocus disabled={!wide} loading={phase === "starting"} onClick={() => void begin()}>
                {resuming ? "再開する" : needsGesture ? "画面共有を選んで開始" : "問題を表示して開始"}
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  const stopped = rec.kind === "stopped" ? stoppedMessage(rec.recorders, data.capture.camera, stopCause) : null;
  const consoleCount = consoleLines.length;
  const idleHint = isWeb ? `${k("run").kbd} でプレビューを更新` : `${k("run").kbd} で実行${hasJudge ? ` · ${k("judge").kbd} で公開サンプルを判定` : ""}`;

  const statusRow = (
    <p role="status" aria-live="polite" className="@container flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-surface px-3 text-dns-13N-130 whitespace-nowrap text-fg-body">
      {runDisabled ? (
        <>
          <StatusBadge tone="neutral">実行環境なし</StatusBadge>
          <span className="truncate text-fg-muted">事前確認で Docker を検出できませんでした</span>
        </>
      ) : statusLine ? (
        <>
          <span className="truncate">{statusLine.main}</span>
          {statusLine.note && <span className="hidden truncate text-fg-muted @sm:inline">{statusLine.note}</span>}
        </>
      ) : (
        <span className="truncate text-fg-muted">
          {idleHint}
          {!hasJudge ? " · この問題には判定がありません" : ""}
        </span>
      )}
    </p>
  );

  return (
    <div data-theme={themeMode} className="flex h-screen flex-col">
      <div data-session className="flex h-screen flex-col overflow-hidden bg-canvas text-fg-body">
        {/* ヘッダ 40px。塗りのボタンは置かない（主役はエディタ） */}
        <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
          <h1 className="min-w-0 flex-1 truncate text-dns-14B-130 text-fg" title={data.title}>
            {data.title}
          </h1>
          {chordArmed && (
            <span className="flex items-center gap-1 text-dns-13N-130 text-fg-muted" aria-live="polite">
              <Kbd>{k("chord").kbd}</Kbd> 次のキー…
            </span>
          )}
          {saveLag && <StatusBadge tone="warning">編集ログ未送信</StatusBadge>}
          <RecIndicator state={rec} camera={data.capture.camera} statuses={recStatus} open={recOpen} onOpenChange={setRecOpen} />
          <SessionTimer remainingMs={remaining} limitMs={data.timeLimitSec * 1000} mode={timerMode} onToggle={toggleTimer} />
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <Button size="xs" kbd={k("run").kbd} keyshortcuts={k("run").aria} loading={busy === "run"} disabled={phase !== "live" || runDisabled || (busy !== null && busy !== "run")} onClick={() => void run()} title={isWeb ? "プレビューを更新" : "標準入力で実行"}>
            実行
          </Button>
          {hasJudge && (
            <Button size="xs" kbd={k("judge").kbd} keyshortcuts={k("judge").aria} loading={busy === "judge"} disabled={phase !== "live" || runDisabled || (busy !== null && busy !== "judge")} onClick={() => void judge()} title="公開サンプルで判定（何度でも可）">
              判定
            </Button>
          )}
          {/* 実行系と終了の間は 24px 空ける（押し間違い防止） */}
          <span aria-hidden="true" className="w-3" />
          <IconButton size="xs" label="キーボード操作の一覧" onClick={() => setHelpOpen(true)}>
            <HelpIcon />
          </IconButton>
          {/* 終了のショートカットは操作一覧と title にだけ出す（ヘッダを詰めすぎない） */}
          <QuietButton keyshortcuts={k("end").aria} title={`終了（${k("end").kbd}）`} disabled={phase !== "live"} onClick={() => handlers.current.askEnd()}>
            終了…
          </QuietButton>
        </header>

        {stopped && (
          <NotificationBanner
            tone="danger"
            variant="compact"
            title={stopped.title}
            className="shrink-0"
            actions={
              <Button size="2xs" onClick={() => setRecOpen(true)}>
                詳細
              </Button>
            }
          >
            {stopped.detail}
          </NotificationBanner>
        )}
        {notice && (
          <NotificationBanner key={notice.id} tone="warning" variant="compact" className="shrink-0" onClose={() => setNotice(null)}>
            {notice.text}
          </NotificationBanner>
        )}

        <div ref={rowRef} className="flex min-h-0 flex-1">
          {/* 問題ペイン（畳むと 32px のレール） */}
          {problemOpen ? (
            <section id="pane-problem" aria-labelledby="pane-problem-h" tabIndex={-1} style={{ width: widths.problem }} className="flex min-h-0 shrink-0 flex-col bg-canvas outline-none focus-visible:outline-none">
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-border pr-1 pl-4">
                <h2 id="pane-problem-h" className="text-dns-14B-130 text-fg">
                  問題
                </h2>
                <IconButton size="2xs" label={`問題ペインを畳む（${k("problem").kbd}）`} aria-expanded aria-controls="pane-problem" onClick={() => setProblemOpen(false)}>
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
                    <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
                <h3 className="mb-2 text-dns-14B-130 text-fg">問題文</h3>
                <Markdown text={data.statement} className="text-std-14N-170 break-words text-fg-body" />
                {data.constraints ? (
                  <>
                    <h3 className="mt-6 mb-2 border-t border-border-subtle pt-4 text-dns-14B-130 text-fg">制約</h3>
                    <Markdown text={data.constraints} className="text-std-14N-170 break-words text-fg-body" />
                  </>
                ) : null}
              </div>
            </section>
          ) : (
            <button
              id="pane-problem"
              type="button"
              aria-expanded={false}
              aria-label={`問題ペインを開く（${k("problem").kbd}）`}
              onClick={() => setProblemOpen(true)}
              style={{ width: widths.problem }}
              className="flex shrink-0 flex-col items-center gap-2 bg-canvas py-3 text-fg-body focus-ring-inset can-hover:bg-hover"
            >
              {/* 縦に 1 字ずつ並べる（writing-mode は flex の中で高さ 0 になることがあるため使わない） */}
              <span aria-hidden="true" className="flex flex-col items-center gap-0.5 text-dns-14B-130">
                <span>問</span>
                <span>題</span>
              </span>
              <Kbd aria-hidden="true" className="py-1 [writing-mode:vertical-rl]">
                {k("problem").kbd}
              </Kbd>
            </button>
          )}
          {problemOpen ? (
            <PaneSeparator
              label="問題ペインの幅"
              controls="pane-problem"
              value={widths.problem}
              min={PANE_MIN.problem}
              max={paneTotal - widths.right - PANE_MIN.editor}
              onKeyDown={keyPane("problem")}
              onPointerDown={dragPane("problem")}
            />
          ) : (
            <span aria-hidden="true" className="w-px shrink-0 bg-border" />
          )}

          {/* エディタ */}
          <section id="pane-editor" aria-label="エディタ" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
            <div {...fileTabs.getListProps("ファイル")} className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border bg-canvas">
              {files.map((f, i) => (
                <button key={f.fileId} {...fileTabs.getTabProps(i)} className={cx(tabClass, "text-mono-13N-150", i === active && "bg-surface")}>
                  {f.path}
                </button>
              ))}
            </div>
            <div {...fileTabs.getPanelProps(active)} tabIndex={-1} className="min-h-0 flex-1">
              <Editor
                path={current.path}
                defaultValue={current.initial}
                defaultLanguage={MONACO_LANGUAGE[current.language]}
                language={MONACO_LANGUAGE[current.language]}
                theme={monacoTheme}
                onMount={onMount}
                options={{
                  ...LCI_MONACO_OPTIONS,
                  minimap: { enabled: false },
                  inlineSuggest: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  renderLineHighlight: "line",
                  // 日本語コメントの横スクロールを避ける（HTML と Markdown だけ。03 §3.10）
                  wordWrap: current.language === "html" || current.language === "markdown" ? "on" : "off",
                  readOnly: phase !== "live",
                }}
              />
            </div>
          </section>

          <PaneSeparator
            label="右ペインの幅"
            controls="pane-right"
            value={widths.right}
            min={PANE_MIN.right}
            max={paneTotal - widths.problem - PANE_MIN.editor}
            onKeyDown={keyPane("right")}
            onPointerDown={dragPane("right")}
          />

          {/* プレビュー / コンソール / 通信（web）、標準入力と出力（それ以外） */}
          {isWeb ? (
            <section id="pane-right" aria-label="プレビューとコンソール" style={{ width: widths.right }} className="flex min-h-0 shrink-0 flex-col bg-surface">
              <div className="flex h-8 shrink-0 items-stretch border-b border-border bg-canvas">
                <div {...rightTabs.getListProps("表示")} className="flex min-w-0 items-stretch overflow-x-auto">
                  {["プレビュー", "コンソール", "通信"].map((label, i) => (
                    <button key={label} {...rightTabs.getTabProps(i)} className={cx(tabClass, "text-dns-14N-130", i === rightTab && "bg-surface")}>
                      {label}
                      {i === 1 && consoleCount > 0 && <span className="text-mono-12N-120 text-fg-muted">{consoleCount}</span>}
                      {i === 2 && requests.length > 0 && <span className="text-mono-12N-120 text-fg-muted">{requests.length}</span>}
                    </button>
                  ))}
                </div>
                {rightTab === 0 && (
                  <div className="ml-auto flex shrink-0 items-center gap-2 pr-1 pl-2">
                    <span className="text-mono-12N-120 text-fg-muted">{fit ? `${Math.round(scale * 100)}%` : "100%"}</span>
                    <Button size="2xs" variant="tertiary" onClick={() => setFit((v) => !v)} title="判定と同じ幅 800px のレイアウトです">
                      {fit ? "実寸で表示" : "幅に合わせる"}
                    </Button>
                  </div>
                )}
              </div>
              <div {...rightTabs.getPanelProps(0)} tabIndex={-1} className={cx("min-h-0 flex-1 bg-canvas p-3", rightTab !== 0 && "hidden")}>
                {/* 判定と同じ 800px で描き、幅に合わせて静的に縮小する（アニメーションなし） */}
                <div ref={viewportRef} className={cx("h-full w-full border border-border", fit ? "overflow-hidden" : "overflow-auto")}>
                  <div
                    ref={previewBox}
                    style={
                      fit && viewport.w > 0
                        ? { width: JUDGE_FRAME_WIDTH, height: viewport.h / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }
                        : { width: JUDGE_FRAME_WIDTH, height: "100%" }
                    }
                  />
                </div>
              </div>
              <div {...rightTabs.getPanelProps(1)} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-mono-13N-150 focus-ring-inset">
                {consoleLines.length === 0 ? (
                  <p className="font-sans text-dns-13N-130 text-fg-muted">console.log の出力とエラーがここに出ます</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {consoleLines.map((l) => (
                      <li key={l.id} className={cx("break-words whitespace-pre-wrap", l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : l.level === "system" ? "text-fg-muted" : "text-fg-body")}>
                        {/* 色だけに頼らない: 種類を先頭の記号でも示す */}
                        {l.level === "error" ? "✕ " : l.level === "warn" ? "！ " : ""}
                        {l.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div {...rightTabs.getPanelProps(2)} className="min-h-0 flex-1 overflow-auto focus-ring-inset">
                {requests.length === 0 ? (
                  <p className="px-3 py-2 text-dns-13N-130 text-fg-muted">プレビューからの通信（fetch / XHR）がここに出ます</p>
                ) : (
                  <Table caption="プレビューからの通信" captionHidden className="text-dns-13N-130">
                    <THead sticky>
                      <tr>
                        <Th numeric>時刻</Th>
                        <Th>URL</Th>
                        <Th>状態</Th>
                        <Th numeric>所要</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {requests.map((r) => (
                        <Tr key={r.id}>
                          <Td numeric className="text-mono-12N-120">{(r.t / 1000).toFixed(2)}s</Td>
                          <Td className="max-w-0 truncate text-mono-12N-120" title={r.url}>
                            {r.url.replace(/^https?:\/\/[^/]+/, "")}
                          </Td>
                          <Td className="whitespace-nowrap">{REQUEST_STATUS_LABEL[r.status]}</Td>
                          <Td numeric className="text-mono-12N-120">{r.t_end !== undefined ? `${Math.round(r.t_end - r.t)}ms` : "—"}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
              {statusRow}
              {/* 判定用の不可視フレーム（レイアウト検証のため実寸で描画する） */}
              <div ref={judgeBox} aria-hidden className="fixed top-0 -left-[10000px] h-[600px] w-[800px] overflow-hidden" />
            </section>
          ) : (
            <section id="pane-right" aria-label="実行" style={{ width: widths.right }} className="flex min-h-0 shrink-0 flex-col bg-surface">
              <div className="flex h-8 shrink-0 items-center border-b border-border bg-canvas px-3">
                <h2 className="text-dns-14B-130 text-fg">実行</h2>
              </div>
              <div className="flex shrink-0 flex-col gap-1 border-b border-border p-3">
                <label htmlFor="stdin" className="text-dns-13N-130 text-fg-muted">
                  標準入力
                </label>
                <textarea
                  id="stdin"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full resize-y rounded-6 border border-border-input bg-surface px-2 py-1.5 text-mono-13N-150 text-fg-body can-hover:border-fg"
                />
              </div>
              <section aria-labelledby="out-h" className="flex min-h-0 flex-1 flex-col">
                <div className="flex h-8 shrink-0 items-center gap-2 px-3">
                  <h3 id="out-h" className="text-dns-13N-130 text-fg-muted">
                    出力
                  </h3>
                  {runOutput &&
                    (() => {
                      const h = runHeadline(runOutput);
                      return (
                        <>
                          <StatusBadge tone={h.tone}>{h.label}</StatusBadge>
                          <span className="text-mono-12N-120 text-fg-muted">{h.meta}</span>
                        </>
                      );
                    })()}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 text-mono-13N-150 break-words whitespace-pre-wrap" tabIndex={0} aria-label="出力">
                  {runOutput ? (
                    <>
                      {runOutput.compile && !runOutput.compile.ok ? <div className="text-danger">{runOutput.compile.stderr}</div> : null}
                      {runOutput.stdout ? <div className="text-fg-body">{runOutput.stdout}</div> : null}
                      {runOutput.stderr ? <div className="text-danger">{runOutput.stderr}</div> : null}
                      {!runOutput.stdout && !runOutput.stderr && !(runOutput.compile && !runOutput.compile.ok) ? <span className="font-sans text-dns-13N-130 text-fg-muted">出力はありません</span> : null}
                    </>
                  ) : (
                    <span className="font-sans text-dns-13N-130 text-fg-muted">{runDisabled ? "実行環境がないため実行できません" : `${k("run").kbd} で実行すると、ここに標準出力が出ます`}</span>
                  )}
                </div>
              </section>
              {statusRow}
            </section>
          )}
        </div>

        {/* 面接官の質問（followup のときだけ。既読まで消さない。03 §3.8） */}
        {data.interviewerMode === "followup" && (
          <footer className="flex min-h-7 shrink-0 items-start gap-3 border-t border-border bg-surface px-3 py-1.5">
            <span className="shrink-0 text-dns-13N-130 leading-5 text-fg-muted">面接官</span>
            <p role="status" aria-live="polite" className="max-h-[4.5rem] min-w-0 flex-1 overflow-y-auto text-dns-14N-130 leading-5 text-fg">
              {followup ?? <span className="text-fg-muted">質問が出たら、ここに全文を表示します</span>}
            </p>
          </footer>
        )}

        {/* 残り 5 分・1 分だけ読み上げる（タイマー自体は aria-live="off"） */}
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <EndDialog
          state={endState}
          remainingMs={remaining}
          sessionId={data.sessionId}
          error={endError}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => void finish("user")}
          onRetry={() => void finish("user")}
          onLeave={() => router.push(`/sessions/${encodeURIComponent(data.sessionId)}`)}
        />
        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} platform={platform} />
      </div>
    </div>
  );
}
