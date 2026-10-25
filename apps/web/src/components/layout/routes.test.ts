import { test } from "node:test";
import assert from "node:assert/strict";
import { isInterviewRoute, isNavCurrent } from "./routes.ts";

test("isInterviewRoute: /session/<id> だけが面接画面（/session/new は事前確認）", () => {
  assert.equal(isInterviewRoute("/session/20261024T1200-abc"), true);
  assert.equal(isInterviewRoute("/session/20261024T1200-abc/"), true);
  assert.equal(isInterviewRoute("/session/new"), false);
  assert.equal(isInterviewRoute("/sessions/20261024T1200-abc"), false);
  assert.equal(isInterviewRoute("/"), false);
  assert.equal(isInterviewRoute(null), false);
});

test("isNavCurrent: ホームは完全一致、ほかは配下を含む", () => {
  assert.equal(isNavCurrent("/", "/"), true);
  assert.equal(isNavCurrent("/", "/problems"), false);
  assert.equal(isNavCurrent("/problems", "/problems/fe-0001"), true);
  assert.equal(isNavCurrent("/problems", "/session/new"), true);
  assert.equal(isNavCurrent("/sessions", "/sessions/abc"), true);
  assert.equal(isNavCurrent("/sessions", "/session/abc"), false);
  assert.equal(isNavCurrent("/problems", "/problemsx"), false);
});
