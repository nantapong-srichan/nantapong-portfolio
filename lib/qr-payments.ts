import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { buildPromptPayPayload, parsePromptPayId, type AccountType } from "@/lib/promptpay";
import type { PaymentEvent } from "@/lib/payment-webhook";

// Reusable PromptPay-QR payment kit. `scope` = demo slug: each demo gets its own payee, intents,
// webhook events and unmatched list. A demo owns its order/booking/invoice rows and flips them to
// paid inside the `onPaid` callback, which runs inside the same transaction as the intent update.

// How long a lapsed intent keeps its unique amount reserved (a slow bank notification may still arrive).
const AMOUNT_GRACE_MS = 24 * 60 * 60_000;

export const SAMPLE_PROMPTPAY_ID = "0800000000";
const DEFAULT_PAYEE_NAME = "บัญชีตัวอย่าง";

const STATUS_TH: Record<string, string> = { paid: "ชำระเงินแล้ว", expired: "หมดอายุแล้ว", cancelled: "ถูกยกเลิกแล้ว", pending: "รอชำระเงิน" };
export const statusMessage = (status: string) => `รายการนี้${STATUS_TH[status] ?? status}`;

export class QrPayError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function qrErrorResponse(e: unknown): Response {
  if (e instanceof QrPayError) return Response.json({ error: e.message, code: e.code, details: e.details }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Internal error", code: "internal" }, { status: 500 });
}

// Demo stand-in for a real admin session; demos may pass their own authorizer to the route factories.
export function requireDemoAdmin(request: Request) {
  if (request.headers.get("x-demo-role") !== "admin") throw new QrPayError(403, "ต้องใช้สิทธิ์ผู้ดูแล", "forbidden");
}

export type IntentStatus = "pending" | "paid" | "expired" | "cancelled";
export type PaidVia = "webhook" | "slip" | "manual";

export type QrIntent = {
  id: string;
  scope: string;
  refType: string;
  refId: string;
  reference: string;
  baseAmountSatang: number;
  payableAmountSatang: number;
  status: IntentStatus;
  expiresAt: number;
  paidVia: PaidVia | null;
  eventId: string | null;
  provider: string | null;
  transRef: string | null;
  sandbox: boolean | null;
  paidAt: string | null;
  createdAt: string;
};

// Returned by onPaid when the demo cannot fulfil (e.g. out of stock): the intent is closed as
// 'cancelled', the money is parked in the unmatched list for a refund, and the demo's own writes stay committed.
// Throw instead to roll everything back.
export type PaidCancel = { cancelled: true; reason: string; message?: string };
export type PaidContext = { scope: string; refType: string; refId: string; intent: QrIntent; via: PaidVia };
export type OnPaid = (paid: PaidContext, t: DatabaseSync) => void | PaidCancel;

type IntentRow = {
  id: string; scope: string; ref_type: string; ref_id: string; reference: string;
  base_amount_satang: number; payable_amount_satang: number; status: IntentStatus; expires_at: number;
  paid_via: PaidVia | null; event_id: string | null; provider: string | null; trans_ref: string | null; sandbox: number | null; paid_at: string | null; created_at: string;
};

const toIntent = (r: IntentRow): QrIntent => ({
  id: r.id, scope: r.scope, refType: r.ref_type, refId: r.ref_id, reference: r.reference,
  baseAmountSatang: r.base_amount_satang, payableAmountSatang: r.payable_amount_satang, status: r.status, expiresAt: r.expires_at,
  paidVia: r.paid_via, eventId: r.event_id, provider: r.provider, transRef: r.trans_ref, sandbox: r.sandbox === null ? null : r.sandbox === 1, paidAt: r.paid_at, createdAt: r.created_at,
});

let ready = false;

function ensure(): DatabaseSync {
  const d = db();
  if (ready) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS qrpay_payee (
      scope TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('company', 'individual')), id TEXT NOT NULL, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qrpay_intents (
      id TEXT PRIMARY KEY, scope TEXT NOT NULL, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, reference TEXT NOT NULL,
      base_amount_satang INTEGER NOT NULL, payable_amount_satang INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
      expires_at INTEGER NOT NULL,
      paid_via TEXT CHECK (paid_via IN ('webhook', 'slip', 'manual')), event_id TEXT, provider TEXT, trans_ref TEXT, sandbox INTEGER, paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (scope, reference)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS qrpay_intents_pending_amount ON qrpay_intents (scope, payable_amount_satang) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS qrpay_intents_ref ON qrpay_intents (scope, ref_type, ref_id);
    CREATE TABLE IF NOT EXISTS qrpay_events (
      scope TEXT NOT NULL, event_id TEXT NOT NULL, provider TEXT NOT NULL, amount_satang INTEGER NOT NULL, reference TEXT,
      result TEXT NOT NULL, intent_id TEXT,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (scope, event_id)
    );
    CREATE TABLE IF NOT EXISTS qrpay_unmatched (
      id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, event_id TEXT NOT NULL, provider TEXT NOT NULL,
      amount_satang INTEGER NOT NULL, reference TEXT, paid_at TEXT NOT NULL, account_last4 TEXT, reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned')), assigned_intent_id TEXT,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (scope, event_id)
    );
  `);
  ready = true;
  return d;
}

// ---------- payee (the PromptPay account that receives the money) ----------

export type Payee = { type: AccountType; id: string; name: string };

// Seeds an obviously fake sample payee on first use; the owner replaces it from the admin screen.
export function getPayee(scope: string, defaultName: string = DEFAULT_PAYEE_NAME): Payee {
  const d = ensure();
  d.prepare("INSERT OR IGNORE INTO qrpay_payee (scope, type, id, name) VALUES (?, 'individual', ?, ?)").run(scope, SAMPLE_PROMPTPAY_ID, defaultName);
  return d.prepare("SELECT type, id, name FROM qrpay_payee WHERE scope = ?").get(scope) as Payee;
}

const maskId = (id: string) => (id.length <= 5 ? id : `${id.slice(0, 2)}${"x".repeat(id.length - 5)}${id.slice(-3)}`);

export function publicPayee(scope: string, defaultName?: string) {
  const p = getPayee(scope, defaultName);
  return { type: p.type, name: p.name, idMasked: maskId(p.id), isSample: p.id === SAMPLE_PROMPTPAY_ID };
}

export function adminPayee(scope: string, defaultName?: string) {
  const p = getPayee(scope, defaultName);
  return { ...p, isSample: p.id === SAMPLE_PROMPTPAY_ID };
}

export function savePayee(scope: string, type: unknown, rawId: unknown, rawName: unknown) {
  const d = ensure();
  if (type !== "company" && type !== "individual") throw new QrPayError(400, "ประเภทบัญชีต้องเป็น บริษัท หรือ บุคคล", "bad_request");
  if (typeof rawId !== "string") throw new QrPayError(400, "กรุณากรอก PromptPay ID", "bad_request");
  const parsed = parsePromptPayId(type, rawId);
  if (!parsed.ok) throw new QrPayError(400, parsed.message, "bad_payee");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 80) : "";
  d.prepare("INSERT INTO qrpay_payee (scope, type, id, name) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET type = excluded.type, id = excluded.id, name = excluded.name").run(scope, type, parsed.target.value, name);
  return adminPayee(scope);
}

// ---------- intents ----------

// Marks pending intents past their deadline as expired. `d` may be a transaction handle.
export function expireStale(scope: string, d: DatabaseSync = ensure()) {
  ensure();
  d.prepare("UPDATE qrpay_intents SET status = 'expired' WHERE scope = ? AND status = 'pending' AND expires_at <= ?").run(scope, Date.now());
}

export type CreateIntentInput = {
  refType: string;
  refId: string;
  baseAmount: number; // baht
  windowMs: number;
  referencePrefix?: string; // printed on the QR/receipt; webhook may echo it back for matching
};

// Call inside the demo's own tx() so the intent and the order/booking row commit together (pass the tx handle as `d`).
// Payable amount = base + a random 0.01-0.99 not used by another pending intent in this scope.
export function createIntent(scope: string, input: CreateIntentInput, d: DatabaseSync = ensure()) {
  ensure();
  const baseSatang = Math.round(input.baseAmount * 100);
  if (!Number.isFinite(baseSatang) || baseSatang <= 0 || baseSatang > 1_000_000_000) throw new QrPayError(400, "ยอดเงินต้องเป็นจำนวนบวก (บาท)", "bad_request");
  expireStale(scope, d);

  // An amount stays reserved for a grace period after its intent lapses, so a late reference-less
  // notification for the old QR cannot be matched to a newer intent that happens to share the amount.
  const reserved = d
    .prepare("SELECT payable_amount_satang AS a, MAX(expires_at) AS until, MAX(status = 'pending') AS live FROM qrpay_intents WHERE scope = ? AND status != 'paid' AND expires_at > ? GROUP BY payable_amount_satang")
    .all(scope, Date.now() - AMOUNT_GRACE_MS) as { a: number; until: number; live: number }[];
  const reservedBy = new Map(reserved.map((r) => [r.a, r]));
  const pool = Array.from({ length: 99 }, (_, i) => baseSatang + i + 1);
  let candidates = pool.filter((a) => !reservedBy.has(a));
  if (candidates.length === 0) {
    // Pool exhausted by lapsed amounts: recycle the one that lapsed longest ago. Only live (pending) amounts are never reused.
    const lapsed = pool.filter((a) => !reservedBy.get(a)!.live);
    if (lapsed.length === 0) throw new QrPayError(503, "ขณะนี้มีรายการรอชำระจำนวนมาก กรุณาลองใหม่ภายหลัง", "busy");
    const oldest = Math.min(...lapsed.map((a) => reservedBy.get(a)!.until));
    candidates = lapsed.filter((a) => reservedBy.get(a)!.until === oldest);
  }
  const payable = candidates[randomInt(candidates.length)];

  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const prefix = input.referencePrefix ?? "QR";
  let reference = "";
  for (let tries = 0; tries < 20; tries++) {
    reference = prefix + Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (!d.prepare("SELECT 1 FROM qrpay_intents WHERE scope = ? AND reference = ?").get(scope, reference)) break;
  }

  const intentId = `qi_${randomBytes(9).toString("base64url")}`;
  const expiresAt = Date.now() + input.windowMs;
  d.prepare(
    `INSERT INTO qrpay_intents (id, scope, ref_type, ref_id, reference, base_amount_satang, payable_amount_satang, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(intentId, scope, input.refType, input.refId, reference, baseSatang, payable, expiresAt);
  return { intentId, payableAmount: payable / 100, reference, expiresAt, qrPayload: qrPayloadFor(scope, payable) };
}

function qrPayloadFor(scope: string, payableSatang: number): string {
  const p = getPayee(scope);
  const parsed = parsePromptPayId(p.type, p.id);
  if (!parsed.ok) throw new QrPayError(500, "บัญชีรับเงินไม่ถูกต้อง", "bad_payee");
  return buildPromptPayPayload(parsed.target, payableSatang);
}

export function getIntent(scope: string, intentId: string, d: DatabaseSync = ensure()): QrIntent {
  expireStale(scope, d);
  const row = d.prepare("SELECT * FROM qrpay_intents WHERE scope = ? AND id = ?").get(scope, intentId) as IntentRow | undefined;
  if (!row) throw new QrPayError(404, "ไม่พบรายการชำระเงิน", "not_found");
  return toIntent(row);
}

// QR payload for a still-payable intent (exact unique amount); 409 once paid/expired/cancelled.
export function intentQrPayload(scope: string, intentId: string): string {
  const intent = getIntent(scope, intentId);
  if (intent.status !== "pending") throw new QrPayError(409, statusMessage(intent.status), "not_payable");
  return qrPayloadFor(scope, intent.payableAmountSatang);
}

// Latest intent for a demo record, e.g. to rebuild a screen from an order id.
export function findIntentByRef(scope: string, refType: string, refId: string): QrIntent | null {
  const d = ensure();
  expireStale(scope, d);
  const row = d.prepare("SELECT * FROM qrpay_intents WHERE scope = ? AND ref_type = ? AND ref_id = ? ORDER BY rowid DESC LIMIT 1").get(scope, refType, refId) as IntentRow | undefined;
  return row ? toIntent(row) : null;
}

// ---------- settlement (shared by webhook, slip, manual assign) ----------

type SettleMeta = { via: PaidVia; eventId?: string; provider?: string; transRef?: string; sandbox?: boolean };

// Caller holds the transaction. The intent status guard is the idempotency gate: onPaid only ever runs once per intent.
function settleIntent(t: DatabaseSync, intent: QrIntent, meta: SettleMeta, onPaid: OnPaid): PaidCancel | null {
  t.prepare(
    `UPDATE qrpay_intents SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), paid_via = ?, event_id = ?, provider = ?, trans_ref = ?, sandbox = ?
     WHERE id = ? AND status IN ('pending', 'expired')`,
  ).run(meta.via, meta.eventId ?? null, meta.provider ?? null, meta.transRef ?? null, meta.sandbox === undefined ? null : meta.sandbox ? 1 : 0, intent.id);
  const fresh = toIntent(t.prepare("SELECT * FROM qrpay_intents WHERE id = ?").get(intent.id) as IntentRow);
  const outcome = onPaid({ scope: intent.scope, refType: intent.refType, refId: intent.refId, intent: fresh, via: meta.via }, t);
  if (outcome && outcome.cancelled) {
    t.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE id = ?").run(intent.id);
    return outcome;
  }
  return null;
}

export type WebhookOutcome = { duplicate: boolean; result: string; intentId?: string; refType?: string; refId?: string };

// Incoming-payment notification (already signature-verified by the route).
// Idempotent by eventId; unmatched or ambiguous money is parked for the owner.
export function applyIncomingPayment(scope: string, ev: PaymentEvent, onPaid: OnPaid): WebhookOutcome {
  ensure();
  return tx((t) => {
    expireStale(scope, t);
    const prior = t
      .prepare("SELECT e.result, i.id, i.ref_type, i.ref_id FROM qrpay_events e LEFT JOIN qrpay_intents i ON i.id = e.intent_id WHERE e.scope = ? AND e.event_id = ?")
      .get(scope, ev.eventId) as { result: string; id: string | null; ref_type: string | null; ref_id: string | null } | undefined;
    if (prior) return { duplicate: true, result: prior.result, intentId: prior.id ?? undefined, refType: prior.ref_type ?? undefined, refId: prior.ref_id ?? undefined };

    let target: IntentRow | null = null;
    let unmatchedReason: string | null = null;
    if (ev.reference) {
      const byRef = t.prepare("SELECT * FROM qrpay_intents WHERE scope = ? AND reference = ?").get(scope, ev.reference) as IntentRow | undefined;
      if (!byRef) unmatchedReason = "unknown_reference";
      else if (byRef.payable_amount_satang !== ev.amountSatang) unmatchedReason = "amount_mismatch";
      else if (byRef.status !== "pending") unmatchedReason = byRef.status === "expired" ? "order_expired" : `order_already_${byRef.status}`;
      else target = byRef;
    } else {
      const matches = t.prepare("SELECT * FROM qrpay_intents WHERE scope = ? AND status = 'pending' AND payable_amount_satang = ?").all(scope, ev.amountSatang) as IntentRow[];
      if (matches.length === 1) target = matches[0];
      else unmatchedReason = matches.length === 0 ? "no_matching_order" : "ambiguous_amount";
    }

    const record = (result: string, intentId: string | null) =>
      t.prepare("INSERT INTO qrpay_events (scope, event_id, provider, amount_satang, reference, result, intent_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(scope, ev.eventId, ev.provider, ev.amountSatang, ev.reference, result, intentId);
    const park = (reason: string) =>
      t.prepare("INSERT INTO qrpay_unmatched (scope, event_id, provider, amount_satang, reference, paid_at, account_last4, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(scope, ev.eventId, ev.provider, ev.amountSatang, ev.reference, ev.paidAt, ev.accountLast4, reason);

    if (!target) {
      park(unmatchedReason ?? "no_matching_order");
      record(`unmatched:${unmatchedReason}`, null);
      return { duplicate: false, result: `unmatched:${unmatchedReason}` };
    }
    const intent = toIntent(target);
    const where = { intentId: intent.id, refType: intent.refType, refId: intent.refId };
    const cancel = settleIntent(t, intent, { via: "webhook", eventId: ev.eventId, provider: ev.provider }, onPaid);
    if (cancel) {
      park(cancel.reason);
      record(`cancelled:${cancel.reason}`, intent.id);
      return { duplicate: false, result: `cancelled:${cancel.reason}`, ...where };
    }
    record("paid", intent.id);
    return { duplicate: false, result: "paid", ...where };
  });
}

// Slip verified by the route. Throws 409 when the intent is no longer payable (caller releases the slip).
export function markIntentPaidBySlip(scope: string, intentId: string, slip: { transRef: string; sandbox: boolean }, onPaid: OnPaid): { cancelled: boolean; message?: string } {
  ensure();
  return tx((t) => {
    const intent = getIntent(scope, intentId, t);
    if (intent.status !== "pending") throw new QrPayError(409, statusMessage(intent.status), intent.status === "expired" ? "order_expired" : "not_payable");
    const cancel = settleIntent(t, intent, { via: "slip", transRef: slip.transRef, sandbox: slip.sandbox }, onPaid);
    if (cancel) {
      // The slip is already consumed, so record the money for a refund like the webhook path does.
      t.prepare("INSERT OR IGNORE INTO qrpay_unmatched (scope, event_id, provider, amount_satang, reference, paid_at, reason) VALUES (?, ?, 'slip', ?, ?, ?, ?)")
        .run(scope, slip.transRef, intent.payableAmountSatang, intent.reference, new Date().toISOString(), cancel.reason);
    }
    return { cancelled: !!cancel, message: cancel?.message };
  });
}

// ---------- unmatched money ----------

export type UnmatchedPayment = {
  id: number; eventId: string; provider: string; amount: number; reference: string | null; paidAt: string; accountLast4: string | null;
  reason: string; status: "open" | "assigned"; assignedRefType: string | null; assignedRefId: string | null; receivedAt: string;
};

export function listUnmatched(scope: string, limit = 50): UnmatchedPayment[] {
  const d = ensure();
  const rows = d
    .prepare(
      `SELECT u.*, i.ref_type, i.ref_id FROM qrpay_unmatched u LEFT JOIN qrpay_intents i ON i.id = u.assigned_intent_id
       WHERE u.scope = ? ORDER BY u.id DESC LIMIT ?`,
    )
    .all(scope, limit) as {
    id: number; event_id: string; provider: string; amount_satang: number; reference: string | null; paid_at: string; account_last4: string | null;
    reason: string; status: "open" | "assigned"; received_at: string; ref_type: string | null; ref_id: string | null;
  }[];
  return rows.map((u) => ({
    id: u.id, eventId: u.event_id, provider: u.provider, amount: u.amount_satang / 100, reference: u.reference, paidAt: u.paid_at,
    accountLast4: u.account_last4, reason: u.reason, status: u.status, assignedRefType: u.ref_type, assignedRefId: u.ref_id, receivedAt: u.received_at,
  }));
}

export function assignUnmatched(scope: string, unmatchedId: number, intentId: string, onPaid: OnPaid): { intentId: string; refType: string; refId: string } {
  ensure();
  return tx((t) => {
    expireStale(scope, t);
    const row = t.prepare("SELECT * FROM qrpay_unmatched WHERE scope = ? AND id = ?").get(scope, unmatchedId) as { id: number; event_id: string; provider: string; amount_satang: number; status: string } | undefined;
    if (!row) throw new QrPayError(404, "ไม่พบรายการเงินเข้าที่รอจับคู่", "not_found");
    if (row.status !== "open") throw new QrPayError(409, "เงินก้อนนี้ถูกจับคู่ไปแล้ว", "already_assigned");
    const intent = getIntent(scope, intentId, t);
    // A late payment may still settle an expired intent; any other state would double-pay.
    if (intent.status !== "pending" && intent.status !== "expired") throw new QrPayError(409, statusMessage(intent.status), "not_payable");
    if (row.amount_satang !== intent.payableAmountSatang) {
      throw new QrPayError(409, `ยอดเงินที่รับมา ${(row.amount_satang / 100).toFixed(2)} บาท ไม่ตรงกับยอดที่ต้องชำระ ${(intent.payableAmountSatang / 100).toFixed(2)} บาท`, "amount_mismatch");
    }
    const cancel = settleIntent(t, intent, { via: "manual", eventId: row.event_id, provider: row.provider }, onPaid);
    if (cancel) throw new QrPayError(409, cancel.message ?? "ไม่สามารถยืนยันรายการนี้ได้", cancel.reason);
    t.prepare("UPDATE qrpay_unmatched SET status = 'assigned', assigned_intent_id = ? WHERE id = ?").run(intent.id, row.id);
    return { intentId: intent.id, refType: intent.refType, refId: intent.refId };
  });
}
