import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, tx } from "@/lib/db";
import { createIntent, expireStale as expireIntents, getPayee, QrPayError as ShopError, qrErrorResponse as errorResponse, requireDemoAdmin as requireAdmin, type OnPaid } from "@/lib/qr-payments";
import type { QrRouteConfig } from "@/lib/qr-route-handlers";

export const SHIPPING_FEE = 60;
export const FREE_SHIPPING_OVER = 2000;
export const PAYMENT_WINDOW_MS = 15 * 60_000;

const SCOPE = "fashion-store";
const PAYEE_NAME = "ร้าน Linen & Co. (ตัวอย่าง)";

export { ShopError, errorResponse, requireAdmin };

export type OrderStatus = "pending_payment" | "paid" | "shipped" | "expired" | "cancelled";

type SeedColor = { name: string; hex: string };
type SeedProduct = { id: string; name: string; nameTh: string; category: string; price: number; image: string; desc: string; colors: SeedColor[] };

const SIZES = ["XS", "S", "M", "L", "XL"];

const SEED: SeedProduct[] = [
  { id: "linen-shirt", name: "Relaxed Linen Shirt", nameTh: "เสื้อเชิ้ตลินินทรงโอเวอร์ไซซ์", category: "เสื้อ", price: 1290, image: "/images/fashion-store/linen-shirt.jpg", desc: "เสื้อเชิ้ตลินิน 100% คอจีน ทรงหลวม พับแขนได้ ใส่เย็นสบายในอากาศร้อน", colors: [{ name: "ขาว", hex: "#f5f5f4" }, { name: "ครีม", hex: "#e7dcc8" }, { name: "ฟ้าอ่อน", hex: "#bcd2e2" }] },
  { id: "melange-tee", name: "Melange Cotton Tee", nameTh: "เสื้อยืดคอตตอนเมลานจ์", category: "เสื้อ", price: 590, image: "/images/fashion-store/tee.jpg", desc: "เสื้อยืดคอกลมผ้าคอตตอนเนื้อนุ่มทอเมลานจ์ ซักแล้วไม่ยืด ใส่ได้ทุกวัน", colors: [{ name: "ฟ้าเมลานจ์", hex: "#a9bdd4" }, { name: "เทา", hex: "#a8a29e" }, { name: "ขาว", hex: "#fafafa" }] },
  { id: "knit-sweater", name: "Chunky Knit Sweater", nameTh: "สเวตเตอร์ไหมพรมถักหนา", category: "เสื้อ", price: 1590, image: "/images/fashion-store/knit-sweater.jpg", desc: "สเวตเตอร์ถักลายโปร่งสีครีมจุดสี แขนล้ำ ทรงสบาย เหมาะกับห้องแอร์และหน้าหนาว", colors: [{ name: "ครีมจุดสี", hex: "#e8dcc6" }, { name: "เบจ", hex: "#cdb79e" }] },
  { id: "print-midi", name: "Printed Midi Dress", nameTh: "เดรสยาวลายพิมพ์ปาดไหล่", category: "เดรส", price: 1890, image: "/images/fashion-store/maxi-dress.jpg", desc: "เดรสความยาวมิดิ คอระบายปาดไหล่ ผูกเอวได้ ผ้าเบาพลิ้ว เหมาะกับทริปทะเลและคาเฟ่", colors: [{ name: "ขาวลายเพสลีย์", hex: "#e5e7eb" }, { name: "ครีมลายดอก", hex: "#eadfca" }] },
  { id: "floral-wrap", name: "Floral Midi Dress", nameTh: "เดรสลายดอกไม้พื้นกรมท่า", category: "เดรส", price: 1490, image: "/images/fashion-store/wrap-dress.jpg", desc: "เดรสแขนสั้นลายดอกไม้เล็กบนพื้นสีกรมท่า ผ้านุ่ม ใส่สบาย", colors: [{ name: "กรมท่าลายดอก", hex: "#26304f" }, { name: "ครีมลายดอก", hex: "#e6d9c2" }, { name: "ชมพูอ่อน", hex: "#efc9cf" }] },
  { id: "wide-trousers", name: "Wide-Leg Trousers", nameTh: "กางเกงขากว้างเอวสม็อค", category: "กางเกง", price: 1290, image: "/images/fashion-store/wide-trousers.jpg", desc: "กางเกงขากว้างเอวสูง เอวยางยืดมีเชือกผูก ผ้าทิ้งตัว สวมใส่สบาย", colors: [{ name: "เขียวมอส", hex: "#4d6a3a" }, { name: "ดำ", hex: "#1c1917" }, { name: "เบจ", hex: "#d6c7ae" }] },
  { id: "linen-pants", name: "Drawstring Linen Pants", nameTh: "กางเกงลินินเอวผูก", category: "กางเกง", price: 1190, image: "/images/fashion-store/linen-pants.jpg", desc: "กางเกงลินินทรงเรียว ขา 8 ส่วน เอวยางยืดผูกโบว์ มีกระเป๋าข้าง", colors: [{ name: "เหลืองมัสตาร์ด", hex: "#d6a436" }, { name: "ขาว", hex: "#f5f5f4" }] },
  { id: "light-jeans", name: "Light-Wash Jeans", nameTh: "ยีนส์ฟอกอ่อนทรงตรง", category: "กางเกง", price: 1690, image: "/images/fashion-store/denim-jeans.jpg", desc: "ยีนส์ทรงตรงเอวสูง ฟอกอ่อนมีรอยขาดเล็กน้อย ผ้าเดนิมหนากำลังดี", colors: [{ name: "ฟ้าอ่อน", hex: "#9fbad3" }, { name: "ฟ้าเข้ม", hex: "#3b5878" }] },
  { id: "trench-coat", name: "Belted Trench Coat", nameTh: "เทรนช์โค้ทผูกเอว", category: "เสื้อคลุม", price: 3290, image: "/images/fashion-store/trench-coat.jpg", desc: "เทรนช์โค้ทผ้าทวิลสีชมพูพาสเทล ปกคู่ สายคาดเอว ปรับข้อมือได้ ใส่ทับได้ทุกชุด", colors: [{ name: "ชมพูพาสเทล", hex: "#e3b5b0" }, { name: "เบจ", hex: "#cdb88f" }, { name: "กากี", hex: "#8a7f5a" }] },
  { id: "check-blazer", name: "Tailored Blazer", nameTh: "เบลเซอร์ทรงสูทสีกรมท่า", category: "เสื้อคลุม", price: 2890, image: "/images/fashion-store/blazer.jpg", desc: "เบลเซอร์ทรงโอเวอร์ไซซ์ สีกรมท่า ใส่คู่เสื้อเชิ้ตและเนกไท แพดไหล่บาง ตัดเย็บเรียบร้อย", colors: [{ name: "กรมท่า", hex: "#1e2a44" }, { name: "ดำ", hex: "#1c1917" }] },
  { id: "denim-jacket", name: "Corduroy-Collar Denim Jacket", nameTh: "แจ็คเก็ตยีนส์คอลูกฟูก", category: "เสื้อคลุม", price: 2190, image: "/images/fashion-store/denim-jacket.jpg", desc: "แจ็คเก็ตเดนิมสีกรมเข้ม คอผ้าลูกฟูกสีน้ำตาล บุซับในผ้าสก๊อต", colors: [{ name: "กรมเข้ม", hex: "#1f2f4d" }] },
  { id: "chunky-cardigan", name: "Long Knit Cardigan", nameTh: "คาร์ดิแกนยาวถักเนื้อนุ่ม", category: "เสื้อคลุม", price: 1790, image: "/images/fashion-store/cardigan.jpg", desc: "คาร์ดิแกนทรงยาวถักเนื้อนุ่ม ไม่มีกระดุม คลุมได้ทุกชุด สีเทาอ่อน", colors: [{ name: "เทาอ่อน", hex: "#b8bcc4" }, { name: "ครีม", hex: "#e8dcc6" }] },
];

let ready = false;

// Orders created before the payment kit stored the payment fields inline; that demo data is dropped once.
function dropLegacyTables(d: DatabaseSync) {
  const cols = d.prepare("PRAGMA table_info(fashion_store_orders)").all() as { name: string }[];
  if (cols.length === 0 || cols.some((c) => c.name === "intent_id")) return;
  d.exec(`
    DROP TABLE IF EXISTS fashion_store_order_items; DROP TABLE IF EXISTS fashion_store_orders;
    DROP TABLE IF EXISTS fashion_store_webhook_events; DROP TABLE IF EXISTS fashion_store_unmatched_payments; DROP TABLE IF EXISTS fashion_store_settings;
  `);
}

function ensure(): DatabaseSync {
  const d = db();
  if (ready) return d;
  dropLegacyTables(d);
  d.exec(`
    CREATE TABLE IF NOT EXISTS fashion_store_products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_th TEXT NOT NULL, category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0), image TEXT NOT NULL, description TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fashion_store_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES fashion_store_products(id),
      color TEXT NOT NULL, color_hex TEXT NOT NULL, size TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      UNIQUE (product_id, color, size)
    );
    CREATE TABLE IF NOT EXISTS fashion_store_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'shipped', 'expired', 'cancelled')),
      subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
      intent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      paid_at TEXT, shipped_at TEXT, note TEXT
    );
    CREATE TABLE IF NOT EXISTS fashion_store_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES fashion_store_orders(id),
      variant_id INTEGER NOT NULL REFERENCES fashion_store_variants(id),
      qty INTEGER NOT NULL CHECK (qty > 0), unit_price INTEGER NOT NULL
    );
  `);

  const orderCols = d.prepare("PRAGMA table_info(fashion_store_orders)").all() as { name: string }[];
  if (!orderCols.some((c) => c.name === "access_key_hash")) d.exec("ALTER TABLE fashion_store_orders ADD COLUMN access_key_hash TEXT");
  // Pre-existing orders get a random hash nobody holds, so only admins can see them.
  d.exec("UPDATE fashion_store_orders SET access_key_hash = hex(randomblob(32)) WHERE access_key_hash IS NULL");

  const count = d.prepare("SELECT COUNT(*) AS n FROM fashion_store_products").get() as { n: number };
  if (count.n === 0) {
    tx((t) => {
      const addProduct = t.prepare("INSERT INTO fashion_store_products (id, name, name_th, category, price, image, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const addVariant = t.prepare("INSERT INTO fashion_store_variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)");
      SEED.forEach((p, pi) => {
        addProduct.run(p.id, p.name, p.nameTh, p.category, p.price, p.image, p.desc, pi);
        p.colors.forEach((c, ci) =>
          SIZES.forEach((s, si) => {
            const stock = ci === 0 && s === "M" ? 6 : (pi * 7 + ci * 5 + si * 3) % 7;
            addVariant.run(p.id, c.name, c.hex, s, stock);
          }),
        );
      });
    });
  }
  getPayee(SCOPE, PAYEE_NAME); // creates the kit tables and seeds the sample payee under this shop's name
  ready = true;
  return d;
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function keyMatches(stored: string | null, presented: string): boolean {
  if (!stored) return false;
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(hashKey(presented), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const orderCode = (id: number) => `LC-${1000 + id}`;

function parseOrderCode(code: unknown): number | null {
  if (typeof code !== "string") return null;
  const m = /^LC-(\d+)$/.exec(code);
  const id = m ? Number(m[1]) - 1000 : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Marks pending orders past their payment deadline as expired. Called at the start of every read/write.
function expireStale(d: DatabaseSync) {
  expireIntents(SCOPE, d);
  d.prepare(
    "UPDATE fashion_store_orders SET status = 'expired' WHERE status = 'pending_payment' AND intent_id IN (SELECT id FROM qrpay_intents WHERE scope = ? AND status = 'expired')",
  ).run(SCOPE);
}

// ---------- catalog ----------

type ProductRow = { id: string; name: string; name_th: string; category: string; price: number; image: string; description: string };
type VariantRow = { id: number; product_id: string; color: string; color_hex: string; size: string; stock: number };

export function listCatalog() {
  const d = ensure();
  const products = d.prepare("SELECT * FROM fashion_store_products ORDER BY sort_order").all() as ProductRow[];
  const variants = d.prepare("SELECT * FROM fashion_store_variants ORDER BY id").all() as VariantRow[];
  return {
    shipping: { fee: SHIPPING_FEE, freeOver: FREE_SHIPPING_OVER },
    products: products.map((p) => ({
      id: p.id, name: p.name, nameTh: p.name_th, category: p.category, price: p.price, image: p.image, desc: p.description,
      variants: variants.filter((v) => v.product_id === p.id).map((v) => ({ id: v.id, color: v.color, colorHex: v.color_hex, size: v.size, stock: v.stock })),
    })),
  };
}

// ---------- orders ----------

// Payment fields live on the order's QR payment intent; joined in under their old column names.
const ORDER_SELECT = `
  SELECT o.*, i.payable_amount_satang AS pay_amount_satang, i.reference AS reference, i.expires_at AS expires_at, i.paid_via AS paid_via,
         i.event_id AS payment_event_id, i.provider AS payment_provider, i.trans_ref AS slip_trans_ref, i.sandbox AS slip_sandbox
  FROM fashion_store_orders o JOIN qrpay_intents i ON i.id = o.intent_id`;

type OrderRow = {
  id: number; customer_name: string; phone: string; address: string; status: OrderStatus; access_key_hash: string | null;
  subtotal: number; shipping: number; total: number; intent_id: string; pay_amount_satang: number; reference: string; expires_at: number;
  created_at: string; paid_at: string | null; shipped_at: string | null; paid_via: "webhook" | "slip" | "manual" | null;
  payment_event_id: string | null; payment_provider: string | null; slip_trans_ref: string | null; slip_sandbox: number | null; note: string | null;
};
type ItemRow = { order_id: number; variant_id: number; qty: number; unit_price: number; name_th: string; image: string; color: string; size: string };

export type NewOrderInput = { name: string; address: string; phone: string; items: { variantId: number; qty: number }[] };

export function createOrder(input: NewOrderInput) {
  ensure();
  const accessKey = randomBytes(16).toString("base64url");
  const id = tx((t) => {
    expireStale(t);
    const merged = new Map<number, number>();
    for (const it of input.items) merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.qty);

    const lookup = t.prepare(
      `SELECT v.id, v.stock, v.color, v.size, p.price, p.name_th
       FROM fashion_store_variants v JOIN fashion_store_products p ON p.id = v.product_id WHERE v.id = ?`,
    );
    type Row = { id: number; stock: number; color: string; size: string; price: number; name_th: string };
    const lines: { row: Row; qty: number }[] = [];
    const shortages: { variantId: number; product: string; requested: number; available: number }[] = [];
    for (const [variantId, qty] of merged) {
      const row = lookup.get(variantId) as Row | undefined;
      if (!row) throw new ShopError(400, `Unknown variant ${variantId}`, "unknown_variant");
      if (qty > row.stock) shortages.push({ variantId, product: `${row.name_th} (${row.color} / ${row.size})`, requested: qty, available: row.stock });
      lines.push({ row, qty });
    }
    if (shortages.length) throw new ShopError(409, "สต็อกไม่เพียงพอ", "insufficient_stock", shortages);

    const subtotal = lines.reduce((n, l) => n + l.row.price * l.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;

    const res = t
      .prepare(
        `INSERT INTO fashion_store_orders (customer_name, phone, address, status, subtotal, shipping, total, access_key_hash)
         VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?)`,
      )
      .run(input.name, input.phone, input.address, subtotal, shipping, total, hashKey(accessKey));
    const orderId = Number(res.lastInsertRowid);
    const intent = createIntent(SCOPE, { refType: "order", refId: orderCode(orderId), baseAmount: total, windowMs: PAYMENT_WINDOW_MS, referencePrefix: "LC" }, t);
    t.prepare("UPDATE fashion_store_orders SET intent_id = ? WHERE id = ?").run(intent.intentId, orderId);
    const addItem = t.prepare("INSERT INTO fashion_store_order_items (order_id, variant_id, qty, unit_price) VALUES (?, ?, ?, ?)");
    for (const l of lines) addItem.run(orderId, l.row.id, l.qty, l.row.price);
    return orderId;
  });
  // The key is returned only here; the server keeps just its hash.
  return { ...getOrderRow(orderCode(id)), accessKey };
}

function hydrate(d: DatabaseSync, orders: OrderRow[], admin: boolean) {
  if (orders.length === 0) return [];
  const items = d
    .prepare(
      `SELECT i.order_id, i.variant_id, i.qty, i.unit_price, p.name_th, p.image, v.color, v.size
       FROM fashion_store_order_items i
       JOIN fashion_store_variants v ON v.id = i.variant_id
       JOIN fashion_store_products p ON p.id = v.product_id ORDER BY i.id`,
    )
    .all() as ItemRow[];
  const now = Date.now();
  return orders.map((o) => ({
    id: orderCode(o.id),
    intentId: o.intent_id,
    name: o.customer_name,
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
    note: o.note,
    items: items.filter((i) => i.order_id === o.id).map((i) => ({ variantId: i.variant_id, name: i.name_th, image: i.image, color: i.color, size: i.size, qty: i.qty, unitPrice: i.unit_price })),
    ...(admin
      ? { phone: o.phone, address: o.address, paymentEventId: o.payment_event_id, paymentProvider: o.payment_provider, slipTransRef: o.slip_trans_ref, slipSandbox: o.slip_sandbox === 1 }
      : { phoneMasked: `${o.phone.slice(0, 3)}-xxx-${o.phone.slice(-4)}` }),
  }));
}

function loadOrder(code: string): { d: DatabaseSync; row: OrderRow } {
  const d = ensure();
  expireStale(d);
  const id = parseOrderCode(code);
  const row = id ? (d.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) as OrderRow | undefined) : undefined;
  if (!row) throw new ShopError(404, "Order not found", "not_found");
  return { d, row };
}

function getOrderRow(code: string) {
  const { d, row } = loadOrder(code);
  return hydrate(d, [row], false)[0];
}

// Customer read: needs the per-order key issued at creation. Wrong key looks the same as a missing order.
export function getPublicOrder(code: string, key: string | null) {
  if (!key) throw new ShopError(403, "Order key is required", "key_required");
  const { d, row } = loadOrder(code);
  if (!keyMatches(row.access_key_hash, key)) throw new ShopError(404, "Order not found", "not_found");
  return hydrate(d, [row], false)[0];
}

// ---------- settlement ----------

// onPaid hook for the payment kit: runs inside the kit's transaction, once per paid intent.
// Decrements stock exactly once; cancels the order (and asks for a refund) when stock ran out before the money arrived.
const settleOrder: OnPaid = ({ refId, intent }, t) => {
  const id = parseOrderCode(refId);
  const order = id ? (t.prepare("SELECT id, status FROM fashion_store_orders WHERE id = ?").get(id) as { id: number; status: OrderStatus } | undefined) : undefined;
  // Never throw after money arrived: park it for a refund instead.
  if (!order) return { cancelled: true, reason: "order_not_found", message: "ไม่พบออเดอร์ (ร้านจะคืนเงินให้)" };
  // A late payment may still settle an expired order; any other state would double-pay.
  if (order.status !== "pending_payment" && order.status !== "expired") return { cancelled: true, reason: "not_payable", message: `ออเดอร์อยู่สถานะ ${order.status} ร้านจะคืนเงินที่ซ้ำให้` };
  // A late payment on an older QR can settle the order while a re-issued QR is still pending; close the rest.
  t.prepare("UPDATE qrpay_intents SET status = 'cancelled' WHERE scope = ? AND ref_type = 'order' AND ref_id = ? AND status = 'pending' AND id != ?").run(SCOPE, refId, intent.id);

  const items = t.prepare("SELECT variant_id, qty FROM fashion_store_order_items WHERE order_id = ?").all(order.id) as { variant_id: number; qty: number }[];
  const stockOf = t.prepare("SELECT stock FROM fashion_store_variants WHERE id = ?");
  if (items.some((i) => (stockOf.get(i.variant_id) as { stock: number }).stock < i.qty)) {
    t.prepare("UPDATE fashion_store_orders SET status = 'cancelled', note = ? WHERE id = ?").run("ยกเลิก: สต็อกหมดก่อนเงินเข้า ต้องคืนเงินลูกค้า", order.id);
    return { cancelled: true, reason: "stock_insufficient", message: "สต็อกหมดก่อนยืนยันการชำระเงิน ออเดอร์ถูกยกเลิก (ร้านจะคืนเงินให้)" };
  }
  const dec = t.prepare("UPDATE fashion_store_variants SET stock = stock - ? WHERE id = ?");
  for (const i of items) dec.run(i.qty, i.variant_id);
  t.prepare("UPDATE fashion_store_orders SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(order.id);
};

// Mounted by app/api/fashion-store/qrpay/[...path]/route.ts.
export const qrpay: QrRouteConfig = { scope: SCOPE, onPaid: settleOrder, defaultPayeeName: PAYEE_NAME };

// ---------- admin ----------

export function shipOrder(code: string) {
  ensure();
  return tx((t) => {
    const id = parseOrderCode(code);
    const order = id ? (t.prepare("SELECT id, status FROM fashion_store_orders WHERE id = ?").get(id) as { id: number; status: OrderStatus } | undefined) : undefined;
    if (!order) throw new ShopError(404, "Order not found", "not_found");
    if (order.status !== "paid") throw new ShopError(409, `Only paid orders can be shipped (order is ${order.status})`, "not_paid");
    t.prepare("UPDATE fashion_store_orders SET status = 'shipped', shipped_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(order.id);
    return { status: "shipped" as const };
  });
}

export function adminOverview() {
  const d = ensure();
  expireStale(d);
  const orders = hydrate(d, d.prepare(`${ORDER_SELECT} ORDER BY o.id DESC`).all() as OrderRow[], true);
  const variants = d
    .prepare(
      `SELECT v.id, v.color, v.size, v.stock, p.name_th, p.image FROM fashion_store_variants v
       JOIN fashion_store_products p ON p.id = v.product_id ORDER BY p.sort_order, v.id`,
    )
    .all() as { id: number; color: string; size: string; stock: number; name_th: string; image: string }[];
  return {
    stats: {
      orders: orders.length,
      pending: orders.filter((o) => o.status === "pending_payment").length,
      revenue: orders.filter((o) => o.status === "paid" || o.status === "shipped").reduce((n, o) => n + o.payAmount, 0),
      totalStock: variants.reduce((n, v) => n + v.stock, 0),
    },
    orders,
    variants: variants.map((v) => ({ id: v.id, name: v.name_th, image: v.image, color: v.color, size: v.size, stock: v.stock })),
  };
}
