"use client";

import { useEffect, useMemo, useState } from "react";

const ACCENT = "#b45309";

type Category = "coffee" | "tea" | "bakery" | "food";
type Item = { id: string; name: string; th: string; price: number; cat: Category; emoji: string; available: boolean };
type Status = "new" | "preparing" | "ready";
type Order = { id: number; table: number; lines: { name: string; qty: number }[]; total: number; status: Status };

const categories: { key: Category; label: string }[] = [
  { key: "coffee", label: "กาแฟ Coffee" },
  { key: "tea", label: "ชา Tea" },
  { key: "bakery", label: "เบเกอรี่ Bakery" },
  { key: "food", label: "อาหาร Food" },
];

const initialMenu: Item[] = [
  { id: "m1", name: "Iced Latte", th: "ลาเต้เย็น", price: 75, cat: "coffee", emoji: "🧋", available: true },
  { id: "m2", name: "Flat White", th: "แฟลตไวท์", price: 80, cat: "coffee", emoji: "☕", available: true },
  { id: "m3", name: "Cold Brew", th: "โคลด์บรูว์", price: 85, cat: "coffee", emoji: "🥤", available: true },
  { id: "m4", name: "Thai Milk Tea", th: "ชาไทยเย็น", price: 60, cat: "tea", emoji: "🧉", available: true },
  { id: "m5", name: "Matcha Latte", th: "มัทฉะลาเต้", price: 85, cat: "tea", emoji: "🍵", available: true },
  { id: "m6", name: "Butter Croissant", th: "ครัวซองต์เนยสด", price: 65, cat: "bakery", emoji: "🥐", available: true },
  { id: "m7", name: "Banana Bread", th: "บานาน่าเบรด", price: 70, cat: "bakery", emoji: "🍞", available: true },
  { id: "m8", name: "Basil Pork Toast", th: "ขนมปังกะเพราหมู", price: 95, cat: "food", emoji: "🥪", available: true },
  { id: "m9", name: "Carbonara", th: "คาร์โบนารา", price: 120, cat: "food", emoji: "🍝", available: true },
];

const seedOrders: Order[] = [
  { id: 1041, table: 3, lines: [{ name: "Iced Latte", qty: 2 }, { name: "Butter Croissant", qty: 1 }], total: 215, status: "preparing" },
  { id: 1042, table: 7, lines: [{ name: "Carbonara", qty: 1 }], total: 120, status: "new" },
];

const statusMeta: Record<Status, { label: string; cls: string }> = {
  new: { label: "ใหม่ New", cls: "bg-sky-100 text-sky-800" },
  preparing: { label: "กำลังทำ Preparing", cls: "bg-amber-100 text-amber-800" },
  ready: { label: "พร้อมเสิร์ฟ Ready", cls: "bg-emerald-100 text-emerald-800" },
};
const nextStatus: Record<Status, Status | null> = { new: "preparing", preparing: "ready", ready: null };

// Deterministic pseudo-QR so the demo needs no library.
function FakeQr({ seed, size = 168 }: { seed: number; size?: number }) {
  const n = 25;
  const cells: React.ReactNode[] = [];
  let s = seed * 9301 + 49297;
  const finder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      s = (s * 9301 + 49297) % 233280;
      if (!finder(x, y) && s / 233280 > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`e${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} role="img" aria-label="PromptPay QR (demo)" className="rounded bg-white">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="white" />
      <g fill="#1e293b">{cells}{eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}</g>
    </svg>
  );
}

type Tab = "menu" | "kitchen" | "admin";

export default function CafeApp() {
  const [tab, setTab] = useState<Tab>("menu");
  const [table, setTable] = useState(5);
  const [cat, setCat] = useState<Category>("coffee");
  const [menu, setMenu] = useState(initialMenu);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState(seedOrders);
  const [nextId, setNextId] = useState(1043);
  const [checkout, setCheckout] = useState(false);
  const [paid, setPaid] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);

  // Simulates realtime kitchen progress: advance the oldest unfinished order.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      setOrders((os) => {
        const target = os.find((o) => o.status !== "ready");
        if (!target) return os;
        return os.map((o) => (o.id === target.id ? { ...o, status: nextStatus[o.status] ?? o.status } : o));
      });
    }, 6000);
    return () => clearInterval(t);
  }, [auto]);

  const lines = useMemo(
    () => menu.filter((m) => cart[m.id]).map((m) => ({ item: m, qty: cart[m.id] })),
    [menu, cart],
  );
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (id: string, d: number) =>
    setCart((c) => {
      const q = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c };
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const confirmPayment = () => {
    setOrders((os) => [
      ...os,
      { id: nextId, table, lines: lines.map((l) => ({ name: l.item.name, qty: l.qty })), total, status: "new" },
    ]);
    setPaid(nextId);
    setNextId(nextId + 1);
    setCart({});
    setCheckout(false);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "menu", label: "เมนู Menu" },
    { key: "kitchen", label: `ครัว Kitchen (${orders.filter((o) => o.status !== "ready").length})` },
    { key: "admin", label: "แอดมิน Admin" },
  ];

  return (
    <div className="bg-[#fffaf3] pb-24">
      <header className="px-5 pb-6 pt-8 text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, #78350f)` }}>
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-amber-200">Specialty Coffee · Ari, Bangkok</p>
          <h1 className="mt-1 text-3xl font-bold">Brew &amp; Bean ☕</h1>
          <p className="mt-1 text-sm text-amber-100">สแกน QR สั่งที่โต๊ะ ไม่ต้องรอคิว — Scan, order, sip.</p>
          <label className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm">
            โต๊ะ Table
            <select
              value={table}
              onChange={(e) => setTable(Number(e.target.value))}
              className="rounded bg-white px-2 py-0.5 font-semibold text-neutral-900"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav className="sticky top-9 z-40 border-b border-amber-200 bg-[#fffaf3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-3 text-sm font-medium ${tab === t.key ? "border-b-2" : "text-neutral-500"}`}
              style={tab === t.key ? { borderColor: ACCENT, color: ACCENT } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {paid !== null && tab === "menu" && (
          <div className="mb-4 flex items-start justify-between rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <span>✅ ชำระเงินสำเร็จ — ออเดอร์ #{paid} ส่งเข้าครัวแล้ว (Payment received, order sent to kitchen)</span>
            <button onClick={() => setPaid(null)} aria-label="Dismiss" className="ml-3">✕</button>
          </div>
        )}

        {tab === "menu" && (
          <section>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${cat === c.key ? "text-white" : "bg-white text-neutral-700"}`}
                  style={cat === c.key ? { background: ACCENT, borderColor: ACCENT } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ul className="space-y-3">
              {menu.filter((m) => m.cat === cat).map((m) => (
                <li key={m.id} className={`flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ${m.available ? "" : "opacity-50"}`}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100 text-3xl">{m.emoji}</div>
                  <div className="flex-1">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-neutral-500">{m.th}</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: ACCENT }}>฿{m.price}</p>
                  </div>
                  {m.available ? (
                    cart[m.id] ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => add(m.id, -1)} className="h-8 w-8 rounded-full border text-lg" aria-label="Remove one">−</button>
                        <span className="w-4 text-center text-sm">{cart[m.id]}</span>
                        <button onClick={() => add(m.id, 1)} className="h-8 w-8 rounded-full text-lg text-white" style={{ background: ACCENT }} aria-label="Add one">+</button>
                      </div>
                    ) : (
                      <button onClick={() => add(m.id, 1)} className="rounded-full px-4 py-1.5 text-sm font-medium text-white" style={{ background: ACCENT }}>
                        เพิ่ม Add
                      </button>
                    )
                  ) : (
                    <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs text-neutral-600">หมด Sold out</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "kitchen" && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">จอครัว Kitchen board</h2>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                จำลองเรียลไทม์ Live simulation
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {orders.map((o) => {
                const nxt = nextStatus[o.status];
                return (
                  <article key={o.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">#{o.id} · โต๊ะ {o.table}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta[o.status].cls}`}>{statusMeta[o.status].label}</span>
                    </div>
                    <ul className="mt-2 text-sm text-neutral-700">
                      {o.lines.map((l) => (
                        <li key={l.name}>{l.qty}× {l.name}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-500">฿{o.total}</span>
                      {nxt && (
                        <button
                          onClick={() => setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: nxt } : x)))}
                          className="rounded-full px-3 py-1 text-xs font-medium text-white"
                          style={{ background: ACCENT }}
                        >
                          → {statusMeta[nxt].label}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "admin" && (
          <section>
            <h2 className="text-lg font-semibold">จัดการเมนู Menu management</h2>
            <p className="mb-3 text-sm text-neutral-500">เปิด/ปิดสินค้าที่หมด — มีผลกับเมนู QR ทันที (Toggle availability; the QR menu updates instantly.)</p>
            <ul className="divide-y rounded-2xl bg-white shadow-sm">
              {menu.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3">
                  <span>{m.emoji} {m.name} <span className="text-xs text-neutral-400">฿{m.price}</span></span>
                  <button
                    role="switch"
                    aria-checked={m.available}
                    onClick={() => setMenu((ms) => ms.map((x) => (x.id === m.id ? { ...x, available: !x.available } : x)))}
                    className="relative h-6 w-11 rounded-full transition-colors"
                    style={{ background: m.available ? ACCENT : "#d4d4d4" }}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${m.available ? "left-5" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-amber-200 bg-white p-5">
          <h2 className="text-lg font-semibold">How it&apos;s built</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li><b>Next.js</b> — one QR per table links to /t/[table]; server-rendered menu loads fast on phones.</li>
            <li><b>TypeScript</b> — shared Order and MenuItem types keep the kitchen, menu and admin in sync.</li>
            <li><b>Supabase Realtime</b> — new orders and status changes push to the kitchen screen without refresh.</li>
            <li><b>Stripe PromptPay</b> — creates a PromptPay QR per order and confirms payment by webhook.</li>
            <li><b>Tailwind CSS</b> — a mobile-first, brand-themed UI that is quick to adjust per shop.</li>
          </ul>
        </section>
      </main>

      {count > 0 && tab === "menu" && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <button
            onClick={() => setCheckout(true)}
            className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-full px-6 py-3 font-semibold text-white shadow-lg"
            style={{ background: ACCENT }}
          >
            <span>🛒 ตะกร้า Cart · {count}</span>
            <span>฿{total} · ชำระเงิน Pay</span>
          </button>
        </div>
      )}

      {checkout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setCheckout(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">ชำระเงิน PromptPay · โต๊ะ {table}</h3>
            <ul className="mt-2 text-sm text-neutral-700">
              {lines.map((l) => (
                <li key={l.item.id} className="flex justify-between"><span>{l.qty}× {l.item.name}</span><span>฿{l.item.price * l.qty}</span></li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4">
              <FakeQr seed={table * 100 + count} />
              <p className="text-xl font-bold">฿{total}</p>
              <p className="text-xs text-neutral-500">สแกนด้วยแอปธนาคาร Scan with any Thai banking app (demo QR)</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCheckout(false)} className="flex-1 rounded-full border py-2.5 text-sm">ยกเลิก Cancel</button>
              <button onClick={confirmPayment} className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white" style={{ background: ACCENT }}>
                จำลองชำระแล้ว Simulate paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
