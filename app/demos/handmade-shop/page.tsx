"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import DemoShell from "@/components/DemoShell";
import OtpVerify from "@/components/OtpVerify";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";

const ACCENT = "#15803d";
const API = "/api/handmade-shop";

type Variant = { id: number; color: string; size: string; stock: number };
type Product = {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  price: number;
  image: string;
  desc: string;
  variants: Variant[];
};
type Catalog = { shipping: { fee: number; freeOver: number }; products: Product[] };

type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
type OrderEvent = { eventId: string; type: string; httpStatus: number; result: string; receivedAt: string };
type Order = {
  id: string;
  intentId: string;
  intentStatus: "pending" | "paid" | "expired" | "cancelled";
  payAmount: number;
  reference: string;
  paidVia: "webhook" | "slip" | "manual" | null;
  name: string;
  address?: string; // admin view only
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
  phoneMasked: string | null;
  slip: { transRef?: string; sandbox: boolean } | null;
  items: { variantId: number; name: string; image: string; color: string; size: string; qty: number }[];
  events: OrderEvent[];
};
type AdminStock = {
  totalStock: number;
  orders: number;
  pendingOrders: number;
  revenue: number;
  variants: { id: number; name: string; image: string; color: string; size: string; stock: number }[];
};
type Shortage = { product: string; requested: number; available: number };

type CartLine = { variantId: number; productId: string; color: string; size: string; qty: number };
type View = "shop" | "checkout" | "order" | "admin";

const ALL = "ทั้งหมด";
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const baht2 = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STEPS: { status: Exclude<OrderStatus, "cancelled">; label: string; event: string }[] = [
  { status: "pending", label: "รอชำระเงิน", event: "checkout.session.created" },
  { status: "paid", label: "ชำระเงินแล้ว", event: "payment.received" },
  { status: "shipped", label: "จัดส่งแล้ว", event: "order.shipped" },
];

const ADMIN_HEADERS = { "x-demo-role": "admin" };

// Per-order keys (returned once at order creation) live only in this browser.
const KEYS_STORAGE = "handmade-shop:order-keys";
type OrderKeys = Record<string, string>;

function loadKeys(): OrderKeys {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}");
    return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as OrderKeys) : {};
  } catch {
    return {};
  }
}

function saveKeys(keys: OrderKeys) {
  try {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch { /* storage unavailable: orders stay visible until reload */ }
}

type ApiResult<T> = { ok: boolean; status: number; body: T & { error?: string; details?: unknown } };

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function postJson(payload: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

type IconName = "leaf" | "cart" | "close" | "box" | "check" | "back" | "plus" | "minus";
function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    leaf: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-4 5-7 9-9" />,
    cart: <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9 20h.01M17 20h.01" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    box: <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9zM3.5 7.5L12 12l8.5-4.5M12 12v9" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    back: <path d="M19 12H5M11 6l-6 6 6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function HandmadeShopPage() {
  const [view, setView] = useState<View>("shop");
  const [category, setCategory] = useState(ALL);
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [orderKeys, setOrderKeys] = useState<OrderKeys>({});
  const [admin, setAdmin] = useState<AdminStock | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const isAdminView = view === "admin";

  // Customers see only orders whose key this browser holds; the admin tab uses the admin header.
  const refresh = useCallback(async () => {
    try {
      const keys = loadKeys();
      const creds = Object.entries(keys).map(([id, key]) => ({ id, key }));
      const [c, o, a, ao] = await Promise.all([
        call<Catalog>("/products"),
        creds.length ? call<{ orders: Order[] }>("/orders/mine", postJson({ orders: creds })) : Promise.resolve(null),
        isAdminView ? call<AdminStock>("/admin/stock", { headers: ADMIN_HEADERS }) : Promise.resolve(null),
        isAdminView ? call<{ orders: Order[] }>("/orders", { headers: ADMIN_HEADERS }) : Promise.resolve(null),
      ]);
      if (!c.ok || (o && !o.ok) || (a && !a.ok) || (ao && !ao.ok)) throw new Error("bad response");
      setCatalog(c.body);
      if (o) {
        setOrders(o.body.orders);
        const known = new Set(o.body.orders.map((x) => x.id));
        const kept = Object.fromEntries(Object.entries(keys).filter(([id]) => known.has(id)));
        if (Object.keys(kept).length !== Object.keys(keys).length) saveKeys(kept);
        setOrderKeys(kept);
      } else {
        setOrders([]);
        setOrderKeys({});
      }
      if (a && ao) {
        setAdmin(a.body);
        setAdminOrders(ao.body.orders);
      }
      setLoadError("");
    } catch {
      setLoadError("โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ กรุณารีเฟรชหน้า");
    }
  }, [isAdminView]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Keep order status fresh (payment arrives, admin ships) while any order is still open.
  const hasOpenOrder = isAdminView || orders.some((o) => o.status === "pending" || o.status === "paid");
  useEffect(() => {
    if (!hasOpenOrder) return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [hasOpenOrder, refresh]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const products = useMemo(() => catalog?.products ?? [], [catalog]);
  const categories = useMemo(() => [ALL, ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const visible = useMemo(() => products.filter((p) => category === ALL || p.category === category), [products, category]);

  const variantOf = useCallback(
    (variantId: number) => {
      for (const p of products) {
        const v = p.variants.find((x) => x.id === variantId);
        if (v) return { product: p, variant: v };
      }
      return null;
    },
    [products],
  );

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((n, l) => n + l.qty * (variantOf(l.variantId)?.product.price ?? 0), 0);
  const shippingRule = catalog?.shipping ?? { fee: 50, freeOver: 1500 };
  const shipping = cart.length === 0 || subtotal >= shippingRule.freeOver ? 0 : shippingRule.fee;
  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;

  function addToCart(product: Product, variant: Variant) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if ((existing?.qty ?? 0) >= variant.stock) return prev;
      if (existing) return prev.map((l) => (l.variantId === variant.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { variantId: variant.id, productId: product.id, color: variant.color, size: variant.size, qty: 1 }];
    });
    setDetail(null);
    setCartOpen(true);
  }

  function changeQty(variantId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.variantId !== variantId) return l;
          const max = variantOf(variantId)?.variant.stock ?? 0;
          return { ...l, qty: Math.min(l.qty + delta, max) };
        })
        .filter((l) => l.qty > 0),
    );
  }

  async function placeOrder(name: string, address: string, phone: string, otpToken: string): Promise<string | null> {
    const res = await call<{ order: Order; orderKey: string }>(
      "/orders",
      postJson({ name, address, phone, otpToken, items: cart.map((l) => ({ variantId: l.variantId, qty: l.qty })) }),
    );
    if (res.status === 409) {
      await refresh();
      const list = (res.body.details as Shortage[] | undefined) ?? [];
      return `สต็อกไม่พอ: ${list.map((d) => `${d.product} (ต้องการ ${d.requested}, เหลือ ${d.available})`).join(", ")}`;
    }
    if (!res.ok) return res.body.error ?? "สร้างคำสั่งซื้อไม่สำเร็จ";
    const keys = { ...loadKeys(), [res.body.order.id]: res.body.orderKey };
    saveKeys(keys);
    setOrderKeys(keys);
    setActiveOrderId(res.body.order.id);
    setCart([]);
    setView("order");
    await refresh();
    return null;
  }

  return (
    <DemoShell slug="handmade-shop">
      <div className="bg-stone-50 text-stone-800">
        <header className="z-40 sm:sticky sm:top-[var(--demo-shell-h,2.25rem)] border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
            <button onClick={() => setView("shop")} className="flex min-h-11 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: ACCENT }}>
                <Icon name="leaf" />
              </span>
              <span>
                <span className="block text-base font-bold leading-tight">Baan Craft</span>
                <span className="block text-xs text-stone-600">บ้านคราฟต์ · งานทำมือจากชุมชน</span>
              </span>
            </button>
            <nav className="flex items-center gap-1 text-sm" aria-label="เมนูร้านค้า">
              {(["shop", "order", "admin"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-current={view === v ? "page" : undefined}
                  className={`min-h-11 rounded-full px-3.5 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${view === v ? "text-white" : "text-stone-700 hover:bg-stone-100"}`}
                  style={view === v ? { background: ACCENT } : undefined}
                >
                  {v === "shop" ? "ร้านค้า" : v === "order" ? "คำสั่งซื้อ" : "แอดมิน"}
                </button>
              ))}
              <button
                onClick={() => setCartOpen(true)}
                className="relative ml-1 flex h-11 min-w-11 items-center justify-center rounded-full border border-stone-300 bg-white hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
                aria-label="เปิดตะกร้า"
              >
                <Icon name="cart" className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white" style={{ background: ACCENT }}>
                    {cartCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          {loadError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{loadError}</p>}

          {view === "shop" && (
            <>
              <section className="relative mb-6 overflow-hidden rounded-2xl text-white">
                <Image
                  src="/images/handmade-shop/hero.jpg"
                  alt="ช่างปั้นกำลังขึ้นรูปดินบนแป้นหมุน"
                  fill
                  priority
                  sizes="(min-width: 1024px) 1024px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,83,45,0.9), rgba(20,83,45,0.35))" }} />
                <div className="relative px-5 py-8 sm:px-10 sm:py-14">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/85">Handmade in Thailand</p>
                  <h1 className="mt-2 text-2xl font-bold leading-snug sm:text-4xl">ของใช้ทำมือ เรื่องเล่าจากชุมชน</h1>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/95 sm:text-base">
                    เซรามิกปั้นเอง เครื่องจักสาน ผ้าทอ และเทียนหอมจากถั่วเหลือง ทุกชิ้นผลิตจำนวนจำกัด ส่งฟรีเมื่อสั่งครบ {baht(shippingRule.freeOver)}
                  </p>
                </div>
              </section>

              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="หมวดหมู่สินค้า">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${category === c ? "text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
                    style={category === c ? { background: ACCENT, borderColor: ACCENT } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {!catalog && !loadError && <p className="py-16 text-center text-sm text-stone-600" role="status">กำลังโหลดสินค้า…</p>}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
                {visible.map((p) => {
                  const left = p.variants.reduce((n, v) => n + v.stock, 0);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setDetail(p)}
                      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
                    >
                      <div className="relative aspect-[4/3] bg-stone-100">
                        <Image src={p.image} alt={p.nameTh} fill sizes="(min-width: 640px) 330px, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      </div>
                      <div className="p-3 sm:p-4">
                        <p className="text-sm font-semibold leading-snug">{p.nameTh}</p>
                        <p className="text-xs text-stone-600">{p.name}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-bold" style={{ color: ACCENT }}>{baht(p.price)}</span>
                          <span className={`text-xs ${left === 0 ? "font-semibold text-red-700" : "text-stone-600"}`}>
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
            <OrdersView
              orders={orders}
              orderKeys={orderKeys}
              active={activeOrder}
              onSelect={setActiveOrderId}
              onShop={() => setView("shop")}
              onRefresh={refresh}
            />
          )}

          {view === "admin" && <AdminView admin={admin} orders={adminOrders} onRefresh={refresh} />}

          <HowItsBuilt />
        </main>

        {detail && <DetailModal product={detail} cart={cart} onClose={() => setDetail(null)} onAdd={addToCart} />}

        {cartOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={() => setCartOpen(false)}>
            <aside role="dialog" aria-modal="true" aria-label="ตะกร้าสินค้า" className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-stone-200 p-4">
                <h2 className="text-lg font-bold">ตะกร้าสินค้า ({cartCount})</h2>
                <button onClick={() => setCartOpen(false)} aria-label="ปิด" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"><Icon name="close" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {cart.length === 0 && <div className="py-12 text-center"><Icon name="cart" className="mx-auto h-10 w-10 text-stone-300" /><p className="mt-3 text-sm text-stone-600">ตะกร้ายังว่างอยู่ ลองเลือกของน่ารัก ๆ ดูนะ</p><button onClick={() => setCartOpen(false)} className="mt-4 min-h-11 rounded-full border border-stone-300 px-5 text-sm font-medium hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">เลือกสินค้าต่อ</button></div>}
                {cart.map((l) => {
                  const found = variantOf(l.variantId);
                  if (!found) return null;
                  const p = found.product;
                  return (
                    <div key={l.variantId} className="flex gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        <Image src={p.image} alt={p.nameTh} fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="font-semibold">{p.nameTh}</p>
                        <p className="text-xs text-stone-600">{l.color} · {l.size}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <button onClick={() => changeQty(l.variantId, -1)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" aria-label="ลดจำนวน"><Icon name="minus" className="h-4 w-4" /></button>
                          <span className="w-6 text-center font-medium tabular-nums">{l.qty}</span>
                          <button onClick={() => changeQty(l.variantId, 1)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" aria-label="เพิ่มจำนวน"><Icon name="plus" className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{baht(p.price * l.qty)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 border-t border-stone-200 p-4 text-sm">
                <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
                <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{shipping === 0 && cart.length > 0 ? "ฟรี" : baht(shipping)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(subtotal + shipping)}</span></div>
                <button
                  disabled={cart.length === 0}
                  onClick={() => { setCartOpen(false); setView("checkout"); }}
                  className="min-h-12 w-full rounded-full font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
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
  product, cart, onClose, onAdd,
}: {
  product: Product;
  cart: CartLine[];
  onClose: () => void;
  onAdd: (product: Product, variant: Variant) => void;
}) {
  const colors = Array.from(new Set(product.variants.map((v) => v.color)));
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)));
  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(sizes[0]);
  const variant = product.variants.find((v) => v.color === color && v.size === size);
  const available = variant ? variant.stock - (cart.find((l) => l.variantId === variant.id)?.qty ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={product.nameTh} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-56 bg-stone-100">
          <Image src={product.image} alt={product.nameTh} fill sizes="448px" className="object-cover" />
          <button onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" aria-label="ปิด"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold leading-snug">{product.nameTh}</h2>
            <p className="text-xs text-stone-600">{product.name} · {product.category}</p>
            <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>{baht(product.price)}</p>
          </div>
          <p className="text-sm leading-relaxed text-stone-700">{product.desc}</p>
          <Picker label="สี / กลิ่น" options={colors} value={color} onChange={setColor} />
          <Picker label="ขนาด" options={sizes} value={size} onChange={setSize} />
          <p className={`text-sm ${available <= 0 ? "text-red-700" : available <= 2 ? "text-amber-700" : "text-stone-600"}`}>
            {available <= 0 ? "สินค้าตัวเลือกนี้หมดแล้ว" : `คงเหลือ ${available} ชิ้น`}
          </p>
          <button
            disabled={available <= 0 || !variant}
            onClick={() => variant && onAdd(product, variant)}
            className="min-h-12 w-full rounded-full font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
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
      <p className="mb-1.5 text-xs font-semibold text-stone-600">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`min-h-11 rounded-full border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${value === o ? "text-white" : "border-stone-300 hover:bg-stone-100"}`}
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
  subtotal: number; shipping: number; total: number; onBack: () => void;
  onPay: (name: string, address: string, phone: string, otpToken: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subtotal <= 0) return setError("ตะกร้าว่างเปล่า");
    if (!name.trim() || !address.trim()) return setError("กรุณากรอกชื่อและที่อยู่จัดส่ง");
    if (!otpToken || verifiedPhone !== phone) return setError("กรุณายืนยันเบอร์โทรด้วย OTP ก่อนสั่งซื้อ");
    setError("");
    setPaying(true);
    const failure = await onPay(name.trim(), address.trim(), phone, otpToken);
    if (failure) {
      setError(failure);
      setPaying(false);
    }
  }

  const field = "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-green-700 focus:ring-2 focus:ring-green-700/25 sm:text-sm";
  const phoneVerified = !!otpToken && verifiedPhone === phone;

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 text-sm text-stone-600 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"><Icon name="back" className="h-4 w-4" /> กลับไปเลือกสินค้า</button>
      <h1 className="text-xl font-bold">สั่งซื้อสินค้า</h1>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold">1. ที่อยู่จัดส่ง</h2>
        <input className={field} placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={field} rows={2} placeholder="ที่อยู่จัดส่ง" value={address} onChange={(e) => setAddress(e.target.value)} />
      </section>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold">2. ยืนยันเบอร์โทรด้วย OTP</h2>
        <input className={field} inputMode="tel" placeholder="เบอร์โทร เช่น 0812345678" value={phone} onChange={(e) => { setPhone(e.target.value); setOtpToken(null); }} />
        {phoneVerified ? (
          <p className="rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800">ยืนยันเบอร์ {phone} แล้ว</p>
        ) : (
          <OtpVerify key={phone} phone={phone} accent={ACCENT} onVerified={(t) => { setOtpToken(t); setVerifiedPhone(phone); }} />
        )}
        <p className="text-xs leading-relaxed text-stone-600">ต้องยืนยันเบอร์ก่อนสร้างคำสั่งซื้อ หลังสั่งซื้อจะได้ QR PromptPay ระบบตรวจพบยอดเข้าอัตโนมัติ (แนบสลิปได้หากต้องการ)</p>
      </section>
      <div className="space-y-1.5 rounded-2xl border border-stone-200 bg-white p-4 text-sm sm:p-5">
        <div className="flex justify-between"><span>ยอดสินค้า</span><span>{baht(subtotal)}</span></div>
        <div className="flex justify-between"><span>ค่าจัดส่ง</span><span>{shipping === 0 ? "ฟรี" : baht(shipping)}</span></div>
        <div className="flex justify-between text-base font-bold"><span>รวม</span><span>{baht(total)}</span></div>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <button disabled={paying || !phoneVerified} className="min-h-12 w-full rounded-full font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" style={{ background: ACCENT }}>
        {paying ? "กำลังดำเนินการ…" : `สร้างคำสั่งซื้อ ${baht(total)}`}
      </button>
    </form>
  );
}

function PayPanel({ order, orderKey, onChanged }: { order: Order; orderKey: string | undefined; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function renew() {
    setBusy(true);
    setError("");
    const res = await call<{ order: Order }>(`/orders/${order.id}/renew`, { method: "POST", headers: { "x-order-key": orderKey ?? "" } });
    if (!res.ok) setError(res.body.error ?? "ออก QR ใหม่ไม่สำเร็จ");
    setBusy(false);
    await onChanged();
  }
  if (order.intentStatus === "pending" && orderKey) {
    return (
      <QrPayPanel
        key={order.intentId}
        scope="handmade-shop"
        apiBase={`${API}/pay/${orderKey}`}
        intentId={order.intentId}
        accent={ACCENT}
        onPaid={() => void onChanged()}
        onClosed={() => void onChanged()}
        sandboxNote='เดโม: ยังไม่มีฟีดธนาคารจริง ให้ไปที่แท็บ Admin แล้วกด "จำลองแจ้งเงินเข้า (sandbox)"'
      />
    );
  }
  return (
    <div className="mt-4 space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
      <p className="text-stone-600">QR ของคำสั่งซื้อนี้หมดเวลาแล้ว คำสั่งซื้อยังเปิดอยู่ ออก QR ใหม่ได้ (ยอดโอนจะเปลี่ยนเล็กน้อย) หากโอนไปแล้วให้ติดต่อร้าน</p>
      <button disabled={busy} onClick={() => void renew()} className="min-h-11 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" style={{ background: ACCENT }}>
        {busy ? "กำลังออก QR…" : "ออก QR ใหม่"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function OrdersView({
  orders, orderKeys, active, onSelect, onShop, onRefresh,
}: { orders: Order[]; orderKeys: OrderKeys; active: Order | null; onSelect: (id: string) => void; onShop: () => void; onRefresh: () => Promise<void> }) {
  if (orders.length === 0) {
    return (
      <div className="py-16 text-center">
        <Icon name="box" className="mx-auto h-12 w-12 text-stone-300" />
        <p className="mt-3 text-sm text-stone-600">ยังไม่มีคำสั่งซื้อ ลองสั่งสินค้าแล้วสแกน QR เพื่อชำระเงิน</p>
        <button onClick={onShop} className="mt-4 min-h-11 rounded-full px-6 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700" style={{ background: ACCENT }}>ไปเลือกสินค้า</button>
      </div>
    );
  }
  const order = active ?? orders[0];
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-xs leading-relaxed text-stone-600">แสดงเฉพาะคำสั่งซื้อที่สร้างจากเบราว์เซอร์นี้ (รหัสเข้าถึงเก็บไว้ในเครื่องของคุณ)</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {orders.map((o) => (
          <button key={o.id} onClick={() => onSelect(o.id)} aria-pressed={o.id === order.id}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${o.id === order.id ? "border-green-700 bg-green-50" : "border-stone-300 bg-white"}`}>
            {o.id}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-bold">คำสั่งซื้อ {order.id}</h1>
        <p className="text-xs leading-relaxed text-stone-600">ผู้รับ {order.name} · ยอดรวม {baht(order.total)} (รวมค่าจัดส่ง {order.shipping === 0 ? "ฟรี" : baht(order.shipping)})</p>
        <ul className="mt-3 space-y-2">
          {order.items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 text-sm">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
                <Image src={i.image} alt={i.name} fill sizes="40px" className="object-cover" />
              </span>
              <span className="flex-1">{i.name}<span className="block text-xs text-stone-600">{i.color} · {i.size}</span></span>
              <span className="text-stone-600">x{i.qty}</span>
            </li>
          ))}
        </ul>
        {order.status === "cancelled" ? (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-700">คำสั่งซื้อถูกยกเลิก: สต็อกหมดก่อนที่การชำระเงินจะยืนยัน (ไม่มีการตัดสต็อก ร้านจะคืนเงินให้)</p>
        ) : (
          <ol className="mt-5 space-y-0">
            {STEPS.map((s, i) => {
              const done = i <= stepIndex;
              return (
                <li key={s.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "text-white" : "bg-stone-200 text-stone-600"}`} style={done ? { background: ACCENT } : undefined}>
                      {done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className={`h-8 w-0.5 ${i < stepIndex ? "" : "bg-stone-200"}`} style={i < stepIndex ? { background: ACCENT } : undefined} />}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-semibold ${done ? "" : "text-stone-500"}`}>{s.label}</p>
                    <p className="font-mono text-[11px] text-stone-500">{s.event}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {order.status === "pending" && <PayPanel order={order} orderKey={orderKeys[order.id]} onChanged={onRefresh} />}
        {order.status === "paid" && <p className="mt-2 text-xs leading-relaxed text-stone-600">ได้รับเงินแล้ว ({order.paidVia === "webhook" ? "ตรวจพบอัตโนมัติจากแจ้งเงินเข้า" : order.paidVia === "slip" ? "ยืนยันด้วยสลิป" : "ร้านยืนยันเอง"}) ยอด {baht2(order.payAmount)} รอแอดมินกดจัดส่ง</p>}
        {order.slip?.sandbox && <p className="mt-2 text-xs text-amber-700">ยังไม่ได้ตั้งค่า API key จึงเป็นโหมดทดสอบ: สลิปนี้ไม่ได้ถูกตรวจกับธนาคารจริง</p>}
        {order.status === "pending" && <p className="mt-2 text-xs text-stone-600">ยอดที่ต้องโอนตาม QR {baht2(order.payAmount)} (เศษสตางค์ใช้จับคู่กับคำสั่งซื้อ)</p>}
      </div>
      <div className="space-y-0.5 overflow-x-auto rounded-2xl bg-stone-900 p-4 font-mono text-[11px] leading-relaxed text-green-300">
        <p>{`> order ${order.id} created, status=pending`}</p>
        {order.events.map((e) => (
          <p key={e.eventId}>{`> ${e.type} ${e.eventId} -> ${e.httpStatus} ${e.result}`}</p>
        ))}
      </div>
    </div>
  );
}

function AdminView({ admin, orders, onRefresh }: { admin: AdminStock | null; orders: Order[]; onRefresh: () => Promise<void> }) {
  const [note, setNote] = useState("");
  async function ship(orderId: string) {
    const res = await call<{ duplicate?: boolean; result?: string }>(`/admin/orders/${orderId}/ship`, { method: "POST", headers: ADMIN_HEADERS });
    setNote(res.body.duplicate ? `${orderId}: ส่ง event ซ้ำ เซิร์ฟเวอร์ตอบ duplicate และไม่เปลี่ยนสถานะ` : `${orderId}: ${res.body.result ?? res.body.error}`);
    await onRefresh();
  }
  if (!admin) return <p className="py-16 text-center text-sm text-stone-600" role="status">กำลังโหลดข้อมูล…</p>;
  const recentEvents = orders
    .flatMap((o) => o.events.map((e) => ({ ...e, orderId: o.id })))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 8);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">แอดมิน · สต็อกและคำสั่งซื้อ</h1>
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[["สต็อกรวม", String(admin.totalStock)], ["ออเดอร์", String(admin.orders)], ["รอชำระ", String(admin.pendingOrders)], ["รายได้", baht(admin.revenue)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-stone-200 bg-white p-3.5">
            <p className="text-lg font-bold" style={{ color: ACCENT }}>{v}</p>
            <p className="text-xs text-stone-600">{k}</p>
          </div>
        ))}
      </div>
      <PayeeSettings scope="handmade-shop" headers={ADMIN_HEADERS} accent={ACCENT} onSaved={() => void onRefresh()} />
      <SandboxSimulate scope="handmade-shop" headers={ADMIN_HEADERS} accent={ACCENT} onDone={() => void onRefresh()}
        targets={orders.filter((o) => o.status === "pending" && o.intentStatus === "pending").map((o) => ({ key: o.id, label: o.id, amount: o.payAmount, reference: o.reference }))} />
      <UnmatchedPayments scope="handmade-shop" headers={ADMIN_HEADERS} accent={ACCENT} onAssigned={() => void onRefresh()}
        targets={orders.filter((o) => o.status === "pending").map((o) => ({ intentId: o.intentId, label: `${o.id} · ${baht2(o.payAmount)} · ${o.intentStatus === "pending" ? "รอชำระ" : "QR หมดเวลา"}` }))} />
      <div className="max-h-[28rem] overflow-auto rounded-2xl border border-stone-200 bg-white" tabIndex={0} role="region" aria-label="ตารางสต็อกสินค้า">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="sticky top-0 bg-stone-100 text-xs text-stone-600">
            <tr><th className="p-3 font-medium">สินค้า</th><th className="p-3 font-medium">ตัวเลือก</th><th className="p-3 text-right font-medium">คงเหลือ</th></tr>
          </thead>
          <tbody>
            {admin.variants.map((v) => (
              <tr key={v.id} className="border-t border-stone-100">
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded bg-stone-100">
                      <Image src={v.image} alt="" fill sizes="28px" className="object-cover" />
                    </span>
                    {v.name}
                  </span>
                </td>
                <td className="p-3 text-xs text-stone-600">{v.color} · {v.size}</td>
                <td className={`p-3 text-right font-semibold tabular-nums ${v.stock === 0 ? "text-red-700" : v.stock <= 2 ? "text-amber-700" : ""}`}>{v.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold">จัดส่งคำสั่งซื้อ</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-600">ส่งคำขอพร้อม header x-demo-role: admin ซึ่งเป็นตัวแทนการล็อกอินแอดมินในเดโม</p>
        <ul className="mt-3 divide-y divide-stone-100 text-sm">
          {orders.filter((o) => o.status === "paid" || o.status === "shipped").map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{o.id} · {o.name} · {baht(o.total)} · {o.status === "paid" ? "ชำระแล้ว" : "จัดส่งแล้ว"}</span>
              <button onClick={() => void ship(o.id)} className="min-h-11 rounded-full border border-stone-300 px-4 text-xs font-medium hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
                {o.status === "paid" ? "จัดส่ง" : "ส่งซ้ำ (ทดสอบ idempotency)"}
              </button>
            </li>
          ))}
          {!orders.some((o) => o.status === "paid" || o.status === "shipped") && <li className="py-2 text-xs text-stone-600">ยังไม่มีคำสั่งซื้อที่ชำระแล้ว</li>}
        </ul>
        {note && <p className="mt-2 text-xs text-stone-700" role="status">{note}</p>}
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold">เหตุการณ์ล่าสุด (events)</h2>
        {recentEvents.length === 0 ? (
          <p className="mt-2 text-xs text-stone-600">ยังไม่มีเหตุการณ์</p>
        ) : (
          <ul className="mt-2 space-y-1 overflow-x-auto font-mono text-[11px] text-stone-700">
            {recentEvents.map((e) => (
              <li key={e.eventId} className="whitespace-nowrap">{`${e.orderId} ${e.type} -> ${e.httpStatus} ${e.result}`}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HowItsBuilt() {
  const parts: [string, string][] = [
  ["Route Handlers + SQLite (เดโมนี้)", "สินค้า ตัวเลือกสินค้าพร้อมสต็อก ออเดอร์ และเหตุการณ์ต่าง ๆ เก็บอยู่ใน SQLite ผ่าน /api/handmade-shop การสร้างออเดอร์ทำเป็น transaction เดียว และจะปฏิเสธด้วยรหัส 409 หากสต็อกไม่พอ"],
  ["ThaiBulkSMS OTP (เดโมนี้)", "การสร้างออเดอร์ต้องยืนยันเบอร์โทรด้วย OTP ก่อน โดยฝั่งเซิร์ฟเวอร์จะตรวจโทเคนซ้ำอีกครั้ง และตอบกลับด้วยรหัส 403 หากไม่ผ่าน หากไม่มี API key ระบบจะทำงานในโหมด sandbox ที่แสดงป้ายบอกชัดเจน"],
  ["PromptPay QR ตรวจจับยอดอัตโนมัติ (เดโมนี้)", "ตอนสร้างออเดอร์ เซิร์ฟเวอร์จะคำนวณยอดรวม (สินค้ารวมค่าจัดส่ง) และออกรายการชำระเงินที่มียอดเศษสตางค์ไม่ซ้ำกัน หน้าชำระเงินจะแสดง PromptPay QR ตามยอดนั้นพอดี เมื่อมีแจ้งเงินเข้า ระบบจะรับผ่าน webhook ที่เซ็นลายเซ็นไว้ (HMAC-SHA256 จากเวลาและเนื้อหาข้อความ) แล้วจับคู่ยอดและรหัสอ้างอิงให้ตรงกัน จากนั้นเปลี่ยนออเดอร์เป็นชำระแล้วและตัดสต็อกเพียงครั้งเดียวใน transaction เดียวกัน หากส่งซ้ำก็ไม่เกิดผลซ้ำ ยอดที่ไม่รู้ที่มาจะเข้าไปอยู่ในรายการที่ยังจับคู่ไม่ได้ ซึ่งเจ้าของร้านกำหนดให้เองได้ และหากสต็อกหมดก่อนที่เงินจะเข้า ระบบจะยกเลิกออเดอร์และพักเงินไว้เพื่อคืนให้ลูกค้า"],
  ["สลิปสำรองผ่าน Thunder API (เดโมนี้)", "หากระบบตรวจจับยอดช้า ลูกค้าสามารถอัปโหลดสลิปในหน้าต่างเดิมได้ เซิร์ฟเวอร์จะตรวจสลิปผ่าน Thunder API เทียบกับยอดของรายการชำระเงิน ปฏิเสธสลิปที่เคยใช้แล้วด้วยรหัส 409 และดำเนินการต่อด้วยขั้นตอนเดียวกัน หากไม่มี API key จะเป็น sandbox ที่รับรูปภาพใดก็ได้"],
  ["ระบบรับแจ้งเงินเข้าในงานจริง", "ในงานจริง webhook จะรับข้อมูลจากบริการแจ้งเงินเข้าของธนาคารหรือผู้ให้บริการชำระเงิน (ใช้ SQLite ในเดโม และ PostgreSQL ในงานจริง) เจ้าของร้านเลือกใช้ PromptPay ID แบบนิติบุคคลหรือบุคคลธรรมดาได้ในหน้าแอดมิน"],
  ["การจัดส่ง (เดโมนี้)", "การจัดส่งเป็นงานของแอดมิน (ส่ง header x-demo-role: admin) และทำซ้ำได้โดยไม่เกิดผลซ้ำต่อหนึ่งออเดอร์ หากสั่งซ้ำ ระบบจะคืนผลเดิมและไม่เปลี่ยนแปลงอะไร"],
  ["Supabase / PostgreSQL (งานจริง)", "ตารางชุดเดียวกันย้ายไปอยู่ใน PostgreSQL พร้อม row-level security ส่วนรูปสินค้าเก็บไว้ใน Supabase Storage และส่งผ่าน CDN"],
  ["Next.js + TypeScript + Tailwind CSS", "โมเดลสินค้าและออเดอร์แบบมีชนิดข้อมูล (typed) ใช้ร่วมกันระหว่าง Route Handlers กับหน้าร้านและหน้าแอดมินที่ออกแบบมาให้ใช้งานบนมือถือเป็นหลัก"],
  ];
  return (
    <section className="mt-12 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-bold">สร้างอย่างไร</h2>
<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
        <li>ของจริงในเดโมนี้: สินค้า สต็อก และออเดอร์ เก็บใน SQLite ผ่าน API จริง และยืนยันเบอร์ด้วย OTP</li>
        <li>การชำระเงิน: ระบบตรวจจับเงินเข้า PromptPay QR อัตโนมัติผ่าน webhook ที่เซ็นลายเซ็นไว้ และมีการอัปโหลดสลิปเป็นทางสำรอง</li>
        <li>ในงานจริง: Supabase (PostgreSQL) รับแจ้งเงินเข้าจากธนาคารหรือผู้ให้บริการชำระเงิน และเก็บรูปสินค้าบน Supabase Storage</li>
      </ul>
      <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">หมายเหตุ: เดโมนี้ยังไม่ได้เชื่อมต่อฟีดแจ้งเงินเข้าจากธนาคารจริง ปุ่ม &ldquo;จำลองแจ้งเงินเข้า&rdquo; ในหน้าแอดมินจะสร้างและเซ็นเหตุการณ์เองแล้วส่งเข้า webhook จริงของระบบ จึงผ่านการตรวจลายเซ็นและการจับคู่ยอดเหมือนใช้งานจริง</p>
      <details className="group mt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803d] [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
      <ul className="mt-2 divide-y divide-stone-100 text-sm leading-relaxed text-stone-700">
        {parts.map(([k, v]) => (
          <li key={k} className="py-3 first:pt-0 last:pb-0"><span className="block font-semibold" style={{ color: ACCENT }}>{k}</span>{v}</li>
        ))}
      </ul>
      </details>
    </section>
  );
}
