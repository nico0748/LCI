"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LANGUAGE_LABEL, type Language } from "@lci/core/browser";
import type { AudioJobStatus, DemoDetail, DemoRevisionInfo, DemoSummary } from "@lci/demo/browser";
import { Breadcrumbs, Button, Checkbox, LoadingText, NotificationBanner, Select, StatusBadge } from "@/components/ui";
import { defaultLanguage, fmtLength, isVerified, pickDemo, sortLanguages, trustState, versionsFor, VIEWED_KEY } from "./demo-model.ts";
import { DemoPlayer } from "./DemoPlayer";
import { DemoEmpty, DemoGate, DemoRecording } from "./DemoStates";
import { DemoAbout, DemoVersions, RateDialog } from "./DemoManage";
import type { DemoProblemInfo, DemoUserRecord } from "./types.ts";

/**
 * 模範解答デモの画面全体（01 §5.3 の状態）。ゲート → 一覧（ネタバレなし）→ 本体（reveal=1）→ プレイヤー。
 * - URL は `?lang=&demo=&rev=` に合わせて書き換える（サーバを呼び直さないよう history.replaceState）
 * - デモが無い・録画中のあいだは、画面が見えている限り 5 秒ごとに確認する（FR-D-51、D15）
 * - 音声を作っているあいだは進捗を 5 秒ごとに確認し、できたら読み込み直しを促す（再生中に長さを変えない）
 * - localStorage を初期値に直接使うため SSR しない（client.tsx の DemoPageClient から読み込む）
 */

const POLL_MS = 5000;
const UNLOCK_KEY = (id: string) => `lci:demo-unlocked:${id}`;
const REVIEWED_KEY = "lci:demo:reviewed";

/** 取得の結果。key は取得した対象（版・再読み込みの回数）で、今の対象と違えば「読み込み中」とみなす */
type DetailState = { kind: "ready"; key: string } | { kind: "error"; key: string; message: string } | { kind: "recording"; key: string };
type ListResult = { kind: "ok"; list: DemoSummary[] } | { kind: "recording" } | { kind: "error"; message: string };

async function loadList(problemId: string): Promise<ListResult> {
  try {
    const res = await fetch(`/api/demos?problem=${encodeURIComponent(problemId)}`, { cache: "no-store" });
    if (res.status === 409) return { kind: "recording" };
    if (!res.ok) return { kind: "error", message: `HTTP ${res.status}` };
    return { kind: "ok", list: (await res.json()) as DemoSummary[] };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}
function useVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 保存できなくても表示は続ける */
  }
}

export function DemoPage({
  problem,
  record,
  initialLang,
  initialDemoId,
  initialChapter,
  initialRevision,
}: {
  problem: DemoProblemInfo;
  record: DemoUserRecord;
  initialLang: string | null;
  initialDemoId: string | null;
  initialChapter: string | null;
  initialRevision?: number | null;
}) {
  const visible = useVisible();
  // ---- ゲート（FR-D-04）: 終了済みが 0 件なら、解かずに見る確認を経たかをこのブラウザで覚える
  const [unlocked, setUnlocked] = useState(() => record.finished > 0 || readJson<string | null>(UNLOCK_KEY(problem.id), null) != null);
  const unlock = () => {
    writeJson(UNLOCK_KEY(problem.id), new Date().toISOString());
    setUnlocked(true);
  };

  // ---- 一覧（ネタバレを含まない）
  const [list, setList] = useState<DemoSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listRecording, setListRecording] = useState(false);
  const [listTick, setListTick] = useState(0);
  const fetchList = useCallback(() => setListTick((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    void loadList(problem.id).then((r) => {
      if (!alive) return;
      if (r.kind === "recording") return setListRecording(true);
      if (r.kind === "error") return setListError(r.message);
      setList(r.list);
      setListRecording(false);
      setListError(null);
    });
    return () => {
      alive = false;
    };
  }, [problem.id, listTick]);
  // 画面に戻ったら確かめ直す（別の窓で Claude が保存した直後など）
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === "visible") fetchList();
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [fetchList]);

  // ---- 言語と版
  // 明示的に選んだ言語。null の間は既定（一覧が届いたら、デモがある言語を優先して決め直す）
  const [pickedLang, setLang] = useState<Language | null>(null);
  const [demoId, setDemoId] = useState<string | null>(initialDemoId);
  const [revision, setRevision] = useState<number | null>(initialRevision ?? null);
  const [chapter, setChapter] = useState<string | null>(initialChapter);
  const langsWithDemo = useMemo(() => new Set((list ?? []).map((d) => d.language)), [list]);
  const autoLang = useMemo(
    () => defaultLanguage({ requested: initialLang, latestSession: record.latestLanguage, languages: problem.languages, available: [...langsWithDemo] }),
    [initialLang, record.latestLanguage, problem.languages, langsWithDemo],
  );
  const lang = pickedLang ?? autoLang;
  const current = useMemo(() => (list ? pickDemo(list, lang, demoId) : null), [list, lang, demoId]);
  const languages = useMemo(() => sortLanguages(problem.languages), [problem.languages]);

  const pickLanguage = (l: Language) => {
    setLang(l);
    setDemoId(null);
    setRevision(null);
    setChapter(null);
  };

  // URL を今の選択に合わせる（共有・再読み込みで同じものが開く）
  useEffect(() => {
    if (!list) return; // 既定の言語は一覧が届くまで決まらないので、それまでは書き換えない
    const q = new URLSearchParams();
    q.set("lang", lang);
    if (current) q.set("demo", current.demo_id);
    if (revision != null) q.set("rev", String(revision));
    if (chapter) q.set("chapter", chapter);
    const url = `${window.location.pathname}?${q}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [list, lang, current, revision, chapter]);

  // ---- 本体（reveal=1。ゲートを通った後だけ取る）
  const [detail, setDetail] = useState<DemoDetail | null>(null);
  const [ds, setDs] = useState<DetailState | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // 一覧を取り直すと current は別オブジェクトになるので、取得は id（文字列）にだけ依存させる（再生中に作り直さない）
  const currentId = current?.demo_id ?? null;
  const detailKey = currentId && unlocked ? `${currentId}@${revision ?? "latest"}#${reloadTick}` : null;
  const reqSeq = useRef(0);
  useEffect(() => {
    if (!detailKey || !currentId) return;
    const seq = ++reqSeq.current;
    const q = new URLSearchParams({ reveal: "1" });
    if (revision != null) q.set("revision", String(revision));
    fetch(`/api/demos/${encodeURIComponent(currentId)}?${q}`, { cache: "no-store" })
      .then(async (res) => {
        if (seq !== reqSeq.current) return;
        if (res.status === 409) return setDs({ kind: "recording", key: detailKey });
        const body = (await res.json().catch(() => null)) as (DemoDetail & { error?: string }) | null;
        if (!res.ok || !body?.compiled) throw new Error(body?.error ?? `HTTP ${res.status}`);
        if (seq !== reqSeq.current) return;
        // 既定の版（FR-D-01）: 最新が検証済みでなければ、検証済みの最新の版を開く
        if (revision == null && !isVerified(body.summary) && body.revisions?.length) {
          const ok = body.revisions.find((r) => isVerified(r));
          if (ok && ok.revision !== body.script.revision) {
            setRevision(ok.revision);
            return;
          }
        }
        setDetail(body);
        setDs({ kind: "ready", key: detailKey });
      })
      .catch((e: Error) => {
        if (seq === reqSeq.current) setDs({ kind: "error", key: detailKey, message: e.message });
      });
  }, [detailKey, currentId, revision]);
  const shownDetail = detail && current && detail.summary.demo_id === current.demo_id ? detail : null;
  // 視聴の記録（最初に見た時刻だけ残す）。以後のセッションのレビューに注記するため
  useEffect(() => {
    if (shownDetail && readJson<string | null>(VIEWED_KEY(problem.id), null) == null) writeJson(VIEWED_KEY(problem.id), new Date().toISOString());
  }, [shownDetail, problem.id]);
  const dsNow = ds && ds.key === detailKey ? ds : null;

  // ---- 5 秒ごとの確認（見えている間だけ）
  const emptyForLang = !!list && !current;
  const recording = listRecording || dsNow?.kind === "recording";
  useEffect(() => {
    if (!visible || !(emptyForLang || recording)) return;
    const detailRecording = dsNow?.kind === "recording";
    const id = setInterval(() => {
      fetchList();
      if (detailRecording) setReloadTick((n) => n + 1);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [visible, emptyForLang, recording, fetchList, dsNow?.kind]);

  // ---- 音声の状態（作っている間は進捗を確認する）
  const audioStatus = shownDetail?.summary.audio_status ?? "none";
  // 進捗と依頼の結果は、表示中の版（と読み込み直しの回数）に結びつけて持つ。版が変われば自然に空になる
  const audioKey = shownDetail ? `${shownDetail.summary.demo_id}@${shownDetail.script.revision}#${reloadTick}` : null;
  const [audioState, setAudioState] = useState<{ key: string; job: AudioJobStatus | null; msg: string | null } | null>(null);
  const job = audioState && audioState.key === audioKey ? audioState.job : null;
  const audioMsg = audioState && audioState.key === audioKey ? audioState.msg : null;
  const setJob = (j: AudioJobStatus) => audioKey && setAudioState({ key: audioKey, job: j, msg: null });
  const setAudioMsg = (m: string | null) => audioKey && setAudioState({ key: audioKey, job, msg: m });
  const [requesting, setRequesting] = useState(false);
  const generating = job ? job.status === "generating" : audioStatus === "generating";
  const demoForAudio = shownDetail?.summary.demo_id ?? null;
  useEffect(() => {
    if (!visible || !generating || !demoForAudio) return;
    const key = audioKey;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/demos/${encodeURIComponent(demoForAudio)}/audio`, { cache: "no-store" });
        if (res.ok && key) {
          const j = (await res.json()) as AudioJobStatus;
          setAudioState({ key, job: j, msg: null });
        }
      } catch {
        /* 次の周期で再試行 */
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [visible, generating, demoForAudio, audioKey]);
  const requestAudio = async () => {
    if (!demoForAudio) return;
    setRequesting(true);
    setAudioMsg(null);
    try {
      const res = await fetch(`/api/demos/${encodeURIComponent(demoForAudio)}/audio`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { status?: string; total?: number; error?: string; reason?: string; message?: string } | null;
      const rev = shownDetail!.script.revision;
      // 202: 合成を始めた（進捗は GET で追う）／200: もうできている（読み込み直しを促す）／409: 作れない理由か録画中
      if (res.status === 202) setJob({ status: "generating", revision: rev, done: 0, total: body?.total ?? 0 });
      else if (res.ok) setJob({ status: "ready", revision: rev, done: 0, total: 0 });
      else setAudioMsg(body?.reason ?? body?.message ?? `音声を作れませんでした（HTTP ${res.status}）`);
    } catch (e) {
      setAudioMsg((e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  // ---- 内容の確認（FR-D-41）。保存先の API は無いので、このブラウザに残す
  const reviewedKey = shownDetail ? `${shownDetail.summary.demo_id}@${shownDetail.script.revision}` : null;
  const [reviewedMap, setReviewedMap] = useState(() => readJson<Record<string, string>>(REVIEWED_KEY, {}));
  const reviewed = !!reviewedKey && !!reviewedMap[reviewedKey];
  const toggleReviewed = (v: boolean) => {
    if (!reviewedKey) return;
    const all = { ...readJson<Record<string, string>>(REVIEWED_KEY, {}) };
    if (v) all[reviewedKey] = new Date().toISOString();
    else delete all[reviewedKey];
    writeJson(REVIEWED_KEY, all);
    setReviewedMap(all);
  };

  // 評価ダイアログは開くたびに作り直す（保存済みの評価を初期値として読み直すため）
  const [rateOpen, setRateOpenRaw] = useState(false);
  const [rateSeq, setRateSeq] = useState(0);
  const setRateOpen = (o: boolean) => {
    if (o) setRateSeq((n) => n + 1);
    setRateOpenRaw(o);
  };

  // ---- 表示 ----------------------------------------------------------------------
  const revisions: DemoRevisionInfo[] = shownDetail?.revisions?.length
    ? shownDetail.revisions
    : shownDetail
      ? [{ revision: shownDetail.script.revision, created_at: shownDetail.summary.created_at, title: shownDetail.summary.title, final_verdict: shownDetail.summary.final_verdict, passed: shownDetail.summary.passed, total: shownDetail.summary.total, estimate_ms: shownDetail.summary.estimate_ms }]
      : [];
  const otherDemos = list ? versionsFor(list, lang) : [];
  const s = shownDetail?.summary ?? current;
  const trust = s ? trustState(s) : null;
  const when = s ? new Date(s.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const audioEnabled = !!shownDetail?.audio && audioStatus === "ready" && !(job && job.status !== "ready");
  const audioArrived = job?.status === "ready" && !shownDetail?.audio;

  const banners = shownDetail ? (
    <div className="flex flex-col gap-2">
      {trust?.tone === "warning" && (
        <NotificationBanner tone="warning" live="off" title="テストを実行できませんでした">
          この版は動作が未確認です。
        </NotificationBanner>
      )}
      {trust?.tone === "danger" && (
        <NotificationBanner tone="danger" live="off" title={`最終コードが ${shownDetail.summary.total - shownDetail.summary.passed} 件のテストに通りません`}>
          既定では開かない版です。作り直しを Claude に頼んでください。
        </NotificationBanner>
      )}
      {shownDetail.summary.runner_backend === "fake" && (
        <NotificationBanner tone="warning" variant="compact" live="off">
          隔離なしの実行（開発用の fake ランナー）で検証した版です。
        </NotificationBanner>
      )}
      {shownDetail.summary.problem_updated && (
        <NotificationBanner tone="info" variant="compact" live="off">
          作成後に問題が更新されています。作り直しを推奨します。
        </NotificationBanner>
      )}
      {generating ? (
        <NotificationBanner tone="info" variant="compact">
          音声を作っています{job && job.total > 0 ? `（${job.done}/${job.total} 区間）` : shownDetail.audio_progress ? `（${shownDetail.audio_progress.done}/${shownDetail.audio_progress.total} 区間）` : ""}。できるまでは字幕で再生します。
        </NotificationBanner>
      ) : audioArrived ? (
        <NotificationBanner tone="success" variant="compact" actions={<Button size="xs" onClick={() => setReloadTick((n) => n + 1)}>音声付きで読み込む</Button>}>
          音声ができました。読み込むと長さが実測に合わせて少し変わります。
        </NotificationBanner>
      ) : (
        !audioEnabled && (
          <NotificationBanner
            tone="info"
            variant="compact"
            live="off"
            actions={
              audioStatus !== "unavailable" && (
                <Button size="xs" onClick={requestAudio} loading={requesting}>
                  音声を作る
                </Button>
              )
            }
          >
            音声がありません。字幕で再生します。
            {(audioMsg ?? shownDetail.audio_unavailable_reason) && <span className="ml-1 text-fg-body">{audioMsg ?? shownDetail.audio_unavailable_reason}</span>}
          </NotificationBanner>
        )
      )}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { label: "問題一覧", href: "/problems" },
            { label: problem.id, href: `/problems/${problem.id}`, mono: true },
            { label: "模範解答デモ" },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <h1 className="min-w-0 text-std-24B-150 text-fg">{problem.title} の模範解答デモ</h1>
          {shownDetail && (
            <Button onClick={() => setRateOpen(true)} className="shrink-0">
              評価する
            </Button>
          )}
        </div>
        {unlocked && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-dns-13N-130 text-fg-muted">
            {/* Select は幅 100% なので、外側で幅を決める */}
            <div className="w-44 shrink-0">
              {/* FR-D-05: デモがある言語と「この言語で作る」（空状態で頼む文を出す）を分けて並べる */}
              <Select aria-label="言語" value={lang} onChange={(e) => pickLanguage(e.target.value as Language)}>
                {list ? (
                  <>
                    {languages.some((l) => langsWithDemo.has(l)) && (
                      <optgroup label="デモがある言語">
                        {languages
                          .filter((l) => langsWithDemo.has(l))
                          .map((l) => (
                            <option key={l} value={l}>
                              {LANGUAGE_LABEL[l]}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {languages.some((l) => !langsWithDemo.has(l)) && (
                      <optgroup label="この言語で作る">
                        {languages
                          .filter((l) => !langsWithDemo.has(l))
                          .map((l) => (
                            <option key={l} value={l}>
                              {LANGUAGE_LABEL[l]}（未作成）
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  languages.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABEL[l]}
                    </option>
                  ))
                )}
              </Select>
            </div>
            {shownDetail && (revisions.length > 1 || otherDemos.length > 1) && (
              <div className="w-44 shrink-0">
                <Select
                  aria-label="版"
                  value={`${shownDetail.summary.demo_id}:${shownDetail.script.revision}`}
                  onChange={(e) => {
                    const [id, rev] = e.target.value.split(":");
                    setDemoId(id!);
                    setRevision(id === shownDetail.summary.demo_id ? Number(rev) : null);
                  }}
                >
                  {revisions.map((r) => (
                    <option key={r.revision} value={`${shownDetail.summary.demo_id}:${r.revision}`}>
                      版 {r.revision}
                      {isVerified(r) ? "" : "（失敗）"}
                    </option>
                  ))}
                  {otherDemos
                    .filter((d) => d.demo_id !== shownDetail.summary.demo_id)
                    .map((d) => (
                      <option key={d.demo_id} value={`${d.demo_id}:${d.revision}`}>
                        別のデモ: {d.title}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            {shownDetail && (
              <>
                {revisions.length <= 1 && otherDemos.length <= 1 && <span className="text-fg-body">版 {shownDetail.script.revision}</span>}
                <span className="tabular-nums">
                  {shownDetail.compiled.timing_source === "estimated" ? "約 " : ""}
                  {fmtLength(shownDetail.compiled.duration)}（制限 {problem.time_limit} 分）
                </span>
                {trust && (
                  <StatusBadge tone={trust.tone}>
                    {trust.label}（{when}）
                  </StatusBadge>
                )}
                <StatusBadge variant="outlined" glyph={false}>
                  {reviewed ? "Claude 作成・確認済み" : "Claude 作成・未確認"}
                </StatusBadge>
                <Checkbox checked={reviewed} onChange={(e) => toggleReviewed(e.target.checked)} className="py-0">
                  内容を確認した
                </Checkbox>
              </>
            )}
          </div>
        )}
        {shownDetail && <p className="text-dns-13N-130 text-fg-muted">話し方と書く順序の手本です。理想化した進行なので、本番ではこの 1.3〜1.5 倍かかっても構いません。</p>}
      </header>

      {!unlocked ? (
        <DemoGate problemId={problem.id} onUnlock={unlock} />
      ) : recording ? (
        <DemoRecording
          onRetry={() => {
            fetchList();
            setReloadTick((n) => n + 1);
          }}
        />
      ) : listError && !list ? (
        <NotificationBanner tone="danger" title="デモの一覧を読み込めませんでした" actions={<Button size="xs" onClick={fetchList}>再試行</Button>}>
          {listError}
        </NotificationBanner>
      ) : !list ? (
        <LoadingText>デモを探しています…</LoadingText>
      ) : !current ? (
        <DemoEmpty problem={problem} language={lang} otherLanguages={languages.filter((l) => l !== lang && langsWithDemo.has(l))} onPickLanguage={pickLanguage} polling={visible} />
      ) : dsNow?.kind === "error" && !shownDetail ? (
        <NotificationBanner tone="danger" title="デモを読み込めませんでした" actions={<Button size="xs" onClick={() => setReloadTick((n) => n + 1)}>再試行</Button>}>
          {dsNow.message}
        </NotificationBanner>
      ) : !shownDetail ? (
        <LoadingText>デモを読み込み中…</LoadingText>
      ) : (
        <>
          <DemoPlayer
            key={`${shownDetail.summary.demo_id}@${shownDetail.script.revision}:${audioEnabled ? "a" : "s"}:${shownDetail.compiled.duration}`}
            problem={problem}
            detail={shownDetail}
            record={record}
            audioEnabled={audioEnabled}
            initialChapter={chapter}
            onRate={() => setRateOpen(true)}
            banners={banners}
          />
          <DemoAbout detail={shownDetail} problem={problem} record={record} />
          <DemoVersions
            detail={shownDetail}
            revisions={revisions}
            currentRevision={shownDetail.script.revision}
            onOpenRevision={(r) => setRevision(r)}
            onDeleted={(whole) => {
              setRevision(null);
              if (whole) {
                setDetail(null);
                setDemoId(null);
              }
              fetchList();
              setReloadTick((n) => n + 1);
            }}
          />
          <RateDialog key={rateSeq} open={rateOpen} onOpenChange={setRateOpen} detail={shownDetail} problemTitle={problem.title} />
        </>
      )}
    </div>
  );
}
