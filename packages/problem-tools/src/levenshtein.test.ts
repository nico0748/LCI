import test from "node:test";
import assert from "node:assert/strict";
import { levenshtein, normalizeTitle, titleSimilarity } from "./levenshtein.ts";

test("levenshtein: 基本距離", () => {
  assert.equal(levenshtein("", ""), 0);
  assert.equal(levenshtein("abc", ""), 3);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("検索フォーム", "検索フォーム"), 0);
  assert.equal(levenshtein("検索フォーム", "検索ホーム"), 2);
});

test("normalizeTitle: 全角・空白・記号・大小文字を無視する", () => {
  assert.equal(normalizeTitle("ＡＰＩ レートリミッタ（Token Bucket）"), "apiレートリミッタtokenbucket");
});

test("titleSimilarity: 近似重複は 0.85 以上、別物は下回る", () => {
  assert.ok(titleSimilarity("いいね API の冪等性", "いいねAPIの冪等性") >= 0.99);
  assert.ok(titleSimilarity("検索フォームとサーバーに優しいキャッシュ", "検索フォームとサーバに優しいキャッシュ") >= 0.85);
  assert.ok(titleSimilarity("検索フォームとキャッシュ", "Webhook の HMAC 署名検証") < 0.5);
});
