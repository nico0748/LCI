/*
 * LCI sandbox: 純粋関数だけを集めたコア（iframe 内の shim.js / scenario-runner.js と node:test の両方から使う）。
 * 依存ゼロ・DOM 非依存。UMD 形式にしているのは、iframe では <script src> の古典スクリプトとして、
 * テストでは require() で読むため。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LCIScenarioCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** 再現可能な乱数（latency / failRate 用）。seed が同じなら同じ系列 */
  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickLatency(range, rnd) {
    if (!range) return 0;
    if (typeof range === "number") return range;
    var lo = Number(range[0]) || 0;
    var hi = Number(range[1]);
    if (!(hi > lo)) return lo;
    return Math.round(lo + (hi - lo) * rnd());
  }

  /** mockApi.routes から URL とメソッドに合う最初のルートを返す */
  function matchRoute(mockApi, url, method) {
    if (!mockApi || !Array.isArray(mockApi.routes)) return null;
    var m = String(method || "GET").toUpperCase();
    for (var i = 0; i < mockApi.routes.length; i++) {
      var route = mockApi.routes[i];
      var want = String((route.match && route.match.method) || "GET").toUpperCase();
      if (want !== "*" && want !== m) continue;
      var re;
      try {
        re = new RegExp(route.match.urlPattern);
      } catch (e) {
        continue;
      }
      var mm = re.exec(url);
      if (mm) return { route: route, index: i, groups: mm.slice(1) };
    }
    return null;
  }

  function safeDecode(s) {
    try {
      return decodeURIComponent(String(s).replace(/\+/g, " "));
    } catch (e) {
      return String(s);
    }
  }

  /** byQuery のキー: `q` パラメータ（無ければ正規表現の最初のキャプチャ） */
  function queryOf(url, groups) {
    var qi = url.indexOf("?");
    if (qi >= 0) {
      var parts = url.slice(qi + 1).split("#")[0].split("&");
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (kv[0] === "q") return safeDecode(kv.slice(1).join("="));
      }
    }
    if (groups && groups.length && groups[0] != null) return safeDecode(groups[0]);
    return "";
  }

  function resolveResponse(route, url, groups) {
    var q = queryOf(url, groups);
    var respond = route.respond || {};
    var byQuery = respond.byQuery || {};
    if (Object.prototype.hasOwnProperty.call(byQuery, q)) return byQuery[q];
    return respond["default"] === undefined ? [] : respond["default"];
  }

  // ---- 期待値の評価 ---------------------------------------------------------

  /**
   * expectRequests。requests は {url, status} の配列。status: pending|completed|failed|aborted|blocked。
   * - blocked は数えない（ネットワークに出ていない）
   * - count: 「サーバーに届いた回数」= completed + failed + pending（+ allowAborted でなければ aborted も）
   * - completedMax: completed の上限
   */
  function evalExpectRequests(requests, spec) {
    var list = requests.filter(function (r) {
      return r.status !== "blocked";
    });
    if (spec.url) {
      list = list.filter(function (r) {
        return String(r.url).indexOf(spec.url) >= 0;
      });
    }
    var completed = list.filter(function (r) {
      return r.status === "completed" || r.status === "failed" || r.status === "pending";
    });
    var aborted = list.filter(function (r) {
      return r.status === "aborted";
    });
    var reached = spec.allowAborted ? completed : completed.concat(aborted);
    var msgs = [];
    if (typeof spec.count === "number" && reached.length !== spec.count) {
      msgs.push("リクエスト数 " + reached.length + "（期待 " + spec.count + "）" + (aborted.length ? "、中断 " + aborted.length : ""));
    }
    if (typeof spec.completedMax === "number" && completed.length > spec.completedMax) {
      msgs.push("完了したリクエスト " + completed.length + "（上限 " + spec.completedMax + "）");
    }
    return { ok: msgs.length === 0, message: msgs.join("; "), completed: completed.length, aborted: aborted.length, total: list.length };
  }

  /** expectText: 要素群の textContent を結合し、contains のすべてを含むか */
  function evalExpectText(texts, contains) {
    var joined = texts.join("\n");
    var missing = (contains || []).filter(function (s) {
      return joined.indexOf(s) < 0;
    });
    if (texts.length === 0) return { ok: false, message: "要素が見つからない" };
    return { ok: missing.length === 0, message: missing.length ? "見つからない文字列: " + missing.join(", ") : "" };
  }

  /** expectNoText: どの要素も contains のいずれも含まない（要素が無ければ成功） */
  function evalExpectNoText(texts, contains) {
    var hits = [];
    for (var i = 0; i < texts.length; i++) {
      for (var j = 0; j < (contains || []).length; j++) {
        if (texts[i].indexOf(contains[j]) >= 0) hits.push(contains[j] === "" ? "(要素が存在)" : contains[j]);
      }
    }
    return { ok: hits.length === 0, message: hits.length ? "含まれてはいけない: " + hits.slice(0, 3).join(", ") : "" };
  }

  /** レイアウト検証。rects は selectors ごとの {top,bottom,left,right,width,height} または null */
  function layoutCheck(kind, rects) {
    for (var i = 0; i < rects.length; i++) {
      if (!rects[i]) return { ok: false, message: "要素 " + (i + 1) + " が見つからない" };
    }
    if (kind === "exists") return { ok: true, message: "" };
    var a = rects[0];
    var b = rects[1];
    if (!b) return { ok: false, message: "セレクタが 2 つ必要" };
    if (kind === "sameRow") {
      var overlap = a.top < b.bottom && b.top < a.bottom;
      var visible = a.height > 0 && b.height > 0;
      return { ok: overlap && visible, message: overlap && visible ? "" : "縦方向に重なっていない (" + Math.round(a.top) + "-" + Math.round(a.bottom) + " vs " + Math.round(b.top) + "-" + Math.round(b.bottom) + ")" };
    }
    if (kind === "below") {
      var ok = a.top >= b.bottom - 1;
      return { ok: ok, message: ok ? "" : "下に配置されていない (top " + Math.round(a.top) + " < bottom " + Math.round(b.bottom) + ")" };
    }
    return { ok: false, message: "未知のアサート: " + kind };
  }

  /** ステップ配列から 1 つを分類する */
  function stepKind(step) {
    if (!step || typeof step !== "object") return "unknown";
    if ("click" in step) return "click";
    if ("wait" in step) return "wait";
    if ("waitForRequestsSettled" in step) return "waitForRequestsSettled";
    if ("expectText" in step) return "expectText";
    if ("expectNoText" in step) return "expectNoText";
    if ("expectRequests" in step) return "expectRequests";
    if ("type" in step) return "type";
    return "unknown";
  }

  function describeStep(step) {
    var k = stepKind(step);
    switch (k) {
      case "type":
        return "入力 " + JSON.stringify(step.value) + " → " + step.type;
      case "click":
        return "クリック " + step.click + (step.times ? " ×" + step.times : "");
      case "wait":
        return "待機 " + step.wait + "ms";
      case "waitForRequestsSettled":
        return "リクエスト完了待ち（最大 " + step.waitForRequestsSettled + "ms）";
      case "expectText":
        return "表示を確認: " + step.expectText.contains.join(", ");
      case "expectNoText":
        return "表示されないことを確認: " + step.expectNoText.selector;
      case "expectRequests":
        return "リクエスト数を確認 " + JSON.stringify(step.expectRequests);
      default:
        return "不明なステップ";
    }
  }

  return {
    mulberry32: mulberry32,
    pickLatency: pickLatency,
    matchRoute: matchRoute,
    queryOf: queryOf,
    resolveResponse: resolveResponse,
    evalExpectRequests: evalExpectRequests,
    evalExpectText: evalExpectText,
    evalExpectNoText: evalExpectNoText,
    layoutCheck: layoutCheck,
    stepKind: stepKind,
    describeStep: describeStep,
  };
});
