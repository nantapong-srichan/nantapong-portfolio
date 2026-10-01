"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import DemoShell from "@/components/DemoShell";
import OtpVerify from "@/components/OtpVerify";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";

const ACCENT = "#0f766e";
const API = "/api/fashion-store";
const ORDERS_KEY = "fashion-store:orders";
const KEYS_KEY = "fashion-store:order-keys";

type Variant = { id: number; color: string; colorHex: string; size: string; stock: number };
type Product = { id: string; name: string; nameTh: string; category: string; price: number; image: string; desc: string; variants: Variant[] };
type Catalog = { shipping: { fee: number; freeOver: number }; products: Product[] };

type OrderStatus = "pending_payment" | "paid" | "shipped" | "expired" | "cancelled";
type OrderItem = { variantId: number; name: string; image: string; color: string; size: string; qty: number; unitPrice: number };
type Order = {
  id: string; intentId: string; name: string; status: OrderStatus; subtotal: number; shipping: number; total: number; payAmount: number; reference: string;
  expiresAt: number; serverNow: number; paidAt: string | null; paidVia: "webhook" | "slip" | "manual" | null; note: string | null; items: OrderItem[];
  phone?: string; address?: string; paymentProvider?: string | null; paymentEventId?: string | null;
};
type Overview = {
  stats: { orders: number; pending: number; revenue: number; totalStock: number };
  orders: Order[];
  variants: { id: number; name: string; image: string; color: string; size: string; stock: number }[];
};
type CartLine = { variantId: number; productId: string; color: string; size: string; qty: number };
type View = "shop" | "checkout" | "order" | "admin";

const ALL = "ทั้งหมด";
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const money = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_LABEL: Record<OrderStatus, string> = { pending_payment: "รอชำระเงิน", paid: "ชำระแล้ว", shipped: "จัดส่งแล้ว", expired: "หมดเวลา", cancelled: "ยกเลิก" };
const STATUS_STYLE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800", paid: "bg-emerald-100 text-emerald-800", shipped: "bg-sky-100 text-sky-800",
  expired: "bg-stone-200 text-stone-600", cancelled: "bg-red-100 text-red-700",
};
// object-position per product (landscape shots need the subject centred horizontally)
const CROP: Record<string, string> = { "chunky-cardigan": "60% 30%", "trench-coat": "50% 25%", "wide-trousers": "50% 20%" };
const cropOf = (id: string) => CROP[id] ?? "50% 30%";
const ADMIN_HEADERS = { "x-demo-role": "admin" };

type ApiResult<T> = { ok: boolean; status: number; body: T & { error?: string; details?: unknown } };
async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
const sendJson = (method: string, payload: unknown): RequestInit => ({
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
});

const SIZE_GUIDES: Record<string, { head: string[]; rows: string[][] }> = {
  เสื้อ: { head: ["ไซซ์", "รอบอก", "ความยาว", "ไหล่"], rows: [["XS", "84", "62", "37"], ["S", "88", "64", "38"], ["M", "94", "66", "40"], ["L", "100", "68", "42"], ["XL", "106", "70", "44"]] },
  เดรส: { head: ["ไซซ์", "รอบอก", "รอบเอว", "รอบสะโพก"], rows: [["XS", "82", "64", "88"], ["S", "86", "68", "92"], ["M", "92", "74", "98"], ["L", "98", "80", "104"], ["XL", "104", "86", "110"]] },
  กางเกง: { head: ["ไซซ์", "รอบเอว", "รอบสะโพก", "ความยาวขา"], rows: [["XS", "62", "88", "96"], ["S", "66", "92", "97"], ["M", "72", "98", "98"], ["L", "78", "104", "99"], ["XL", "84", "110", "100"]] },
  เสื้อคลุม: { head: ["ไซซ์", "รอบอก", "ความยาว", "ความยาวแขน"], rows: [["XS", "92", "70", "58"], ["S", "96", "72", "59"], ["M", "102", "74", "60"], ["L", "108", "76", "61"], ["XL", "114", "78", "62"]] },
};

type IconName = "bag" | "cart" | "close" | "box" | "check" | "back" | "plus" | "minus" | "shield" | "ruler";
function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: <path d="M6 8h12l1 12H5L6 8zM9 8V6a3 3 0 0 1 6 0v2" />,
    cart: <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9 20h.01M17 20h.01" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    box: <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9zM3.5 7.5L12 12l8.5-4.5M12 12v9" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    back: <path d="M19 12H5M11 6l-6 6 6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.500-7-10V6l7-3zM9 12l2 2 4-4" />,
    ruler: <path d="M3 17L17 3l4 4L7 21l-4-4zM8 12l2 2M11 9l2 2M14 6l2 2" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function FashionStorePage() {
  const [view, setView] = useState<View>("shop");
  const [category, setCategory] = useState(ALL);
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [myOrders, setMyOrders] = useState<string[]>([]);
  const [orderKeys, setOrderKeys] = useState<Record<string, string>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const c = await call<Catalog>("/products");
      if (!c.ok) throw new Error("bad response");
      setCatalog(c.body);
      setLoadError("");
    } catch {
      setLoadError("โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCatalog();
      try {
        const saved = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
        const keys = JSON.parse(localStorage.getItem(KEYS_KEY) ?? "{}");
        const keyMap: Record<string, string> = {};
        if (keys && typeof keys === "object") for (const [k, v] of Object.entries(keys)) if (typeof v === "string") keyMap[k] = v;
        setOrderKeys(keyMap);
        // Orders saved before keys existed can no longer be read, so they are dropped from the list.
        if (Array.isArray(saved)) setMyOrders(saved.filter((x): x is string => typeof x === "string" && x in keyMap));
      } catch { /* ignore corrupt storage */ }
    }, 0);
    return () => clearTimeout(t);
  }, [loadCatalog]);

  const products = useMemo(() => catalog?.products ?? [], [catalog]);
  const categories = useMemo(() => [ALL, ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const visible = useMemo(() => products.filter((p) => category === ALL || p.category === category), [products, category]);

  const variantOf = useCallback((variantId: number) => {
    for (const p of products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return { product: p, variant: v };
    }
    return null;
  }, [products]);

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((n, l) => n + l.qty * (variantOf(l.variantId)?.product.price ?? 0), 0);
  const rule = catalog?.shipping ?? { fee: 60, freeOver: 2000 };
  const shipping = cart.length === 0 || subtotal >= rule.freeOver ? 0 : rule.fee;

  function addToCart(product: Product, variant: Variant) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if ((existing?.qty ?? 0) >= Math.min(variant.stock, 10)) return prev;
      if (existing) return prev.map((l) => (l.variantId === variant.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { variantId: variant.id, productId: product.id, color: variant.color, size: variant.size, qty: 1 }];
    });
    setDetail(null);
    setCartOpen(true);
  }

  function changeQty(variantId: number, delta: number) {
    setCart((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(l.qty + delta, Math.min(variantOf(variantId)?.variant.stock ?? 0, 10)) } : l)).filter((l) => l.qty > 0),
    );
  }

  async function placeOrder(name: string, address: string, phone: string, otpToken: string): Promise<string | null> {
    const res = await call<{ order: Order; accessKey: string }>("/orders", sendJson("POST", { name, address, phone, otpToken, items: cart.map((l) => ({ variantId: l.variantId, qty: l.qty })) }));
    if (res.status === 409) {
      await loadCatalog();
      const list = (res.body.details as { product: string; requested: number; available: number }[] | undefined) ?? [];
      return `สต็อกไม่พอ: ${list.map((d) => `${d.product} (ต้องการ ${d.requested}, เหลือ ${d.available})`).join(", ")}`;
    }
    if (!res.ok) return res.body.error ?? "สร้างคำสั่งซื้อไม่สำเร็จ";
    const code = res.body.order.id;
    const next = [code, ...myOrders.filter((c) => c !== code)].slice(0, 20);
    const nextKeys = { ...orderKeys, [code]: res.body.accessKey };
    for (const c of Object.keys(nextKeys)) if (!next.includes(c)) delete nextKeys[c];
    setMyOrders(next);
    setOrderKeys(nextKeys);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    localStorage.setItem(KEYS_KEY, JSON.stringify(nextKeys));
    setActiveOrderId(code);
    setCart([]);
    setView("order");
    return null;
  }

  return (
    <DemoShell slug="fashion-store">
      <div className="bg-[#faf8f5] text-stone-800 [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-teal-700 [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-teal-700/30 [&_textarea]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-teal-700/30">
        <header className="z-40 border-b border-stone-200 sm:sticky sm:top-[var(--demo-shell-h)] bg-[#faf8f5]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setView("shop")} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-left">
              <span>
                <span className="block font-serif text-lg font-semibold leading-tight tracking-[0.08em]">Linen &amp; Co.</span>
                <span className="block text-xs text-stone-600">เสื้อผ้าลินินและคอตตอน</span>
              </span>
            </button>
            <nav className="flex items-center gap-0.5 whitespace-nowrap text-sm sm:gap-1">
              {(["shop", "order", "admin"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`min-h-11 rounded-full px-2 font-medium sm:px-3 ${view === v ? "text-white" : "text-stone-700 hover:bg-stone-200/60"}`} style={view === v ? { background: ACCENT } : undefined}>
                  {v === "shop" ? "ร้านค้า" : v === "order" ? "คำสั่งซื้อ" : "Admin"}
                </button>
              ))}
              <button onClick={() => setCartOpen(true)} className="relative ml-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 hover:bg-stone-100" aria-label="เปิดตะกร้า">
                <Icon name="cart" className="h-5 w-5" />
                {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] text-white" style={{ background: ACCENT }}>{cartCount}</span>}
              </button>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {loadError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

          {view === "shop" && (
            <>
              <section className="relative mb-10 overflow-hidden rounded-sm text-white">
                <Image src="/images/fashion-store/wrap-dress.jpg" alt="เดรสป้ายลายดอกไม้" fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover object-[50%_35%]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(15,60,55,0.92)] to-[rgba(15,60,55,0.35)] sm:bg-gradient-to-r" />
                <div className="relative flex min-h-[320px] flex-col justify-end p-6 sm:min-h-[440px] sm:p-14">
                  <p className="text-xs uppercase tracking-[0.3em] opacity-90">New season</p>
                  <h1 className="mt-3 max-w-xl break-keep font-serif text-3xl font-medium leading-snug sm:text-5xl sm:leading-tight">ผ้าลินิน ใส่สบาย ทุกวัน</h1>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-95 sm:text-base">เสื้อ เดรส กางเกง และเสื้อคลุมไซซ์ XS-XL ส่งฟรีเมื่อสั่งครบ {baht(rule.freeOver)}</p>
                </div>
              </section>

              <div className="mb-10 flex gap-3 rounded-sm border border-teal-200 bg-teal-50/70 p-4 text-sm leading-relaxed text-teal-900">
                <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">เงินเข้าบัญชีร้านโดยตรง ไม่ผ่านตัวกลาง</p>
                  <p className="mt-1 text-sm text-teal-900">
                    สแกน QR PromptPay ของออเดอร์เพื่อโอนเข้าบัญชีเจ้าของร้านโดยตรง (บัญชีบริษัทหรือบุคคลธรรมดาก็ได้) ระบบรับแจ้งเงินเข้าแล้วเปลี่ยนสถานะเป็นชำระแล้วให้อัตโนมัติ
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-teal-800">
                    หมายเหตุเดโม: ยังไม่ได้เชื่อมต่อฟีดธนาคารจริง การแจ้งเงินเข้าจำลองจากหน้า Admin (ส่งผ่าน webhook จริงพร้อมลายเซ็น) ระบบจริงจะรับแจ้งจาก API ของธนาคารหรือผู้ให้บริการ ส่วนตรวจสลิปและ OTP เป็นโหมดทดสอบจนกว่าจะตั้งค่า API key
                  </p>
                </div>
              </div>

              <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button key={c} onClick={() => setCategory(c)} className={`min-h-11 shrink-0 rounded-full border px-5 text-sm ${category === c ? "text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`} style={category === c ? { background: ACCENT, borderColor: ACCENT } : undefined}>
                    {c}
                  </button>
                ))}
              </div>

              {!catalog && !loadError && <p className="py-16 text-center text-sm text-stone-600">กำลังโหลดสินค้า...</p>}

              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
                {visible.map((p) => {
                  const left = p.variants.reduce((n, v) => n + v.stock, 0);
                  const colors = Array.from(new Map(p.variants.map((v) => [v.color, v.colorHex])));
                  return (
                    <button key={p.id} onClick={() => setDetail(p)} className="group text-left">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-stone-200">
                        <Image src={p.image} alt={p.nameTh} fill sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" style={{ objectPosition: cropOf(p.id) }} />
                      </div>
                      <div className="pt-3">
                        <p className="text-sm font-medium leading-snug">{p.nameTh}</p>
                        <p className="text-xs text-stone-600">{p.name}</p>
                        <div className="mt-1.5 flex gap-1">{colors.map(([name, hex]) => <span key={name} title={name} className="h-3.5 w-3.5 rounded-full border border-stone-300" style={{ background: hex }} />)}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-semibold" style={{ color: ACCENT }}>{baht(p.price)}</span>
                          <span className={`text-xs ${left === 0 ? "text-red-700" : "text-stone-600"}`}>{left === 0 ? "หมด" : `เหลือ ${left}`}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "checkout" && <CheckoutForm subtotal={subtotal} shipping={shipping} onBack={() => setView("shop")} onPay={placeOrder} />}
          {view === "order" && <OrdersView codes={myOrders} keys={orderKeys} activeId={activeOrderId} onSelect={setActiveOrderId} onShop={() => setView("shop")} onStockChanged={loadCatalog} />}
          {view === "admin" && <AdminView onChanged={loadCatalog} />}

          <HowItsBuilt />
        </main>

        {detail && <DetailModal product={detail} cart={cart} onClose={() => setDetail(null)} onAdd={addToCart} />}

        {cartOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={() => setCartOpen(false)}>
            <aside className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-stone-200 p-4">
                <h2 className="font-serif text-lg font-semibold lining-nums">ตะกร้าสินค้า ({cartCount})</h2>
                <button onClick={() => setCartOpen(false)} className="flex h-11 w-11 items-center justify-center" aria-label="ปิด"><Icon name="close" /></button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {cart.length === 0 && <p className="py-10 text-center text-sm text-stone-500">ตะกร้ายังว่างอยู่</p>}
                {cart.map((l) => {
                  const found = variantOf(l.variantId);
                  if (!found) return null;
                  const p = found.product;
                  return (
                    <div key={l.variantId} className="flex gap-3">
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-stone-100"><Image src={p.image} alt={p.nameTh} fill sizes="56px" className="object-cover" /></div>
                      <div className="flex-1 text-sm">
                        <p className="font-medium">{p.nameTh}</p>
                        <p className="text-xs text-stone-500">{l.color} · ไซซ์ {l.size}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <button onClick={() => changeQty(l.variantId, -1)} className="flex h-11 w-11 items-center justify-center rounded-sm border border-stone-300" aria-label="ลดจำนวน"><Icon name="minus" className="h-3 w-3" /></button>
                          <span className="w-5 text-center">{l.qty}</span>
                          <button onClick={() => changeQty(l.variantId, 1)} className="flex h-11 w-11 items-center justify-center rounded-sm border border-stone-300" aria-label="เพิ่มจำนวน"><Icon name="plus" className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{baht(p.price * l.qty)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 border-t border-stone-200 p-4 text-sm">
                {cart.length > 0 && subtotal < rule.freeOver && <p className="text-xs text-teal-700">ซื้อเพิ่มอีก {baht(rule.freeOver - subtotal)} ส่งฟรี</p>}
                <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
                <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{shipping === 0 && cart.length > 0 ? "ฟรี" : baht(shipping)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(subtotal + shipping)}</span></div>
                <p className="text-xs leading-relaxed text-stone-600">ยอดนี้คำนวณซ้ำที่เซิร์ฟเวอร์ ยอดโอนจริงจะมีเศษสตางค์เฉพาะออเดอร์เพื่อจับคู่การชำระเงิน</p>
                <button disabled={cart.length === 0} onClick={() => { setCartOpen(false); setView("checkout"); }} className="min-h-12 w-full rounded-full py-3 font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>ชำระเงิน</button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DemoShell>
  );
}

function DetailModal({ product, cart, onClose, onAdd }: { product: Product; cart: CartLine[]; onClose: () => void; onAdd: (p: Product, v: Variant) => void }) {
  const colors = Array.from(new Map(product.variants.map((v) => [v.color, v.colorHex])));
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)));
  const [color, setColor] = useState(colors[0][0]);
  const [size, setSize] = useState(() => product.variants.find((v) => v.color === colors[0][0] && v.stock > 0)?.size ?? sizes[0]);
  const [guide, setGuide] = useState(false);
  const variant = product.variants.find((v) => v.color === color && v.size === size);
  const available = variant ? variant.stock - (cart.find((l) => l.variantId === variant.id)?.qty ?? 0) : 0;
  const stockOf = (s: string) => product.variants.find((v) => v.color === color && v.size === s)?.stock ?? 0;
  const guideData = SIZE_GUIDES[product.category];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white sm:rounded-md" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/5] max-h-[50vh] sm:max-h-[44vh] w-full bg-stone-200">
          <Image src={product.image} alt={product.nameTh} fill sizes="448px" loading="eager" className="object-cover" style={{ objectPosition: cropOf(product.id) }} />
          <button onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90" aria-label="ปิด"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-serif text-xl font-semibold">{product.nameTh}</h2>
            <p className="text-xs text-stone-600">{product.name} · {product.category}</p>
            <p className="mt-2 text-xl font-semibold" style={{ color: ACCENT }}>{baht(product.price)}</p>
          </div>
          <p className="text-sm leading-relaxed text-stone-700">{product.desc}</p>
          <div>
            <p className="mb-2 text-xs font-semibold text-stone-700">สี: {color}</p>
            <div className="flex flex-wrap gap-2">
              {colors.map(([name, hex]) => (
                <button key={name} onClick={() => setColor(name)} title={name} aria-label={name} className={`h-11 w-11 rounded-full border-2 ring-2 ring-inset ring-white ${color === name ? "border-teal-700" : "border-stone-300"}`} style={{ background: hex }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-700">ไซซ์</p>
              <button onClick={() => setGuide((g) => !g)} className="flex min-h-11 items-center gap-1 text-xs underline" style={{ color: ACCENT }}><Icon name="ruler" className="h-3.5 w-3.5" />ตารางไซซ์</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const out = stockOf(s) === 0;
                return (
                  <button key={s} disabled={out} onClick={() => setSize(s)} className={`min-h-11 min-w-11 rounded-full border px-3 text-sm disabled:cursor-not-allowed disabled:text-stone-400 disabled:line-through ${size === s && !out ? "text-white" : "border-stone-300"}`} style={size === s && !out ? { background: ACCENT, borderColor: ACCENT } : undefined}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          {guide && guideData && (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-center text-xs">
                <caption className="bg-stone-50 p-2 text-left text-xs text-stone-600">ตารางไซซ์ (ซม.) หมวด{product.category}</caption>
                <thead className="bg-stone-100 text-stone-500"><tr>{guideData.head.map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {guideData.rows.map((r) => (
                    <tr key={r[0]} className={`border-t border-stone-100 ${r[0] === size ? "bg-teal-50 font-semibold" : ""}`}>{r.map((c, i) => <td key={i} className="p-2">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={`text-sm ${available <= 0 ? "text-red-700" : available <= 2 ? "text-amber-700" : "text-stone-600"}`}>
            {!variant || variant.stock === 0 ? "ตัวเลือกนี้หมดแล้ว" : available <= 0 ? "คุณใส่ตะกร้าครบจำนวนที่มีแล้ว" : `คงเหลือ ${available} ชิ้น`}
          </p>
          <button disabled={available <= 0 || !variant} onClick={() => variant && onAdd(product, variant)} className="min-h-12 w-full rounded-full py-3 font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>ใส่ตะกร้า</button>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ subtotal, shipping, onBack, onPay }: { subtotal: number; shipping: number; onBack: () => void; onPay: (n: string, a: string, p: string, t: string) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const phoneVerified = !!otpToken && verifiedPhone === phone;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subtotal <= 0) return setError("ตะกร้าว่างเปล่า");
    if (!name.trim() || !address.trim()) return setError("กรุณากรอกชื่อและที่อยู่จัดส่ง");
    if (!otpToken || !phoneVerified) return setError("กรุณายืนยันเบอร์โทรด้วย OTP ก่อนสั่งซื้อ");
    setError("");
    setPaying(true);
    const failure = await onPay(name.trim(), address.trim(), phone, otpToken);
    if (failure) { setError(failure); setPaying(false); }
  }
  const field = "w-full min-h-11 rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 sm:text-sm";
  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 text-sm text-stone-600 hover:text-stone-900"><Icon name="back" className="h-4 w-4" /> กลับไปเลือกสินค้า</button>
      <h1 className="font-serif text-2xl font-semibold">สั่งซื้อ</h1>
      <section className="space-y-3 rounded-md border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">1. ที่อยู่จัดส่ง</h2>
        <input className={field} placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={field} rows={2} placeholder="ที่อยู่จัดส่ง" value={address} onChange={(e) => setAddress(e.target.value)} />
      </section>
      <section className="space-y-3 rounded-md border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold">2. ยืนยันเบอร์โทรด้วย OTP</h2>
        <input className={field} inputMode="tel" placeholder="เบอร์โทร เช่น 0812345678" value={phone} onChange={(e) => { setPhone(e.target.value); setOtpToken(null); }} />
        {phoneVerified ? (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">ยืนยันเบอร์ {phone} แล้ว</p>
        ) : (
          <OtpVerify key={phone} phone={phone} accent={ACCENT} onVerified={(t) => { setOtpToken(t); setVerifiedPhone(phone); }} />
        )}
      </section>
      <div className="space-y-1 rounded-md border border-stone-200 bg-white p-5 text-sm">
        <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
        <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{shipping === 0 ? "ฟรี" : baht(shipping)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(subtotal + shipping)}</span></div>
        <p className="pt-2 text-xs leading-relaxed text-stone-600">หลังกดสั่งซื้อ ระบบจะสร้าง QR PromptPay ที่มียอดเฉพาะออเดอร์ (มีเศษสตางค์) และมีเวลาชำระ 15 นาที</p>
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={paying || !phoneVerified} className="min-h-12 w-full rounded-full py-3 font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
        {paying ? "กำลังดำเนินการ..." : "สร้างคำสั่งซื้อและรับ QR ชำระเงิน"}
      </button>
    </form>
  );
}

function OrdersView({ codes, keys, activeId, onSelect, onShop, onStockChanged }: {
  codes: string[]; keys: Record<string, string>; activeId: string | null; onSelect: (id: string) => void; onShop: () => void; onStockChanged: () => Promise<void>;
}) {
  const currentId = activeId && codes.includes(activeId) ? activeId : codes[0] ?? null;
  if (!currentId) {
    return (
      <div className="py-20 text-center">
        <Icon name="box" className="mx-auto h-12 w-12 text-stone-400" />
        <p className="mt-3 font-serif text-lg">ยังไม่มีคำสั่งซื้อ</p>
        <p className="mt-1 text-sm text-stone-600">ยังไม่มีคำสั่งซื้อจากเบราว์เซอร์นี้</p>
        <button onClick={onShop} className="mt-5 min-h-11 rounded-full px-6 text-sm font-semibold text-white" style={{ background: ACCENT }}>ไปเลือกสินค้า</button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {codes.map((c) => (
          <button key={c} onClick={() => onSelect(c)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${c === currentId ? "border-teal-700 bg-teal-50" : "border-stone-300 bg-white"}`}>{c}</button>
        ))}
      </div>
      <OrderCard key={currentId} code={currentId} accessKey={keys[currentId] ?? ""} onStockChanged={onStockChanged} />
    </div>
  );
}

function OrderCard({ code, accessKey, onStockChanged }: { code: string; accessKey: string; onStockChanged: () => Promise<void> }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await call<{ order: Order }>(`/orders/${code}`, { headers: { "x-order-key": accessKey } });
      if (res.status === 404 || res.status === 403) return setMissing(true);
      if (res.ok) {
        setOrder((prev) => {
          if (prev && prev.status === "pending_payment" && res.body.order.status === "paid") void onStockChanged();
          return res.body.order;
        });
      }
    } catch { /* retry on next refresh */ }
  }, [code, accessKey, onStockChanged]);

  useEffect(() => {
    const first = setTimeout(() => void fetchOrder(), 0);
    return () => clearTimeout(first);
  }, [fetchOrder]);

  if (missing) return <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">ไม่พบคำสั่งซื้อ {code} (อาจถูกล้างข้อมูลเดโมแล้ว)</p>;
  if (!order) return <p className="py-10 text-center text-sm text-stone-600">กำลังโหลดคำสั่งซื้อ...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-serif text-xl font-semibold lining-nums">คำสั่งซื้อ {order.id}</h1>
            <p className="mt-1 text-xs text-stone-600">ผู้รับ {order.name} · เลขอ้างอิง {order.reference}</p>
          </div>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {order.items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 text-sm">
              <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-sm bg-stone-200"><Image src={i.image} alt={i.name} fill sizes="40px" className="object-cover" /></span>
              <span className="flex-1">{i.name}<span className="block text-xs text-stone-500">{i.color} · ไซซ์ {i.size}</span></span>
              <span className="text-stone-600">x{i.qty}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
          <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{order.shipping === 0 ? "ฟรี" : baht(order.shipping)}</span></div>
          <div className="flex justify-between font-bold"><span>ยอดที่ต้องโอน</span><span>{money(order.payAmount)}</span></div>
        </div>

        {order.status === "pending_payment" && (
          <QrPayPanel scope="fashion-store" intentId={order.intentId} accent={ACCENT} onPaid={() => void fetchOrder()} onClosed={() => void fetchOrder()}
            sandboxNote='เดโม: ยังไม่มีฟีดธนาคารจริง ให้ไปที่แท็บ Admin แล้วกด "จำลองแจ้งเงินเข้า (sandbox)"' />
        )}
        {order.status === "paid" && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            ได้รับเงินแล้ว ({order.paidVia === "webhook" ? "ตรวจพบอัตโนมัติจากแจ้งเงินเข้า" : order.paidVia === "slip" ? "ยืนยันด้วยสลิป" : "ร้านยืนยันเอง"}) รอร้านจัดส่ง
          </p>
        )}
        {order.status === "shipped" && <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">ร้านจัดส่งสินค้าแล้ว</p>}
        {order.status === "expired" && <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-600">ออเดอร์หมดเวลาชำระเงิน QR นี้ใช้ไม่ได้แล้ว กรุณาสั่งซื้อใหม่ หากโอนไปแล้วให้ติดต่อร้าน</p>}
        {order.status === "cancelled" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{order.note ?? "ออเดอร์ถูกยกเลิก"}</p>}
      </div>
    </div>
  );
}

function AdminView({ onChanged }: { onChanged: () => Promise<void> }) {
  const [data, setData] = useState<Overview | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await call<Overview>("/admin/overview", { headers: ADMIN_HEADERS });
      if (r.ok) setData(r.body);
    } catch { /* keep last data */ }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const poll = setInterval(() => void load(), 3000);
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [load]);

  async function ship(id: string) {
    const r = await call<{ status?: string }>(`/admin/orders/${id}/ship`, { method: "POST", headers: ADMIN_HEADERS });
    setNote(r.ok ? `${id}: จัดส่งแล้ว` : `${id}: ${r.body.error}`);
    await load();
  }
  if (!data) return <p className="py-16 text-center text-sm text-stone-600">กำลังโหลดข้อมูล...</p>;
  const pending = data.orders.filter((o) => o.status === "pending_payment");
  const assignable = data.orders.filter((o) => o.status === "pending_payment" || o.status === "expired");
  const refresh = () => { void load(); void onChanged(); };

  return (
    <div className="space-y-4">
      <h1 className="break-keep font-serif text-xl font-semibold sm:text-2xl">แอดมิน · ออเดอร์ สต็อก และบัญชีรับเงิน</h1>
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[["สต็อกรวม", String(data.stats.totalStock)], ["ออเดอร์", String(data.stats.orders)], ["รอชำระ", String(data.stats.pending)], ["รับเงินแล้ว", money(data.stats.revenue)]].map(([k, v]) => (
          <div key={k} className="rounded-md border border-stone-200 bg-white p-4"><p className="font-serif text-xl font-semibold lining-nums" style={{ color: ACCENT }}>{v}</p><p className="mt-0.5 text-xs text-stone-600">{k}</p></div>
        ))}
      </div>
      {note && <p className="rounded-md bg-stone-900 px-3 py-2 font-mono text-xs text-teal-200">{note}</p>}

      <PayeeSettings scope="fashion-store" headers={ADMIN_HEADERS} accent={ACCENT} onSaved={refresh} />

      <SandboxSimulate scope="fashion-store" headers={ADMIN_HEADERS} accent={ACCENT} onDone={refresh}
        targets={pending.map((o) => ({ key: o.id, label: o.id, amount: o.payAmount, reference: o.reference }))} />

      <UnmatchedPayments scope="fashion-store" headers={ADMIN_HEADERS} accent={ACCENT} onAssigned={refresh}
        targets={assignable.map((o) => ({ intentId: o.intentId, label: `${o.id} · ${money(o.payAmount)} · ${STATUS_LABEL[o.status]}` }))} />

      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold">ออเดอร์</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-stone-600"><tr className="whitespace-nowrap"><th className="p-2">ออเดอร์</th><th className="p-2">ลูกค้า</th><th className="p-2 text-right">ยอดโอน</th><th className="p-2">สถานะ</th><th className="p-2">ช่องทาง</th><th className="p-2" /></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-t border-stone-100">
                  <td className="p-2 font-mono text-xs">{o.id}<span className="block text-stone-500">{o.reference}</span></td>
                  <td className="p-2 text-xs">{o.name}<span className="block text-stone-500">{o.phone}</span></td>
                  <td className="p-2 text-right">{money(o.payAmount)}</td>
                  <td className="p-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td className="p-2 text-xs text-stone-500">{o.paidVia ?? "-"}</td>
                  <td className="p-2 text-right">{o.status === "paid" && <button onClick={() => void ship(o.id)} className="min-h-9 rounded-full border border-stone-300 px-4 text-xs font-medium hover:bg-stone-100">จัดส่ง</button>}</td>
                </tr>
              ))}
              {data.orders.length === 0 && <tr><td colSpan={6} className="p-3 text-xs text-stone-600">ยังไม่มีออเดอร์</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-stone-200 bg-white">
        <h2 className="p-4 pb-2 text-sm font-semibold">สต็อกตามไซซ์และสี</h2>
        <div className="max-h-[28rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-stone-100 text-xs text-stone-600"><tr><th className="p-2">สินค้า</th><th className="p-2">ตัวเลือก</th><th className="p-2 text-right">คงเหลือ</th></tr></thead>
          <tbody>
            {data.variants.map((v) => (
              <tr key={v.id} className="border-t border-stone-100">
                <td className="p-2"><span className="flex items-center gap-2"><span className="relative h-8 w-6 shrink-0 overflow-hidden rounded bg-stone-100"><Image src={v.image} alt="" fill sizes="24px" className="object-cover" /></span>{v.name}</span></td>
                <td className="p-2 text-xs text-stone-600">{v.color} · {v.size}</td>
                <td className={`p-2 text-right font-semibold ${v.stock === 0 ? "text-red-700" : v.stock <= 2 ? "text-amber-700" : ""}`}>{v.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}

function HowItsBuilt() {
  const parts: [string, string][] = [
    ["Route Handlers + SQLite (เดโมนี้)", "แคตตาล็อก ตัวเลือกไซซ์/สี สต็อก ออเดอร์ และการตั้งค่าบัญชีรับเงินเก็บใน SQLite หลัง /api/fashion-store ราคาและยอดรวมคำนวณที่เซิร์ฟเวอร์เสมอ ค่าส่งฟรีเมื่อครบ 2,000 บาท การสร้างออเดอร์เป็นหนึ่งทรานแซกชันที่ปฏิเสธเมื่อสต็อกไม่พอ (409)"],
    ["PromptPay QR แบบ EMVCo (เดโมนี้)", "เขียนตัวสร้างข้อมูล QR เองตามมาตรฐาน (tag 29, AID A000000677010111, CRC16-CCITT) รองรับเบอร์โทร เลขบัตรประชาชน/เลขนิติบุคคล และ e-Wallet แต่ละออเดอร์ได้ยอดไม่ซ้ำ (บวกเศษสตางค์สุ่มที่ไม่ชนกับออเดอร์ที่รออยู่) และหมดอายุใน 15 นาทีที่ฝั่งเซิร์ฟเวอร์"],
    ["Webhook + HMAC (เดโมนี้)", "POST /api/fashion-store/qrpay/webhook ตรวจลายเซ็น HMAC-SHA256 (เทียบแบบ constant-time) และช่วงเวลาของคำขอ กันรายการซ้ำด้วย eventId จับคู่ด้วยยอดที่ตรงเป๊ะ (และเลขอ้างอิงถ้ามี) แล้วตัดสต็อกในทรานแซกชันเดียว เงินที่จับคู่ไม่ได้ไปอยู่ในตารางรอเจ้าของร้านจับคู่เอง ปุ่ม sandbox ให้เซิร์ฟเวอร์เซ็นแล้วส่งเข้า endpoint จริง ออเดอร์จะเปลี่ยนเป็นชำระแล้วได้ทางเดียวเท่านั้น คือผ่าน webhook ที่ลายเซ็นถูกต้อง สลิปที่ตรวจผ่าน หรือแอดมินจับคู่เอง"],
    ["Thunder API ตรวจสลิป + ThaiBulkSMS OTP (เดโมนี้)", "สลิปเป็นทางสำรองเมื่อไม่มีแจ้งเงินเข้า สลิปใช้ซ้ำไม่ได้ (409) และยอดต้องตรง ส่วน OTP ยืนยันเบอร์ก่อนสร้างออเดอร์ และเซิร์ฟเวอร์ตรวจโทเคนซ้ำ (403) ทั้งสองเป็นโหมดทดสอบจนกว่าจะตั้ง API key"],
    ["งานจริง (production)", "ย้ายไป PostgreSQL บน Supabase พร้อม RLS และ Supabase Storage สำหรับรูปสินค้า รับแจ้งเงินเข้าจาก API ของธนาคารหรือผู้ให้บริการรับชำระที่รองรับ PromptPay พร้อมตั้งค่า PAYMENT_WEBHOOK_SECRET และใช้การเข้าสู่ระบบของแอดมินจริงแทน header x-demo-role"],
    ["Next.js + TypeScript + Tailwind CSS", "โครงสร้างข้อมูลสินค้าและออเดอร์ที่ระบุชนิดข้อมูลชัดเจน ใช้ร่วมกันระหว่าง Route Handlers หน้าร้าน และหน้าแอดมิน ออกแบบให้ใช้บนมือถือเป็นหลัก"],
  ];
  return (
    <section className="mt-20 rounded-md border border-stone-200 bg-white p-5 sm:p-8">
      <h2 className="font-serif text-xl font-semibold">สร้างอย่างไร</h2>
<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
        <li>ของจริงในเดโมนี้: สินค้า สต็อก ออเดอร์ และราคา เก็บและคำนวณใน SQLite ผ่าน API จริง</li>
        <li>การชำระเงิน: ระบบตรวจจับเงินเข้า PromptPay QR อัตโนมัติผ่าน webhook ที่เซ็นลายเซ็นไว้ และมีการอัปโหลดสลิปเป็นทางสำรอง</li>
        <li>ในงานจริง: Supabase (PostgreSQL) รับแจ้งเงินเข้าจากธนาคารหรือผู้ให้บริการชำระเงิน และแอดมินล็อกอินจริง</li>
      </ul>
      <p className="mt-3 rounded-md bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">หมายเหตุความจริงของเดโม: เดโมนี้ยังไม่ได้เชื่อมต่อฟีดแจ้งเงินเข้าจากธนาคารจริง ฟีดธนาคาร การตรวจสลิป และ SMS OTP เป็นโหมดทดสอบ (sandbox) จนกว่าจะตั้งค่า API key ปุ่มจำลองจะให้เซิร์ฟเวอร์เซ็นและส่งเข้า webhook จริง</p>
      <details className="group mt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
      <ul className="mt-2 space-y-3 text-sm leading-relaxed text-stone-700">
        {parts.map(([k, v]) => <li key={k}><span className="font-semibold" style={{ color: ACCENT }}>{k}</span> — {v}</li>)}
      </ul>
      </details>
    </section>
  );
}
