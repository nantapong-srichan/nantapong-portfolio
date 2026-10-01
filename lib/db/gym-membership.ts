import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db, tx } from "@/lib/db";
import { sandboxEnabled } from "@/lib/sandbox";
import { isOtpVerified, normalizeMsisdn } from "@/lib/thaibulksms";
import { createIntent, expireStale as expireIntents, QrPayError, type OnPaid } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";
import {
  CLASSES, PLANS, priceFor,
  type Billing, type PlanId,
} from "@/app/demos/gym-membership/data";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const SCOPE = "gym-membership";
const PAYEE_NAME = "IronPulse Fitness (ตัวอย่าง)";
export const PAYMENT_WINDOW_MS = 15 * 60_000;

const MEMBER_ID = /^[A-Za-z0-9-]{8,64}$/;
const isPlanId = (v: unknown): v is PlanId => PLANS.some((p) => p.id === v);
const isBilling = (v: unknown): v is Billing => v === "monthly" || v === "yearly";

function addColumn(d: ReturnType<typeof db>, table: string, column: string, type: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

let ready = false;
function init() {
  if (ready) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS gym_membership_plans (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, monthly INTEGER NOT NULL,
      rank INTEGER NOT NULL, tagline TEXT NOT NULL, perks TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gym_membership_members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gym_membership_subscriptions (
      member_id TEXT PRIMARY KEY REFERENCES gym_membership_members(id),
      plan_id TEXT NOT NULL REFERENCES gym_membership_plans(id),
      interval TEXT NOT NULL CHECK (interval IN ('monthly','yearly')),
      status TEXT NOT NULL CHECK (status IN ('active','canceled')),
      next_billing_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gym_membership_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT NOT NULL REFERENCES gym_membership_members(id),
      kind TEXT NOT NULL, plan_id TEXT NOT NULL, amount INTEGER NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gym_membership_classes (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, time TEXT NOT NULL, name TEXT NOT NULL,
      coach TEXT NOT NULL, image TEXT NOT NULL, capacity INTEGER NOT NULL,
      base_booked INTEGER NOT NULL, min_plan TEXT NOT NULL REFERENCES gym_membership_plans(id)
    );
    CREATE TABLE IF NOT EXISTS gym_membership_class_bookings (
      member_id TEXT NOT NULL REFERENCES gym_membership_members(id),
      class_id TEXT NOT NULL REFERENCES gym_membership_classes(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (member_id, class_id)
    );
  `);
  addColumn(d, "gym_membership_members", "phone", "TEXT");
  addColumn(d, "gym_membership_payments", "interval", "TEXT");
  addColumn(d, "gym_membership_payments", "trans_ref", "TEXT");
  addColumn(d, "gym_membership_payments", "sandbox", "INTEGER");
  addColumn(d, "gym_membership_payments", "intent_id", "TEXT");
  // Charges opened before QR intents existed can no longer be paid; demo data is disposable.
  d.exec("DELETE FROM gym_membership_payments WHERE status = 'pending' AND intent_id IS NULL");
  // At most one unpaid charge per member; a new request replaces the old one.
  d.exec("CREATE UNIQUE INDEX IF NOT EXISTS gym_membership_one_pending ON gym_membership_payments(member_id) WHERE status = 'pending'");
  const planCount = (d.prepare("SELECT COUNT(*) AS n FROM gym_membership_plans").get() as { n: number }).n;
  if (planCount === 0) {
    const ins = d.prepare("INSERT INTO gym_membership_plans (id,name,monthly,rank,tagline,perks) VALUES (?,?,?,?,?,?)");
    for (const p of PLANS) ins.run(p.id, p.name, p.monthly, p.rank, p.tagline, JSON.stringify(p.perks));
  }
  const classCount = (d.prepare("SELECT COUNT(*) AS n FROM gym_membership_classes").get() as { n: number }).n;
  if (classCount === 0) {
    const ins = d.prepare("INSERT INTO gym_membership_classes (id,day,time,name,coach,image,capacity,base_booked,min_plan) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const c of CLASSES) ins.run(c.id, c.day, c.time, c.name, c.coach, c.image, c.capacity, c.baseBooked, c.minPlan);
  }
  ready = true;
}

const nowIso = () => new Date().toISOString();

function nextBilling(interval: Billing): string {
  const d = new Date();
  if (interval === "monthly") {
    // Clamp to the last day of next month (Jan 31 + 1 month = Feb 28, not Mar 3).
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Dev-only fallback outside production; GYM_MEMBER_SECRET is always required in production (even with DEMO_SANDBOX=1).
const DEV_MEMBER_SECRET = "dev-only-gym-member-secret";

function memberSecret(): string {
  const secret = process.env.GYM_MEMBER_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production" && sandboxEnabled()) return DEV_MEMBER_SECRET;
  throw new ApiError(503, "not_configured", "ระบบสมาชิกยังไม่พร้อมใช้งาน");
}

const memberSignature = (id: string) => createHmac("sha256", memberSecret()).update(`gym-member:${id}`).digest("base64url");

// Opaque credential "<memberId>.<signature>"; only the server can mint it, so a guessed id is useless.
export const signMember = (id: string) => `${id}.${memberSignature(id)}`;

function verifyMemberToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  if (!MEMBER_ID.test(id)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(memberSignature(id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

// Member id behind a genuine x-member-token header, otherwise null.
export function memberIdFrom(req: Request): string | null {
  const token = req.headers.get("x-member-token");
  return token && token.length <= 200 ? verifyMemberToken(token) : null;
}

function requireMemberId(req: Request): string {
  const id = memberIdFrom(req);
  if (!id) throw new ApiError(401, "bad_member_token", "ต้องสมัครสมาชิกก่อน (ไม่พบหรือโทเค็นสมาชิกไม่ถูกต้อง)");
  return id;
}

// JSON body as a plain object; null, arrays and scalars are a 400.
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "bad_json", "ต้องส่งข้อมูลเป็น JSON object");
  return body as Record<string, unknown>;
}

interface PlanRow { id: PlanId; name: string; monthly: number; rank: number; tagline: string; perks: string }
interface SubRow { member_id: string; plan_id: PlanId; interval: Billing; status: "active" | "canceled"; next_billing_date: string }
interface ClassRow { id: string; day: string; time: string; name: string; coach: string; image: string; capacity: number; base_booked: number; min_plan: PlanId; booked: number }

const planRow = (id: string) =>
  db().prepare("SELECT * FROM gym_membership_plans WHERE id = ?").get(id) as PlanRow | undefined;

export function listPlans() {
  init();
  const rows = db().prepare("SELECT * FROM gym_membership_plans ORDER BY rank").all() as unknown as PlanRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, monthly: r.monthly, rank: r.rank, tagline: r.tagline, perks: JSON.parse(r.perks) as string[] }));
}

const CLASS_SELECT = `
  SELECT c.*, c.base_booked + (SELECT COUNT(*) FROM gym_membership_class_bookings b WHERE b.class_id = c.id) AS booked
  FROM gym_membership_classes c`;

export function listClasses(memberId: string | null) {
  init();
  const rows = db().prepare(`${CLASS_SELECT} ORDER BY c.rowid`).all() as unknown as ClassRow[];
  const mine = new Set(
    memberId
      ? (db().prepare("SELECT class_id FROM gym_membership_class_bookings WHERE member_id = ?").all(memberId) as unknown as { class_id: string }[]).map((r) => r.class_id)
      : [],
  );
  return rows.map((c) => ({
    id: c.id, day: c.day, time: c.time, name: c.name, coach: c.coach, image: c.image,
    capacity: c.capacity, booked: c.booked, minPlan: c.min_plan, mine: mine.has(c.id),
  }));
}

export function getMe(memberId: string | null) {
  init();
  const empty = { member: null, subscription: null, pending: null, bookings: [] as string[], payments: [] as unknown[] };
  if (!memberId) return empty;
  const member = db().prepare("SELECT id, name, phone FROM gym_membership_members WHERE id = ?").get(memberId) as { id: string; name: string; phone: string | null } | undefined;
  if (!member) return empty;
  const sub = db().prepare("SELECT * FROM gym_membership_subscriptions WHERE member_id = ?").get(memberId) as SubRow | undefined;
  const bookings = (db().prepare("SELECT class_id FROM gym_membership_class_bookings WHERE member_id = ?").all(memberId) as unknown as { class_id: string }[]).map((r) => r.class_id);
  const payments = db().prepare("SELECT id, kind, plan_id AS planId, amount, status, created_at AS createdAt FROM gym_membership_payments WHERE member_id = ? ORDER BY id DESC LIMIT 10").all(memberId);
  expireIntents(SCOPE, db());
  const pendingRow = db().prepare(
    `SELECT p.id, p.kind, p.plan_id, p.interval, p.amount, p.intent_id, i.status AS intent_status, i.payable_amount_satang AS payable, i.expires_at
     FROM gym_membership_payments p LEFT JOIN qrpay_intents i ON i.id = p.intent_id
     WHERE p.member_id = ? AND p.status = 'pending'`,
  ).get(memberId) as (PaymentRow & { intent_id: string; intent_status: string; payable: number; expires_at: number }) | undefined;
  return {
    member,
    subscription: sub ? { planId: sub.plan_id, interval: sub.interval, status: sub.status, nextBillingDate: sub.next_billing_date } : null,
    pending: pendingRow
      ? {
          id: pendingRow.id, kind: pendingRow.kind, planId: pendingRow.plan_id, interval: pendingRow.interval,
          amount: pendingRow.amount, payAmount: pendingRow.payable / 100, intentId: pendingRow.intent_id,
          intentStatus: pendingRow.intent_status, expiresAt: pendingRow.expires_at,
        }
      : null,
    bookings,
    payments,
  };
}

function subOf(d: ReturnType<typeof db>, memberId: string): SubRow | undefined {
  return d.prepare("SELECT * FROM gym_membership_subscriptions WHERE member_id = ?").get(memberId) as SubRow | undefined;
}

interface PaymentRow { id: number; member_id: string; kind: "subscribe" | "resume" | "upgrade"; plan_id: PlanId; interval: Billing; amount: number; status: string; intent_id: string | null }

function pendingOf(d: ReturnType<typeof db>, memberId: string): PaymentRow | undefined {
  return d.prepare("SELECT id, member_id, kind, plan_id, interval, amount, status, intent_id FROM gym_membership_payments WHERE member_id = ? AND status = 'pending'").get(memberId) as PaymentRow | undefined;
}

// Replaces any earlier unpaid charge (and closes its QR); nothing becomes active until the money is detected.
function createPending(d: ReturnType<typeof db>, memberId: string, kind: PaymentRow["kind"], planId: PlanId, interval: Billing, amount: number) {
  const old = pendingOf(d, memberId);
  if (old?.intent_id) d.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(old.intent_id);
  d.prepare("DELETE FROM gym_membership_payments WHERE member_id = ? AND status = 'pending'").run(memberId);
  const id = Number(
    d.prepare("INSERT INTO gym_membership_payments (member_id,kind,plan_id,interval,amount,status,created_at) VALUES (?,?,?,?,?,'pending',?)")
      .run(memberId, kind, planId, interval, amount, nowIso()).lastInsertRowid,
  );
  attachIntent(d, id, amount);
}

function attachIntent(d: ReturnType<typeof db>, paymentId: number, amount: number) {
  const intent = createIntent(SCOPE, { refType: "membership_payment", refId: String(paymentId), baseAmount: amount, windowMs: PAYMENT_WINDOW_MS, referencePrefix: "IP" }, d);
  d.prepare("UPDATE gym_membership_payments SET intent_id = ? WHERE id = ?").run(intent.intentId, paymentId);
}

const stale = () => new ApiError(409, "stale_payment", "รายการนี้ไม่ตรงกับสถานะสมาชิกปัจจุบัน กรุณาเลือกใหม่");

// The amount to collect, recomputed from DB prices and current subscription state every time.
function chargeFor(d: ReturnType<typeof db>, pay: PaymentRow): number {
  const sub = subOf(d, pay.member_id);
  const target = planRow(pay.plan_id) as PlanRow;
  if (pay.kind === "subscribe") {
    if (sub?.status === "active") throw stale();
    return priceFor({ ...target, perks: [] }, pay.interval);
  }
  if (!sub) throw stale();
  if (pay.kind === "resume") {
    if (sub.status !== "canceled") throw stale();
    return priceFor({ ...target, perks: [] }, sub.interval);
  }
  const current = planRow(sub.plan_id) as PlanRow;
  if (sub.status !== "active" || target.rank <= current.rank) throw stale();
  return priceFor({ ...target, perks: [] }, sub.interval) - priceFor({ ...current, perks: [] }, sub.interval);
}

// `memberId` is the caller's verified id, or null for a first-time member (a fresh id and token are issued).
export function subscribe(memberId: string | null, body: Record<string, unknown>) {
  init();
  const { name, phone, otpToken, planId, interval } = body;
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName.length < 2 || cleanName.length > 80) throw new ApiError(400, "bad_name", "กรุณากรอกชื่อ 2-80 ตัวอักษร");
  const msisdn = typeof phone === "string" ? normalizeMsisdn(phone) : null;
  if (!msisdn) throw new ApiError(400, "bad_phone", "เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)");
  if (!isPlanId(planId)) throw new ApiError(400, "bad_plan", "ไม่พบแพ็กเกจนี้");
  if (!isBilling(interval)) throw new ApiError(400, "bad_interval", "รอบการเรียกเก็บเงินต้องเป็น monthly หรือ yearly");
  if (memberId && subOf(db(), memberId)?.status === "active") throw new ApiError(409, "already_subscribed", "คุณมีสมาชิกที่ใช้งานอยู่แล้ว");
  // Last gate: it consumes an OTP use, so every plain input error above must come first.
  if (typeof otpToken !== "string" || !isOtpVerified(otpToken, msisdn)) throw new ApiError(403, "otp_required", "ต้องยืนยันเบอร์โทรด้วย OTP ก่อนสมัครสมาชิก");
  const id = memberId ?? randomUUID();
  tx((d) => {
    if (subOf(d, id)?.status === "active") throw new ApiError(409, "already_subscribed", "คุณมีสมาชิกที่ใช้งานอยู่แล้ว");
    d.prepare("INSERT INTO gym_membership_members (id,name,phone,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone")
      .run(id, cleanName, msisdn, nowIso());
    const plan = planRow(planId) as PlanRow;
    createPending(d, id, "subscribe", plan.id, interval, priceFor({ ...plan, perks: [] }, interval));
  });
  return { ...getMe(id), memberToken: signMember(id) };
}

function requireSub(d: ReturnType<typeof db>, memberId: string): SubRow {
  const sub = subOf(d, memberId);
  if (!sub) throw new ApiError(404, "no_subscription", "ยังไม่มีสมาชิก");
  return sub;
}

export function cancelSubscription(memberId: string) {
  init();
  tx((d) => {
    const sub = requireSub(d, memberId);
    if (sub.status === "canceled") throw new ApiError(409, "already_canceled", "ยกเลิกสมาชิกไปแล้ว");
    d.prepare("UPDATE gym_membership_subscriptions SET status = 'canceled' WHERE member_id = ?").run(memberId);
    d.prepare("DELETE FROM gym_membership_class_bookings WHERE member_id = ?").run(memberId);
  });
  return getMe(memberId);
}

// Resume and upgrade only open a pending charge with a QR; the plan changes when the payment is detected (onPaid).
export function resumeSubscription(memberId: string) {
  init();
  tx((d) => {
    const sub = requireSub(d, memberId);
    if (sub.status === "active") throw new ApiError(409, "already_active", "สมาชิกยังใช้งานอยู่");
    const plan = planRow(sub.plan_id) as PlanRow;
    createPending(d, memberId, "resume", plan.id, sub.interval, priceFor({ ...plan, perks: [] }, sub.interval));
  });
  return getMe(memberId);
}

export function upgradeSubscription(memberId: string, body: Record<string, unknown>) {
  init();
  const { planId } = body;
  if (!isPlanId(planId)) throw new ApiError(400, "bad_plan", "ไม่พบแพ็กเกจนี้");
  tx((d) => {
    const sub = requireSub(d, memberId);
    if (sub.status !== "active") throw new ApiError(409, "not_active", "กรุณากลับมาใช้สมาชิกก่อนเปลี่ยนแพ็กเกจ");
    const current = planRow(sub.plan_id) as PlanRow;
    const target = planRow(planId) as PlanRow;
    if (target.rank <= current.rank) throw new ApiError(400, "not_an_upgrade", "อัปเกรดได้เฉพาะแพ็กเกจที่สูงกว่า");
    const diff = priceFor({ ...target, perks: [] }, sub.interval) - priceFor({ ...current, perks: [] }, sub.interval);
    createPending(d, memberId, "upgrade", target.id, sub.interval, diff);
  });
  return getMe(memberId);
}

// Issues a fresh QR for the open charge once the previous one expired (amount is recomputed from DB prices).
export function renewPending(memberId: string) {
  init();
  tx((d) => {
    expireIntents(SCOPE, d);
    const pay = pendingOf(d, memberId);
    if (!pay) throw new ApiError(404, "no_pending_payment", "ไม่มีรายการที่รอชำระเงิน");
    const open = pay.intent_id ? (d.prepare("SELECT status FROM qrpay_intents WHERE id = ?").get(pay.intent_id) as { status: string } | undefined) : undefined;
    if (open?.status === "pending") return;
    const amount = chargeFor(d, pay);
    d.prepare("UPDATE gym_membership_payments SET amount = ? WHERE id = ?").run(amount, pay.id);
    attachIntent(d, pay.id, amount);
  });
  return getMe(memberId);
}

// onPaid hook for the payment kit: runs inside the kit's transaction, once per paid intent.
// Re-derives the amount from DB prices and the current subscription; the plan only changes here.
const settlePayment: OnPaid = ({ refId, intent }, t) => {
  const pay = t.prepare("SELECT id, member_id, kind, plan_id, interval, amount, status, intent_id FROM gym_membership_payments WHERE id = ?").get(Number(refId)) as PaymentRow | undefined;
  if (!pay) throw new QrPayError(404, "Payment not found", "not_found");
  if (pay.status !== "pending") return { cancelled: true, reason: `payment_already_${pay.status}`, message: "รายการนี้ปิดไปแล้ว เงินที่ได้รับจะถูกคืน" };

  const cancel = (reason: string, message: string) => {
    t.prepare("UPDATE gym_membership_payments SET status = 'cancelled' WHERE id = ?").run(pay.id);
    return { cancelled: true as const, reason, message };
  };
  let amount: number;
  try {
    amount = chargeFor(t, pay);
  } catch (e) {
    if (e instanceof ApiError) return cancel("stale_payment", "สถานะสมาชิกเปลี่ยนไปก่อนเงินเข้า รายการถูกยกเลิก (จะคืนเงิน)");
    throw e;
  }
  if (Math.round(amount * 100) !== intent.baseAmountSatang) return cancel("stale_payment", "ราคาเปลี่ยนไปก่อนเงินเข้า รายการถูกยกเลิก (จะคืนเงิน)");

  // A renewed QR may have replaced the one that was just paid; close the leftover.
  if (pay.intent_id && pay.intent_id !== intent.id) t.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(pay.intent_id);
  t.prepare("UPDATE gym_membership_payments SET status = 'succeeded', intent_id = ?, trans_ref = ?, sandbox = ? WHERE id = ?")
    .run(intent.id, intent.transRef, intent.sandbox === null ? null : intent.sandbox ? 1 : 0, pay.id);
  if (pay.kind === "upgrade") {
    t.prepare("UPDATE gym_membership_subscriptions SET plan_id = ? WHERE member_id = ?").run(pay.plan_id, pay.member_id);
  } else if (pay.kind === "resume") {
    const sub = requireSub(t, pay.member_id);
    t.prepare("UPDATE gym_membership_subscriptions SET status = 'active', next_billing_date = ? WHERE member_id = ?")
      .run(nextBilling(sub.interval), pay.member_id);
  } else {
    t.prepare(`INSERT INTO gym_membership_subscriptions (member_id,plan_id,interval,status,next_billing_date,created_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(member_id) DO UPDATE SET plan_id = excluded.plan_id, interval = excluded.interval,
        status = 'active', next_billing_date = excluded.next_billing_date`)
      .run(pay.member_id, pay.plan_id, pay.interval, "active", nextBilling(pay.interval), nowIso());
  }
};

// Mounted by app/api/gym-membership/qrpay/[...path]/route.ts.
export const qrpay: QrRouteConfig = { scope: SCOPE, onPaid: settlePayment, defaultPayeeName: PAYEE_NAME };

// Owner view: open charges that can be simulated (pending QR) or assigned manually (pending or just expired QR).
export function adminOpenCharges() {
  init();
  expireIntents(SCOPE, db());
  const rows = db().prepare(
    `SELECT p.id, p.kind, p.plan_id AS planId, m.name AS memberName, i.id AS intentId, i.status AS intentStatus,
            i.payable_amount_satang AS payable, i.reference
     FROM gym_membership_payments p
     JOIN gym_membership_members m ON m.id = p.member_id
     JOIN qrpay_intents i ON i.id = p.intent_id
     WHERE p.status = 'pending' ORDER BY p.id DESC`,
  ).all() as unknown as { id: number; kind: string; planId: string; memberName: string; intentId: string; intentStatus: string; payable: number; reference: string }[];
  return { charges: rows.map((r) => ({ ...r, payAmount: r.payable / 100 })) };
}

function findClass(d: ReturnType<typeof db>, classId: string): ClassRow {
  const c = d.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(classId) as ClassRow | undefined;
  if (!c) throw new ApiError(404, "class_not_found", "ไม่พบคลาสนี้");
  return c;
}

export function bookClass(memberId: string, classId: string) {
  init();
  tx((d) => {
    const sub = subOf(d, memberId);
    if (!sub || sub.status !== "active") throw new ApiError(403, "no_active_plan", "ต้องมีสมาชิกที่ใช้งานอยู่จึงจะจองคลาสได้");
    const c = findClass(d, classId);
    const have = planRow(sub.plan_id) as PlanRow;
    const need = planRow(c.min_plan) as PlanRow;
    if (have.rank < need.rank) throw new ApiError(403, "plan_required", `คลาสนี้สำหรับแพ็กเกจ ${need.name} ขึ้นไป`);
    const dup = d.prepare("SELECT 1 AS x FROM gym_membership_class_bookings WHERE member_id = ? AND class_id = ?").get(memberId, classId);
    if (dup) throw new ApiError(409, "already_booked", "คุณจองคลาสนี้แล้ว");
    if (c.booked >= c.capacity) throw new ApiError(409, "class_full", "คลาสนี้เต็มแล้ว");
    d.prepare("INSERT INTO gym_membership_class_bookings (member_id,class_id,created_at) VALUES (?,?,?)").run(memberId, classId, nowIso());
  });
  return { classes: listClasses(memberId), ...getMe(memberId) };
}

export function cancelBooking(memberId: string, classId: string) {
  init();
  tx((d) => {
    findClass(d, classId);
    const r = d.prepare("DELETE FROM gym_membership_class_bookings WHERE member_id = ? AND class_id = ?").run(memberId, classId);
    if (r.changes === 0) throw new ApiError(404, "not_booked", "ไม่พบการจองนี้");
  });
  return { classes: listClasses(memberId), ...getMe(memberId) };
}

export { requireMemberId };

// Maps thrown ApiErrors to JSON responses; anything else is a real 500.
export async function respond(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
    if (e instanceof QrPayError) return Response.json({ error: e.code ?? "payment_error", message: e.message }, { status: e.status });
    if (e instanceof SyntaxError) return Response.json({ error: "bad_json", message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
    throw e;
  }
}
