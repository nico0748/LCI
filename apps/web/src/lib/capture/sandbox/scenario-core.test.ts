import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

// public/sandbox/scenario-core.js は iframe 用の古典スクリプト（UMD）。node では require で読む
const require = createRequire(import.meta.url);
const core = require(path.resolve(import.meta.dirname, "../../../../public/sandbox/scenario-core.js")) as {
  mulberry32(seed: number): () => number;
  pickLatency(range: [number, number] | number | undefined, rnd: () => number): number;
  matchRoute(mockApi: unknown, url: string, method: string): { route: Record<string, unknown>; index: number; groups: string[] } | null;
  queryOf(url: string, groups?: string[]): string;
  resolveResponse(route: unknown, url: string, groups?: string[]): unknown;
  evalExpectRequests(requests: { url: string; status: string }[], spec: Record<string, unknown>): { ok: boolean; message: string };
  evalExpectText(texts: string[], contains: string[]): { ok: boolean; message: string };
  evalExpectNoText(texts: string[], contains: string[]): { ok: boolean; message: string };
  layoutCheck(kind: string, rects: ({ top: number; bottom: number; left: number; right: number; width: number; height: number } | null)[]): { ok: boolean; message: string };
  stepKind(step: unknown): string;
};

const mockApi = {
  routes: [
    {
      match: { method: "GET", urlPattern: "^https://api\\.example\\.com/search\\?q=(.*)$" },
      latencyMs: [300, 800],
      failRate: 0,
      respond: { byQuery: { "": [], lorem: [{ id: 1, title: "Lorem ipsum" }], sit: [{ id: 3, title: "Sit amet" }] }, default: [{ id: 4, title: "Consectetur" }] },
    },
  ],
  unmatched: "block",
};

test("matchRoute / resolveResponse: q パラメータで byQuery、無ければ default", () => {
  const m = core.matchRoute(mockApi, "https://api.example.com/search?q=lorem", "GET");
  assert.ok(m);
  assert.deepEqual(core.resolveResponse(m.route, "https://api.example.com/search?q=lorem", m.groups), [{ id: 1, title: "Lorem ipsum" }]);
  assert.deepEqual(core.resolveResponse(m.route, "https://api.example.com/search?q=", m.groups), []);
  assert.deepEqual(core.resolveResponse(m.route, "https://api.example.com/search?q=zzz", m.groups), [{ id: 4, title: "Consectetur" }]);
  assert.equal(core.queryOf("https://api.example.com/search?q=%E3%81%82&x=1"), "あ");
  assert.equal(core.matchRoute(mockApi, "https://api.example.com/search?q=lorem", "POST"), null, "メソッド不一致");
  assert.equal(core.matchRoute(mockApi, "https://evil.example.com/", "GET"), null);
});

test("pickLatency は範囲内で再現可能", () => {
  const r1 = core.mulberry32(42);
  const r2 = core.mulberry32(42);
  const a = core.pickLatency([300, 800], r1);
  assert.equal(a, core.pickLatency([300, 800], r2));
  assert.ok(a >= 300 && a <= 800);
  assert.equal(core.pickLatency(250, r1), 250);
  assert.equal(core.pickLatency(undefined, r1), 0);
});

test("evalExpectRequests: count / completedMax / url / allowAborted", () => {
  const reqs = [
    { url: "https://api.example.com/search?q=sit", status: "completed" },
    { url: "https://api.example.com/search?q=lorem", status: "aborted" },
    { url: "https://api.example.com/search?q=lorem", status: "completed" },
    { url: "https://cdn.example.com/x.js", status: "blocked" },
  ];
  assert.equal(core.evalExpectRequests(reqs, { count: 1, url: "q=sit" }).ok, true);
  assert.equal(core.evalExpectRequests(reqs, { count: 0 }).ok, false);
  assert.equal(core.evalExpectRequests(reqs, { count: 3 }).ok, true, "aborted も届いた扱い（allowAborted なし）、blocked は数えない");
  assert.equal(core.evalExpectRequests(reqs, { count: 2, allowAborted: true }).ok, true);
  assert.equal(core.evalExpectRequests(reqs, { completedMax: 1, allowAborted: true }).ok, false);
  assert.equal(core.evalExpectRequests(reqs, { completedMax: 1, url: "q=lorem", allowAborted: true }).ok, true);
  assert.equal(core.evalExpectRequests([], { count: 0 }).ok, true);
  assert.equal(core.evalExpectRequests([{ url: "u", status: "pending" }], { count: 0 }).ok, false, "未完了も届いた扱い");
});

test("evalExpectText / evalExpectNoText", () => {
  assert.equal(core.evalExpectText(["Lorem ipsum", "Dolor"], ["Lorem ipsum", "Dolor"]).ok, true);
  assert.equal(core.evalExpectText(["Lorem ipsum"], ["Dolor"]).ok, false);
  assert.equal(core.evalExpectText([], ["x"]).ok, false);
  assert.equal(core.evalExpectNoText([], [""]).ok, true, "img が 1 つも無ければ OK");
  assert.equal(core.evalExpectNoText([""], [""]).ok, false, "img が存在すると contains [''] に引っかかる");
  assert.equal(core.evalExpectNoText(["abc"], ["zzz"]).ok, true);
});

test("layoutCheck: sameRow / below / exists", () => {
  const input = { top: 10, bottom: 40, left: 0, right: 200, width: 200, height: 30 };
  const button = { top: 12, bottom: 38, left: 210, right: 280, width: 70, height: 26 };
  const results = { top: 60, bottom: 60, left: 0, right: 280, width: 280, height: 0 };
  assert.equal(core.layoutCheck("sameRow", [input, button]).ok, true);
  assert.equal(core.layoutCheck("sameRow", [input, results]).ok, false);
  assert.equal(core.layoutCheck("below", [results, input]).ok, true);
  assert.equal(core.layoutCheck("below", [input, results]).ok, false);
  assert.equal(core.layoutCheck("exists", [input]).ok, true);
  assert.equal(core.layoutCheck("exists", [null]).ok, false);
  assert.match(core.layoutCheck("sameRow", [input, null]).message, /見つからない/);
});

test("stepKind は各 WebStep を分類する（type はセレクタ名なので最後に判定）", () => {
  assert.equal(core.stepKind({ type: "input", value: "x" }), "type");
  assert.equal(core.stepKind({ click: "button", times: 5 }), "click");
  assert.equal(core.stepKind({ wait: 1 }), "wait");
  assert.equal(core.stepKind({ waitForRequestsSettled: 1 }), "waitForRequestsSettled");
  assert.equal(core.stepKind({ expectRequests: {} }), "expectRequests");
  assert.equal(core.stepKind({}), "unknown");
});
