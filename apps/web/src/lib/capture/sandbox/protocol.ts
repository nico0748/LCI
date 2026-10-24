/**
 * 親ページ ↔ sandbox iframe の postMessage 契約（要件書 02 FR-X-01-6 / FR-X-03）。
 * iframe 側の実装は public/sandbox/{shim,scenario-runner,scenario-core}.js（素の JS）。
 *
 * 「load」について: sandbox="allow-scripts"（allow-same-origin なし）の iframe は opaque origin になり、
 * CSP の 'self' が何にもマッチしない。また document.open() は window のイベントリスナを全部外す。
 * そのため「load」メッセージは postMessage ではなく、親が frame.html テンプレートに
 * LoadPayload を JSON で埋め込んだ srcdoc を組み立てることで実現する（= シナリオごとに新しい文書）。
 * 以降のメッセージは通常の postMessage。
 */

export type ScenarioMode = "preview" | "judge";

export interface MockRoute {
  match: { method: string; urlPattern: string };
  latencyMs: [number, number];
  failRate: number;
  respond: { byQuery: Record<string, unknown>; default?: unknown };
}

export interface MockApi {
  routes: MockRoute[];
  unmatched: "block" | "passthrough";
}

export interface LoadPayload {
  type: "load";
  html: string;
  mockApi: MockApi | null;
  scenarioMode: ScenarioMode;
  tailwind: boolean;
  /** judge 時: ready 後に自動で走らせるシナリオ。preview では省略 */
  scenario?: ScenarioSpec;
  layout?: LayoutAssert[];
  /** 乱数の種（latency を再現可能にする） */
  seed?: number;
}

export type WebStep =
  | { type: string; value: string }
  | { click: string; times?: number; intervalMs?: number }
  | { wait: number }
  | { waitForRequestsSettled: number }
  | { expectText: { selector: string; contains: string[] } }
  | { expectNoText: { selector: string; contains: string[] } }
  | { expectRequests: { count?: number; completedMax?: number; url?: string; allowAborted?: boolean } };

export interface ScenarioSpec {
  name: string;
  steps: WebStep[];
  tags?: string[];
  weight?: number;
}

export interface LayoutAssert {
  name: string;
  assert: "sameRow" | "below" | "exists";
  selectors: string[];
}

export type RequestStatus = "completed" | "aborted" | "failed" | "blocked";

export interface RequestRecord {
  id: number;
  /** iframe 内 performance.now()（iframe 読込からの ms）。親が offset を足してセッション時刻にする */
  t: number;
  t_end?: number;
  url: string;
  method: string;
  status: RequestStatus;
  httpStatus?: number;
}

export interface StepResult {
  index: number;
  step: WebStep;
  ok: boolean;
  message?: string;
}

export interface LayoutResult {
  name: string;
  ok: boolean;
  message?: string;
}

export interface ScenarioResult {
  name: string;
  verdict: "PASS" | "FAIL";
  steps: StepResult[];
  layout: LayoutResult[];
  requests: RequestRecord[];
  /** click ステップが発火した時刻（iframe 時間）。debounce 推定に使う */
  clicks: number[];
  /** シナリオ中に type ステップで入力した値（empty-skip 推定に使う） */
  typed: string[];
  errors: string[];
  duration_ms: number;
}

export type ToFrameMessage = { type: "run_scenario"; scenario: ScenarioSpec; layout?: LayoutAssert[] } | { type: "ping" };

export type FromFrameMessage =
  | { type: "ready"; t: number }
  | { type: "request"; request: RequestRecord }
  | { type: "console"; level: "log" | "info" | "warn" | "error" | "debug"; args: string[] }
  | { type: "error"; message: string; line?: number; col?: number }
  | { type: "scenario_result"; result: ScenarioResult };

export const SANDBOX_CHANNEL = "lci-sandbox";

export function isFromFrame(data: unknown): data is FromFrameMessage & { channel: typeof SANDBOX_CHANNEL } {
  return !!data && typeof data === "object" && (data as { channel?: unknown }).channel === SANDBOX_CHANNEL && typeof (data as { type?: unknown }).type === "string";
}
