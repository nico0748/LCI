import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SEC = 300;

export class WebhookError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function parseHeader(header: string): { t: number; sigs: string[] } {
  let t: number | null = null;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") {
      if (t !== null || !/^\d+$/.test(v)) throw new WebhookError("malformed_header");
      t = Number(v);
    } else if (k === "v1") {
      sigs.push(v.toLowerCase());
    }
    // v0 など未知の項目は無視する
  }
  if (t === null || sigs.length === 0) throw new WebhookError("malformed_header");
  return { t, sigs };
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  // timingSafeEqual は長さが違うと例外になるので先に比較する（長さは秘密ではない）
  return x.length === y.length && timingSafeEqual(x, y);
}

// 署名対象は "{t}." + 生のボディ。比較は定数時間。t を署名に含めることで t の書き換えによる再送を防ぐ
export function verifyWebhook(rawBody: Buffer, header: string, secrets: string[], now: number): unknown {
  const { t, sigs } = parseHeader(header);
  if (Math.abs(now - t) > TOLERANCE_SEC) throw new WebhookError("timestamp_out_of_range");
  const signed = Buffer.concat([Buffer.from(`${t}.`, "utf8"), rawBody]);
  let ok = false;
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(signed).digest("hex");
    for (const s of sigs) ok = safeEqualHex(expected, s) || ok;
  }
  if (!ok) throw new WebhookError("signature_mismatch");
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new WebhookError("invalid_payload");
  }
}
