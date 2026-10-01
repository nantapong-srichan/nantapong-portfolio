import { randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { createIntent, expireStale, getIntent, QrPayError, type OnPaid } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";

export const OPEN = 10 * 60;
export const CLOSE = 19 * 60;
export const STEP = 30;
export const DEPOSIT_RATE = 0.3;
export const SCOPE = "salon-booking";
// The slot is held while the QR is payable; after this the hold is released.
export const HOLD_MS = 10 * 60 * 1000;
const PAYEE_NAME = "Studio Lumi";

export type ServiceRow = { id: string; name: string; th: string; price: number; mins: number; image: string };
export type StaffRow = { id: string; name: string; role: string; image: string };
export type BookingRow = {
  id: string; ref: string; staffId: string; serviceId: string; date: string; start: number; mins: number;
  service: string; client: string; phone: string; email: string; note: string;
  price: number; deposit: number; status: BookingStatus; paidAt: string | null;
  slipSandbox: boolean | null; intentId: string | null; paidVia: "webhook" | "slip" | "manual" | null;
};
export type BookingStatus = "pending_deposit" | "deposit_paid" | "expired";

// What a customer may read back about their own booking: no phone, email or note.
export type OwnerBooking = Omit<BookingRow, "phone" | "email" | "note">;
export type BusyRange = { start: number; mins: number };

export const BOOKING_WINDOW_DAYS = 60;

export class ConflictError extends Error {}
export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const SEED_SERVICES: ServiceRow[] = [
  { id: "cut", name: "Signature Haircut", th: "ตัดผม + สไตล์ลิ่ง", price: 650, mins: 60, image: "/images/salon-booking/hair-styling.jpg" },
  { id: "color", name: "Full Color", th: "ทำสีผมทั้งหัว", price: 2400, mins: 120, image: "/images/salon-booking/hair-color.jpg" },
  { id: "treat", name: "Keratin Treatment", th: "เคราตินบำรุงผม", price: 1800, mins: 90, image: "/images/salon-booking/hair-color.jpg" },
  { id: "nail", name: "Gel Manicure", th: "ทำเล็บเจล", price: 590, mins: 60, image: "/images/salon-booking/nails.jpg" },
  { id: "facial", name: "Glow Facial", th: "ทรีตเมนต์หน้าใส", price: 1200, mins: 60, image: "/images/salon-booking/spa.jpg" },
  { id: "spa", name: "Scalp Spa", th: "สปาหนังศีรษะ", price: 890, mins: 30, image: "/images/salon-booking/spa.jpg" },
];

const SEED_STAFF: StaffRow[] = [
  { id: "mild", name: "Mild", role: "Senior Stylist", image: "/images/salon-booking/staff-mild.jpg" },
  { id: "ploy", name: "Ploy", role: "Colorist", image: "/images/salon-booking/staff-ploy.jpg" },
  { id: "ken", name: "Ken", role: "Nail & Skin", image: "/images/salon-booking/staff-ken.jpg" },
];

export const SEED_DAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 2 + i)).toISOString().slice(0, 10));

let ready = false;

const newAccessKey = () => randomBytes(16).toString("base64url");

function init() {
  if (ready) return;
  const d = db();
  // Demo-only tables from before QR payments lack intent_id and the 'expired' status: recreate them (data is disposable).
  const old = d.prepare("PRAGMA table_info(salon_booking_bookings)").all() as { name: string }[];
  if (old.length > 0 && !old.some((c) => c.name === "intent_id")) {
    d.exec("DROP TABLE IF EXISTS salon_booking_slots; DROP TABLE salon_booking_bookings;");
  }
  d.exec(`
    CREATE TABLE IF NOT EXISTS salon_booking_services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, th TEXT NOT NULL,
      price INTEGER NOT NULL, mins INTEGER NOT NULL, image TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salon_booking_staff (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, image TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salon_booking_bookings (
      id TEXT PRIMARY KEY, ref TEXT NOT NULL UNIQUE,
      staff_id TEXT NOT NULL REFERENCES salon_booking_staff(id),
      service_id TEXT NOT NULL REFERENCES salon_booking_services(id),
      date TEXT NOT NULL, start_slot INTEGER NOT NULL, slots INTEGER NOT NULL,
      client TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL, deposit INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending_deposit','deposit_paid','expired')),
      paid_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      intent_id TEXT
    );
    -- One row per occupied 30-minute slot: the primary key is what blocks overlapping bookings.
    CREATE TABLE IF NOT EXISTS salon_booking_slots (
      staff_id TEXT NOT NULL, date TEXT NOT NULL, slot INTEGER NOT NULL,
      booking_id TEXT NOT NULL REFERENCES salon_booking_bookings(id) ON DELETE CASCADE,
      PRIMARY KEY (staff_id, date, slot)
    );
  `);
  const cols = (d.prepare("PRAGMA table_info(salon_booking_bookings)").all() as { name: string }[]).map((c) => c.name);
  const add = (name: string, type: string) => { if (!cols.includes(name)) d.exec(`ALTER TABLE salon_booking_bookings ADD COLUMN ${name} ${type}`); };
  add("verified_phone", "TEXT");
  add("trans_ref", "TEXT");
  add("slip_amount", "REAL");
  add("slip_sandbox", "INTEGER");
  add("paid_via", "TEXT");
  add("access_key", "TEXT");
  // Pre-existing rows get a random key nobody holds, so they stay unreadable to customers.
  const keyless = d.prepare("SELECT id FROM salon_booking_bookings WHERE access_key IS NULL").all() as { id: string }[];
  for (const r of keyless) d.prepare("UPDATE salon_booking_bookings SET access_key = ? WHERE id = ?").run(newAccessKey(), r.id);
  const noServices = (d.prepare("SELECT COUNT(*) AS n FROM salon_booking_services").get() as { n: number }).n === 0;
  if (noServices) {
    tx((t) => {
      const si = t.prepare("INSERT INTO salon_booking_services VALUES (?,?,?,?,?,?)");
      SEED_SERVICES.forEach((s) => si.run(s.id, s.name, s.th, s.price, s.mins, s.image));
      const ti = t.prepare("INSERT INTO salon_booking_staff VALUES (?,?,?,?)");
      SEED_STAFF.forEach((s) => ti.run(s.id, s.name, s.role, s.image));
    });
  }
  if ((d.prepare("SELECT COUNT(*) AS n FROM salon_booking_bookings").get() as { n: number }).n === 0) seedBookings();
  ready = true;
}

// Seed rows that would overlap or overrun closing time are simply skipped.
function seedOne(b: NewBooking) {
  try {
    tx(() => insertBooking(b));
  } catch (e) {
    if (!(e instanceof ConflictError || e instanceof ValidationError)) throw e;
  }
}

function seedBookings() {
  const names = ["คุณแอน", "คุณบีม", "Nok", "คุณเอ", "Fah", "คุณมิ้นท์"];
  SEED_DAYS.forEach((date, di) => {
    SEED_STAFF.forEach((s, si) => {
      const svc = SEED_SERVICES[(di + si) % SEED_SERVICES.length];
      seedOne({ staffId: s.id, serviceId: svc.id, date, start: OPEN + ((di * 3 + si * 2) % 6) * 60,
        client: names[(di + si) % names.length], status: "deposit_paid" });
      if ((di + si) % 2 === 0) {
        seedOne({ staffId: s.id, serviceId: "nail", date, start: 15 * 60 + (si % 2) * 30,
          client: names[(di * 2 + si) % names.length], status: "deposit_paid" });
      }
    });
  });
}

type NewBooking = {
  staffId: string; serviceId: string; date: string; start: number; client: string;
  phone?: string; email?: string; note?: string; status?: "pending_deposit" | "deposit_paid";
};

// Inserts directly using the raw connection; callers that need atomicity wrap it in tx().
function insertBooking(b: NewBooking): BookingRow {
  const d = db();
  const svc = d.prepare("SELECT * FROM salon_booking_services WHERE id = ?").get(b.serviceId) as ServiceRow | undefined;
  if (!svc) throw new ValidationError("unknown service");
  const staff = d.prepare("SELECT id FROM salon_booking_staff WHERE id = ?").get(b.staffId);
  if (!staff) throw new ValidationError("unknown staff");
  if (b.start < OPEN || b.start % STEP !== 0 || b.start + svc.mins > CLOSE) throw new ValidationError("time outside opening hours");
  const id = crypto.randomUUID();
  const ref = `LUMI-${b.date.slice(8)}${String(Math.floor(b.start / 60)).padStart(2, "0")}${String(b.start % 60).padStart(2, "0")}-${id.slice(0, 4).toUpperCase()}`;
  const deposit = Math.round(svc.price * DEPOSIT_RATE);
  const status = b.status ?? "pending_deposit";
  const startSlot = b.start / STEP;
  const count = svc.mins / STEP;
  try {
    d.prepare(`INSERT INTO salon_booking_bookings
      (id, ref, staff_id, service_id, date, start_slot, slots, client, phone, email, note, price, deposit, status, paid_at, access_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, ref, b.staffId, b.serviceId, b.date, startSlot, count, b.client, b.phone ?? "", b.email ?? "", b.note ?? "",
        svc.price, deposit, status, status === "deposit_paid" ? new Date().toISOString() : null, newAccessKey());
    const ins = d.prepare("INSERT INTO salon_booking_slots (staff_id, date, slot, booking_id) VALUES (?,?,?,?)");
    for (let i = 0; i < count; i++) ins.run(b.staffId, b.date, startSlot + i, id);
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) throw new ConflictError("slot already booked");
    throw e;
  }
  return getBooking(id)!;
}

const BOOKING_SQL = `SELECT b.id, b.ref, b.staff_id AS staffId, b.service_id AS serviceId, b.date,
  b.start_slot * ${STEP} AS start, b.slots * ${STEP} AS mins, s.name AS service, b.client, b.phone, b.email, b.note,
  b.price, b.deposit, b.status, b.paid_at AS paidAt, b.intent_id AS intentId, b.paid_via AS paidVia,
  CASE WHEN b.slip_sandbox IS NULL THEN NULL ELSE b.slip_sandbox = 1 END AS slipSandbox
  FROM salon_booking_bookings b JOIN salon_booking_services s ON s.id = b.service_id`;

// SQLite returns the sandbox flag as 0/1/NULL.
const toRow = (r: BookingRow): BookingRow => ({ ...r, slipSandbox: r.slipSandbox == null ? null : Boolean(r.slipSandbox) });

function getBooking(id: string): BookingRow | undefined {
  const r = db().prepare(`${BOOKING_SQL} WHERE b.id = ?`).get(id) as BookingRow | undefined;
  return r && toRow(r);
}

export function listServices(): ServiceRow[] {
  init();
  return db().prepare("SELECT * FROM salon_booking_services ORDER BY rowid").all() as ServiceRow[];
}

export function listStaff(): StaffRow[] {
  init();
  return db().prepare("SELECT * FROM salon_booking_staff ORDER BY rowid").all() as StaffRow[];
}

// Free start times for one staff member on one date, for a service of the given length.
export function availability(staffId: string, date: string, serviceId: string) {
  refreshHolds();
  return computeAvailability(staffId, date, serviceId);
}

function computeAvailability(staffId: string, date: string, serviceId: string) {
  const svc = db().prepare("SELECT mins FROM salon_booking_services WHERE id = ?").get(serviceId) as { mins: number } | undefined;
  if (!svc) throw new ValidationError("unknown service");
  const taken = new Set(
    (db().prepare("SELECT slot FROM salon_booking_slots WHERE staff_id = ? AND date = ?").all(staffId, date) as { slot: number }[]).map((r) => r.slot),
  );
  const need = svc.mins / STEP;
  const out: { t: number; free: boolean }[] = [];
  for (let t = OPEN; t < CLOSE; t += STEP) {
    let free = t + svc.mins <= CLOSE;
    for (let i = 0; free && i < need; i++) if (taken.has(t / STEP + i)) free = false;
    out.push({ t, free });
  }
  return out;
}

export function openSlotCounts(serviceId: string, dates: string[]) {
  refreshHolds();
  return listStaff().map((s) => ({
    staffId: s.id,
    open: dates.reduce((n, date) => n + computeAvailability(s.id, date, serviceId).filter((x) => x.free).length, 0),
  }));
}

// Mirrors expired payment intents onto their bookings and frees the held slots so others can book them.
function releaseExpiredHolds(t: DatabaseSync) {
  const holds = t.prepare("SELECT id, intent_id FROM salon_booking_bookings WHERE status = 'pending_deposit' AND intent_id IS NOT NULL").all() as { id: string; intent_id: string }[];
  expireStale(SCOPE, t);
  for (const h of holds) {
    if (getIntent(SCOPE, h.intent_id, t).status === "pending") continue;
    t.prepare("UPDATE salon_booking_bookings SET status = 'expired' WHERE id = ? AND status = 'pending_deposit'").run(h.id);
    t.prepare("DELETE FROM salon_booking_slots WHERE booking_id = ?").run(h.id);
  }
}

const refreshHolds = () => { init(); tx(releaseExpiredHolds); };

// `verifiedPhone` must already have passed isOtpVerified(); it is stored with the booking.
// The slot is held and a QR payment intent for the 30% deposit is created in the same transaction.
export function createBooking(b: NewBooking, verifiedPhone: string): { booking: OwnerBooking; accessKey: string } {
  init();
  assertBookableDate(b.date);
  return tx((d) => {
    releaseExpiredHolds(d);
    const row = insertBooking({ ...b, status: "pending_deposit" });
    const intent = createIntent(SCOPE, { refType: "booking", refId: row.id, baseAmount: row.deposit, windowMs: HOLD_MS, referencePrefix: "LM" }, d);
    d.prepare("UPDATE salon_booking_bookings SET verified_phone = ?, intent_id = ? WHERE id = ?").run(verifiedPhone, intent.intentId, row.id);
    return { booking: ownerView(getBooking(row.id)!), accessKey: keyOf(row.id)! };
  });
}

// Customer retry after the hold expired: re-claim the slot if still free and issue a fresh QR.
export function retryDeposit(id: string, key: string | null): OwnerBooking {
  init();
  return tx((d) => {
    releaseExpiredHolds(d);
    assertKey(id, key);
    const cur = getBooking(id);
    if (!cur) throw new NotFoundError("booking not found");
    if (cur.status === "deposit_paid") throw new ConflictError("deposit already paid");
    if (cur.status === "pending_deposit") return ownerView(cur);
    const startSlot = cur.start / STEP;
    const ins = d.prepare("INSERT INTO salon_booking_slots (staff_id, date, slot, booking_id) VALUES (?,?,?,?)");
    try {
      for (let i = 0; i < cur.mins / STEP; i++) ins.run(cur.staffId, cur.date, startSlot + i, id);
    } catch (e) {
      if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) throw new ConflictError("slot already booked");
      throw e;
    }
    const intent = createIntent(SCOPE, { refType: "booking", refId: id, baseAmount: cur.deposit, windowMs: HOLD_MS, referencePrefix: "LM" }, d);
    d.prepare("UPDATE salon_booking_bookings SET status = 'pending_deposit', intent_id = ? WHERE id = ?").run(intent.intentId, id);
    return ownerView(getBooking(id)!);
  });
}

export function getBookingFresh(id: string, key: string | null): OwnerBooking {
  refreshHolds();
  assertKey(id, key);
  const b = getBooking(id);
  if (!b) throw new NotFoundError("booking not found");
  return ownerView(b);
}

function ownerView(b: BookingRow): OwnerBooking {
  const { phone: _p, email: _e, note: _n, ...rest } = b;
  void _p; void _e; void _n;
  return rest;
}

function keyOf(id: string): string | undefined {
  return (db().prepare("SELECT access_key FROM salon_booking_bookings WHERE id = ?").get(id) as { access_key: string } | undefined)?.access_key;
}

// Missing booking and wrong key answer identically so ids cannot be probed.
function assertKey(id: string, key: string | null) {
  const stored = keyOf(id);
  const a = Buffer.from(stored ?? "");
  const b = Buffer.from(key ?? "");
  if (!stored || !key || a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundError("booking not found");
}

// Public projection: busy time ranges only, no identity or payment data.
export function busyRanges(staffId: string, date: string): BusyRange[] {
  refreshHolds();
  return (db().prepare("SELECT start_slot * ? AS start, slots * ? AS mins FROM salon_booking_bookings WHERE staff_id = ? AND date = ? AND status != 'expired' ORDER BY start_slot").all(STEP, STEP, staffId, date) as BusyRange[]);
}

// Staff view (x-demo-role admin): booking details without payment capabilities.
export function dayCalendar(staffId: string, date: string): Omit<BookingRow, "intentId">[] {
  refreshHolds();
  const rows = (db().prepare(`${BOOKING_SQL} WHERE b.staff_id = ? AND b.date = ? AND b.status != 'expired' ORDER BY b.start_slot`).all(staffId, date) as BookingRow[]).map(toRow);
  return rows.map((r) => { const { intentId: _i, ...rest } = r; void _i; return rest; });
}

// Admin view: bookings that are waiting for money (or lost their hold) with the payable amount of their latest intent.
export function adminPaymentTargets() {
  refreshHolds();
  const rows = db().prepare(`${BOOKING_SQL} WHERE b.status != 'deposit_paid' AND b.intent_id IS NOT NULL ORDER BY b.rowid DESC LIMIT 50`).all() as BookingRow[];
  return rows.map(toRow).map((b) => {
    const intent = getIntent(SCOPE, b.intentId!);
    return { ref: b.ref, client: b.client, service: b.service, date: b.date, start: b.start, status: b.status, intentId: intent.id, intentStatus: intent.status, payAmount: intent.payableAmountSatang / 100, reference: intent.reference };
  });
}

// onPaid hook for the payment kit: runs inside the kit's transaction, once per paid intent.
// A late payment may still settle an expired booking if its slot is free; otherwise the money is parked for a refund.
const settleDeposit: OnPaid = ({ refId, intent }, t) => {
  const b = t.prepare("SELECT id, status, staff_id, date, start_slot, slots FROM salon_booking_bookings WHERE id = ?").get(refId) as
    { id: string; status: BookingStatus; staff_id: string; date: string; start_slot: number; slots: number } | undefined;
  if (!b) throw new QrPayError(404, "booking not found", "not_found");
  if (b.status === "deposit_paid") return { cancelled: true, reason: "booking_already_paid", message: "การจองนี้ชำระมัดจำไปแล้ว" };
  if (b.status === "expired") {
    const ins = t.prepare("INSERT INTO salon_booking_slots (staff_id, date, slot, booking_id) VALUES (?,?,?,?)");
    try {
      for (let i = 0; i < b.slots; i++) ins.run(b.staff_id, b.date, b.start_slot + i, b.id);
    } catch (e) {
      if (!(e instanceof Error && /UNIQUE constraint failed/i.test(e.message))) throw e;
      return { cancelled: true, reason: "slot_taken", message: "คิวนี้ถูกจองโดยผู้อื่นแล้วหลังหมดเวลา ร้านจะคืนเงินมัดจำ" };
    }
  }
  t.prepare("UPDATE salon_booking_bookings SET status = 'deposit_paid', paid_at = ?, paid_via = ?, trans_ref = ?, slip_amount = ?, slip_sandbox = ?, intent_id = ? WHERE id = ?")
    .run(intent.paidAt ?? new Date().toISOString(), intent.paidVia, intent.transRef, intent.payableAmountSatang / 100, intent.sandbox === null ? null : intent.sandbox ? 1 : 0, intent.id, b.id);
};

// Mounted by app/api/salon-booking/qrpay/[...path]/route.ts.
export const qrpay: QrRouteConfig = { scope: SCOPE, onPaid: settleDeposit, defaultPayeeName: PAYEE_NAME };

export function errorResponse(e: unknown): Response {
  if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404 });
  if (e instanceof ConflictError) return Response.json({ error: e.message }, { status: 409 });
  throw e;
}

// A real calendar date: Feb 31 and similar are rejected by the round trip.
export const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
};

const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function assertBookableDate(date: string) {
  const today = bangkokToday();
  const last = new Date(Date.parse(`${today}T00:00:00Z`) + BOOKING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (date < today) throw new ValidationError("date is in the past");
  if (date > last) throw new ValidationError(`date must be within ${BOOKING_WINDOW_DAYS} days`);
}
