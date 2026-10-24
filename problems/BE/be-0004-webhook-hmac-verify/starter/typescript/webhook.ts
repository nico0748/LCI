export class WebhookError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function verifyWebhook(rawBody: Buffer, header: string, secrets: string[], now: number): unknown {
  throw new Error("not implemented");
}
