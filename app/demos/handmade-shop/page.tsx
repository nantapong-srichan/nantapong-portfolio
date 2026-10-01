"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DemoShell from "@/components/DemoShell";

const ACCENT = "#15803d";

type Category = "ทั้งหมด" | "ผ้า" | "เซรามิก" | "เทียนหอม";
type Product = {
  id: string;
  name: string;
  nameTh: string;
  category: Exclude<Category, "ทั้งหมด">;
  price: number;
  emoji: string;
  tint: string;
  desc: string;
  colors: string[];
  sizes: string[];
};

const CATEGORIES: Category[] = ["ทั้งหมด", "ผ้า", "เซรามิก", "เทียนหอม"];

const PRODUCTS: Product[] = [
  { id: "tote", name: "Indigo Tote Bag", nameTh: "กระเป๋าผ้าคราม", category: "ผ้า", price: 450, emoji: "👜", tint: "#dbeafe", desc: "กระเป๋าผ้าฝ้ายย้อมครามธรรมชาติ ทอมือโดยกลุ่มแม่บ้านจังหวัดสกลนคร ใช้งานได้ทุกวัน", colors: ["คราม", "ธรรมชาติ"], sizes: ["S", "M"] },
  { id: "scarf", name: "Cotton Scarf", nameTh: "ผ้าพันคอฝ้ายทอมือ", category: "ผ้า", price: 590, emoji: "🧣", tint: "#fde68a", desc: "ผ้าพันคอเนื้อนุ่ม ย้อมสีจากเปลือกไม้และใบไม้ ลายไม่ซ้ำกันทุกผืน", colors: ["เหลืองมะนาว", "เขียวมอส", "แดงอิฐ"], sizes: ["M", "L"] },
  { id: "mug", name: "Stoneware Mug", nameTh: "แก้วเซรามิกปั้นมือ", category: "เซรามิก", price: 320, emoji: "☕", tint: "#fed7aa", desc: "แก้วสโตนแวร์เคลือบด้าน จุ 280 มล. ใช้ได้กับไมโครเวฟและเครื่องล้างจาน", colors: ["ขาวนวล", "เขียวเซลาดอน"], sizes: ["280 มล."] },
  { id: "bowl", name: "Rice Bowl Set", nameTh: "ชามข้าวเซรามิก", category: "เซรามิก", price: 680, emoji: "🍚", tint: "#e7e5e4", desc: "ชามข้าวชุดละ 2 ใบ ขึ้นรูปด้วยมือ เคลือบเงาลายหยดน้ำ", colors: ["ขาวนวล", "น้ำตาลดิน"], sizes: ["4 นิ้ว", "5 นิ้ว"] },
  { id: "candle", name: "Soy Candle", nameTh: "เทียนหอมถั่วเหลือง", category: "เทียนหอม", price: 390, emoji: "🕯️", tint: "#fef3c7", desc: "เทียนหอมจากแว็กซ์ถั่วเหลืองธรรมชาติ ไส้เทียนฝ้าย เผาไหม้ได้ราว 40 ชั่วโมง", colors: ["ตะไคร้", "ดอกพุดซ้อน", "ไม้จันทน์"], sizes: ["100 g", "200 g"] },
  { id: "diffuser", name: "Reed Diffuser", nameTh: "ก้านไม้หอมกระจายกลิ่น", category: "เทียนหอม", price: 520, emoji: "🌿", tint: "#dcfce7", desc: "ก้านไม้หอมในขวดแก้วรีไซเคิล กลิ่นอ่อนละมุน เหมาะกับห้องนอน", colors: ["ตะไคร้", "ดอกพุดซ้อน"], sizes: ["100 มล."] },
];

const variantKey = (pid: string, color: string, size: string) => `${pid}|${color}|${size}`;

function buildInitialStock(): Record<string, number> {
  const stock: Record<string, number> = {};
  PRODUCTS.forEach((p, pi) =>
    p.colors.forEach((c, ci) =>
      p.sizes.forEach((s, si) => {
        stock[variantKey(p.id, c, s)] = 3 + ((pi * 5 + ci * 3 + si * 2) % 6);
      }),
    ),
  );
  return stock;
}

type CartLine = { key: string; pid: string; color: string; size: string; qty: number };
type OrderStatus = "pending" | "paid" | "shipped";
type Order = { id: string; status: OrderStatus; lines: CartLine[]; total: number; name: string; log: string[] };

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const productOf = (id: string) => PRODUCTS.find((p) => p.id === id)!;

const STEPS: { status: OrderStatus; label: string; event: string }[] = [
  { status: "pending", label: "รอชำระเงิน", event: "checkout.session.created" },
  { status: "paid", label: "ชำระเงินแล้ว", event: "checkout.session.completed" },
  { status: "shipped", label: "จัดส่งแล้ว", event: "order.shipped" },
];

type View = "shop" | "checkout" | "order" | "admin";

export default function HandmadeShopPage() {
  const [view, setView] = useState<View>("shop");
  const [category, setCategory] = useState<Category>("ทั้งหมด");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [stock, setStock] = useState<Record<string, number>>(buildInitialStock);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const visible = useMemo(
    () => PRODUCTS.filter((p) => category === "ทั้งหมด" || p.category === category),
    [category],
  );
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((n, l) => n + l.qty * productOf(l.pid).price, 0);
  const shipping = cart.length ? 50 : 0;
  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;

  function addToCart(pid: string, color: string, size: string) {
    const key = variantKey(pid, color, size);
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      const inCart = existing?.qty ?? 0;
      if (inCart >= (stock[key] ?? 0)) return prev;
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, pid, color, size, qty: 1 }];
    });
    setDetail(null);
    setCartOpen(true);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: Math.min(l.qty + delta, stock[key] ?? 0) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function updateOrder(id: string, status: OrderStatus, event: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, log: [...o.log, event] } : o)),
    );
  }

  function placeOrder(name: string) {
    const id = `BC-${String(1001 + orders.length)}`;
    const lines = cart;
    const total = subtotal + shipping;
    setOrders((prev) => [
      { id, status: "pending", lines, total, name, log: ["checkout.session.created"] },
      ...prev,
    ]);
    setActiveOrderId(id);
    setCart([]);
    setView("order");

    // Simulated Stripe webhook deliveries
    timers.current.push(
      setTimeout(() => {
        updateOrder(id, "paid", "checkout.session.completed → 200 OK");
        setStock((prev) => {
          const next = { ...prev };
          lines.forEach((l) => {
            next[l.key] = Math.max(0, (next[l.key] ?? 0) - l.qty);
          });
          return next;
        });
      }, 2000),
      setTimeout(() => updateOrder(id, "shipped", "order.shipped (tracking TH88120045)"), 5000),
    );
  }

  const totalStock = Object.values(stock).reduce((a, b) => a + b, 0);

  return (
    <DemoShell slug="handmade-shop">
      <div className="bg-stone-50 text-stone-800">
        <header className="sticky top-[37px] z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <button onClick={() => setView("shop")} className="flex items-center gap-2 text-left">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-white" style={{ background: ACCENT }}>🌱</span>
              <span>
                <span className="block text-base font-bold leading-tight">Baan Craft</span>
                <span className="block text-[11px] text-stone-500">บ้านคราฟต์ · งานทำมือจากชุมชน</span>
              </span>
            </button>
            <nav className="flex items-center gap-1 text-sm">
              {(["shop", "order", "admin"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1.5 font-medium ${view === v ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
                  style={view === v ? { background: ACCENT } : undefined}
                >
                  {v === "shop" ? "ร้านค้า" : v === "order" ? "คำสั่งซื้อ" : "Admin"}
                </button>
              ))}
              <button
                onClick={() => setCartOpen(true)}
                className="relative ml-1 rounded-full border border-stone-300 px-3 py-1.5 font-medium"
                aria-label="เปิดตะกร้า"
              >
                🛒
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] text-white" style={{ background: ACCENT }}>
                    {cartCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          {view === "shop" && (
            <>
              <section className="mb-6 rounded-2xl p-6 text-white sm:p-10" style={{ background: `linear-gradient(135deg, ${ACCENT}, #166534)` }}>
                <p className="text-xs uppercase tracking-widest opacity-80">Handmade in Thailand</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-4xl">ของใช้ทำมือ เรื่องเล่าจากชุมชน</h1>
                <p className="mt-2 max-w-lg text-sm opacity-90">
                  ผ้าครามย้อมมือ เซรามิกปั้นเอง และเทียนหอมจากถั่วเหลือง ทุกชิ้นผลิตจำนวนจำกัด ส่งฟรีเมื่อสั่งครบ ฿1,500
                </p>
              </section>

              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${category === c ? "text-white" : "border-stone-300 bg-white text-stone-700"}`}
                    style={category === c ? { background: ACCENT, borderColor: ACCENT } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {visible.map((p) => {
                  const left = Object.entries(stock)
                    .filter(([k]) => k.startsWith(`${p.id}|`))
                    .reduce((n, [, v]) => n + v, 0);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setDetail(p)}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex h-32 items-center justify-center text-6xl sm:h-40" style={{ background: p.tint }}>{p.emoji}</div>
                      <div className="p-3">
                        <p className="text-sm font-semibold">{p.nameTh}</p>
                        <p className="text-xs text-stone-500">{p.name}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-bold" style={{ color: ACCENT }}>{baht(p.price)}</span>
                          <span className={`text-[11px] ${left === 0 ? "text-red-600" : "text-stone-500"}`}>
                            {left === 0 ? "หมด" : `เหลือ ${left}`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "checkout" && (
            <CheckoutForm
              total={subtotal + shipping}
              subtotal={subtotal}
              shipping={shipping}
              onBack={() => setView("shop")}
              onPay={placeOrder}
            />
          )}

          {view === "order" && (
            <OrdersView orders={orders} active={activeOrder} onSelect={setActiveOrderId} onShop={() => setView("shop")} />
          )}

          {view === "admin" && <AdminView stock={stock} orders={orders} totalStock={totalStock} />}

          <HowItsBuilt />
        </main>

        {detail && <DetailModal product={detail} stock={stock} cart={cart} onClose={() => setDetail(null)} onAdd={addToCart} />}

        {cartOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={() => setCartOpen(false)}>
            <aside className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-stone-200 p-4">
                <h2 className="font-bold">ตะกร้าสินค้า ({cartCount})</h2>
                <button onClick={() => setCartOpen(false)} className="text-xl" aria-label="ปิด">✕</button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {cart.length === 0 && <p className="py-10 text-center text-sm text-stone-500">ตะกร้ายังว่างอยู่ ลองเลือกของน่ารัก ๆ ดูนะ</p>}
                {cart.map((l) => {
                  const p = productOf(l.pid);
                  return (
                    <div key={l.key} className="flex gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-2xl" style={{ background: p.tint }}>{p.emoji}</div>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold">{p.nameTh}</p>
                        <p className="text-xs text-stone-500">{l.color} · {l.size}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <button onClick={() => changeQty(l.key, -1)} className="h-6 w-6 rounded border border-stone-300">−</button>
                          <span>{l.qty}</span>
                          <button onClick={() => changeQty(l.key, 1)} className="h-6 w-6 rounded border border-stone-300">+</button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{baht(p.price * l.qty)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 border-t border-stone-200 p-4 text-sm">
                <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
                <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{baht(shipping)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(subtotal + shipping)}</span></div>
                <button
                  disabled={cart.length === 0}
                  onClick={() => { setCartOpen(false); setView("checkout"); }}
                  className="w-full rounded-full py-3 font-semibold text-white disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  ชำระเงิน
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DemoShell>
  );
}

function DetailModal({
  product, stock, cart, onClose, onAdd,
}: {
  product: Product;
  stock: Record<string, number>;
  cart: CartLine[];
  onClose: () => void;
  onAdd: (pid: string, color: string, size: string) => void;
}) {
  const [color, setColor] = useState(product.colors[0]);
  const [size, setSize] = useState(product.sizes[0]);
  const key = variantKey(product.id, color, size);
  const available = (stock[key] ?? 0) - (cart.find((l) => l.key === key)?.qty ?? 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-48 items-center justify-center text-8xl" style={{ background: product.tint }}>
          {product.emoji}
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/80 px-2.5 py-1" aria-label="ปิด">✕</button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">{product.nameTh}</h2>
            <p className="text-xs text-stone-500">{product.name} · {product.category}</p>
            <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>{baht(product.price)}</p>
          </div>
          <p className="text-sm text-stone-600">{product.desc}</p>
          <Picker label="สี / กลิ่น" options={product.colors} value={color} onChange={setColor} />
          <Picker label="ขนาด" options={product.sizes} value={size} onChange={setSize} />
          <p className={`text-sm ${available <= 0 ? "text-red-600" : available <= 2 ? "text-amber-600" : "text-stone-500"}`}>
            {available <= 0 ? "สินค้าตัวเลือกนี้หมดแล้ว" : `คงเหลือ ${available} ชิ้น`}
          </p>
          <button
            disabled={available <= 0}
            onClick={() => onAdd(product.id, color, size)}
            className="w-full rounded-full py-3 font-semibold text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            ใส่ตะกร้า
          </button>
        </div>
      </div>
    </div>
  );
}

function Picker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-stone-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-full border px-3 py-1 text-sm ${value === o ? "text-white" : "border-stone-300"}`}
            style={value === o ? { background: ACCENT, borderColor: ACCENT } : undefined}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckoutForm({
  subtotal, shipping, total, onBack, onPay,
}: {
  subtotal: number; shipping: number; total: number; onBack: () => void; onPay: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/30");
  const [cvc, setCvc] = useState("123");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (total <= shipping) return setError("ตะกร้าว่างเปล่า");
    if (!name.trim() || !address.trim()) return setError("กรุณากรอกชื่อและที่อยู่จัดส่ง");
    if (card.replace(/\s/g, "").length !== 16) return setError("เลขบัตรต้องมี 16 หลัก");
    if (!/^\d{2}\/\d{2}$/.test(exp) || cvc.length < 3) return setError("วันหมดอายุหรือ CVC ไม่ถูกต้อง");
    setError("");
    setPaying(true);
    setTimeout(() => onPay(name.trim()), 900);
  }

  const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-700";

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-stone-500">← กลับไปเลือกสินค้า</button>
      <h1 className="text-xl font-bold">ชำระเงิน</h1>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold">1. ที่อยู่จัดส่ง</h2>
        <input className={field} placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={field} rows={2} placeholder="ที่อยู่จัดส่ง" value={address} onChange={(e) => setAddress(e.target.value)} />
      </section>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">2. บัตรเครดิต / เดบิต</h2>
          <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">stripe · test mode</span>
        </div>
        <input className={field} inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} placeholder="เลขบัตร" />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" />
          <input className={field} value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="CVC" />
        </div>
        <p className="text-[11px] text-stone-500">โหมดทดลอง: ไม่มีการตัดเงินจริง ข้อมูลบัตรไม่ถูกส่งไปที่ไหน</p>
      </section>
      <div className="space-y-1 rounded-2xl bg-white p-4 text-sm">
        <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
        <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{baht(shipping)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(total)}</span></div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={paying} className="w-full rounded-full py-3 font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
        {paying ? "กำลังดำเนินการ…" : `ชำระ ${baht(total)}`}
      </button>
    </form>
  );
}

function OrdersView({
  orders, active, onSelect, onShop,
}: { orders: Order[]; active: Order | null; onSelect: (id: string) => void; onShop: () => void }) {
  if (orders.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-5xl">📦</p>
        <p className="mt-3 text-sm text-stone-500">ยังไม่มีคำสั่งซื้อ ลองสั่งสินค้าเพื่อดูสถานะแบบเรียลไทม์</p>
        <button onClick={onShop} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}>ไปเลือกสินค้า</button>
      </div>
    );
  }
  const order = active ?? orders[0];
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {orders.map((o) => (
          <button key={o.id} onClick={() => onSelect(o.id)} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${o.id === order.id ? "border-green-700 bg-green-50" : "border-stone-300 bg-white"}`}>
            {o.id}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h1 className="text-lg font-bold">คำสั่งซื้อ {order.id}</h1>
        <p className="text-xs text-stone-500">ผู้รับ {order.name} · {baht(order.total)}</p>
        <ol className="mt-5 space-y-0">
          {STEPS.map((s, i) => {
            const done = i <= stepIndex;
            return (
              <li key={s.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "text-white" : "bg-stone-200 text-stone-500"}`} style={done ? { background: ACCENT } : undefined}>
                    {done ? "✓" : i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span className={`h-8 w-0.5 ${i < stepIndex ? "" : "bg-stone-200"}`} style={i < stepIndex ? { background: ACCENT } : undefined} />}
                </div>
                <div className="pb-4">
                  <p className={`text-sm font-semibold ${done ? "" : "text-stone-400"}`}>{s.label}</p>
                  <p className="font-mono text-[11px] text-stone-400">{s.event}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {order.status !== "shipped" && <p className="text-xs text-stone-500">กำลังรอ webhook จาก Stripe… สถานะจะอัปเดตอัตโนมัติ</p>}
      </div>
      <div className="rounded-2xl bg-stone-900 p-4 font-mono text-[11px] text-green-300">
        {order.log.map((l, i) => <p key={i}>{`> ${l}`}</p>)}
      </div>
    </div>
  );
}

function AdminView({ stock, orders, totalStock }: { stock: Record<string, number>; orders: Order[]; totalStock: number }) {
  const revenue = orders.filter((o) => o.status !== "pending").reduce((n, o) => n + o.total, 0);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Admin · สต็อกและคำสั่งซื้อ</h1>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[["สต็อกรวม", String(totalStock)], ["ออเดอร์", String(orders.length)], ["รายได้", baht(revenue)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-lg font-bold" style={{ color: ACCENT }}>{v}</p>
            <p className="text-[11px] text-stone-500">{k}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs text-stone-500">
            <tr><th className="p-2">สินค้า</th><th className="p-2">ตัวเลือก</th><th className="p-2 text-right">คงเหลือ</th></tr>
          </thead>
          <tbody>
            {Object.entries(stock).map(([key, qty]) => {
              const [pid, color, size] = key.split("|");
              return (
                <tr key={key} className="border-t border-stone-100">
                  <td className="p-2">{productOf(pid).nameTh}</td>
                  <td className="p-2 text-xs text-stone-500">{color} · {size}</td>
                  <td className={`p-2 text-right font-semibold ${qty === 0 ? "text-red-600" : qty <= 2 ? "text-amber-600" : ""}`}>{qty}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HowItsBuilt() {
  const parts: [string, string][] = [
    ["Next.js + TypeScript", "Server-rendered catalog pages for SEO, with typed cart and order models shared across the app."],
    ["Stripe Checkout", "Hosted payment page handles cards and PromptPay so card data never touches our server."],
    ["Webhooks", "Stripe events (checkout.session.completed) verify the signature, then mark the order paid and decrement stock."],
    ["Supabase Storage", "Product photos uploaded by the owner from the admin tab and served through a CDN."],
    ["Tailwind CSS", "Mobile-first design tokens so the brand look stays consistent across storefront and admin."],
  ];
  return (
    <section className="mt-12 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-bold">How it&apos;s built</h2>
      <p className="mt-1 text-xs text-stone-500">This demo uses in-memory mock data. In production:</p>
      <ul className="mt-3 space-y-2 text-sm">
        {parts.map(([k, v]) => (
          <li key={k}><span className="font-semibold" style={{ color: ACCENT }}>{k}</span> — {v}</li>
        ))}
      </ul>
    </section>
  );
}
