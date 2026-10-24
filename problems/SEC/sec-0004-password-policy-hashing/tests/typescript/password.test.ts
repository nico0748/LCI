import test from "node:test";
import assert from "node:assert/strict";
import { checkPassword, hashPassword, needsRehash, verifyPassword } from "./password.ts";

const VECTOR = "pbkdf2_sha256$1000$MDEyMzQ1Njc4OWFiY2RlZg==$yqSq2SygY1sB4EcH9f2FG0JTMES+wqLsOT5YmiRBplI=";
const PHRASE = "correct horse battery staple";
const check = (pw: string, userId = "nico", email = "nico.yamada@example.jp") => checkPassword(pw, { userId, email });

test("ok", () => assert.deepEqual(check(PHRASE), []));

test("no composition rules", () => {
  assert.deepEqual(check("abcdefghijkm"), []);
  assert.deepEqual(check("ながいあいことばはあんぜんです"), []);
  assert.deepEqual(check("たのしい診察室に咲く花たち"), []);
});

test("length boundaries", () => {
  assert.deepEqual(check("a1b2c3d4e5f"), ["too_short"]);
  assert.deepEqual(check("a1b2c3d4e5f6"), []);
  assert.deepEqual(check("abcde".repeat(26).slice(0, 128)), []);
  assert.deepEqual(check("abcde".repeat(26).slice(0, 129)), ["too_long"]);
});

test("length counts code points, not UTF-16 units", () => {
  // 🌸 は UTF-16 で 2 単位。length で数えると 12 以上に見えてしまう
  assert.deepEqual(check("🌸🍀🌙abcdefg"), ["too_short"]);
  assert.deepEqual(check("🌸".repeat(3) + "ab".repeat(4) + "x"), []);
});

test("common", () => {
  assert.deepEqual(check("password1234"), ["common"]);
  assert.deepEqual(check("Password1234"), ["common"]);
  assert.deepEqual(check("ＰＡＳＳＷＯＲＤ１２３４"), ["common"]);
});

test("common and short reports both in order", () => assert.deepEqual(check("password"), ["too_short", "common"]));

test("contains user info", () => {
  assert.deepEqual(check("my-NICO-is-great"), ["contains_user_info"]);
  assert.deepEqual(check("i am nico.yamada!!"), ["contains_user_info"]);
  assert.deepEqual(check("ＮＩＣＯ forever and ever"), ["contains_user_info"]);
});

test("short user id is ignored", () => assert.deepEqual(checkPassword("abcdefghijkm", { userId: "ab", email: "xy@example.com" }), []));

test("repetitive", () => {
  assert.deepEqual(check("zzzz-bridge-river"), ["repetitive"]);
  assert.deepEqual(check("zzz-bridge-river"), []);
});

test("multiple reasons in order", () => {
  assert.deepEqual(checkPassword("nicoooo", { userId: "nico", email: "n@x.jp" }), ["too_short", "contains_user_info", "repetitive"]);
});

test("cross-language vector matches the storage format", () => {
  assert.equal(hashPassword(PHRASE, { iterations: 1000, salt: Buffer.from("0123456789abcdef") }), VECTOR);
  assert.equal(verifyPassword(PHRASE, VECTOR), true);
  assert.equal(verifyPassword(PHRASE + " ", VECTOR), false);
});

test("random salt and default iterations", () => {
  const pw = "ながいあいことばはあんぜんです";
  const a = hashPassword(pw);
  const b = hashPassword(pw);
  assert.notEqual(a, b);
  const [alg, it] = a.split("$");
  assert.equal(alg, "pbkdf2_sha256");
  assert.equal(it, "600000");
  assert.equal(verifyPassword(pw, a), true);
  assert.equal(verifyPassword(pw, b), true);
  assert.equal(verifyPassword("ながいあいことばはあんぜんでした", a), false);
});

test("NFKC before hashing", () => {
  const stored = hashPassword("ｃｏｒｒｅｃｔ horse", { iterations: 1000 });
  assert.equal(verifyPassword("correct horse", stored), true);
});

test("broken stored values return false", () => {
  const dk = VECTOR.split("$")[3];
  for (const bad of [
    "",
    "garbage",
    "pbkdf2_sha256$abc$AAAA$AAAA",
    "md5$1000$MDEy$yqSq",
    `pbkdf2_sha256$1000$!!!$${dk}`,
    "pbkdf2_sha256$1000$MDEyMzQ1Njc4OWFiY2RlZg==$AAAA",
    `pbkdf2_sha256$0$MDEyMzQ1Njc4OWFiY2RlZg==$${dk}`,
    `${VECTOR}$extra`,
  ]) {
    assert.equal(verifyPassword(PHRASE, bad), false, bad);
  }
});

test("needsRehash", () => {
  assert.equal(needsRehash(VECTOR), true);
  assert.equal(needsRehash(VECTOR, 1000), false);
  assert.equal(needsRehash(VECTOR, 999), false);
  assert.equal(needsRehash("garbage"), true);
  assert.equal(needsRehash("md5$1000$MDEy$yqSq"), true);
});
