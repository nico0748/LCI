import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhook, WebhookError } from "./webhook.ts";

const SECRET = "whsec_test_123";
const NOW = 1_730_000_000;
const BODY = Buffer.from('{"id":"evt_1","type":"payment.succeeded","amount":1200}');

const sign = (t: number, body: Buffer, secret = SECRET) =>
  createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${t}.`), body])).digest("hex");

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof WebhookError, `WebhookError を投げるべき: ${String(e)}`);
    return e.code;
  }
  assert.fail("拒否されなかった");
}

const ev = (x: unknown) => x as Record<string, unknown>;

test("valid", () => {
  const e = ev(verifyWebhook(BODY, `t=${NOW},v1=${sign(NOW, BODY)}`, [SECRET], NOW));
  assert.equal(e.id, "evt_1");
  assert.equal(e.amount, 1200);
});

test("spaces and unknown schemes in the header", () => {
  assert.equal(ev(verifyWebhook(BODY, `t=${NOW}, v0=deadbeef, v1=${sign(NOW, BODY)}`, [SECRET], NOW)).id, "evt_1");
});

test("tampered body", () => {
  const tampered = Buffer.from(BODY.toString().replace("1200", "9999"));
  assert.equal(code(() => verifyWebhook(tampered, `t=${NOW},v1=${sign(NOW, BODY)}`, [SECRET], NOW)), "signature_mismatch");
});

test("re-serialized JSON does not match", () => {
  const pretty = Buffer.from('{"id": "evt_1", "type": "payment.succeeded", "amount": 1200}');
  assert.equal(code(() => verifyWebhook(pretty, `t=${NOW},v1=${sign(NOW, BODY)}`, [SECRET], NOW)), "signature_mismatch");
});

test("signature over the body only is rejected", () => {
  const bodyOnly = createHmac("sha256", SECRET).update(BODY).digest("hex");
  assert.equal(code(() => verifyWebhook(BODY, `t=${NOW},v1=${bodyOnly}`, [SECRET], NOW)), "signature_mismatch");
});

test("wrong secret", () => {
  assert.equal(code(() => verifyWebhook(BODY, `t=${NOW},v1=${sign(NOW, BODY, "other")}`, [SECRET], NOW)), "signature_mismatch");
});

test("changing t breaks the signature", () => {
  assert.equal(code(() => verifyWebhook(BODY, `t=${NOW},v1=${sign(NOW - 3600, BODY)}`, [SECRET], NOW)), "signature_mismatch");
});

test("tolerance boundaries", () => {
  for (const t of [NOW - 300, NOW + 300]) assert.equal(ev(verifyWebhook(BODY, `t=${t},v1=${sign(t, BODY)}`, [SECRET], NOW)).id, "evt_1");
  for (const t of [NOW - 301, NOW + 301, NOW - 86400]) {
    assert.equal(code(() => verifyWebhook(BODY, `t=${t},v1=${sign(t, BODY)}`, [SECRET], NOW)), "timestamp_out_of_range");
  }
});

test("rotation: multiple signatures", () => {
  const header = `t=${NOW},v1=${sign(NOW, BODY, "old")},v1=${sign(NOW, BODY, "new")}`;
  assert.equal(ev(verifyWebhook(BODY, header, ["new"], NOW)).id, "evt_1");
  assert.equal(ev(verifyWebhook(BODY, header, ["old"], NOW)).id, "evt_1");
});

test("rotation: multiple secrets", () => {
  const header = `t=${NOW},v1=${sign(NOW, BODY, "old")}`;
  assert.equal(ev(verifyWebhook(BODY, header, ["new", "old"], NOW)).id, "evt_1");
  assert.equal(code(() => verifyWebhook(BODY, header, ["new"], NOW)), "signature_mismatch");
});

test("malformed headers", () => {
  const good = sign(NOW, BODY);
  for (const h of ["", "garbage", `v1=${good}`, `t=${NOW}`, `t=abc,v1=${good}`, `t=-5,v1=${good}`, `t=${NOW},v0=${good}`]) {
    assert.equal(code(() => verifyWebhook(BODY, h, [SECRET], NOW)), "malformed_header", h);
  }
});

test("invalid payload", () => {
  const body = Buffer.from("not json");
  assert.equal(code(() => verifyWebhook(body, `t=${NOW},v1=${sign(NOW, body)}`, [SECRET], NOW)), "invalid_payload");
});

test("non-ASCII body", () => {
  const body = Buffer.from('{"id":"evt_2","note":"決済完了"}', "utf8");
  assert.equal(ev(verifyWebhook(body, `t=${NOW},v1=${sign(NOW, body)}`, [SECRET], NOW)).note, "決済完了");
});
