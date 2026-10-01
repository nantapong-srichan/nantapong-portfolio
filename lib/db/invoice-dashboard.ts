import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { createIntent, expireStale, QrPayError, type OnPaid } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";

// Money is stored as integer satang (1 baht = 100) so totals never drift from float math.
export const VAT_PERCENT = 7;
const SCOPE = "invoice-dashboard";
const QR_WINDOW_MS = 30 * 60 * 1000;

export type Role = "owner" | "staff";
export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type Row = Record<string, unknown>;
const T = {
  customers: "invoice_dashboard_customers",
  products: "invoice_dashboard_products",
  invoices: "invoice_dashboard_invoices",
  items: "invoice_dashboard_invoice_items",
  payments: "invoice_dashboard_payments",
};

// Keeps the payable amount (total + up to 0.99 uniqueness) under the payment webhook's 10,000,000 baht ceiling.
export const MAX_INVOICE_TOTAL_SATANG = 999_999_900;

const toBaht = (satang: unknown) => Number(satang) / 100;
const toSatang = (baht: number) => Math.round(baht * 100);

const SEED_PRODUCTS: [string, string, number, number, number, number][] = [
  // sku, name, stock, min, price (baht), cost (baht)
  ["PK-1001", "กล่องกระดาษ ขนาด M", 420, 150, 18, 11],
  ["PK-1002", "เทปกาว OPP 2 นิ้ว", 36, 60, 42, 27],
  ["ST-2010", "กระดาษ A4 80 แกรม (รีม)", 18, 40, 125, 94],
  ["ST-2044", "ปากกาลูกลื่น สีน้ำเงิน (โหล)", 95, 30, 68, 41],
  ["EL-3005", "ปลั๊กพ่วง 4 ช่อง 3 เมตร", 8, 15, 259, 168],
  ["EL-3012", "หลอด LED 12W", 140, 50, 59, 36],
  ["CL-4001", "น้ำยาทำความสะอาด 5 ลิตร", 52, 20, 190, 122],
];

const SEED_INVOICES: [string, string, string, number, InvoiceStatus][] = [
  ["INV-2410-018", "บริษัท สยามพาณิชย์ จำกัด", "2026-10-01", 48150, "pending"],
  ["INV-2410-017", "ร้านกาแฟ บ้านสวน", "2026-09-29", 12840, "paid"],
  ["INV-2410-016", "หจก. ไทยเฟอร์นิเจอร์", "2026-09-27", 73920, "paid"],
  ["INV-2410-015", "Northgate Trading Co.", "2026-09-20", 29960, "overdue"],
  ["INV-2410-014", "คุณสมศักดิ์ วงศ์ทอง", "2026-09-18", 5350, "paid"],
  ["INV-2410-013", "โรงแรม ริมน้ำ รีสอร์ท", "2026-09-12", 96300, "overdue"],
  ["INV-2410-012", "Bangkok Print Studio", "2026-09-10", 18725, "pending"],
  ["INV-2410-011", "บริษัท กรีนเลฟ ออร์แกนิค จำกัด", "2026-09-05", 34240, "draft"],
];

// Historical paid walk-in sales batches so the monthly chart has a real history.
const SEED_HISTORY: [string, string, number, number][] = [
  ["INV-2505-001", "2026-05-28", 182000, 121000],
  ["INV-2506-001", "2026-06-28", 214500, 140000],
  ["INV-2507-001", "2026-07-28", 198300, 132000],
  ["INV-2508-001", "2026-08-28", 256800, 161000],
  ["INV-2509-001", "2026-09-28", 155116, 96000],
  ["INV-2510-001", "2026-10-01", 287900, 176000],
];

function computeTotals(lines: { qty: number; unitPrice: number }[]) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vat = Math.round((subtotal * VAT_PERCENT) / 100);
  return { subtotal, vat, total: subtotal + vat };
}

function ensureCustomer(d: DatabaseSync, name: string): number {
  const found = d.prepare(`SELECT id FROM ${T.customers} WHERE name = ?`).get(name) as Row | undefined;
  if (found) return Number(found.id);
  const r = d.prepare(`INSERT INTO ${T.customers} (name) VALUES (?)`).run(name);
  return Number(r.lastInsertRowid);
}

function insertInvoice(
  d: DatabaseSync,
  id: string,
  customerName: string,
  issueDate: string,
  status: InvoiceStatus,
  lines: { sku: string | null; description: string; qty: number; unitPrice: number; unitCost: number }[],
) {
  const totals = computeTotals(lines);
  d.prepare(
    `INSERT INTO ${T.invoices} (id, customer_id, issue_date, status, subtotal, vat, total) VALUES (?,?,?,?,?,?,?)`,
  ).run(id, ensureCustomer(d, customerName), issueDate, status, totals.subtotal, totals.vat, totals.total);
  const ins = d.prepare(
    `INSERT INTO ${T.items} (invoice_id, sku, description, qty, unit_price, unit_cost) VALUES (?,?,?,?,?,?)`,
  );
  for (const l of lines) ins.run(id, l.sku, l.description, l.qty, l.unitPrice, l.unitCost);
  return totals;
}

let ready = false;
function init(): DatabaseSync {
  const d = db();
  if (ready) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS ${T.customers} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS ${T.products} (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      min_stock INTEGER NOT NULL,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${T.invoices} (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES ${T.customers}(id),
      issue_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft','pending','paid','overdue')),
      subtotal INTEGER NOT NULL,
      vat INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ${T.items} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL REFERENCES ${T.invoices}(id) ON DELETE CASCADE,
      sku TEXT REFERENCES ${T.products}(sku),
      description TEXT NOT NULL,
      qty INTEGER NOT NULL CHECK (qty > 0),
      unit_price INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${T.payments} (
      invoice_id TEXT PRIMARY KEY REFERENCES ${T.invoices}(id) ON DELETE CASCADE,
      trans_ref TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      sandbox INTEGER NOT NULL,
      verified_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const count = d.prepare(`SELECT COUNT(*) AS n FROM ${T.products}`).get() as Row;
  if (Number(count.n) === 0) {
    tx((t) => {
      const ins = t.prepare(`INSERT INTO ${T.products} (sku, name, stock, min_stock, price, cost) VALUES (?,?,?,?,?,?)`);
      for (const [sku, name, stock, min, price, cost] of SEED_PRODUCTS) ins.run(sku, name, stock, min, toSatang(price), toSatang(cost));
      for (const [id, customer, date, amount, status] of SEED_INVOICES) {
        // Back-solve the pre-VAT line so the seeded total matches the old mock amount.
        const unitPrice = Math.round((toSatang(amount) * 100) / (100 + VAT_PERCENT));
        insertInvoice(t, id, customer, date, status, [
          { sku: null, description: "สินค้าและบริการตามใบสั่งซื้อ", qty: 1, unitPrice, unitCost: Math.round(unitPrice * 0.65) },
        ]);
      }
      for (const [id, date, sales, cost] of SEED_HISTORY) {
        insertInvoice(t, id, "ลูกค้าหน้าร้าน (สรุปรายเดือน)", date, "paid", [
          { sku: null, description: "ยอดขายหน้าร้านรวม", qty: 1, unitPrice: toSatang(sales), unitCost: toSatang(cost) },
        ]);
      }
    });
  }
  ready = true;
  return d;
}

// ---------- reads ----------

type InvoiceItemDto = { sku: string | null; description: string; qty: number; unitPrice: number; lineTotal: number };

function invoiceDto(r: Row, items?: InvoiceItemDto[]) {
  return {
    id: String(r.id),
    customer: String(r.customer),
    date: String(r.issue_date),
    status: r.status as InvoiceStatus,
    subtotal: toBaht(r.subtotal),
    vat: toBaht(r.vat),
    amount: toBaht(r.total),
    ...(items ? { items } : {}),
  };
}

const INVOICE_SELECT = `SELECT i.*, c.name AS customer FROM ${T.invoices} i JOIN ${T.customers} c ON c.id = i.customer_id`;

export function listInvoices() {
  const rows = init().prepare(`${INVOICE_SELECT} ORDER BY i.issue_date DESC, i.id DESC`).all() as Row[];
  return rows.map((r) => invoiceDto(r));
}

export function getInvoice(id: string) {
  const d = init();
  const r = d.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id) as Row | undefined;
  if (!r) throw new HttpError(404, "ไม่พบใบแจ้งหนี้นี้");
  const items = (d.prepare(`SELECT * FROM ${T.items} WHERE invoice_id = ? ORDER BY id`).all(id) as Row[]).map((x) => ({
    sku: x.sku === null ? null : String(x.sku),
    description: String(x.description),
    qty: Number(x.qty),
    unitPrice: toBaht(x.unit_price),
    lineTotal: toBaht(Number(x.qty) * Number(x.unit_price)),
  }));
  return invoiceDto(r, items);
}

export function listCustomers() {
  const rows = init().prepare(`SELECT id, name FROM ${T.customers} ORDER BY name`).all() as Row[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

function productDto(r: Row) {
  return {
    sku: String(r.sku),
    name: String(r.name),
    stock: Number(r.stock),
    min: Number(r.min_stock),
    price: toBaht(r.price),
  };
}

export function listProducts() {
  const rows = init().prepare(`SELECT * FROM ${T.products} ORDER BY sku`).all() as Row[];
  return rows.map(productDto);
}

export function restock(sku: string, qty: number) {
  const d = init();
  const r = d.prepare(`UPDATE ${T.products} SET stock = stock + ? WHERE sku = ?`).run(qty, sku);
  if (Number(r.changes) === 0) throw new HttpError(404, "ไม่พบสินค้านี้");
  return productDto(d.prepare(`SELECT * FROM ${T.products} WHERE sku = ?`).get(sku) as Row);
}

// ---------- invoice writes ----------

export type NewInvoiceInput = {
  customer: string;
  status: "draft" | "pending";
  items: { sku?: string; description?: string; qty: number; unitPrice?: number }[];
};

// Decrement stock for every SKU line; the CHECK-free guard here gives a clean 409 message.
function consumeStock(d: DatabaseSync, invoiceId: string) {
  const lines = d
    .prepare(`SELECT sku, SUM(qty) AS qty FROM ${T.items} WHERE invoice_id = ? AND sku IS NOT NULL GROUP BY sku`)
    .all(invoiceId) as Row[];
  for (const l of lines) {
    const r = d
      .prepare(`UPDATE ${T.products} SET stock = stock - ? WHERE sku = ? AND stock >= ?`)
      .run(Number(l.qty), String(l.sku), Number(l.qty));
    if (Number(r.changes) === 0) {
      const p = d.prepare(`SELECT stock FROM ${T.products} WHERE sku = ?`).get(String(l.sku)) as Row;
      throw new HttpError(409, `สินค้า ${l.sku} มีไม่พอ ต้องการ ${l.qty} ชิ้น แต่เหลือ ${p.stock} ชิ้น`, "insufficient_stock");
    }
  }
}

function returnStock(d: DatabaseSync, invoiceId: string) {
  d.prepare(
    `UPDATE ${T.products} SET stock = stock + COALESCE(
       (SELECT SUM(qty) FROM ${T.items} WHERE invoice_id = ? AND sku = ${T.products}.sku), 0)`,
  ).run(invoiceId);
}

function nextInvoiceId(d: DatabaseSync, today: string) {
  const prefix = `INV-${today.slice(2, 4)}${today.slice(5, 7)}-`;
  const r = d
    .prepare(`SELECT MAX(CAST(SUBSTR(id, ?) AS INTEGER)) AS n FROM ${T.invoices} WHERE id LIKE ?`)
    .get(prefix.length + 1, `${prefix}%`) as Row;
  return `${prefix}${String(Number(r.n ?? 0) + 1).padStart(3, "0")}`;
}

export function createInvoice(input: NewInvoiceInput) {
  init();
  const today = new Date().toISOString().slice(0, 10);
  const id = tx((t) => {
    const lines = input.items.map((it) => {
      if (it.sku) {
        const p = t.prepare(`SELECT * FROM ${T.products} WHERE sku = ?`).get(it.sku) as Row | undefined;
        if (!p) throw new HttpError(400, `ไม่พบรหัสสินค้า ${it.sku}`, "unknown_sku");
        // Price comes from the catalogue, never from the client.
        return { sku: it.sku, description: String(p.name), qty: it.qty, unitPrice: Number(p.price), unitCost: Number(p.cost) };
      }
      const unitPrice = toSatang(it.unitPrice ?? 0);
      return { sku: null, description: String(it.description), qty: it.qty, unitPrice, unitCost: Math.round(unitPrice * 0.65) };
    });
    if (lines.some((l) => l.unitPrice < 1)) throw new HttpError(400, "ราคาต่อหน่วยต้องไม่ต่ำกว่า 0.01 บาท", "unit_price_min");
    const { total } = computeTotals(lines);
    if (total < 1) throw new HttpError(400, "ยอดรวมใบแจ้งหนี้ต้องมากกว่า 0 บาท", "total_min");
    if (total > MAX_INVOICE_TOTAL_SATANG) throw new HttpError(400, "ยอดรวมใบแจ้งหนี้ต้องไม่เกิน 9,999,999 บาท", "total_max");
    const invoiceId = nextInvoiceId(t, today);
    insertInvoice(t, invoiceId, input.customer, today, input.status, lines);
    if (input.status !== "draft") consumeStock(t, invoiceId);
    return invoiceId;
  });
  return getInvoice(id);
}

const STATUS_TH: Record<InvoiceStatus, string> = { draft: "ฉบับร่าง", pending: "รอชำระ", paid: "ชำระแล้ว", overdue: "เกินกำหนด" };

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending"],
  pending: ["overdue"],
  overdue: [],
  paid: [],
};

// "paid" is deliberately unreachable here: only the QR payment kit (settleInvoice) can set it.
export function setInvoiceStatus(id: string, next: InvoiceStatus) {
  init();
  tx((t) => {
    const cur = t.prepare(`SELECT status FROM ${T.invoices} WHERE id = ?`).get(id) as Row | undefined;
    if (!cur) throw new HttpError(404, "ไม่พบใบแจ้งหนี้นี้");
    const from = cur.status as InvoiceStatus;
    if (!ALLOWED_TRANSITIONS[from].includes(next)) throw new HttpError(409, `ไม่สามารถเปลี่ยนสถานะจาก ${STATUS_TH[from]} เป็น ${STATUS_TH[next]} ได้`, "invalid_transition");
    if (from === "draft") consumeStock(t, id);
    t.prepare(`UPDATE ${T.invoices} SET status = ? WHERE id = ?`).run(next, id);
  });
  return getInvoice(id);
}

// ---------- QR payment ----------

type QrState = { intentId: string; status: string; payableAmount: number; reference: string; expiresAt: number };

const latestIntent = (d: DatabaseSync, invoiceId: string) =>
  d
    .prepare(
      `SELECT id, status, payable_amount_satang, reference, expires_at FROM qrpay_intents
       WHERE scope = ? AND ref_type = 'invoice' AND ref_id = ? ORDER BY rowid DESC LIMIT 1`,
    )
    .get(SCOPE, invoiceId) as Row | undefined;

const toQrState = (r: Row): QrState => ({
  intentId: String(r.id),
  status: String(r.status),
  payableAmount: toBaht(r.payable_amount_satang),
  reference: String(r.reference),
  expiresAt: Number(r.expires_at),
});

// Opens (or reuses) the pending QR intent for an unpaid invoice. The amount is the stored total incl. VAT, never client input;
// an expired intent is simply replaced by a fresh one with a new unique satang amount.
export function openInvoiceQr(id: string): QrState {
  init();
  return tx((t) => {
    expireStale(SCOPE, t);
    const inv = t.prepare(`SELECT status, total FROM ${T.invoices} WHERE id = ?`).get(id) as Row | undefined;
    if (!inv) throw new HttpError(404, "ไม่พบใบแจ้งหนี้นี้");
    if (inv.status !== "pending" && inv.status !== "overdue") throw new HttpError(409, `ใบแจ้งหนี้นี้อยู่ในสถานะ${STATUS_TH[inv.status as InvoiceStatus] ?? String(inv.status)} ชำระได้เฉพาะใบที่รอชำระหรือเกินกำหนด`, "not_payable");
    const cur = latestIntent(t, id);
    if (cur && cur.status === "pending") return toQrState(cur);
    try {
      createIntent(SCOPE, { refType: "invoice", refId: id, baseAmount: toBaht(inv.total), windowMs: QR_WINDOW_MS, referencePrefix: id }, t);
    } catch (e) {
      if (e instanceof QrPayError) throw new HttpError(e.status, e.message);
      throw e;
    }
    return toQrState(latestIntent(t, id) as Row);
  });
}

// Owner screens: unpaid invoices that already have a QR intent (pending, or expired and still assignable).
export function listQrTargets() {
  init();
  expireStale(SCOPE);
  const rows = db()
    .prepare(
      `SELECT i.id AS invoice_id, i.status AS invoice_status, c.name AS customer, q.id, q.status, q.payable_amount_satang, q.reference, q.expires_at
       FROM ${T.invoices} i JOIN ${T.customers} c ON c.id = i.customer_id
       JOIN qrpay_intents q ON q.id = (SELECT id FROM qrpay_intents WHERE scope = ? AND ref_type = 'invoice' AND ref_id = i.id ORDER BY rowid DESC LIMIT 1)
       WHERE i.status IN ('pending','overdue') AND q.status IN ('pending','expired')
       ORDER BY i.id DESC`,
    )
    .all(SCOPE) as Row[];
  return rows.map((r) => ({
    invoiceId: String(r.invoice_id),
    customer: String(r.customer),
    invoiceStatus: String(r.invoice_status),
    ...toQrState(r),
  }));
}

// Runs inside the kit's transaction, once per intent: the only place an invoice becomes paid.
const settleInvoice: OnPaid = ({ refId, intent, via }, t) => {
  const inv = t.prepare(`SELECT status FROM ${T.invoices} WHERE id = ?`).get(refId) as Row | undefined;
  if (!inv) return { cancelled: true, reason: "invoice_missing", message: "ไม่พบใบแจ้งหนี้ (ถูกลบแล้ว) เงินที่ได้รับรอการคืน" };
  if (inv.status !== "pending" && inv.status !== "overdue") {
    return { cancelled: true, reason: "already_paid", message: "ใบแจ้งหนี้นี้ชำระแล้ว เงินที่ได้รับรอการคืน" };
  }
  t.prepare(`UPDATE ${T.invoices} SET status = 'paid' WHERE id = ?`).run(refId);
  t.prepare(`INSERT INTO ${T.payments} (invoice_id, trans_ref, amount, sandbox, verified_by) VALUES (?,?,?,?,?)`).run(
    refId, intent.transRef ?? intent.eventId ?? `manual-${intent.id}`, intent.payableAmountSatang, intent.sandbox ? 1 : 0, via,
  );
};

// Mounted by app/api/invoice-dashboard/qrpay/[...path]/route.ts. Payee, unmatched and sandbox panels are owner-only.
export const qrpay: QrRouteConfig = {
  scope: SCOPE,
  onPaid: settleInvoice,
  defaultPayeeName: "ร้านสยามออฟฟิศซัพพลาย",
  authorizeAdmin: (req) => {
    const role = req.headers.get("x-demo-role");
    if (role === null) throw new QrPayError(401, "ไม่พบ header x-demo-role", "unauthorized");
    if (role !== "owner") throw new QrPayError(403, "ต้องใช้บทบาทเจ้าของร้านเท่านั้น", "forbidden");
  },
};

// Deleting a sent/paid invoice puts its stock back; a draft never took any.
export function deleteInvoice(id: string) {
  init();
  tx((t) => {
    const cur = t.prepare(`SELECT status FROM ${T.invoices} WHERE id = ?`).get(id) as Row | undefined;
    if (!cur) throw new HttpError(404, "ไม่พบใบแจ้งหนี้นี้");
    if (cur.status !== "draft") returnStock(t, id);
    t.prepare(`DELETE FROM ${T.invoices} WHERE id = ?`).run(id);
  });
}

// ---------- dashboard (all aggregation in SQL) ----------

export function dashboard() {
  const d = init();
  const series = d
    .prepare(
      `WITH RECURSIVE months(m) AS (
         SELECT strftime('%Y-%m', 'now', 'start of month', '-5 months')
         UNION ALL
         SELECT strftime('%Y-%m', m || '-01', '+1 month') FROM months WHERE m < strftime('%Y-%m', 'now')
       )
       SELECT months.m AS month,
              COALESCE(SUM(i.subtotal), 0) AS sales,
              COALESCE(SUM((SELECT SUM(it.qty * it.unit_cost) FROM ${T.items} it WHERE it.invoice_id = i.id)), 0) AS cost
       FROM months
       LEFT JOIN ${T.invoices} i ON strftime('%Y-%m', i.issue_date) = months.m AND i.status = 'paid'
       GROUP BY months.m ORDER BY months.m`,
    )
    .all() as Row[];

  const k = d
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid' AND strftime('%Y-%m', issue_date) = strftime('%Y-%m', 'now') THEN subtotal END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN status = 'paid' AND strftime('%Y-%m', issue_date) = strftime('%Y-%m', 'now', 'start of month', '-1 month') THEN subtotal END), 0) AS prev_revenue,
         COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN total END), 0) AS outstanding,
         COALESCE(SUM(status = 'overdue'), 0) AS overdue_count,
         COALESCE(SUM(strftime('%Y-%m', issue_date) = strftime('%Y-%m', 'now')), 0) AS invoices_this_month,
         COUNT(*) AS invoices_total
       FROM ${T.invoices}`,
    )
    .get() as Row;
  const low = d.prepare(`SELECT COUNT(*) AS n FROM ${T.products} WHERE stock < min_stock`).get() as Row;

  const revenue = Number(k.revenue);
  const prev = Number(k.prev_revenue);
  return {
    revenue: toBaht(revenue),
    previousRevenue: toBaht(prev),
    revenueChangePct: prev > 0 ? Math.round(((revenue - prev) / prev) * 1000) / 10 : null,
    outstanding: toBaht(k.outstanding),
    overdueCount: Number(k.overdue_count),
    invoicesThisMonth: Number(k.invoices_this_month),
    invoicesTotal: Number(k.invoices_total),
    lowStockCount: Number(low.n),
    monthly: series.map((s) => ({ month: String(s.month), sales: toBaht(s.sales), cost: toBaht(s.cost) })),
  };
}
