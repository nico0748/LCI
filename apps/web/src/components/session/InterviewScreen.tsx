"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import type { RunResult } from "@lci/core/browser";
import { Markdown } from "@/components/review/markdown";
import { SessionController, readStoredOrigin } from "@/lib/capture/session-controller";
import { attachMonacoCapture, type MonacoCapture } from "@/lib/capture/monaco-hooks";
import type { RecorderStatus } from "@/lib/capture/recorder";
import { SandboxHost } from "@/lib/capture/sandbox/host";
import { judgeWeb, newRunId } from "@/lib/capture/sandbox/judge";
import type { FromFrameMessage, RequestRecord } from "@/lib/capture/sandbox/protocol";
import { formatRemaining, playChime } from "./chime";
import { loadMonacoReact } from "@/lib/monaco";
import { MONACO_LANGUAGE, type InterviewData } from "./types";

/**
 * S3 面接セッション画面（04 §6.2）。
 * ヘッダ（問題名・残り時間・●REC・実行・提出・終了）／問題ペイン｜エディタ｜プレビュー・コンソール／字幕ストリップ。
 * セッション中は静か（04 §7）: 動くのはタイマーだけ。アニメーション・トーストは置かない。
 */

const Editor = dynamic(() => loadMonacoReact().then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-xs text-fg-muted">エディタを読み込み中…</div>,
});

type Phase = "ready" | "starting" | "live" | "ending" | "error";

interface ConsoleLine {
  id: number;
  level: "log" | "info" | "warn" | "error" | "debug" | "system";
  text: string;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

export function InterviewScreen({ data, recordingEnabled }: { data: InterviewData; recordingEnabled: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  // SSR しない（client.tsx）ので localStorage を初期値に直接使える
  const [resuming] = useState(() => !!readStoredOrigin(data.sessionId));
  const [files, setFiles] = useState(data.files);
  const [active, setActive] = useState(0);
  const [remaining, setRemaining] = useState(data.timeLimitSec * 1000);
  const [recStatus, setRecStatus] = useState<RecorderStatus[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "run" | "judge">(null);
  const [judgeSummary, setJudgeSummary] = useState<string | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [stdin, setStdin] = useState(data.sampleStdin);
  const [runOutput, setRunOutput] = useState<RunResult | null>(null);
  const [followup, setFollowup] = useState<string | null>(null);
  const [problemOpen, setProblemOpen] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [theme] = useState<"vs" | "vs-dark">(() => {
    if (typeof window === "undefined") return "vs";
    const forced = document.documentElement.dataset.theme;
    if (forced === "dark") return "vs-dark";
    if (forced === "light") return "vs";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "vs-dark" : "vs";
  });

  const ctrlRef = useRef<SessionController | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const captureRef = useRef<MonacoCapture | null>(null);
  const modelsRef = useRef(new Map<string, Monaco.editor.ITextModel>());
  const activeRef = useRef(0);
  const prevActiveRef = useRef(0);
  const lastEditRef = useRef(0);
  const shownFollowups = useRef(new Set<number>());
  const chimed = useRef(false);
  const endingRef = useRef(false);
  const previewBox = useRef<HTMLDivElement>(null);
  const judgeBox = useRef<HTMLDivElement>(null);
  const previewHost = useRef<SandboxHost | null>(null);
  const judgeHost = useRef<SandboxHost | null>(null);
  const lineId = useRef(0);
  const frameErrors = useRef(0);
  const isWeb = data.language === "html";

  useEffect(() => {
  }, []);

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
    if (phase !== "ready") return;
    setPhase("starting");
    let devices: { audio?: string; video?: string } | undefined;
    try {
      devices = JSON.parse(localStorage.getItem("lci-devices") ?? "{}") as { audio?: string; video?: string };
    } catch {
      devices = undefined;
    }
    const ctrl = new SessionController({
      sessionId: data.sessionId,
      record: { enabled: recordingEnabled, camera: data.capture.camera, screen: data.capture.screen },
      deviceIds: devices,
      onRecorderStatus: setRecStatus,
      onWarning: (code, detail) => {
        const msg: Record<string, string> = {
          track_ended: "録画トラックが停止しました（デバイス変更または共有停止）。編集ログは記録を続けています。",
          upload_failed: "録画データの送信に失敗しています。サーバが起動しているか確認してください。",
          cam_unavailable: "カメラ／マイクを取得できませんでした。編集ログのみ記録します。",
          screen_unavailable: "画面録画を開始できませんでした。",
          screen_denied: "画面録画はキャンセルされました。",
          recorder_error: "録画でエラーが発生しました。",
        };
        if (msg[code]) setWarning(msg[code]!);
        else if (code !== "session_resumed" && code !== "recorder_restarted") setWarning(`${code}${detail ? `: ${detail}` : ""}`);
      },
    });
    ctrlRef.current = ctrl;
    const resumed = !!readStoredOrigin(data.sessionId);
    try {
      await ctrl.begin();
    } catch (e) {
      setWarning(`開始処理でエラー: ${e instanceof Error ? e.message : String(e)}`);
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
  }, [data, phase, recordingEnabled]);

  // ---- 終了 ---------------------------------------------------------------------
  const finish = useCallback(
    async (reason: "user" | "timeout") => {
      const ctrl = ctrlRef.current;
      if (!ctrl || endingRef.current) return;
      endingRef.current = true;
      setConfirmEnd(false);
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

  // ---- タイマー・followup -----------------------------------------------------------
  useEffect(() => {
    if (phase !== "live") return;
    const iv = setInterval(() => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      const t = ctrl.clock.now();
      const rem = data.timeLimitSec * 1000 - t;
      setRemaining((prev) => (Math.ceil(prev / 1000) === Math.ceil(rem / 1000) ? prev : rem));
      if (!chimed.current && rem <= 60_000 && rem > 0) {
        chimed.current = true;
        playChime();
      }
      if (rem <= 0) void finish("timeout");
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
    }, 250);
    return () => clearInterval(iv);
  }, [data, finish, phase]);

  // ---- sandbox -----------------------------------------------------------------------
  const onFrameMessage = useCallback(
    (m: FromFrameMessage) => {
      if (m.type === "console") pushConsole(m.level, m.args.join(" "));
      else if (m.type === "error") {
        frameErrors.current++;
        pushConsole("error", m.message + (m.line ? `（${m.line} 行目）` : ""));
      }
      else if (m.type === "request") setRequests((rs) => [...rs.slice(-99), m.request]);
    },
    [pushConsole],
  );

  useEffect(() => {
    if (phase !== "live" || !isWeb) return;
    if (previewBox.current && !previewHost.current) previewHost.current = new SandboxHost({ container: previewBox.current, onMessage: onFrameMessage, className: "h-full w-full bg-white", title: "プレビュー" });
    if (judgeBox.current && !judgeHost.current) judgeHost.current = new SandboxHost({ container: judgeBox.current, className: "h-[600px] w-[800px] bg-white", title: "判定用フレーム" });
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

  // ---- 実行・提出 ----------------------------------------------------------------------
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
        setNotice("実行環境が未起動です");
        return;
      }
      if (res.status === 404 || res.status === 503 || res.status === 501) {
        setNotice("実行環境が未起動です");
        return;
      }
      const json = (await res.json().catch(() => null)) as RunResult | { error?: string } | null;
      if (!res.ok || !json || !("run_id" in json)) {
        setNotice(`実行に失敗しました: ${(json as { error?: string } | null)?.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setNotice(null);
      // 実行時刻はクライアントの時計で上書き（サーバはセッション時計を知らない）
      const run: RunResult = { ...json, t: ctrl.clock.now() - json.duration_ms };
      if (mode === "run") setRunOutput(run);
      else {
        const passed = run.cases.filter((c) => c.verdict === "AC" || c.verdict === "PASS").length;
        setJudgeSummary(`判定を記録しました（${passed} / ${run.cases.length} 件 通過）。詳細は終了後の振り返りで確認できます。`);
        if (run.compile && !run.compile.ok) setRunOutput(run);
      }
      void ctrl.saveRun(run, files[0]?.fileId);
    },
    [allFiles, data.language, data.problemId, files, stdin],
  );

  const run = useCallback(async () => {
    if (phase !== "live" || busy) return;
    setBusy("run");
    try {
      await captureRef.current?.requestSnapshot("run");
      if (isWeb) await reloadPreview();
      else await runNonWeb("run");
    } finally {
      setBusy(null);
    }
  }, [busy, isWeb, phase, reloadPreview, runNonWeb]);

  const judge = useCallback(async () => {
    if (phase !== "live" || busy) return;
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    setBusy("judge");
    setJudgeSummary("判定中…");
    try {
      await captureRef.current?.requestSnapshot("judge");
      if (isWeb) {
        if (!judgeHost.current || !data.webTests) {
          setJudgeSummary("この問題には判定がありません");
          return;
        }
        const { run } = await judgeWeb({ host: judgeHost.current, html: textOf(htmlIndex), tests: data.webTests, language: data.language, clock: ctrl.clock });
        const passed = run.cases.filter((c) => c.verdict === "PASS").length;
        setJudgeSummary(`判定を記録しました（${passed} / ${run.cases.length} 件 通過）。詳細は終了後の振り返りで確認できます。`);
        await ctrl.saveRun(run, files[htmlIndex]?.fileId);
      } else if (data.testsKind === "none") {
        setJudgeSummary("この問題には判定がありません");
      } else {
        setJudgeSummary(null);
        await runNonWeb("judge");
      }
    } catch (e) {
      setJudgeSummary(`判定に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [busy, data.language, data.testsKind, data.webTests, files, htmlIndex, isWeb, phase, runNonWeb, textOf]);

  // ---- キーボード ----------------------------------------------------------------------
  // Monaco のコマンドは onMount で 1 度だけ登録するので、最新のハンドラを ref 経由で呼ぶ
  const handlers = useRef<{ run: () => Promise<void>; judge: () => Promise<void>; toggleProblem: () => void; askEnd: () => void; tab: (d: number) => void }>({
    run: async () => {},
    judge: async () => {},
    toggleProblem: () => {},
    askEnd: () => {},
    tab: () => {},
  });
  useEffect(() => {
    handlers.current = {
      run,
      judge,
      toggleProblem: () => setProblemOpen((v) => !v),
      askEnd: () => {
        if (phase === "live") setConfirmEnd(true);
      },
      tab: (d: number) => setActive((a) => (a + d + files.length) % files.length),
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "ready" && e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        void begin();
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
      } else if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        handlers.current.tab(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [begin, phase]);

  // ---- Monaco ---------------------------------------------------------------------------
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
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
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => handlers.current.tab(1));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => handlers.current.tab(-1));
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

  // ---- 表示 -------------------------------------------------------------------------------
  const warnTime = remaining <= 5 * 60_000;
  const camStatus = recStatus.find((r) => r.id === "cam");
  const recOk = recStatus.some((r) => r.state === "recording");
  const recTitle = recStatus.map((r) => `${r.id}: ${r.state} / チャンク ${r.chunks} / ${(r.bytes / 1_000_000).toFixed(1)} MB${r.pendingUploads > 2 ? ` / 未送信 ${r.pendingUploads}` : ""}`).join("\n") || "録画なし";
  const current = files[active]!;

  if (phase === "ready" || phase === "starting") {
    return (
      <main className="flex-1 grid place-items-center px-4">
        <div className="max-w-md w-full space-y-4 text-center">
          <p className="text-xs text-fg-muted font-mono">{data.problemId} · {Math.round(data.timeLimitSec / 60)} 分</p>
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <p className="text-sm text-fg-muted">
            {resuming ? "前回の続きから再開します。録画は新しいファイルとして続きを記録します。" : "開始すると問題文が表示され、タイマーと記録が始まります。"}
            {data.capture.screen && recordingEnabled ? " 画面共有のダイアログでは「このタブ」を選んでください。" : ""}
          </p>
          <button type="button" autoFocus disabled={phase === "starting"} onClick={() => void begin()} className="rounded-md bg-accent px-5 py-2 text-accent-fg font-medium disabled:opacity-50">
            {phase === "starting" ? "準備中…" : resuming ? "再開する" : "問題を表示して開始"}
          </button>
          <p className="text-xs text-fg-muted">Enter でも開始できます</p>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-session-live>
      {/* ヘッダ 40px */}
      <header className="h-10 shrink-0 flex items-center gap-3 border-b border-border bg-bg-elev px-3 text-sm" role="banner">
        <span className="truncate font-medium min-w-0 flex-1" title={data.title}>{data.title}</span>
        <span className={`font-mono tabular-nums ${warnTime ? "text-warn font-semibold" : ""}`} aria-label={`残り ${Math.ceil(remaining / 60000)} 分`} title="残り時間">
          {formatRemaining(remaining)}
          {warnTime ? <span className="ml-1 text-xs font-sans font-normal">残り {Math.max(0, Math.ceil(remaining / 60000))} 分</span> : null}
        </span>
        <span className="flex items-center gap-1 text-xs text-fg-muted" title={recTitle} aria-label={recOk ? "録画中" : "録画していません"}>
          <span className={`inline-block h-2 w-2 rounded-full ${recOk ? "bg-rec" : recordingEnabled && camStatus ? "bg-danger" : "bg-border"}`} />
          {recOk ? "REC" : recordingEnabled ? "停止" : "記録のみ"}
        </span>
        <span className="h-5 w-px bg-border" />
        <button type="button" onClick={() => void run()} disabled={!!busy || phase !== "live"} className="rounded-md border border-border px-2.5 py-0.5 disabled:opacity-50" title={`${MOD}+Enter`}>
          {busy === "run" ? "実行中…" : "実行"}
        </button>
        <button type="button" onClick={() => void judge()} disabled={!!busy || phase !== "live" || data.testsKind === "none"} className="rounded-md border border-border px-2.5 py-0.5 disabled:opacity-50" title={`${MOD}+Shift+Enter`}>
          {busy === "judge" ? "判定中…" : "提出(判定)"}
        </button>
        <button type="button" onClick={() => setConfirmEnd(true)} disabled={phase !== "live"} className="rounded-md border border-border px-2.5 py-0.5 text-danger disabled:opacity-50" title={`${MOD}+Shift+E`}>
          終了
        </button>
      </header>

      {warning ? (
        <div role="status" className="shrink-0 border-b border-border bg-bg px-3 py-1 text-xs text-warn flex items-center gap-2">
          <span className="flex-1">{warning}</span>
          <button type="button" className="text-fg-muted" onClick={() => setWarning(null)} aria-label="閉じる">閉じる</button>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: problemOpen ? "3fr 6fr 3fr" : "0 9fr 3fr" }}>
        {/* 問題ペイン */}
        <section aria-label="問題" className={`min-h-0 overflow-y-auto border-r border-border p-4 text-sm ${problemOpen ? "" : "hidden"}`}>
          <h2 className="text-xs font-medium text-fg-muted mb-2">問題文</h2>
          <Markdown text={data.statement} className="leading-relaxed" />
          {data.constraints ? (
            <>
              <h2 className="text-xs font-medium text-fg-muted mt-5 mb-2">制約</h2>
              <Markdown text={data.constraints} className="leading-relaxed" />
            </>
          ) : null}
          <p className="mt-6 text-xs text-fg-muted">{MOD}+B で折りたたみ</p>
        </section>

        {/* エディタ */}
        <section aria-label="エディタ" className="min-h-0 flex flex-col border-r border-border">
          <div className="h-8 shrink-0 flex items-end gap-px border-b border-border bg-bg px-1 text-xs" role="tablist">
            {files.map((f, i) => (
              <button
                key={f.fileId}
                role="tab"
                aria-selected={i === active}
                type="button"
                onClick={() => setActive(i)}
                className={`px-3 py-1 rounded-t font-mono ${i === active ? "bg-bg-elev border border-b-0 border-border" : "text-fg-muted"}`}
              >
                {f.path}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              path={current.path}
              defaultValue={current.initial}
              defaultLanguage={MONACO_LANGUAGE[current.language]}
              language={MONACO_LANGUAGE[current.language]}
              theme={theme}
              onMount={onMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                inlineSuggest: { enabled: false },
                scrollBeyondLastLine: false,
                smoothScrolling: false,
                cursorBlinking: "solid",
                automaticLayout: true,
                tabSize: 2,
                renderLineHighlight: "line",
              }}
            />
          </div>
        </section>

        {/* プレビュー / コンソール */}
        <section aria-label={isWeb ? "プレビュー" : "コンソール"} className="min-h-0 flex flex-col">
          {notice ? <div className="shrink-0 border-b border-border px-3 py-2 text-xs text-warn">{notice}</div> : null}
          {judgeSummary ? <div className="shrink-0 border-b border-border px-3 py-2 text-xs">{judgeSummary}</div> : null}
          {isWeb ? (
            <>
              <div ref={previewBox} className="flex-1 min-h-0 bg-white" />
              <div className="h-40 shrink-0 border-t border-border overflow-y-auto font-mono text-xs p-2 space-y-0.5" aria-label="コンソール">
                <div className="text-fg-muted">リクエスト {requests.length} 件{requests.length ? `（完了 ${requests.filter((r) => r.status === "completed").length} / 中断 ${requests.filter((r) => r.status === "aborted").length} / ブロック ${requests.filter((r) => r.status === "blocked").length}）` : ""}</div>
                {consoleLines.map((l) => (
                  <div key={l.id} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warn" : l.level === "system" ? "text-fg-muted" : ""}>
                    {l.text}
                  </div>
                ))}
              </div>
              {/* 判定用の不可視フレーム（レイアウト検証のため実寸で描画する） */}
              <div ref={judgeBox} aria-hidden className="fixed -left-[10000px] top-0 h-[600px] w-[800px] overflow-hidden" />
            </>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col text-xs">
              <label className="shrink-0 p-2 space-y-1 border-b border-border">
                <span className="text-fg-muted">標準入力</span>
                <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={5} spellCheck={false} className="w-full rounded border border-border bg-bg-elev p-1 font-mono" />
              </label>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 font-mono whitespace-pre-wrap" aria-label="出力">
                {runOutput ? (
                  <>
                    <div className="text-fg-muted mb-1">
                      {runOutput.verdict} · exit {runOutput.exit_code ?? "-"} · {runOutput.duration_ms}ms
                    </div>
                    {runOutput.compile && !runOutput.compile.ok ? <div className="text-danger">{runOutput.compile.stderr}</div> : null}
                    {runOutput.stdout ? <div>{runOutput.stdout}</div> : null}
                    {runOutput.stderr ? <div className="text-danger">{runOutput.stderr}</div> : null}
                  </>
                ) : (
                  <span className="text-fg-muted">{MOD}+Enter で実行</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 字幕ストリップ（1 行）＋面接官メッセージ */}
      <footer className="h-8 shrink-0 flex items-center gap-4 border-t border-border bg-bg-elev px-3 text-xs text-fg-muted">
        <span className="truncate flex-1">{data.capture.live_stt ? "ライブ字幕: 準備中（未実装）" : "ライブ字幕: 未対応"}</span>
        {followup ? (
          <span className="text-fg truncate max-w-[50%]" role="note" aria-label="面接官からの質問">
            面接官: {followup}
            <button type="button" className="ml-2 text-fg-muted" onClick={() => setFollowup(null)}>既読</button>
          </span>
        ) : null}
        <span className="hidden xl:inline">{MOD}+Enter 実行 · {MOD}+Shift+Enter 提出 · {MOD}+B 問題 · {MOD}+Alt+←/→ ファイル · {MOD}+Shift+E 終了</span>
      </footer>

      {confirmEnd || phase === "ending" || phase === "error" ? (
        <div className="fixed inset-0 grid place-items-center bg-black/40" role="dialog" aria-modal="true" aria-label="セッションを終了">
          <div className="w-full max-w-sm rounded-lg border border-border bg-bg-elev p-5 space-y-4 text-sm">
            {phase === "ending" ? (
              <p>録画と記録を保存しています…</p>
            ) : phase === "error" ? (
              <>
                <p className="text-danger">{endError}</p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => void finish("user")} autoFocus>
                    もう一度
                  </button>
                </div>
              </>
            ) : (
              <EndConfirm onCancel={() => setConfirmEnd(false)} onConfirm={() => void finish("user")} remaining={remaining} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EndConfirm({ onCancel, onConfirm, remaining }: { onCancel: () => void; onConfirm: () => void; remaining: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <>
      <p>セッションを終了しますか？（残り {formatRemaining(remaining)}）</p>
      <p className="text-xs text-fg-muted">終了すると録画を保存し、振り返り画面へ移動します。</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-md border border-border px-3 py-1" onClick={onCancel}>
          続ける
        </button>
        <button type="button" className="rounded-md bg-danger px-3 py-1 text-white" onClick={onConfirm} autoFocus>
          終了する
        </button>
      </div>
    </>
  );
}
