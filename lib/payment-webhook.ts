import { createHmac, timingSafeEqual } from "node:crypto";
import { sandboxEnabled } from "@/lib/sandbox";

// Incoming-payment webhook helpers: HMAC-SHA256 signing/verification and body validation. Server-only.
// Signature = hex HMAC-SHA256 of `${scope}.${x-timestamp}.${rawBody}` (scope binds it to one demo, so a
// signed body cannot be replayed against another scope that shares the secret).
// Secret lookup: PAYMENT_WEBHOOK_SECRET_<SCOPE> (per demo), then PAYMENT_WEBHOOK_SECRET (shared).
// The dev fallback below is used ONLY while the sandbox is enabled; otherwise a missing secret means "not configured".
export const DEV_WEBHOOK_SECRET = "dev-only-qrpay-webhook-secret";
export const TIMESTAMP_TOLERANCE_SECONDS = 300;
export const SIGNATURE_HEADER = "x-signature";
export const TIMESTAMP_HEADER = "x-timestamp";

export function webhookSecret(scope?: string): string | null {
  const perScope = scope ? process.env[`PAYMENT_WEBHOOK_SECRET_${scope.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] : undefined;
  const fromEnv = perScope || process.env.PAYMENT_WEBHOOK_SECRET;
  if (fromEnv) return fromEnv;
  return sandboxEnabled() ? DEV_WEBHOOK_SECRET : null;
}

export function signWebhook(secret: string, scope: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${scope}.${timestamp}.${rawBody}`).digest("hex");
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "stale_timestamp" | "bad_signature" };

export function verifyWebhookSignature(
  secret: string,
  scope: string,
  headers: Headers,
  rawBody: string,
  nowMs: number = Date.now(),
): SignatureCheck {
  const signature = headers.get(SIGNATURE_HEADER);
  const timestamp = headers.get(TIMESTAMP_HEADER);
  if (!signature || !timestamp || !/^\d{9,13}$/.test(timestamp)) return { ok: false, reason: "missing" };
  // Accept seconds; tolerate milliseconds from providers that send them.
  const tsMs = timestamp.length > 11 ? Number(timestamp) : Number(timestamp) * 1000;
  if (Math.abs(nowMs - tsMs) > TIMESTAMP_TOLERANCE_SECONDS * 1000) return { ok: false, reason: "stale_timestamp" };

  const expected = Buffer.from(signWebhook(secret, scope, timestamp, rawBody), "hex");
  const given = /^[0-9a-f]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : null;
  if (!given || given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

export type PaymentEvent = {
  eventId: string;
  provider: string;
  amountSatang: number;
  reference: string | null;
  paidAt: string;
  accountLast4: string | null;
};

// Validates the JSON body of an incoming-payment notification.
export function parsePaymentEvent(raw: unknown): { ok: true; event: PaymentEvent } | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, message: "body must be a JSON object" };
  const b = raw as Record<string, unknown>;
  if (typeof b.eventId !== "string" || !/^[\w.:-]{6,80}$/.test(b.eventId)) return { ok: false, message: "eventId must be a 6-80 char string" };
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount)) return { ok: false, message: "amount must be a positive number (baht)" };
  // Range is checked after rounding to satang so 0.004 (rounds to 0) cannot slip through.
  const amountSatang = Math.round(b.amount * 100);
  if (amountSatang < 1 || amountSatang > 1_000_000_000) return { ok: false, message: "amount must be between 0.01 and 10,000,000 baht" };
  if (typeof b.paidAt !== "string" || Number.isNaN(Date.parse(b.paidAt))) return { ok: false, message: "paidAt must be an ISO date string" };
  if (b.reference !== undefined && b.reference !== null && (typeof b.reference !== "string" || b.reference.length > 40)) return { ok: false, message: "reference must be a string (max 40)" };
  if (b.accountLast4 !== undefined && b.accountLast4 !== null && (typeof b.accountLast4 !== "string" || !/^\d{4}$/.test(b.accountLast4))) return { ok: false, message: "accountLast4 must be 4 digits" };
  if (b.provider !== undefined && (typeof b.provider !== "string" || b.provider.length > 40)) return { ok: false, message: "provider must be a string (max 40)" };
  return {
    ok: true,
    event: {
      eventId: b.eventId,
      provider: typeof b.provider === "string" && b.provider ? b.provider : "unknown",
      amountSatang,
      reference: typeof b.reference === "string" && b.reference ? b.reference.toUpperCase() : null,
      paidAt: new Date(b.paidAt).toISOString(),
      accountLast4: typeof b.accountLast4 === "string" ? b.accountLast4 : null,
    },
  };
}
