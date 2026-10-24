/*
 * LCI sandbox shim（要件書 02 FR-X-03-1〜3）。
 * sandbox="allow-scripts" の iframe の中で、ユーザ HTML より先に読み込まれる。
 * - window.fetch / XMLHttpRequest を置き換え、mockApi.routes に合う URL だけ定義済みレスポンスで応答する
 * - すべてのリクエストを {t, url, method, status} として記録し、終了時に親へ postMessage する
 * - console / エラーも親へ転送する
 * 設定（LoadPayload）は <script id="lci-config" type="application/json"> に埋め込まれている。
 */
(function () {
  "use strict";
  var CHANNEL = "lci-sandbox";
  var core = self.LCIScenarioCore;
  var cfgEl = document.getElementById("lci-config");
  var cfg = {};
  try {
    cfg = JSON.parse((cfgEl && cfgEl.textContent) || "{}");
  } catch (e) {
    cfg = {};
  }
  var rnd = core.mulberry32(typeof cfg.seed === "number" ? cfg.seed : Date.now());

  var state = {
    requests: [], // RequestRecord（status: pending → completed|failed|aborted|blocked）
    inflight: 0,
    lastActivity: performance.now(),
    nextId: 1,
    clicks: [],
    typed: [],
    errors: [],
    done: false,
  };

  function post(msg) {
    try {
      msg.channel = CHANNEL;
      parent.postMessage(msg, "*"); // opaque origin なので targetOrigin は指定できない。親は e.source で検証する
    } catch (e) {
      /* 親がいない（単体で開いた）場合は無視 */
    }
  }

  // シナリオ終了時点でまだ応答が無いものは "failed"（タイムアウト扱い）。"aborted" にすると abort を使ったと誤推定される
  function publicRecord(rec) {
    return { id: rec.id, t: rec.t, t_end: rec.t_end, url: rec.url, method: rec.method, status: rec.status === "pending" ? "failed" : rec.status, httpStatus: rec.httpStatus };
  }

  // ---- console / error 転送 ---------------------------------------------------
  function fmt(a) {
    if (typeof a === "string") return a;
    if (a instanceof Error) return a.name + ": " + a.message;
    try {
      return JSON.stringify(a);
    } catch (e) {
      return String(a);
    }
  }
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments).map(fmt);
      post({ type: "console", level: level, args: args.slice(0, 20) });
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (e) {
    var msg = e && e.message ? e.message : "スクリプトエラー";
    state.errors.push(msg);
    post({ type: "error", message: msg, line: e && e.lineno, col: e && e.colno });
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    if (r && r.name === "AbortError") return; // 中断は正常系
    var msg = "未処理の Promise 拒否: " + fmt(r);
    state.errors.push(msg);
    post({ type: "error", message: msg });
  });

  // ---- fetch / XHR モック ---------------------------------------------------
  function absolutize(url) {
    try {
      return new URL(String(url), "https://sandbox.lci.local/").href;
    } catch (e) {
      return String(url);
    }
  }
  function abortError() {
    try {
      return new DOMException("The user aborted a request.", "AbortError");
    } catch (e) {
      var err = new Error("The user aborted a request.");
      err.name = "AbortError";
      return err;
    }
  }
  function begin(url, method) {
    var rec = { id: state.nextId++, t: performance.now(), url: url, method: method, status: "pending" };
    state.requests.push(rec);
    state.inflight++;
    state.lastActivity = rec.t;
    return rec;
  }
  function finish(rec, status, httpStatus) {
    if (rec.status !== "pending") return;
    rec.status = status;
    rec.t_end = performance.now();
    if (httpStatus != null) rec.httpStatus = httpStatus;
    state.inflight = Math.max(0, state.inflight - 1);
    state.lastActivity = rec.t_end;
    post({ type: "request", request: publicRecord(rec) });
  }
  function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), { status: status, headers: { "content-type": "application/json" } });
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;

  function mockRequest(url, method, signal) {
    var rec = begin(url, method);
    var matched = core.matchRoute(cfg.mockApi, url, method);
    if (!matched) {
      if (!cfg.mockApi || cfg.mockApi.unmatched !== "passthrough" || !realFetch) {
        finish(rec, "blocked");
        return Promise.reject(new TypeError("LCI sandbox: このネットワーク先は許可されていません: " + url));
      }
      // passthrough でも CSP connect-src 'none' が実際には止める。記録だけ正しく残す
      return realFetch(url, { method: method, signal: signal }).then(
        function (r) {
          finish(rec, "completed", r.status);
          return r;
        },
        function (e) {
          finish(rec, signal && signal.aborted ? "aborted" : "failed");
          throw e;
        },
      );
    }
    var route = matched.route;
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        finish(rec, "aborted");
        reject(abortError());
        return;
      }
      var latency = core.pickLatency(route.latencyMs, rnd);
      var onAbort = function () {
        clearTimeout(timer);
        finish(rec, "aborted");
        reject(abortError());
      };
      var timer = setTimeout(function () {
        if (signal) signal.removeEventListener("abort", onAbort);
        if (route.failRate > 0 && rnd() < route.failRate) {
          finish(rec, "failed", 503);
          resolve(jsonResponse({ error: "service unavailable" }, 503));
          return;
        }
        var body = core.resolveResponse(route, url, matched.groups);
        finish(rec, "completed", 200);
        resolve(jsonResponse(body, 200));
      }, latency);
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  window.fetch = function (input, init) {
    var isReq = typeof Request !== "undefined" && input instanceof Request;
    var url = absolutize(isReq ? input.url : input);
    var method = String((init && init.method) || (isReq && input.method) || "GET").toUpperCase();
    var signal = (init && init.signal) || (isReq && input.signal) || null;
    return mockRequest(url, method, signal);
  };

  function LCIXMLHttpRequest() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = "";
    this.responseText = "";
    this.response = "";
    this.responseType = "";
    this.responseURL = "";
    this.timeout = 0;
    this.withCredentials = false;
    this.upload = new EventTarget();
    this._listeners = {};
    this._headers = {};
  }
  LCIXMLHttpRequest.prototype = {
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4,
    addEventListener: function (name, fn) {
      (this._listeners[name] = this._listeners[name] || []).push(fn);
    },
    removeEventListener: function (name, fn) {
      var l = this._listeners[name] || [];
      var i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    _fire: function (name) {
      var ev;
      try {
        ev = new Event(name);
      } catch (e) {
        ev = { type: name };
      }
      try {
        Object.defineProperty(ev, "target", { value: this });
      } catch (e) {
        /* ignore */
      }
      var l = this._listeners[name] || [];
      for (var i = 0; i < l.length; i++) {
        try {
          l[i].call(this, ev);
        } catch (e) {
          console.error(e);
        }
      }
      var h = this["on" + name];
      if (typeof h === "function") {
        try {
          h.call(this, ev);
        } catch (e) {
          console.error(e);
        }
      }
    },
    _state: function (n) {
      this.readyState = n;
      this._fire("readystatechange");
    },
    open: function (method, url) {
      this._method = String(method || "GET").toUpperCase();
      this._url = absolutize(url);
      this.responseURL = this._url;
      this._state(1);
    },
    setRequestHeader: function (k, v) {
      this._headers[k] = v;
    },
    getResponseHeader: function (k) {
      return String(k).toLowerCase() === "content-type" ? "application/json" : null;
    },
    getAllResponseHeaders: function () {
      return "content-type: application/json\r\n";
    },
    overrideMimeType: function () {},
    send: function () {
      var self_ = this;
      this._ctrl = new AbortController();
      this._fire("loadstart");
      mockRequest(this._url, this._method, this._ctrl.signal).then(
        function (res) {
          return res.text().then(function (text) {
            self_.status = res.status;
            self_.statusText = res.status === 200 ? "OK" : "Service Unavailable";
            self_._state(2);
            self_.responseText = text;
            if (self_.responseType === "json") {
              try {
                self_.response = JSON.parse(text);
              } catch (e) {
                self_.response = null;
              }
            } else self_.response = text;
            self_._state(4);
            self_._fire("load");
            self_._fire("loadend");
          });
        },
        function (err) {
          self_.status = 0;
          self_._state(4);
          self_._fire(err && err.name === "AbortError" ? "abort" : "error");
          self_._fire("loadend");
        },
      );
    },
    abort: function () {
      if (this._ctrl) this._ctrl.abort();
    },
  };
  LCIXMLHttpRequest.UNSENT = 0;
  LCIXMLHttpRequest.OPENED = 1;
  LCIXMLHttpRequest.HEADERS_RECEIVED = 2;
  LCIXMLHttpRequest.LOADING = 3;
  LCIXMLHttpRequest.DONE = 4;
  window.XMLHttpRequest = LCIXMLHttpRequest;

  // 他の通信手段は塞ぐ（CSP でも止まるが、エラーの出どころを分かりやすくする）
  function blocked(name) {
    return function () {
      throw new TypeError("LCI sandbox: " + name + " はこの環境では使えません");
    };
  }
  try {
    window.WebSocket = blocked("WebSocket");
    window.EventSource = blocked("EventSource");
    if (navigator.sendBeacon) navigator.sendBeacon = function () { return false; };
  } catch (e) {
    /* ignore */
  }

  // ---- 読み込み完了通知 ----------------------------------------------------------
  var readyCallbacks = [];
  function onDone() {
    if (state.done) return;
    state.done = true;
    post({ type: "ready", t: performance.now() });
    readyCallbacks.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }
  // テンプレート末尾の <script> から呼ばれる。保険として load イベントでも呼ぶ
  window.addEventListener("load", function () {
    setTimeout(onDone, 0);
  });

  window.__lci = {
    cfg: cfg,
    state: state,
    core: core,
    post: post,
    done: onDone,
    onReady: function (fn) {
      if (state.done) fn();
      else readyCallbacks.push(fn);
    },
    publicRecord: publicRecord,
  };
})();
