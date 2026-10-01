"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import DemoLauncher from "./DemoLauncher";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";
import { useCallback, useEffect, useMemo, useState } from "react";

const ACCENT = "#b45309";
const API = "/api/cafe-qr-order";
const POLL_MS = 3000;

type Category = "coffee" | "tea" | "bakery" | "food";
type Status = "new" | "preparing" | "ready" | "paid";
type Item = { id: string; name: string; th: string; price: number; cat: Category; image: string; available: boolean };
type Order = {
  id: number;
  table: number;
  total: number;
  status: Status;
  createdAt: string;
  payment: { intentId: string; status: "pending" | "paid" | "expired" | "cancelled"; payAmount: number; reference: string; expiresAt: number; paidVia: "webhook" | "slip" | "manual" | null } | null;
  lines: { itemId: string; name: string; price: number; qty: number }[];
};

const categories: { key: Category; label: string }[] = [
  { key: "coffee", label: "กาแฟ" },
  { key: "tea", label: "ชา" },
  { key: "bakery", label: "เบเกอรี่" },
  { key: "food", label: "อาหาร" },
];

const statusMeta: Record<Status, { label: string; cls: string }> = {
  new: { label: "ใหม่", cls: "bg-sky-100 text-sky-800" },
  preparing: { label: "กำลังทำ", cls: "bg-amber-100 text-amber-800" },
  ready: { label: "พร้อมเสิร์ฟ", cls: "bg-emerald-100 text-emerald-800" },
  paid: { label: "ชำระแล้ว", cls: "bg-neutral-200 text-neutral-700" },
};
const nextStatus: Record<Status, Status | null> = { new: "preparing", preparing: "ready", ready: null, paid: null };

type IconProps = { className?: string };
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const CartIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M2 3h3l2.5 12h11L21 7H6" />
  </svg>
);
const CheckIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 3 3 5-6" />
  </svg>
);
const CloseIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const AlertIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
);
const PulseIcon = ({ className }: IconProps) => (
  <svg {...svgProps} className={className}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
);

type Tab = "menu" | "kitchen" | "admin" | "demo";
type Role = "staff" | "admin";

const ADMIN_HEADERS = { "x-demo-role": "admin" };
const STAFF_HEADERS = { "x-demo-role": "staff" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const jsonInit = (method: string, body: unknown, headers?: Record<string, string>): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export default function CafeApp({ table, tableToken }: { table: number | null; tableToken: string | null }) {
  const [tab, setTab] = useState<Tab>("menu");
  const [cat, setCat] = useState<Category>("coffee");
  const [menu, setMenu] = useState<Item[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [staffOrders, setStaffOrders] = useState<Order[]>([]);
  const [launcherOn, setLauncherOn] = useState(false);
  const [launcherChecked, setLauncherChecked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payingId, setPayingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [role, setRole] = useState<Role>("staff");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const m = await api<{ menu: Item[] }>("/menu");
      setMenu(m.menu);
      // Staff screens get the full list; the customer view only ever asks for its own table by signed token.
      if (tab === "kitchen" || tab === "admin") {
        setStaffOrders((await api<{ orders: Order[] }>("/orders", { headers: STAFF_HEADERS })).orders);
      } else if (tableToken) {
        setMyOrders((await api<{ orders: Order[] }>(`/orders?tableToken=${encodeURIComponent(tableToken)}`)).orders.slice().reverse());
      }
      setLoaded(true);
    } catch {
      // A failed poll keeps the last good data; the next tick retries.
    }
  }, [tab, tableToken]);

  useEffect(() => {
    fetch(`${API}/demo-tables`, { cache: "no-store" })
      .then((res) => setLauncherOn(res.ok))
      .catch(() => setLauncherOn(false))
      .finally(() => setLauncherChecked(true));
  }, []);

  // Poll so orders and availability changed in another tab show up without reload.
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const lines = useMemo(
    () => menu.filter((m) => cart[m.id]).map((m) => ({ item: m, qty: cart[m.id] })),
    [menu, cart],
  );
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const kitchenOrders = staffOrders.filter((o) => o.status !== "paid");
  const paying = [...myOrders, ...staffOrders].find((o) => o.id === payingId) ?? null;
  const pendingPayments = staffOrders.filter((o) => o.payment?.status === "pending");

  const add = (id: string, d: number) =>
    setCart((c) => {
      const q = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c };
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setNotice(null);
    try {
      const ok = await action();
      if (ok) setNotice({ kind: "ok", text: ok });
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const placeOrder = () =>
    run(async () => {
      const items = lines.map((l) => ({ id: l.item.id, qty: l.qty }));
      const { order } = await api<{ order: Order }>("/orders", jsonInit("POST", { tableToken, items }));
      setCart({});
      return `ส่งออเดอร์ #${order.id} เข้าครัวแล้ว`;
    });

  const advance = (o: Order, to: Status) =>
    run(async () => {
      await api(`/orders/${o.id}`, jsonInit("PATCH", { status: to }, STAFF_HEADERS));
      return null;
    });

  // The server creates the QR intent from the stored order total; the client only names the order.
  const startPayment = (o: Order) =>
    run(async () => {
      await api(`/orders/${o.id}/pay`, { method: "POST", headers: { "x-table-token": tableToken ?? "" } });
      setPayingId(o.id);
      return null;
    });

  const onPaid = (id: number) => {
    setNotice({ kind: "ok", text: `ได้รับเงินแล้ว ออเดอร์ #${id} (Payment received for order #${id})` });
    void refresh();
  };

  const toggleAvailability = (m: Item) =>
    run(async () => {
      await api(
        `/menu/${m.id}`,
        jsonInit("PATCH", { available: !m.available }, role === "admin" ? ADMIN_HEADERS : undefined),
      );
      return null;
    });

  const tabs: { key: Tab; th: string }[] = [
    { key: "menu", th: "เมนู" },
    { key: "kitchen", th: tab === "kitchen" || tab === "admin" ? `ครัว (${kitchenOrders.length})` : "ครัว" },
    { key: "admin", th: "แอดมิน" },
    ...(launcherOn ? [{ key: "demo" as const, th: "ทดลองเดโม" }] : []),
  ];

  return (
    <div className="bg-[#fffaf3] pb-24">
      <header className="relative overflow-hidden px-5 pb-6 pt-8 text-white">
        <Image
          src="/images/cafe-qr-order/hero-interior.jpg"
          alt="Interior of a bright café with a coffee bar, plants and wooden chairs"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(92,38,8,0.9) 0%, rgba(92,38,8,0.7) 55%, rgba(69,26,3,0.45) 100%)" }} />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-amber-200">Specialty Coffee · Ari, Bangkok</p>
          <h1 className="mt-1 text-3xl font-bold">Brew &amp; Bean</h1>
          <p className="mt-1 text-sm text-amber-100">สแกน QR สั่งที่โต๊ะ ไม่ต้องรอคิว</p>
          {table !== null && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm">
              โต๊ะ <span className="rounded bg-white px-2 py-0.5 font-semibold text-neutral-900">{table}</span>
            </p>
          )}
        </div>
      </header>

      <nav className="z-40 border-b border-amber-200 sm:sticky sm:top-[var(--demo-shell-h)] bg-[#fffaf3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-h-12 flex-1 whitespace-nowrap px-2 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700 ${tab === t.key ? "border-b-2" : "text-neutral-600 hover:text-amber-800"}`}
              style={tab === t.key ? { borderColor: ACCENT, color: ACCENT } : undefined}
            >
              {t.th}
            </button>
          ))}
          {!launcherChecked && (
            <span aria-hidden="true" className="invisible min-h-12 flex-1 whitespace-nowrap px-2 py-3 text-sm font-medium">ทดลองเดโม</span>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {notice && (
          <div
            role="status"
            className={`mb-4 flex items-start justify-between gap-3 rounded-xl p-4 text-sm ${
              notice.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
            }`}
          >
            <span className="flex items-start gap-2">
              {notice.kind === "ok" ? <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />}
              {notice.text}
            </span>
            <button onClick={() => setNotice(null)} aria-label="ปิดข้อความ" className="-m-2.5 shrink-0 p-2.5">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {!loaded && <p className="py-10 text-center text-sm text-neutral-500">กำลังโหลด…</p>}

        {loaded && tab === "menu" && table === null && (
          <section className="rounded-2xl border border-amber-200 bg-white px-6 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <svg {...svgProps} className="h-7 w-7">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v.01M14 20h3M20 17v3" />
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-semibold">กรุณาสแกน QR ที่โต๊ะเพื่อสั่งอาหาร</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-600">
              ลิงก์นี้ไม่มี QR ของโต๊ะ หรือ QR ไม่ถูกต้อง
            </p>
            {launcherOn && (
              <button onClick={() => setTab("demo")} className="mt-5 min-h-11 rounded-full px-6 py-2.5 text-sm font-medium text-white" style={{ background: ACCENT }}>
                ทดลองเดโม: จำลองสแกน QR โต๊ะ
              </button>
            )}
          </section>
        )}

        {loaded && tab === "demo" && <DemoLauncher accent={ACCENT} />}

        {loaded && tab === "menu" && table !== null && (
          <section>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm ${cat === c.key ? "text-white" : "border-amber-200 bg-white text-neutral-700"}`}
                  style={cat === c.key ? { background: ACCENT, borderColor: ACCENT } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ul className="space-y-3">
              {menu.filter((m) => m.cat === cat).map((m) => (
                <li key={m.id} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm">
                  <div className={`relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-amber-100 ${m.available ? "" : "opacity-50 grayscale"}`}>
                    <Image src={m.image} alt={m.name} fill sizes="80px" className="object-cover object-center" />
                  </div>
                  <div className={`min-w-0 flex-1 ${m.available ? "" : "opacity-50"}`}>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-neutral-500">{m.th}</p>
                    <p className="mt-1 text-sm font-medium" style={{ color: ACCENT }}>฿{m.price}</p>
                  </div>
                  {m.available ? (
                    cart[m.id] ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => add(m.id, -1)} className="h-11 w-11 rounded-full border border-amber-300 text-xl" aria-label="ลดหนึ่งรายการ">−</button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{cart[m.id]}</span>
                        <button onClick={() => add(m.id, 1)} className="h-11 w-11 rounded-full text-xl text-white" style={{ background: ACCENT }} aria-label="เพิ่มหนึ่งรายการ">+</button>
                      </div>
                    ) : (
                      <button onClick={() => add(m.id, 1)} className="min-h-11 shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: ACCENT }}>
                        เพิ่ม
                      </button>
                    )
                  ) : (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-200 px-3 py-1 text-xs text-neutral-700">หมด</span>
                  )}
                </li>
              ))}
            </ul>

            <h2 className="mb-3 mt-8 text-lg font-semibold">ออเดอร์ของโต๊ะ {table}</h2>
            {myOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-amber-300 bg-white/60 p-4 text-sm text-neutral-500">
                ยังไม่มีออเดอร์ของโต๊ะนี้
              </p>
            ) : (
              <ul className="space-y-2">
                {myOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-white p-3 text-sm shadow-sm">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-semibold">
                        #{o.id} · ฿{o.total}
                      </p>
                      <p className="text-xs leading-relaxed text-neutral-600">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta[o.status].cls}`}>{statusMeta[o.status].label}</span>
                      {o.status === "ready" && (
                        <button disabled={busy} onClick={() => startPayment(o)} className="min-h-10 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-60" style={{ background: ACCENT }}>
                          ชำระเงิน
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {loaded && tab === "kitchen" && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">จอครัว</h2>
              <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                <PulseIcon className="h-4 w-4 text-emerald-600" />
                อัปเดตอัตโนมัติทุก 3 วินาที
              </span>
            </div>
            {kitchenOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-amber-300 bg-white/60 p-6 text-center text-sm text-neutral-500">
                ไม่มีออเดอร์ค้าง ลองสั่งจากแท็บเมนู
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {kitchenOrders.map((o) => {
                  const nxt = nextStatus[o.status];
                  return (
                    <article key={o.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-bold">#{o.id} · โต๊ะ {o.table}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta[o.status].cls}`}>{statusMeta[o.status].label}</span>
                      </div>
                      <ul className="mt-2 text-sm text-neutral-700">
                        {o.lines.map((l) => (
                          <li key={l.itemId}>{l.qty}× {l.name}</li>
                        ))}
                      </ul>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-neutral-500">฿{o.total}</span>
                        {nxt ? (
                          <button
                            disabled={busy}
                            onClick={() => advance(o, nxt)}
                            className="min-h-10 rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
                            style={{ background: ACCENT }}
                          >
                            → {statusMeta[nxt].label}
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">รอลูกค้าชำระเงิน</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {loaded && tab === "admin" && (
          <section>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-60">
                <h2 className="text-lg font-semibold">จัดการเมนู</h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">เปิด/ปิดสินค้าที่หมด — เซิร์ฟเวอร์จะไม่รับออเดอร์สินค้าที่ปิดอยู่</p>
              </div>
              <label className="shrink-0 text-xs text-neutral-600">
                บทบาท
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="ml-1 min-h-9 rounded-lg border border-amber-300 bg-white px-2 py-1">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            {role === "staff" && (
              <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                เลือกบทบาท Admin เพื่อแก้ไขเมนู (บทบาท Staff แก้ไขไม่ได้)
              </p>
            )}
            <ul className="divide-y divide-amber-100 rounded-2xl bg-white shadow-sm">
              {menu.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-amber-100">
                      <Image src={m.image} alt="" fill sizes="40px" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      {m.name} <span className="ml-1 text-xs text-neutral-600">฿{m.price}</span>
                    </span>
                  </span>
                  <button
                    role="switch"
                    aria-checked={m.available}
                    aria-label={`${m.name} availability`}
                    disabled={busy}
                    onClick={() => toggleAvailability(m)}
                    className="relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:opacity-60"
                    style={{ background: m.available ? ACCENT : "#a3a3a3" }}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${m.available ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
            </ul>
            {role === "admin" && (
              <div className="mt-6 space-y-4">
                <PayeeSettings scope="cafe-qr-order" headers={ADMIN_HEADERS} accent={ACCENT} onSaved={refresh} />
                <SandboxSimulate scope="cafe-qr-order" headers={ADMIN_HEADERS} accent={ACCENT} onDone={refresh}
                  targets={pendingPayments.map((o) => ({ key: String(o.id), label: `ออเดอร์ #${o.id}`, amount: o.payment!.payAmount, reference: o.payment!.reference }))} />
                <UnmatchedPayments scope="cafe-qr-order" headers={ADMIN_HEADERS} accent={ACCENT} onAssigned={refresh}
                  targets={pendingPayments.map((o) => ({ intentId: o.payment!.intentId, label: `ออเดอร์ #${o.id} · ฿${o.payment!.payAmount.toFixed(2)}` }))} />
              </div>
            )}
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-amber-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">สร้างอย่างไร</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700">
            <li>ของจริงในเดโมนี้: เมนู ออเดอร์ และสถานะเก็บใน SQLite ผ่าน API จริง โหลดหน้าใหม่ข้อมูลก็ยังอยู่</li>
            <li>การชำระเงิน: ระบบตรวจจับเงินเข้า PromptPay QR อัตโนมัติผ่าน webhook ที่เซ็นลายเซ็นไว้ และมีการอัปโหลดสลิปเป็นทางสำรอง</li>
            <li>ในงานจริง: Supabase (PostgreSQL) Realtime, ฟีดแจ้งเงินเข้าจากธนาคารหรือผู้ให้บริการชำระเงิน และการล็อกอินแอดมินจริง</li>
          </ul>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">หมายเหตุ: เดโมนี้ยังไม่ได้เชื่อมต่อฟีดแจ้งเงินเข้าจากธนาคารจริง ปุ่มจำลองแจ้งเงินเข้า (sandbox) ในแท็บแอดมินจะส่งสัญญาณเหมือนที่ธนาคารจะส่ง และบัญชีรับเงินเป็นบัญชีตัวอย่างจนกว่าเจ้าของร้านตั้งค่าเอง</p>
          <details className="group mt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b45309] [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
          <ul className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-600">
            <li><b className="mb-0.5 block text-neutral-900">API จริงในเดโมนี้</b>ใช้ Next.js Route Handlers ที่เก็บข้อมูลใน SQLite เมนู ออเดอร์ และรายการในออเดอร์จึงยังอยู่ครบแม้โหลดหน้าใหม่ โดยฝั่งเซิร์ฟเวอร์ (ไม่ใช่หน้าจอ) เป็นผู้ปฏิเสธเมนูที่หมด บังคับลำดับสถานะออเดอร์ ใหม่ กำลังทำ พร้อมเสิร์ฟ ชำระแล้ว (สถานะชำระแล้วเกิดได้ผ่านระบบรับชำระเงินเท่านั้น) และตรวจสิทธิ์แอดมินเมื่อแก้ไขเมนู</li>
            <li><b className="mb-0.5 block text-neutral-900">QR ต่อโต๊ะที่เซ็นลายเซ็น (HMAC)</b>ลิงก์ของแต่ละโต๊ะมีโทเคน เลขโต๊ะ.ลายเซ็น ที่เซิร์ฟเวอร์เซ็นด้วย HMAC-SHA256 และตรวจก่อนรับออเดอร์ทุกครั้ง ลูกค้าจึงเปลี่ยนเลขโต๊ะเองหรือปลอมโทเคนไม่ได้ และเห็นเฉพาะออเดอร์ของโต๊ะตัวเอง ร้านจริงจะพิมพ์สติกเกอร์ QR หนึ่งแผ่นต่อโต๊ะ ส่วนแผงจำลองสแกนในแท็บเดโมมีไว้ให้ผู้ชมทดลองเท่านั้น</li>
            <li><b className="mb-0.5 block text-neutral-900">Next.js + TypeScript</b>แต่ละโต๊ะมี QR ของตัวเองสำหรับเปิดเมนูของโต๊ะนั้น และชนิดข้อมูล Order กับ MenuItem ที่ใช้ร่วมกันช่วยให้ครัว เมนู และแอดมินตรงกันเสมอ</li>
            <li><b className="mb-0.5 block text-neutral-900">Polling ในเดโม และ Supabase Realtime ในงานจริง</b>กระดานครัวนี้ดึงข้อมูลจาก API ทุก 3 วินาที (polling) ส่วนงานจริงใช้ Supabase (PostgreSQL) Realtime ส่งออเดอร์ใหม่และการเปลี่ยนสถานะไปให้ทันที</li>
            <li><b className="mb-0.5 block text-neutral-900">QR PromptPay ตรวจจับยอดอัตโนมัติ</b>เมื่อออเดอร์พร้อมเสิร์ฟ เซิร์ฟเวอร์จะสร้างรายการชำระเงินจากยอดรวมที่เก็บใน SQLite (ไม่รับยอดจากฝั่งลูกค้า) QR มียอดเศษสตางค์ที่ไม่ซ้ำกัน เมื่อมี webhook แจ้งเงินเข้าที่เซ็นลายเซ็นไว้ (HMAC-SHA256 ตรวจเวลา และไม่ประมวลผลซ้ำด้วยรหัสเหตุการณ์) ระบบจะจับคู่ยอดและเปลี่ยนออเดอร์เป็นชำระแล้วเพียงครั้งเดียวใน transaction เดียว แล้วหน้าจอจะอัปเดตด้วย polling ยอดที่ผิดหรือไม่รู้ที่มาจะเข้าไปอยู่ในรายการที่ยังจับคู่ไม่ได้ ซึ่งแอดมินกำหนดให้เองได้</li>
            <li><b className="mb-0.5 block text-neutral-900">สลิปสำรองผ่าน Thunder API</b>หากระบบตรวจจับยอดไม่ทำงาน ลูกค้าอัปโหลดสลิปในหน้าต่าง QR ได้ เซิร์ฟเวอร์จะตรวจสลิปผ่าน Thunder API เทียบกับรายการชำระเงินเดียวกัน และปฏิเสธสลิปที่เคยใช้แล้ว หากไม่มี API key จะทำงานในโหมด sandbox ซึ่งรับรูปภาพใดก็ได้ และมีป้ายบอกไว้ชัดเจน</li>
            <li><b className="mb-0.5 block text-neutral-900">งานจริง</b>webhook จะรับข้อมูลจากบริการแจ้งเงินเข้า PromptPay ของธนาคารหรือผู้ให้บริการชำระเงิน และเปลี่ยนจาก header บทบาทแอดมินของเดโมเป็นการล็อกอินแอดมินจริง ออเดอร์ที่ยังไม่จ่ายจะยังเปิดค้างอยู่แม้ QR หมดอายุ และเมื่อกดจ่ายอีกครั้งจะได้ยอดใหม่</li>
            <li><b className="mb-0.5 block text-neutral-900">Tailwind CSS</b>หน้าตาแบบเน้นมือถือเป็นหลัก ปรับสีตามแบรนด์ และแก้ให้เหมาะกับแต่ละร้านได้รวดเร็ว</li>
          </ul>
          </details>
        </section>
      </main>

      {count > 0 && tab === "menu" && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <button
            disabled={busy}
            onClick={placeOrder}
            className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-3 whitespace-nowrap rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-70 sm:px-6 sm:text-base"
            style={{ background: ACCENT }}
          >
            <span className="flex items-center gap-2">
              <CartIcon className="h-5 w-5" /> ตะกร้า · {count}
            </span>
            <span>฿{total} · ส่งเข้าครัว</span>
          </button>
        </div>
      )}

      {paying && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setPayingId(null)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl [&_p.text-amber-800]:rounded-lg [&_p.text-amber-800]:border [&_p.text-amber-800]:border-amber-300 [&_p.text-amber-800]:bg-amber-50 [&_p.text-amber-800]:p-3 [&_p.text-amber-800]:text-sm [&_p.text-amber-800]:text-amber-950" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">ชำระเงิน PromptPay · โต๊ะ {paying.table} · #{paying.id}</h3>
            <ul className="mt-2 text-sm text-neutral-700">
              {paying.lines.map((l) => (
                <li key={l.itemId} className="flex justify-between"><span>{l.qty}× {l.name}</span><span>฿{l.price * l.qty}</span></li>
              ))}
            </ul>
            {paying.payment && (paying.status === "ready" || paying.status === "paid") && (
              <QrPayPanel
                key={paying.payment.intentId}
                scope="cafe-qr-order"
                intentId={paying.payment.intentId}
                accent={ACCENT}
                onPaid={() => onPaid(paying.id)}
                onClosed={() => void refresh()}
                sandboxNote='เดโม: ยังไม่มีฟีดธนาคารจริง ให้ไปที่แท็บ Admin เลือกบทบาท Admin แล้วกด "จำลองแจ้งเงินเข้า (sandbox)"'
              />
            )}
            <button onClick={() => setPayingId(null)} className="mt-3 min-h-11 w-full rounded-full border border-amber-300 py-2.5 text-sm">ปิด</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
