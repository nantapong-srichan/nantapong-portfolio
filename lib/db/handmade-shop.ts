import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { createIntent, expireStale as expireIntents, getIntent, getPayee, QrPayError as ShopError, qrErrorResponse as errorResponse, requireDemoAdmin as requireAdmin, type OnPaid } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";

export const SHIPPING_FEE = 50;
export const FREE_SHIPPING_OVER = 1500;

export const PAYMENT_WINDOW_MS = 15 * 60_000;

const SCOPE = "handmade-shop";
const PAYEE_NAME = "ร้านงานฝีมือ (ตัวอย่าง)";

export { ShopError, errorResponse, requireAdmin };

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

type SeedProduct = {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  price: number;
  image: string;
  desc: string;
  colors: string[];
  sizes: string[];
};

const SEED: SeedProduct[] = [
  { id: "tote", name: "Natural Tote Bag", nameTh: "กระเป๋าผ้าสีธรรมชาติ", category: "กระเป๋า", price: 450, image: "/images/handmade-shop/tote.jpg", desc: "กระเป๋าผ้าทอมือโทนธรรมชาติ ทนทาน ใส่ของได้เยอะ ใช้งานได้ทุกวัน", colors: ["น้ำตาลธรรมชาติ", "ครีม"], sizes: ["S", "M"] },
  { id: "rattan-bag", name: "Rattan Handbag", nameTh: "กระเป๋าหวายสาน", category: "กระเป๋า", price: 1290, image: "/images/handmade-shop/rattan-bag.jpg", desc: "กระเป๋าถือสานจากหวายทีละเส้นด้วยมือ ฝาหนังแท้ สายสะพายถอดได้", colors: ["ส้มอิฐ", "ธรรมชาติ"], sizes: ["S", "M"] },
  { id: "rug", name: "Woven Rug", nameTh: "พรมทอมือ", category: "ผ้า", price: 1850, image: "/images/handmade-shop/rug.jpg", desc: "พรมทอมือลายเปอร์เซียคลาสสิกสีแดงเข้ม ปลายผ้าถักเป็นพู่ ผืนหนานุ่มเดินสบายเท้า", colors: ["แดงเข้ม", "กรมท่า"], sizes: ["60x90 ซม.", "90x150 ซม."] },
  { id: "mug", name: "Stoneware Mug", nameTh: "แก้วเซรามิกปั้นมือ", category: "เซรามิก", price: 320, image: "/images/handmade-shop/mug.jpg", desc: "แก้วสโตนแวร์เคลือบด้าน จุ 280 มล. ใช้ได้กับไมโครเวฟและเครื่องล้างจาน", colors: ["น้ำตาลเข้ม", "ขาวนวล"], sizes: ["280 มล."] },
  { id: "bowl", name: "Glazed Stoneware Bowl", nameTh: "ชามเซรามิกเคลือบน้ำตาลทอง", category: "เซรามิก", price: 680, image: "/images/handmade-shop/bowls.jpg", desc: "ชามขึ้นรูปด้วยมือ เคลือบเงาไล่สีน้ำตาลทอง ลายเคลือบไม่ซ้ำกันสักใบ", colors: ["น้ำตาลทอง", "เทาเข้ม"], sizes: ["ใบเล็ก", "ใบใหญ่"] },
  { id: "cups", name: "Stoneware Cup & Saucer", nameTh: "ถ้วยพร้อมจานรองเซรามิก", category: "เซรามิก", price: 540, image: "/images/handmade-shop/cups.jpg", desc: "ถ้วยเซรามิกดินลายจุดเคลือบสองสี เหมาะกับชา เอสเปรสโซ และของหวาน", colors: ["ครีมลายจุด", "ขาวนวล"], sizes: ["1 ชุด", "ชุด 2 ใบ"] },
  { id: "vase", name: "Stoneware Bud Vase", nameTh: "แจกันเซรามิกทรงขวด", category: "เซรามิก", price: 460, image: "/images/handmade-shop/vase.jpg", desc: "แจกันสโตนแวร์ทรงขวด พื้นผิวหยาบแบบธรรมชาติ เหมาะกับดอกไม้แห้งและกิ่งไม้", colors: ["ขาวหิน", "เทาอ่อน"], sizes: ["สูง 15 ซม.", "สูง 22 ซม."] },
  { id: "candle", name: "Soy Candle", nameTh: "เทียนหอมถั่วเหลือง", category: "เทียนหอม", price: 390, image: "/images/handmade-shop/candle.jpg", desc: "เทียนหอมจากแว็กซ์ถั่วเหลืองธรรมชาติ ไส้เทียนฝ้าย เผาไหม้ได้ราว 40 ชั่วโมง", colors: ["ตะไคร้", "ดอกพุดซ้อน", "ไม้จันทน์"], sizes: ["100 g", "200 g"] },
];

let ready = false;

// Orders created before the payment kit stored slip fields inline; that demo data is dropped once.
function dropLegacyTables(d: DatabaseSync) {
  const cols = d.prepare("PRAGMA table_info(handmade_shop_orders)").all() as { name: string }[];
  if (cols.length === 0 || cols.some((c) => c.name === "intent_id")) return;
  d.exec("DROP TABLE IF EXISTS handmade_shop_order_items; DROP TABLE IF EXISTS handmade_shop_orders; DROP TABLE IF EXISTS handmade_shop_webhook_events;");
}

function ensure(): DatabaseSync {
  const d = db();
  if (ready) return d;
  dropLegacyTables(d);
  d.exec(`
    CREATE TABLE IF NOT EXISTS handmade_shop_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_th TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS handmade_shop_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES handmade_shop_products(id),
      color TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      UNIQUE (product_id, color, size)
    );
    CREATE TABLE IF NOT EXISTS handmade_shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
      subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      paid_at TEXT,
      shipped_at TEXT,
      phone TEXT,
      intent_id TEXT
    );
    CREATE TABLE IF NOT EXISTS handmade_shop_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES handmade_shop_orders(id),
      variant_id INTEGER NOT NULL REFERENCES handmade_shop_variants(id),
      qty INTEGER NOT NULL CHECK (qty > 0),
      unit_price INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS handmade_shop_webhook_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      order_id INTEGER,
      http_status INTEGER NOT NULL,
      result TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const count = d.prepare("SELECT COUNT(*) AS n FROM handmade_shop_products").get() as { n: number };
  if (count.n === 0) {
    tx((t) => {
      const addProduct = t.prepare(
        "INSERT INTO handmade_shop_products (id, name, name_th, category, price, image, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      const addVariant = t.prepare(
        "INSERT INTO handmade_shop_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)",
      );
      SEED.forEach((p, pi) => {
        addProduct.run(p.id, p.name, p.nameTh, p.category, p.price, p.image, p.desc, pi);
        p.colors.forEach((c, ci) =>
          p.sizes.forEach((s, si) => addVariant.run(p.id, c, s, 3 + ((pi * 5 + ci * 3 + si * 2) % 6))),
        );
      });
    });
  }
  const orderCols = d.prepare("PRAGMA table_info(handmade_shop_orders)").all() as { name: string }[];
  if (!orderCols.some((c) => c.name === "order_key_hash")) d.exec("ALTER TABLE handmade_shop_orders ADD COLUMN order_key_hash TEXT");
  // Orders that predate per-order keys get an unknowable hash: only admins can see them.
  d.exec("UPDATE handmade_shop_orders SET order_key_hash = lower(hex(randomblob(32))) WHERE order_key_hash IS NULL");
  getPayee(SCOPE, PAYEE_NAME); // creates the kit tables and seeds the sample payee under this shop's name
  ready = true;
  return d;
}

// Marks open orders' expired intents as expired; the order itself stays open and can be re-issued a fresh QR.
function expireStale(d: DatabaseSync) {
  expireIntents(SCOPE, d);
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function keyMatches(storedHash: string | null, key: unknown): boolean {
  if (typeof key !== "string" || key.length === 0 || key.length > 100 || !storedHash) return false;
  const a = Buffer.from(hashKey(key));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Customer-facing authorisation: the per-order key is returned once at creation and never listed again.
export function assertOrderKey(code: string, key: unknown) {
  const d = ensure();
  const id = parseOrderCode(code);
  const row = id ? (d.prepare("SELECT order_key_hash FROM handmade_shop_orders WHERE id = ?").get(id) as { order_key_hash: string | null } | undefined) : undefined;
  if (!row || !keyMatches(row.order_key_hash, key)) throw new ShopError(403, "Invalid order key", "forbidden");
}

// Authorises access to a payment intent through the key of the order it belongs to.
export function assertIntentKey(intentId: string, key: unknown) {
  ensure();
  let refId: string;
  try {
    refId = getIntent(SCOPE, intentId).refId;
  } catch {
    throw new ShopError(403, "Invalid order key", "forbidden");
  }
  assertOrderKey(refId, key);
}

export const orderCode = (id: number) => `BC-${1000 + id}`;

function parseOrderCode(code: unknown): number | null {
  if (typeof code !== "string") return null;
  const m = /^BC-(\d+)$/.exec(code);
  if (!m) return null;
  const id = Number(m[1]) - 1000;
  return Number.isInteger(id) && id > 0 ? id : null;
}

type ProductRow = { id: string; name: string; name_th: string; category: string; price: number; image: string; description: string };
type VariantRow = { id: number; product_id: string; color: string; size: string; stock: number };

export function listCatalog() {
  const d = ensure();
  const products = d.prepare("SELECT * FROM handmade_shop_products ORDER BY sort_order").all() as ProductRow[];
  const variants = d.prepare("SELECT * FROM handmade_shop_variants ORDER BY id").all() as VariantRow[];
  return {
    shipping: { fee: SHIPPING_FEE, freeOver: FREE_SHIPPING_OVER },
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      nameTh: p.name_th,
      category: p.category,
      price: p.price,
      image: p.image,
      desc: p.description,
      variants: variants
        .filter((v) => v.product_id === p.id)
        .map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock })),
    })),
  };
}

export type NewOrderInput = { name: string; address: string; phone: string; items: { variantId: number; qty: number }[] };

export function createOrder(input: NewOrderInput) {
  ensure();
  const orderKey = randomBytes(16).toString("base64url");
  const id = tx((t) => {
    expireStale(t);
    const merged = new Map<number, number>();
    for (const it of input.items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.qty);

    const lookup = t.prepare(
      `SELECT v.id, v.stock, v.color, v.size, p.price, p.name_th
       FROM handmade_shop_variants v JOIN handmade_shop_products p ON p.id = v.product_id WHERE v.id = ?`,
    );
    type Row = { id: number; stock: number; color: string; size: string; price: number; name_th: string };
    const lines: { row: Row; qty: number }[] = [];
    const shortages: { variantId: number; product: string; requested: number; available: number }[] = [];
    for (const [variantId, qty] of merged) {
      const row = lookup.get(variantId) as Row | undefined;
      if (!row) throw new ShopError(400, `Unknown variant ${variantId}`, "unknown_variant");
      if (qty > row.stock) {
        shortages.push({ variantId, product: `${row.name_th} (${row.color} / ${row.size})`, requested: qty, available: row.stock });
      }
      lines.push({ row, qty });
    }
    if (shortages.length) throw new ShopError(409, "Insufficient stock", "insufficient_stock", shortages);

    const subtotal = lines.reduce((n, l) => n + l.row.price * l.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
    const res = t
      .prepare(
        "INSERT INTO handmade_shop_orders (customer_name, address, phone, status, subtotal, shipping, total, order_key_hash) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
      )
      .run(input.name, input.address, input.phone, subtotal, shipping, subtotal + shipping, hashKey(orderKey));
    const orderId = Number(res.lastInsertRowid);
    const intent = createIntent(SCOPE, { refType: "order", refId: orderCode(orderId), baseAmount: subtotal + shipping, windowMs: PAYMENT_WINDOW_MS, referencePrefix: "BC" }, t);
    t.prepare("UPDATE handmade_shop_orders SET intent_id = ? WHERE id = ?").run(intent.intentId, orderId);
    const addItem = t.prepare(
      "INSERT INTO handmade_shop_order_items (order_id, variant_id, qty, unit_price) VALUES (?, ?, ?, ?)",
    );
    for (const l of lines) addItem.run(orderId, l.row.id, l.qty, l.row.price);
    return orderId;
  });
  return { order: getOrder(id, "customer")!, orderKey };
}

// Payment fields live on the order's QR payment intent.
const ORDER_SELECT = `
  SELECT o.*, i.payable_amount_satang AS pay_amount_satang, i.reference AS reference, i.expires_at AS expires_at,
         i.status AS intent_status, i.paid_via AS paid_via, i.trans_ref AS slip_trans_ref, i.sandbox AS slip_sandbox
  FROM handmade_shop_orders o JOIN qrpay_intents i ON i.id = o.intent_id`;

type OrderRow = {
  id: number; order_key_hash: string | null; customer_name: string; address: string; status: OrderStatus;
  subtotal: number; shipping: number; total: number; created_at: string; paid_at: string | null; shipped_at: string | null;
  phone: string | null; intent_id: string; pay_amount_satang: number; reference: string; expires_at: number;
  intent_status: "pending" | "paid" | "expired" | "cancelled"; paid_via: "webhook" | "slip" | "manual" | null;
  slip_trans_ref: string | null; slip_sandbox: number | null;
};
type ItemRow = { order_id: number; variant_id: number; qty: number; unit_price: number; name_th: string; image: string; color: string; size: string };

function hydrate(d: DatabaseSync, orders: OrderRow[], audience: "admin" | "customer") {
  if (orders.length === 0) return [];
  const items = d
    .prepare(
      `SELECT i.order_id, i.variant_id, i.qty, i.unit_price, p.name_th, p.image, v.color, v.size
       FROM handmade_shop_order_items i
       JOIN handmade_shop_variants v ON v.id = i.variant_id
       JOIN handmade_shop_products p ON p.id = v.product_id
       ORDER BY i.id`,
    )
    .all() as ItemRow[];
  const events = d
    .prepare("SELECT event_id, type, order_id, http_status, result, received_at FROM handmade_shop_webhook_events WHERE order_id IS NOT NULL ORDER BY received_at, rowid")
    .all() as { event_id: string; type: string; order_id: number; http_status: number; result: string; received_at: string }[];
  const now = Date.now();
  const admin = audience === "admin";
  return orders.map((o) => ({
    id: orderCode(o.id),
    intentId: o.intent_id, // the payer's own order only; customers never receive other orders
    intentStatus: o.intent_status,
    name: o.customer_name,
    ...(admin ? { address: o.address } : {}),
    status: o.status,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    payAmount: o.pay_amount_satang / 100,
    reference: o.reference,
    expiresAt: o.expires_at,
    serverNow: now,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    paidVia: o.paid_via,
    phoneMasked: o.phone ? `${o.phone.slice(0, 3)}-xxx-${o.phone.slice(-4)}` : null,
    slip: o.slip_trans_ref ? { ...(admin ? { transRef: o.slip_trans_ref } : {}), sandbox: o.slip_sandbox === 1 } : null,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((i) => ({ variantId: i.variant_id, name: i.name_th, image: i.image, color: i.color, size: i.size, qty: i.qty, unitPrice: i.unit_price })),
    events: events
      .filter((e) => e.order_id === o.id)
      .map((e) => ({ eventId: e.event_id, type: e.type, httpStatus: e.http_status, result: e.result, receivedAt: e.received_at })),
  }));
}

// Admin only: every order with full details.
export function listOrders() {
  const d = ensure();
  expireStale(d);
  return hydrate(d, d.prepare(`${ORDER_SELECT} ORDER BY o.id DESC`).all() as OrderRow[], "admin");
}

// Customer view of the orders whose id+key pairs are presented; anything that does not verify is silently omitted.
export function listOrdersForCustomer(creds: { id: string; key: string }[]) {
  const d = ensure();
  expireStale(d);
  const get = d.prepare(`${ORDER_SELECT} WHERE o.id = ?`);
  const rows: OrderRow[] = [];
  for (const c of creds) {
    const id = parseOrderCode(c.id);
    const row = id ? (get.get(id) as OrderRow | undefined) : undefined;
    if (row && keyMatches(row.order_key_hash, c.key)) rows.push(row);
  }
  rows.sort((a, b) => b.id - a.id);
  return hydrate(d, rows, "customer");
}

function getOrder(id: number, audience: "admin" | "customer") {
  const d = ensure();
  expireStale(d);
  return hydrate(d, d.prepare(`${ORDER_SELECT} WHERE o.id = ?`).all(id) as OrderRow[], audience)[0] ?? null;
}

// onPaid hook for the payment kit: runs inside the kit's transaction, once per paid intent.
// Decrements stock exactly once; cancels the order (and asks for a refund) when stock ran out before the money arrived.
const settleOrder: OnPaid = ({ refId, via, intent }, t) => {
  const id = parseOrderCode(refId);
  const order = id ? (t.prepare("SELECT id, status FROM handmade_shop_orders WHERE id = ?").get(id) as { id: number; status: OrderStatus } | undefined) : undefined;
  // Never throw after money arrived: park it for a refund instead.
  if (!order) return { cancelled: true, reason: "order_not_found", message: "ไม่พบคำสั่งซื้อ (ร้านจะคืนเงินให้)" };
  if (order.status !== "pending") return { cancelled: true, reason: "not_payable", message: `คำสั่งซื้อ${order.status === "paid" || order.status === "shipped" ? "ชำระแล้ว" : "ถูกปิดแล้ว"} ร้านจะคืนเงินที่ซ้ำให้` };
  // A late payment on an older QR can settle the order while a re-issued QR is still pending; close the rest.
  t.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE scope = ? AND ref_type = 'order' AND ref_id = ? AND status = 'pending' AND id != ?").run(SCOPE, orderCode(order.id), intent.id);
  const record = (result: string) =>
    t.prepare("INSERT OR IGNORE INTO handmade_shop_webhook_events (event_id, type, order_id, http_status, result) VALUES (?, ?, ?, 200, ?)")
      .run(`evt_pay_${orderCode(order.id)}`, `payment.${via}`, order.id, result);

  const items = t.prepare("SELECT variant_id, qty FROM handmade_shop_order_items WHERE order_id = ?").all(order.id) as { variant_id: number; qty: number }[];
  const stockOf = t.prepare("SELECT stock FROM handmade_shop_variants WHERE id = ?");
  if (items.some((i) => (stockOf.get(i.variant_id) as { stock: number }).stock < i.qty)) {
    t.prepare("UPDATE handmade_shop_orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    record("cancelled: stock ran out before payment settled");
    return { cancelled: true, reason: "stock_insufficient", message: "สต็อกหมดก่อนยืนยันการชำระเงิน คำสั่งซื้อถูกยกเลิก (ร้านจะคืนเงินให้)" };
  }
  const dec = t.prepare("UPDATE handmade_shop_variants SET stock = stock - ? WHERE id = ?");
  for (const i of items) dec.run(i.qty, i.variant_id);
  t.prepare("UPDATE handmade_shop_orders SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(order.id);
  record(`paid: ${via}, stock decremented`);
};

// Mounted by app/api/handmade-shop/qrpay/[...path]/route.ts.
export const qrpay: QrRouteConfig = { scope: SCOPE, onPaid: settleOrder, defaultPayeeName: PAYEE_NAME };

// An unpaid order stays open after its QR expires; this issues a fresh intent (new unique amount) for it.
export function renewPayment(code: string, key: unknown) {
  ensure();
  assertOrderKey(code, key);
  tx((t) => {
    expireStale(t);
    const id = parseOrderCode(code);
    const row = id
      ? (t.prepare("SELECT o.id, o.status, o.total, i.status AS intent_status FROM handmade_shop_orders o JOIN qrpay_intents i ON i.id = o.intent_id WHERE o.id = ?").get(id) as
          | { id: number; status: OrderStatus; total: number; intent_status: string } | undefined)
      : undefined;
    if (!row) throw new ShopError(404, "Order not found", "not_found");
    if (row.status !== "pending") throw new ShopError(409, `Order is already ${row.status}`, "not_payable");
    if (row.intent_status === "pending") return;
    const intent = createIntent(SCOPE, { refType: "order", refId: orderCode(row.id), baseAmount: row.total, windowMs: PAYMENT_WINDOW_MS, referencePrefix: "BC" }, t);
    t.prepare("UPDATE handmade_shop_orders SET intent_id = ? WHERE id = ?").run(intent.intentId, row.id);
  });
  return getOrder(parseOrderCode(code)!, "customer")!;
}

// Admin action. Idempotent by event id (derived from the order): a repeat returns the stored outcome.
export function shipOrder(code: string) {
  ensure();
  return tx((t) => {
    const orderId = parseOrderCode(code);
    const order = orderId ? (t.prepare("SELECT * FROM handmade_shop_orders WHERE id = ?").get(orderId) as OrderRow | undefined) : undefined;
    if (!order) throw new ShopError(404, "Order not found", "not_found");
    const eventId = `evt_ship_${orderCode(order.id)}`;
    const prior = t.prepare("SELECT http_status, result FROM handmade_shop_webhook_events WHERE event_id = ?").get(eventId) as { http_status: number; result: string } | undefined;
    if (prior) return { status: prior.http_status, duplicate: true, result: prior.result };

    const record = (status: number, result: string) => {
      if (status === 200) {
        t.prepare("INSERT INTO handmade_shop_webhook_events (event_id, type, order_id, http_status, result) VALUES (?, 'order.shipped', ?, ?, ?)").run(eventId, order.id, status, result);
      }
      return { status, duplicate: false, result };
    };
    if (order.status !== "paid") return record(409, `ignored: order is ${order.status}`);
    t.prepare("UPDATE handmade_shop_orders SET status = 'shipped', shipped_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(order.id);
    return record(200, "shipped");
  });
}

export function adminStock() {
  const d = ensure();
  expireStale(d);
  const rows = d
    .prepare(
      `SELECT v.id, v.color, v.size, v.stock, p.id AS product_id, p.name_th, p.image
       FROM handmade_shop_variants v JOIN handmade_shop_products p ON p.id = v.product_id
       ORDER BY p.sort_order, v.id`,
    )
    .all() as { id: number; color: string; size: string; stock: number; product_id: string; name_th: string; image: string }[];
  const stats = d
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped') THEN total END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 END), 0) AS pending
       FROM handmade_shop_orders`,
    )
    .get() as { orders: number; revenue: number; pending: number };
  return {
    totalStock: rows.reduce((n, r) => n + r.stock, 0),
    orders: stats.orders,
    pendingOrders: stats.pending,
    revenue: stats.revenue,
    variants: rows.map((r) => ({ id: r.id, productId: r.product_id, name: r.name_th, image: r.image, color: r.color, size: r.size, stock: r.stock })),
  };
}
