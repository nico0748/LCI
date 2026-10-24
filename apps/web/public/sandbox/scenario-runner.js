/*
 * LCI sandbox: 操作シナリオランナー（要件書 02 FR-X-02-4/5, FR-X-03-4）。
 * iframe の中で WebStep を順に実行し、ScenarioResult を親へ postMessage する。
 * 判定ロジックは scenario-core.js の純粋関数に寄せ、ここは DOM 操作と待機だけを担当する。
 */
(function () {
  "use strict";
  var L = window.__lci;
  if (!L) return;
  var core = L.core;
  var state = L.state;
  var STEP_TIMEOUT_MS = 15000;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function setNativeValue(el, value) {
    // React 等が value setter をフックしているため、プロトタイプの setter で入れてから input を発火する
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function textsOf(selector) {
    var els;
    try {
      els = document.querySelectorAll(selector);
    } catch (e) {
      return null;
    }
    return Array.prototype.map.call(els, function (el) {
      return el.textContent || "";
    });
  }

  function rectOf(selector) {
    var el;
    try {
      el = document.querySelector(selector);
    } catch (e) {
      return null;
    }
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  }

  async function waitSettled(maxMs) {
    var start = performance.now();
    var quiet = Math.min(500, maxMs);
    while (true) {
      var now = performance.now();
      if (state.inflight === 0 && now - state.lastActivity >= quiet) return;
      if (now - start >= maxMs) return;
      await sleep(25);
    }
  }

  async function runStep(step) {
    var kind = core.stepKind(step);
    switch (kind) {
      case "type": {
        var el = document.querySelector(step.type);
        if (!el) return { ok: false, message: "入力欄が見つからない: " + step.type };
        state.typed.push(step.value);
        state.lastActivity = performance.now();
        el.focus && el.focus();
        setNativeValue(el, step.value);
        return { ok: true };
      }
      case "click": {
        var btn = document.querySelector(step.click);
        if (!btn) return { ok: false, message: "ボタンが見つからない: " + step.click };
        var times = step.times || 1;
        for (var i = 0; i < times; i++) {
          state.clicks.push(performance.now());
          state.lastActivity = performance.now();
          btn.click();
          if (i < times - 1 && step.intervalMs) await sleep(step.intervalMs);
        }
        return { ok: true };
      }
      case "wait":
        await sleep(step.wait);
        return { ok: true };
      case "waitForRequestsSettled":
        await waitSettled(step.waitForRequestsSettled);
        return { ok: true };
      case "expectText": {
        var t = textsOf(step.expectText.selector);
        if (t === null) return { ok: false, message: "不正なセレクタ: " + step.expectText.selector };
        return core.evalExpectText(t, step.expectText.contains);
      }
      case "expectNoText": {
        var t2 = textsOf(step.expectNoText.selector);
        if (t2 === null) return { ok: false, message: "不正なセレクタ: " + step.expectNoText.selector };
        return core.evalExpectNoText(t2, step.expectNoText.contains);
      }
      case "expectRequests":
        return core.evalExpectRequests(state.requests, step.expectRequests);
      default:
        return { ok: false, message: "不明なステップ" };
    }
  }

  function withTimeout(p, ms) {
    return Promise.race([
      p,
      sleep(ms).then(function () {
        return { ok: false, message: "ステップがタイムアウト（" + ms + "ms）", timeout: true };
      }),
    ]);
  }

  async function runScenario(scenario, layout) {
    // Tailwind（browser 版）は class を非同期にスタイルへ反映するので、レイアウト検証の前に少し待つ
    await sleep(150);
    var t0 = performance.now();
    var steps = [];
    var failed = false;
    var list = (scenario && scenario.steps) || [];
    for (var i = 0; i < list.length; i++) {
      var step = list[i];
      var r;
      try {
        r = await withTimeout(runStep(step), STEP_TIMEOUT_MS);
      } catch (e) {
        r = { ok: false, message: "例外: " + (e && e.message ? e.message : String(e)) };
      }
      steps.push({ index: i, step: step, ok: !!r.ok, message: r.ok ? undefined : r.message || core.describeStep(step) + " に失敗" });
      if (!r.ok) {
        failed = true;
        if (r.timeout) break; // 固まっているので残りは実行しない
      }
    }
    // 判定後に飛んでいるリクエストの結末（完了／中断）を記録に残すため、少しだけ待つ（判定には影響しない）
    if (state.inflight > 0) await waitSettled(2000);
    var layoutResults = [];
    (layout || []).forEach(function (a) {
      var rects = (a.selectors || []).map(rectOf);
      var res = core.layoutCheck(a.assert, rects);
      layoutResults.push({ name: a.name, ok: !!res.ok, message: res.ok ? undefined : res.message });
      if (!res.ok) failed = true;
    });
    return {
      name: scenario ? scenario.name : "layout",
      verdict: failed ? "FAIL" : "PASS",
      steps: steps,
      layout: layoutResults,
      requests: state.requests.map(L.publicRecord),
      clicks: state.clicks.slice(),
      typed: state.typed.slice(),
      errors: state.errors.slice(),
      duration_ms: Math.round(performance.now() - t0),
    };
  }

  L.runScenario = runScenario;

  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var d = e.data;
    if (!d || d.channel !== "lci-sandbox") return;
    if (d.type === "run_scenario") {
      L.onReady(function () {
        runScenario(d.scenario, d.layout).then(function (result) {
          L.post({ type: "scenario_result", result: result });
        });
      });
    }
  });

  // judge モードで scenario が埋め込まれていれば、読み込み完了後に自動実行する
  if (L.cfg && L.cfg.scenarioMode === "judge" && (L.cfg.scenario || L.cfg.layout)) {
    L.onReady(function () {
      runScenario(L.cfg.scenario || { name: "layout", steps: [] }, L.cfg.layout).then(function (result) {
        L.post({ type: "scenario_result", result: result });
      });
    });
  }
})();
