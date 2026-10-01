import "server-only";
import { randomUUID } from "node:crypto";
import { sandboxEnabled } from "@/lib/sandbox";
import { parsePaymentEvent, SIGNATURE_HEADER, signWebhook, TIMESTAMP_HEADER, verifyWebhookSignature, webhookSecret } from "@/lib/payment-webhook";
import { releaseSlip, verifySlip } from "@/lib/thunder";
import {
  applyIncomingPayment, assignUnmatched, getIntent, intentQrPayload, listUnmatched, markIntentPaidBySlip, publicPayee, adminPayee, savePayee,
  qrErrorResponse, QrPayError, requireDemoAdmin, type OnPaid, statusMessage } from "@/lib/qr-payments";

// Route handler factories for the QR-payment kit. A demo creates one config and mounts a single catch-all:
//   app/api/<scope>/qrpay/[...path]/route.ts
//     export const dynamic = "force-dynamic";
//     const h = createQrRoutes(qrConfig);
//     export const GET = h.GET; export const POST = h.POST; export const PUT = h.PUT;
// Sub-paths (relative to /api/<scope>/qrpay): webhook, simulate, settings, payee, unmatched,
// unmatched/:id/assign, intents/:id, intents/:id/slip.

export type QrRouteConfig = {
  scope: string;
  onPaid: OnPaid;
  authorizeAdmin?: (request: Request) => void | Promise<void>; // throw QrPayError(403) to deny
  defaultPayeeName?: string;
};

type Handler = (request: Request, params: string[]) => Promise<Response>;

const MAX_SLIP_BODY_BYTES = 5_500_000; // 5MB file plus multipart overhead

const HTTP_BY_SLIP_CODE = { bad_image: 400, invalid_slip: 422, wrong_amount: 422, wrong_receiver: 422, duplicate: 409, provider_error: 502 } as const;

const admin = (cfg: QrRouteConfig) => async (request: Request) => (cfg.authorizeAdmin ?? requireDemoAdmin)(request);

// Incoming-payment notification from the bank / payment provider. Signed with HMAC-SHA256.
export const webhookPost = (cfg: QrRouteConfig): Handler => async (request) => {
  try {
    const secret = webhookSecret(cfg.scope);
    if (!secret) return Response.json({ error: "ยังไม่ได้ตั้งค่า secret ของ webhook", code: "not_configured" }, { status: 503 });

    const raw = await request.text();
    const check = verifyWebhookSignature(secret, cfg.scope, request.headers, raw);
    if (!check.ok) return Response.json({ error: "Invalid webhook signature", code: check.reason }, { status: 401 });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Body must be JSON", code: "bad_request" }, { status: 400 });
    }
    const parsed = parsePaymentEvent(json);
    if (!parsed.ok) return Response.json({ error: parsed.message, code: "bad_request" }, { status: 400 });

    return Response.json({ ok: true, ...applyIncomingPayment(cfg.scope, parsed.event, cfg.onPaid) });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

// Sandbox "bank": signs a notification on the server and feeds it to the real webhook handler.
// It never touches demo rows itself, so every payment still goes through signature check and matching.
export const simulatePost = (cfg: QrRouteConfig): Handler => async (request) => {
  try {
    if (!sandboxEnabled()) return Response.json({ error: "Not found" }, { status: 404 });
    await admin(cfg)(request);
    const secret = webhookSecret(cfg.scope);
    if (!secret) throw new QrPayError(503, "ยังไม่ได้ตั้งค่า secret ของ webhook", "not_configured");

    const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (typeof b.amount !== "number" || !(b.amount > 0)) throw new QrPayError(400, "ต้องระบุยอดเงิน (บาท)", "bad_request");
    const event = {
      eventId: typeof b.eventId === "string" ? b.eventId : `sbx-${randomUUID()}`,
      provider: "sandbox-bank",
      amount: b.amount,
      reference: typeof b.reference === "string" && b.reference ? b.reference : undefined,
      paidAt: new Date().toISOString(),
      accountLast4: "0000",
    };
    const rawBody = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await webhookPost(cfg)(
      new Request(request.url, {
        method: "POST",
        headers: { "content-type": "application/json", [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signWebhook(secret, cfg.scope, timestamp, rawBody) },
        body: rawBody,
      }),
      [],
    );
    const out = await res.json().catch(() => ({}));
    return Response.json({ sent: event, webhookStatus: res.status, webhook: out });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

// Public, non-secret config: masked payee and whether the sandbox bank is on.
export const settingsGet = (cfg: QrRouteConfig): Handler => async () => {
  try {
    return Response.json({ payee: publicPayee(cfg.scope, cfg.defaultPayeeName), sandbox: sandboxEnabled() });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

export const payeeGet = (cfg: QrRouteConfig): Handler => async (request) => {
  try {
    await admin(cfg)(request);
    return Response.json({ payee: adminPayee(cfg.scope, cfg.defaultPayeeName) });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

export const payeePut = (cfg: QrRouteConfig): Handler => async (request) => {
  try {
    await admin(cfg)(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new QrPayError(400, "ข้อมูลที่ส่งมาต้องเป็น JSON object", "bad_request");
    return Response.json({ payee: savePayee(cfg.scope, body.type, body.promptpayId, body.name) });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

export const unmatchedGet = (cfg: QrRouteConfig): Handler => async (request) => {
  try {
    await admin(cfg)(request);
    return Response.json({ unmatched: listUnmatched(cfg.scope) });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

// Owner manually matches money that arrived but could not be paired automatically.
export const unmatchedAssignPost = (cfg: QrRouteConfig): Handler => async (request, params) => {
  try {
    await admin(cfg)(request);
    const unmatchedId = Number(params[0]);
    const body = (await request.json().catch(() => null)) as { intentId?: unknown } | null;
    if (!Number.isInteger(unmatchedId) || typeof body?.intentId !== "string") throw new QrPayError(400, "ต้องระบุรายการชำระเงิน (intentId)", "bad_request");
    return Response.json(assignUnmatched(cfg.scope, unmatchedId, body.intentId, cfg.onPaid));
  } catch (e) {
    return qrErrorResponse(e);
  }
};

// Public status poll. The unguessable intent id is the capability; the QR payload is only returned while payable.
export const intentGet = (cfg: QrRouteConfig): Handler => async (_request, params) => {
  try {
    const intent = getIntent(cfg.scope, params[0]);
    return Response.json({
      intent: {
        id: intent.id, refType: intent.refType, refId: intent.refId, status: intent.status, amount: intent.payableAmountSatang / 100,
        baseAmount: intent.baseAmountSatang / 100, reference: intent.reference, expiresAt: intent.expiresAt, serverNow: Date.now(),
        paidVia: intent.paidVia, paidAt: intent.paidAt,
      },
      qrPayload: intent.status === "pending" ? intentQrPayload(cfg.scope, intent.id) : null,
      payee: publicPayee(cfg.scope, cfg.defaultPayeeName),
      sandbox: sandboxEnabled(),
    });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

// Fallback when the automatic payment notification did not arrive.
export const slipPost = (cfg: QrRouteConfig): Handler => async (request, params) => {
  try {
    // Reject oversized bodies before formData() buffers them (the slip itself is capped at 5MB).
    const declared = Number(request.headers.get("content-length"));
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_SLIP_BODY_BYTES) {
      throw new QrPayError(declared > 0 ? 413 : 411, "ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB", "payload_too_large");
    }
    const form = await request.formData().catch(() => null);
    const file = form?.get("slip");
    if (!(file instanceof File)) throw new QrPayError(400, "กรุณาแนบรูปสลิป", "bad_request");

    const intent = getIntent(cfg.scope, params[0]);
    if (intent.status !== "pending") throw new QrPayError(409, statusMessage(intent.status), intent.status === "expired" ? "order_expired" : "not_payable");
    const slip = await verifySlip(file, intent.payableAmountSatang / 100, `${cfg.scope}:${intent.refType}:${intent.refId}`, Date.parse(intent.createdAt));
    if (!slip.ok) return Response.json({ error: slip.message, code: slip.code }, { status: HTTP_BY_SLIP_CODE[slip.code] });

    try {
      const out = markIntentPaidBySlip(cfg.scope, intent.id, { transRef: slip.transRef, sandbox: slip.sandbox }, cfg.onPaid);
      if (out.cancelled) return Response.json({ error: out.message ?? "ไม่สามารถยืนยันการชำระเงินได้ (ร้านจะคืนเงินให้)", code: "cancelled" }, { status: 409 });
    } catch (e) {
      releaseSlip(slip.transRef);
      throw e;
    }
    return Response.json({ ok: true, sandbox: slip.sandbox, transRef: slip.transRef });
  } catch (e) {
    return qrErrorResponse(e);
  }
};

type Routed = { GET: Route; POST: Route; PUT: Route };
type Route = (request: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

// Single catch-all dispatcher: mount as app/api/<scope>/qrpay/[...path]/route.ts.
export function createQrRoutes(cfg: QrRouteConfig): Routed {
  const table: Record<string, Record<string, Handler>> = {
    GET: { settings: settingsGet(cfg), payee: payeeGet(cfg), unmatched: unmatchedGet(cfg), "intents/*": intentGet(cfg) },
    POST: { webhook: webhookPost(cfg), simulate: simulatePost(cfg), "unmatched/*/assign": unmatchedAssignPost(cfg), "intents/*/slip": slipPost(cfg) },
    PUT: { payee: payeePut(cfg) },
  };
  const dispatch = (method: string): Route => async (request, ctx) => {
    const { path } = await ctx.params;
    const key = path.map((seg, i) => (path[i - 1] === "intents" || path[i - 1] === "unmatched" ? "*" : seg)).join("/");
    const handler = Object.hasOwn(table[method], key) ? table[method][key] : undefined;
    if (!handler) return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });
    return handler(request, path.filter((_, i) => path[i - 1] === "intents" || path[i - 1] === "unmatched"));
  };
  return { GET: dispatch("GET"), POST: dispatch("POST"), PUT: dispatch("PUT") };
}
