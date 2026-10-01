import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { createIntent, expireStale, getPayee, QrPayError, type OnPaid, type QrIntent } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";

export type Category = "coffee" | "tea" | "bakery" | "food";
export type OrderStatus = "new" | "preparing" | "ready" | "paid";

export type MenuItem = {
  id: string;
  name: string;
  th: string;
  price: number;
  cat: Category;
  image: string;
  available: boolean;
};

export type OrderLine = { itemId: string; name: string; price: number; qty: number };
// Latest QR payment intent of an order; payAmount carries the unique satang suffix used to match the bank notification.
export type OrderPayment = {
  intentId: string;
  status: QrIntent["status"];
  payAmount: number;
  reference: string;
  expiresAt: number;
  paidVia: QrIntent["paidVia"];
};
export type Order = {
  id: number;
  table: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  payment: OrderPayment | null;
  lines: OrderLine[];
};

export const TABLE_COUNT = 12;
export const MAX_QTY = 20;
export const PAYMENT_WINDOW_MS = 10 * 60_000;

const SCOPE = "cafe-qr-order";

// Dev-only fallback so the demo runs without setup; production must set CAFE_TABLE_SECRET.
const DEV_TABLE_SECRET = "dev-only-cafe-table-secret";
const TOKEN_SIG_LENGTH = 10;

function tableSecret(): string {
  const secret = process.env.CAFE_TABLE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("CAFE_TABLE_SECRET is required in production");
  return DEV_TABLE_SECRET;
}

const tableSignature = (n: number) =>
  createHmac("sha256", tableSecret()).update(`cafe-table:${n}`).digest("base64url").slice(0, TOKEN_SIG_LENGTH);

// Token printed on a table's QR sticker: "<table>.<signature>". Customers cannot forge another table's token.
export const signTable = (n: number) => `${n}.${tableSignature(n)}`;

// Returns the table number for a genuine token, otherwise null.
export function verifyTable(token: unknown): number | null {
  if (typeof token !== "string") return null;
  const m = /^(\d{1,2})\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > TABLE_COUNT) return null;
  const given = Buffer.from(m[2]);
  const expected = Buffer.from(tableSignature(n));
  return given.length === expected.length && timingSafeEqual(given, expected) ? n : null;
}
const PAYEE_NAME = "Brew & Bean (ตัวอย่าง)";

const img = (f: string) => `/images/cafe-qr-order/${f}`;

const seedMenu: MenuItem[] = [
  { id: "m1", name: "Latte", th: "ลาเต้", price: 75, cat: "coffee", image: img("latte-pour.jpg"), available: true },
  { id: "m2", name: "Flat White", th: "แฟลตไวท์", price: 80, cat: "coffee", image: img("flat-white.jpg"), available: true },
  { id: "m3", name: "Cappuccino", th: "คาปูชิโน่", price: 80, cat: "coffee", image: img("cappuccino.jpg"), available: true },
  { id: "m4", name: "Boba Milk Tea", th: "ชานมไข่มุก", price: 60, cat: "tea", image: img("boba-milk-tea.jpg"), available: true },
  { id: "m5", name: "Matcha Latte", th: "มัทฉะลาเต้", price: 85, cat: "tea", image: img("matcha-latte.jpg"), available: true },
  { id: "m10", name: "Iced Black Tea", th: "ชาดำเย็น", price: 55, cat: "tea", image: img("iced-lime-tea.jpg"), available: true },
  { id: "m6", name: "Butter Croissant", th: "ครัวซองต์เนยสด", price: 65, cat: "bakery", image: img("croissant.jpg"), available: true },
  { id: "m7", name: "Seeded Rustic Loaf", th: "ขนมปังโฮลเกรนเมล็ดพืช", price: 70, cat: "bakery", image: img("rustic-bread.jpg"), available: true },
  { id: "m8", name: "Avocado Egg Toast", th: "ขนมปังอะโวคาโดไข่ดาว", price: 95, cat: "food", image: img("avocado-egg-toast.jpg"), available: true },
  { id: "m9", name: "Spinach Pesto Penne", th: "เพนเน่ซอสเพสโต้ผักโขม", price: 120, cat: "food", image: img("penne-ragu.jpg"), available: true },
  { id: "m11", name: "Garlic Shrimp Spaghetti", th: "สปาเกตตีกุ้งกระเทียม", price: 140, cat: "food", image: img("shrimp-spaghetti.jpg"), available: true },
  { id: "m12", name: "Crispy Chicken Burger", th: "เบอร์เกอร์ไก่กรอบ", price: 130, cat: "food", image: img("chicken-burger.jpg"), available: true },
];

let ready = false;

function init() {
  if (ready) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS cafe_qr_order_menu (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      th TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0),
      cat TEXT NOT NULL,
      image TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cafe_qr_order_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_no INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('new','preparing','ready','paid')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cafe_qr_order_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES cafe_qr_order_orders(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL CHECK (qty > 0)
    );
    CREATE INDEX IF NOT EXISTS cafe_qr_order_items_order ON cafe_qr_order_order_items(order_id);
  `);
  const cols = (d.prepare("PRAGMA table_info(cafe_qr_order_orders)").all() as { name: string }[]).map((c) => c.name);
  // Slip columns from before the payment kit stay unused; payment details now live on the QR intent.
  if (!cols.includes("intent_id")) d.exec("ALTER TABLE cafe_qr_order_orders ADD COLUMN intent_id TEXT");
  getPayee(SCOPE, PAYEE_NAME); // creates the kit tables and seeds the sample payee under this shop's name
  tx((t) => {
    const count = (t.prepare("SELECT COUNT(*) AS n FROM cafe_qr_order_menu").get() as { n: number }).n;
    if (count > 0) return;
    const ins = t.prepare(
      "INSERT INTO cafe_qr_order_menu (id, name, th, price, cat, image, available, sort) VALUES (?,?,?,?,?,?,?,?)",
    );
    seedMenu.forEach((m, i) => ins.run(m.id, m.name, m.th, m.price, m.cat, m.image, m.available ? 1 : 0, i));
    createOrder(t, 3, [{ id: "m1", qty: 2 }, { id: "m6", qty: 1 }], "preparing");
    createOrder(t, 7, [{ id: "m9", qty: 1 }], "new");
  });
  ready = true;
}

type Db = ReturnType<typeof db>;
type MenuRow = Omit<MenuItem, "available"> & { available: number };

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

export function listMenu(): MenuItem[] {
  init();
  const rows = db().prepare("SELECT id, name, th, price, cat, image, available FROM cafe_qr_order_menu ORDER BY sort").all() as unknown as MenuRow[];
  return rows.map((r) => ({ ...r, available: r.available === 1 }));
}

export function setAvailability(id: string, available: boolean): MenuItem {
  init();
  const res = db().prepare("UPDATE cafe_qr_order_menu SET available = ? WHERE id = ?").run(available ? 1 : 0, id);
  if (res.changes === 0) throw new NotFoundError("menu item not found");
  return listMenu().find((m) => m.id === id)!;
}

type OrderRow = { id: number; table_no: number; total: number; status: OrderStatus; created_at: string; paid_at: string | null; intent_id: string | null };
type IntentRow = { id: string; status: QrIntent["status"]; payable_amount_satang: number; reference: string; expires_at: number; paid_via: QrIntent["paidVia"] };

function hydrate(d: Db, rows: OrderRow[]): Order[] {
  const itemStmt = d.prepare("SELECT item_id, name, price, qty FROM cafe_qr_order_order_items WHERE order_id = ? ORDER BY id");
  const intentStmt = d.prepare("SELECT id, status, payable_amount_satang, reference, expires_at, paid_via FROM qrpay_intents WHERE id = ?");
  return rows.map((r) => {
    const i = r.intent_id ? (intentStmt.get(r.intent_id) as IntentRow | undefined) : undefined;
    return {
    id: r.id,
    table: r.table_no,
    total: r.total,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    payment: i
      ? { intentId: i.id, status: i.status, payAmount: i.payable_amount_satang / 100, reference: i.reference, expiresAt: i.expires_at, paidVia: i.paid_via }
      : null,
    lines: (itemStmt.all(r.id) as { item_id: string; name: string; price: number; qty: number }[]).map((l) => ({
      itemId: l.item_id,
      name: l.name,
      price: l.price,
      qty: l.qty,
    })),
    };
  });
}

export function listOrders(table?: number): Order[] {
  init();
  const d = db();
  expireStale(SCOPE, d);
  const rows = (
    table === undefined
      ? d.prepare("SELECT * FROM cafe_qr_order_orders ORDER BY id DESC LIMIT 60").all()
      : d.prepare("SELECT * FROM cafe_qr_order_orders WHERE table_no = ? ORDER BY id DESC LIMIT 30").all(table)
  ) as unknown as OrderRow[];
  return hydrate(d, rows).reverse();
}

function getOrder(d: Db, id: number): Order {
  const row = d.prepare("SELECT * FROM cafe_qr_order_orders WHERE id = ?").get(id) as unknown as OrderRow | undefined;
  if (!row) throw new NotFoundError("order not found");
  return hydrate(d, [row])[0];
}

// Availability and prices are read inside the transaction so a sold-out item can never slip in.
function createOrder(d: Db, table: number, items: { id: string; qty: number }[], status: OrderStatus = "new"): Order {
  const lookup = d.prepare("SELECT id, name, price, available FROM cafe_qr_order_menu WHERE id = ?");
  const resolved = items.map((it) => {
    const m = lookup.get(it.id) as { id: string; name: string; price: number; available: number } | undefined;
    if (!m) throw new NotFoundError(`unknown menu item: ${it.id.length > 40 ? `${it.id.slice(0, 40)}...` : it.id}`);
    return { m, qty: it.qty };
  });
  const soldOut = resolved.filter((r) => r.m.available !== 1).map((r) => r.m.name);
  if (soldOut.length > 0) throw new ConflictError(`sold out: ${soldOut.join(", ")}`);

  const total = resolved.reduce((s, r) => s + r.m.price * r.qty, 0);
  const res = d.prepare("INSERT INTO cafe_qr_order_orders (table_no, total, status) VALUES (?,?,?)").run(table, total, status);
  const orderId = Number(res.lastInsertRowid);
  const ins = d.prepare("INSERT INTO cafe_qr_order_order_items (order_id, item_id, name, price, qty) VALUES (?,?,?,?,?)");
  resolved.forEach((r) => ins.run(orderId, r.m.id, r.m.name, r.m.price, r.qty));
  return getOrder(d, orderId);
}

export function placeOrder(table: number, items: { id: string; qty: number }[]): Order {
  init();
  return tx((d) => createOrder(d, table, items));
}

const nextStep: Record<OrderStatus, OrderStatus | null> = { new: "preparing", preparing: "ready", ready: null, paid: null };

// Kitchen may only move an order forward one step; "paid" is reached solely through the QR payment kit (see settleOrder).
export function advanceOrder(id: number, to: OrderStatus): Order {
  init();
  return tx((d) => {
    const cur = getOrder(d, id);
    if (nextStep[cur.status] !== to) throw new ConflictError(`cannot move order from ${cur.status} to ${to}`);
    d.prepare("UPDATE cafe_qr_order_orders SET status = ? WHERE id = ?").run(to, id);
    return getOrder(d, id);
  });
}

// Starts (or resumes) payment for a ready order. The amount is the order total stored in the DB; an unpaid
// order stays open when its QR expires and a new intent with a fresh unique amount is issued on the next call.
export function startPayment(id: number, table: number): Order {
  init();
  return tx((d) => {
    expireStale(SCOPE, d);
    const cur = getOrder(d, id);
    // Same message as a missing order so ids of other tables cannot be probed.
    if (cur.table !== table) throw new NotFoundError("order not found");
    if (cur.status === "paid") throw new ConflictError("order already paid");
    if (cur.status !== "ready") throw new ConflictError("order can be paid once it is ready");
    if (cur.payment?.status === "pending") return cur;
    const intent = createIntent(SCOPE, { refType: "order", refId: String(id), baseAmount: cur.total, windowMs: PAYMENT_WINDOW_MS, referencePrefix: "CF" }, d);
    d.prepare("UPDATE cafe_qr_order_orders SET intent_id = ? WHERE id = ?").run(intent.intentId, id);
    return getOrder(d, id);
  });
}

// onPaid hook for the payment kit: the only path to "paid", run inside the kit's transaction once per intent.
const settleOrder: OnPaid = ({ refId, intent }, t: DatabaseSync) => {
  const id = /^\d+$/.test(refId) ? Number(refId) : NaN;
  const order = t.prepare("SELECT id, status FROM cafe_qr_order_orders WHERE id = ?").get(id) as { id: number; status: OrderStatus } | undefined;
  if (!order) throw new QrPayError(404, "Order not found", "not_found");
  if (order.status !== "ready") {
    return { cancelled: true, reason: "not_payable", message: `ออเดอร์อยู่สถานะ ${order.status} จึงรับชำระไม่ได้ เงินที่รับมาต้องคืนลูกค้า` };
  }
  t.prepare("UPDATE cafe_qr_order_orders SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), intent_id = ? WHERE id = ?").run(intent.id, id);
  // A late payment on an older QR can settle the order while a re-issued QR is still pending; close that one.
  t.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE scope = ? AND ref_type = 'order' AND ref_id = ? AND status = 'pending' AND id != ?").run(SCOPE, refId, intent.id);
};

// Mounted by app/api/cafe-qr-order/qrpay/[...path]/route.ts; admin auth is the default x-demo-role: admin header.
export const qrpay: QrRouteConfig = { scope: SCOPE, onPaid: settleOrder, defaultPayeeName: PAYEE_NAME };
