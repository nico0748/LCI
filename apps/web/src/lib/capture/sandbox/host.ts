import { SANDBOX_CHANNEL, isFromFrame, type FromFrameMessage, type LayoutAssert, type LoadPayload, type ScenarioResult, type ScenarioSpec } from "./protocol.ts";

/**
 * 親ページ側の sandbox iframe 管理。
 * - frame.html テンプレートを 1 度だけ取得し、LoadPayload を埋めて srcdoc にする（protocol.ts の注記参照）
 * - 1 回の load = 1 つの新しい iframe。シナリオごとに作り直すので状態が持ち越されない
 * - iframe からのメッセージは e.source で検証する（opaque origin なので origin は "null"）
 */

let templateCache: Promise<string> | null = null;

export function fetchTemplate(origin = ""): Promise<string> {
  templateCache ??= fetch(`${origin}/sandbox/frame.html`, { cache: "force-cache" }).then((r) => {
    if (!r.ok) throw new Error(`frame.html を取得できません (${r.status})`);
    return r.text();
  });
  return templateCache;
}

/** JSON を <script> に埋めても閉じタグ等で壊れないようにする */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function buildSrcdoc(template: string, payload: LoadPayload, origin: string): string {
  const { html, ...config } = payload;
  const tailwindTag = payload.tailwind ? `<script src="${origin}/sandbox/tailwind.js"></script>` : "";
  return template
    // テンプレートの説明コメントは不要（プレースホルダ置換の誤爆も防ぐ）
    .replace(/<!--[\s\S]*?-->\s*/g, "")
    .replace(/__LCI_ORIGIN__/g, origin)
    .replace("__LCI_CONFIG__", () => embedJson({ ...config, html: undefined }))
    .replace("__LCI_TAILWIND__", () => tailwindTag)
    .replace("__LCI_USER_HTML__", () => html);
}

export interface SandboxHostOptions {
  /** iframe を入れる要素 */
  container: HTMLElement;
  origin?: string;
  onMessage?: (msg: FromFrameMessage) => void;
  /** iframe の属性（サイズなど） */
  className?: string;
  title?: string;
}

export class SandboxHost {
  private iframe: HTMLIFrameElement | null = null;
  private readonly origin: string;
  private readonly listeners = new Set<(msg: FromFrameMessage) => void>();
  private readonly onWindowMessage = (e: MessageEvent) => {
    if (!this.iframe || e.source !== this.iframe.contentWindow) return;
    if (!isFromFrame(e.data)) return;
    const msg = e.data as FromFrameMessage;
    this.opts.onMessage?.(msg);
    for (const l of this.listeners) l(msg);
  };

  private readonly opts: SandboxHostOptions;

  constructor(opts: SandboxHostOptions) {
    this.opts = opts;
    this.origin = opts.origin ?? (typeof location !== "undefined" ? location.origin : "");
    window.addEventListener("message", this.onWindowMessage);
  }

  get element() {
    return this.iframe;
  }

  /** 新しい iframe を作って読み込む。ready（ユーザ HTML の解析完了）まで待つ */
  async load(payload: Omit<LoadPayload, "type">, timeoutMs = 10000): Promise<{ t_ready: number }> {
    const template = await fetchTemplate(this.origin);
    this.destroyFrame();
    const iframe = document.createElement("iframe");
    // allow-same-origin は付けない（FR-X-01-6）。forms は入力操作に不要（submit は form-action 'none' で止まる）
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.title = this.opts.title ?? "プレビュー";
    if (this.opts.className) iframe.className = this.opts.className;
    this.iframe = iframe;
    const ready = this.waitFor((m) => (m.type === "ready" ? { t_ready: m.t } : null), timeoutMs, "プレビューの読み込み");
    iframe.srcdoc = buildSrcdoc(template, { type: "load", ...payload }, this.origin);
    this.opts.container.appendChild(iframe);
    return ready;
  }

  /** judge: 読み込み済みのフレームでシナリオを走らせる（load で埋め込んだ場合は自動実行の結果を待つだけ） */
  runScenario(scenario: ScenarioSpec, layout?: LayoutAssert[], timeoutMs = 20000): Promise<ScenarioResult> {
    const p = this.waitFor((m) => (m.type === "scenario_result" ? m.result : null), timeoutMs, `シナリオ ${scenario.name}`);
    this.iframe?.contentWindow?.postMessage({ channel: SANDBOX_CHANNEL, type: "run_scenario", scenario, layout }, "*");
    return p;
  }

  /** load で scenario を埋め込んだときの結果待ち */
  waitScenarioResult(timeoutMs = 20000): Promise<ScenarioResult> {
    return this.waitFor((m) => (m.type === "scenario_result" ? m.result : null), timeoutMs, "シナリオ");
  }

  private waitFor<T>(pick: (m: FromFrameMessage) => T | null, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(l);
        reject(new Error(`${label}がタイムアウトしました（${timeoutMs}ms）`));
      }, timeoutMs);
      const l = (m: FromFrameMessage) => {
        const v = pick(m);
        if (v === null) return;
        clearTimeout(timer);
        this.listeners.delete(l);
        resolve(v);
      };
      this.listeners.add(l);
    });
  }

  private destroyFrame() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  destroy() {
    this.destroyFrame();
    this.listeners.clear();
    window.removeEventListener("message", this.onWindowMessage);
  }
}
