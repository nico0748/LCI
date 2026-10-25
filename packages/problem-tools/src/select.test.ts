import test from "node:test";
import assert from "node:assert/strict";
import { matchesOnly, splitOnly } from "./select.ts";

test("--only: 完全一致・接頭辞・カテゴリ名・ディレクトリ名・カンマ区切り", () => {
  const only = (s: string) => splitOnly([s]);
  assert.ok(matchesOnly("cp-0003", only("cp-0003")));
  assert.ok(!matchesOnly("cp-0030", only("cp-0003")));
  // 05 §7.2 の DoD: 10 問をカンマ区切りで
  const ids = only("cp-0001,cp-0002,cp-0010");
  assert.deepEqual(["cp-0001", "cp-0002", "cp-0003", "cp-0010"].map((id) => matchesOnly(id, ids)), [true, true, false, true]);
  // 接頭辞（- で終わらなくてもよい）とカテゴリ名（大文字小文字は問わない）
  assert.ok(matchesOnly("cp-0007", only("cp-")));
  assert.ok(matchesOnly("cp-0007", only("cp-000")));
  assert.ok(!matchesOnly("cp-0017", only("cp-000")));
  assert.ok(matchesOnly("cp-0017", only("CP")));
  assert.ok(!matchesOnly("alg-0001", only("cp")));
  // シェルのグロブで渡したディレクトリ名（problems/CP/cp-00{01..10}-*/）
  assert.ok(matchesOnly("cp-0003", only("problems/CP/cp-0003-bookshelf-min-width/")));
  assert.ok(!matchesOnly("cp-0030", only("problems/CP/cp-0003-bookshelf-min-width/")));
  // 空要素は無視、複数回の --only は合わせる
  assert.deepEqual(splitOnly(["cp-0001,,", " cp-0002 ", "cp-0003,cp-0004"]), ["cp-0001", "cp-0002", "cp-0003", "cp-0004"]);
  assert.ok(!matchesOnly("cp-0001", []));
});
