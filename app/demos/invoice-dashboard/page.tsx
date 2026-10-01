"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import DemoShell from "@/components/DemoShell";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";

const ACCENT = "#2563eb";
const VAT_RATE = 0.07;
const API = "/api/invoice-dashboard";
const QR_SCOPE = "invoice-dashboard";

type QrTarget = { invoiceId: string; customer: string; invoiceStatus: string; intentId: string; status: string; payableAmount: number; reference: string };

type Role = "owner" | "staff";
type View = "dashboard" | "invoices" | "builder" | "inventory" | "payments";
type Status = "paid" | "pending" | "overdue" | "draft";
type Invoice = { id: string; customer: string; date: string; amount: number; status: Status };
type Line = { id: number; sku: string; desc: string; qty: number; price: number };
type Item = { sku: string; name: string; stock: number; min: number; price: number };
type Summary = {
  revenue: number;
  revenueChangePct: number | null;
  outstanding: number;
  overdueCount: number;
  invoicesThisMonth: number;
  lowStockCount: number;
  monthly: { month: string; sales: number; cost: number }[];
};

const baht = (n: number) =>
  "฿" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Every call carries the demo role; the server is what enforces it.
async function api<T>(role: Role, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    cache: "no-store",
    headers: { "x-demo-role": role, ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `ทำรายการไม่สำเร็จ (รหัส ${res.status})`);
  return data as T;
}

const errText = (e: unknown) => (e instanceof ApiError ? e.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");

const STATUS_STYLE: Record<Status, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
};
const STATUS_LABEL: Record<Status, string> = {
  paid: "ชำระแล้ว",
  pending: "รอชำระ",
  overdue: "เกินกำหนด",
  draft: "ฉบับร่าง",
};

function Badge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className={`mt-1 text-xs ${tone ?? "text-slate-500"}`}>{note}</p>
    </div>
  );
}

function SalesChart({ months }: { months: Summary["monthly"] }) {
  const W = 600;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(100000, Math.ceil(Math.max(...months.map((d) => d.sales)) / 100000) * 100000);
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / months.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = months.map((d, i) => `${i ? "L" : "M"}${pad.l + step * i + step / 2},${y(d.sales - d.cost)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="กราฟแท่งยอดขายรายเดือนพร้อมเส้นกำไรขั้นต้น">
      {[0, 1, 2, 3].map((q) => max * q / 3).map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#475569">{Math.round(t / 1000)}k</text>
        </g>
      ))}
      {months.map((d, i) => {
        const x = pad.l + step * i + step * 0.2;
        return (
          <g key={d.month}>
            <rect x={x} y={y(d.sales)} width={step * 0.6} height={pad.t + ih - y(d.sales)} rx="4" fill={ACCENT} opacity={i === months.length - 1 ? 1 : 0.55}>
              <title>{`${MONTH_NAMES[Number(d.month.slice(5)) - 1]}: ${baht(d.sales)}`}</title>
            </rect>
            <text x={x + step * 0.3} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">{MONTH_NAMES[Number(d.month.slice(5)) - 1]}</text>
          </g>
        );
      })}
      <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
      {months.map((d, i) => (
        <circle key={d.month} cx={pad.l + step * i + step / 2} cy={y(d.sales - d.cost)} r="3.5" fill="#f59e0b" />
      ))}
    </svg>
  );
}

function Icon({ name, className = "h-4 w-4" }: { name: "lock" | "close" | "up" | "down" | "alert"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    up: <path d="M5 15l7-7 7 7" />,
    down: <path d="M5 9l7 7 7-7" />,
    alert: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Dashboard({ summary }: { summary: Summary | null }) {
  if (!summary) return <p className="text-sm text-slate-500">กำลังโหลดข้อมูล...</p>;
  const change = summary.revenueChangePct;
  return (
    <div className="space-y-6">
      <div className="relative h-36 overflow-hidden rounded-xl">
        <Image src="/images/invoice-dashboard/warehouse.jpg" alt="ชั้นวางสินค้าในคลังที่เต็มไปด้วยกล่องและลังพลาสติก" fill sizes="(min-width: 1152px) 1120px, 100vw" className="object-cover" priority />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-900/80 to-transparent p-5">
          <p className="text-lg font-semibold text-white">ร้านสยามออฟฟิศซัพพลาย</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="ยอดขายเดือนนี้"
          value={baht(summary.revenue)}
          note={change === null ? "ไม่มีข้อมูลเดือนก่อน" : `${change >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(change)}% จากเดือนก่อน`}
          tone={change !== null && change < 0 ? "text-red-700" : "text-emerald-700"}
        />
        <Kpi label="ยอดค้างชำระ" value={baht(summary.outstanding)} note={`${summary.overdueCount} ใบเกินกำหนด`} tone="text-red-700" />
        <Kpi label="ใบแจ้งหนี้" value={String(summary.invoicesThisMonth)} note="ใบที่ออกในเดือนนี้" />
        <Kpi label="สินค้าใกล้หมด" value={String(summary.lowStockCount)} note="ต้องสั่งซื้อเพิ่ม" tone="text-amber-700" />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">ยอดขายรายเดือน (ก่อน VAT)</h2>
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />ยอดขาย</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />กำไรขั้นต้น</span>
          </div>
        </div>
        <SalesChart months={summary.monthly} />
      </section>
    </div>
  );
}

function PayPanel({ invoice, role, onPaid, onClose }: { invoice: Invoice; role: Role; onPaid: () => void; onClose: () => void }) {
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Each attempt asks the server for a QR; an expired one is replaced with a fresh unique amount.
  useEffect(() => {
    let live = true;
    api<{ intentId: string }>(role, `/invoices/${encodeURIComponent(invoice.id)}/qr`, { method: "POST" })
      .then((q) => { if (live) { setError(""); setIntentId(q.intentId); } })
      .catch((e) => { if (live) setError(errText(e)); });
    return () => { live = false; };
  }, [role, invoice.id, attempt]);

  return (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-3 sm:p-4 print:hidden">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">รับชำระ {invoice.id} ด้วย PromptPay QR</h3>
        <button onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Icon name="close" /></button>
      </div>
      <p className="text-xs text-slate-600">ยอดรวม VAT คำนวณโดยเซิร์ฟเวอร์ ({baht(invoice.amount)}) ยอดโอนจริงมีเศษสตางค์เพื่อจับคู่อัตโนมัติ</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {intentId && (
        <QrPayPanel
          key={intentId}
          scope={QR_SCOPE}
          intentId={intentId}
          accent={ACCENT}
          className="space-y-3 rounded-xl bg-white p-4"
          sandboxNote='เดโม: ยังไม่มีฟีดธนาคารจริง ให้สลับเป็น Owner แล้วไปที่แท็บ "รับชำระ" กด "จำลองแจ้งเงินเข้า (sandbox)"'
          onPaid={onPaid}
          onClosed={() => { setIntentId(null); setAttempt((n) => n + 1); onPaid(); }}
        />
      )}
    </div>
  );
}

function InvoiceList({ invoices, role, onDelete, onStatus, onPaid }: { invoices: Invoice[]; role: Role; onDelete: (id: string) => void; onStatus: (id: string, s: Status) => void; onPaid: () => void }) {
  const [filter, setFilter] = useState<Status | "all">("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const paying = invoices.find((i) => i.id === payingId);
  const FILTER_LABEL: Record<Status | "all", string> = { all: "ทั้งหมด", ...STATUS_LABEL };
  const filters: (Status | "all")[] = ["all", "paid", "pending", "overdue", "draft"];
  const rows = invoices.filter((i) => filter === "all" || i.status === filter);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 sm:flex-wrap sm:p-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f} className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${filter === f ? "font-medium text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            style={filter === f ? { background: ACCENT } : undefined}
          >
            {FILTER_LABEL[f]} ({f === "all" ? invoices.length : invoices.filter((i) => i.status === f).length})
          </button>
        ))}
      </div>
      {paying && <PayPanel key={paying.id} invoice={paying} role={role} onPaid={onPaid} onClose={() => setPayingId(null)} />}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">เลขที่</th>
              <th className="px-4 py-2.5 font-medium">ลูกค้า</th>
              <th className="px-4 py-2.5 font-medium">วันที่</th>
              <th className="px-4 py-2.5 text-right font-medium">ยอดรวม</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
              <th className="px-4 py-2.5"><span className="sr-only">การดำเนินการ</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs tabular-nums whitespace-nowrap">{i.id}</td>
                <td className="min-w-40 px-4 py-3">{i.customer}</td>
                <td className="px-4 py-3 tabular-nums whitespace-nowrap text-slate-600">{i.date}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">{baht(i.amount)}</td>
                <td className="px-4 py-3"><Badge status={i.status} /></td>
                <td className="whitespace-nowrap px-2 py-1 text-right text-sm">
                  {i.status === "draft" && <button onClick={() => onStatus(i.id, "pending")} className="min-h-10 rounded px-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" style={{ color: ACCENT }}>ส่งใบแจ้งหนี้</button>}
                  {(i.status === "pending" || i.status === "overdue") && <button onClick={() => setPayingId(i.id)} className="min-h-10 rounded px-2 text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">รับชำระด้วย QR</button>}
                  {role === "owner" && <button onClick={() => onDelete(i.id)} className="min-h-10 rounded px-2 text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">ลบ</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">ไม่พบใบแจ้งหนี้ในสถานะนี้ ลองเลือกตัวกรองอื่น</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Builder({ products, customers, role, onCreated, onError }: { products: Item[]; customers: string[]; role: Role; onCreated: () => void; onError: (m: string) => void }) {
  const [customer, setCustomer] = useState("บริษัท ตัวอย่าง จำกัด");
  const [lines, setLines] = useState<Line[]>([
    { id: 1, sku: "PK-1001", desc: "กล่องกระดาษ ขนาด M", qty: 100, price: 18 },
    { id: 2, sku: "PK-1002", desc: "เทปกาว OPP 2 นิ้ว", qty: 12, price: 42 },
  ]);
  const [nextId, setNextId] = useState(3);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Preview only: the server recomputes subtotal, VAT and total from its own prices.
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = subtotal + vat;
  const patch = (id: number, p: Partial<Line>) => {
    setMessage("");
    setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  };
  const pickProduct = (id: number, sku: string) => {
    const p = products.find((x) => x.sku === sku);
    patch(id, p ? { sku, desc: p.name, price: p.price } : { sku: "" });
  };
  const input = "w-full min-h-10 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-blue-600 focus:outline-2 focus:outline-blue-600/30";

  const save = async (status: "draft" | "pending") => {
    setBusy(true);
    setMessage("");
    try {
      const inv = await api<Invoice>(role, "/invoices", {
        method: "POST",
        body: JSON.stringify({
          customer,
          status,
          items: lines.map((l) => (l.sku ? { sku: l.sku, qty: l.qty } : { description: l.desc, qty: l.qty, unitPrice: l.price })),
        }),
      });
      setMessage(`สร้าง ${inv.id} แล้ว (${baht(inv.amount)}) สถานะ ${status}`);
      onCreated();
    } catch (e) {
      onError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const btn = "min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 print:hidden">
        <h2 className="font-semibold">สร้างใบแจ้งหนี้ใหม่</h2>
        <label className="block text-sm">
          <span className="text-slate-600">ลูกค้า</span>
          <input className={`${input} mt-1`} list="invoice-customers" value={customer} onChange={(e) => { setMessage(""); setCustomer(e.target.value); }} />
          <datalist id="invoice-customers">{customers.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_72px_104px_44px] gap-2 text-xs text-slate-500 sm:grid">
            <span>รายการ (เลือกจากสต็อก หรือพิมพ์เอง)</span><span>จำนวน</span><span>ราคา/หน่วย</span><span />
          </div>
          {lines.map((l) => (
            <div key={l.id} className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_72px_104px_44px] sm:items-center">
                <select className={`${input} col-span-full sm:col-span-1`} value={l.sku} onChange={(e) => pickProduct(l.id, e.target.value)} aria-label="สินค้า">
                  <option value="">รายการพิมพ์เอง</option>
                  {products.map((p) => <option key={p.sku} value={p.sku}>{p.name} ({p.stock})</option>)}
                </select>
                <label className="block text-xs text-slate-600 sm:contents"><span className="sm:hidden">จำนวน</span><input className={input} type="number" min={1} inputMode="numeric" value={l.qty} onChange={(e) => patch(l.id, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} aria-label="จำนวน" /></label>
                <label className="block text-xs text-slate-600 sm:contents"><span className="sm:hidden">ราคา/หน่วย</span><input className={`${input} disabled:bg-slate-100`} type="number" min={0} value={l.price} disabled={!!l.sku} onChange={(e) => patch(l.id, { price: Math.max(0, Number(e.target.value)) })} aria-label="ราคาต่อหน่วย" /></label>
                <button onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="grid h-11 w-11 sm:h-10 sm:w-10 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="ลบรายการ"><Icon name="close" /></button>
              </div>
              {!l.sku && <input className={input} value={l.desc} placeholder="รายละเอียดรายการ" onChange={(e) => patch(l.id, { desc: e.target.value })} aria-label="รายละเอียดรายการ" />}
            </div>
          ))}
          <button
            onClick={() => { setLines([...lines, { id: nextId, sku: "", desc: "", qty: 1, price: 0 }]); setNextId(nextId + 1); }}
            className="min-h-10 rounded text-sm font-medium hover:underline"
            style={{ color: ACCENT }}
          >
            + เพิ่มรายการ / Add line
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button disabled={busy || lines.length === 0} onClick={() => save("draft")} className={`${btn} text-white`} style={{ background: ACCENT }}>
            บันทึกฉบับร่าง
          </button>
          <button disabled={busy || lines.length === 0} onClick={() => save("pending")} className={`${btn} border border-slate-300 hover:bg-slate-50`}>
            ส่งใบแจ้งหนี้
          </button>
          <button onClick={() => window.print()} className={`${btn} border border-slate-300 hover:bg-slate-50`}>
            พิมพ์
          </button>
        </div>
        <p className="text-xs text-slate-500">ส่งแล้วจะตัดสต็อกทันที (ถ้าสินค้าไม่พอ เซิร์ฟเวอร์จะตอบ 409) การรับชำระทำที่หน้ารายการใบแจ้งหนี้</p>
        {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold" style={{ color: ACCENT }}>BizLedger</p>
            <p className="text-xs text-slate-500">บริษัท บิซเลดเจอร์ จำกัด<br />99/9 ถ.สุขุมวิท กรุงเทพฯ 10110<br />Tax ID 0105500000000</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">ใบแจ้งหนี้ (INVOICE)</p>
            <p className="text-xs text-slate-500">ตัวอย่างก่อนส่ง</p>
          </div>
        </div>
        <p className="mt-6 text-xs uppercase text-slate-500">เรียน</p>
        <p className="font-medium">{customer || "—"}</p>
        <div className="relative overflow-x-auto"><table className="mt-5 w-full min-w-[320px] text-sm tabular-nums">
          <thead className="border-b border-slate-300 text-left text-xs text-slate-500">
            <tr><th className="py-1 font-medium">รายการ</th><th className="text-right">จำนวน</th><th className="text-right">ราคา</th><th className="text-right">รวม</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-1.5">{l.desc || "—"}</td>
                <td className="text-right">{l.qty}</td>
                <td className="text-right">{baht(l.price)}</td>
                <td className="text-right">{baht(l.qty * l.price)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <dl className="ml-auto mt-4 w-full max-w-64 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-slate-500">ยอดก่อน VAT</dt><dd>{baht(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">VAT 7%</dt><dd>{baht(vat)}</dd></div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold"><dt>รวมทั้งสิ้น</dt><dd>{baht(total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function Inventory({ items, onRestock }: { items: Item[]; onRestock: (sku: string, qty: number) => void }) {
  const low = items.filter((i) => i.stock < i.min);
  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>แจ้งเตือนสินค้าใกล้หมด ({low.length} รายการ):</strong> {low.map((i) => i.name).join(", ")}</p>
        </div>
      )}
      <section className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">สินค้า</th>
              <th className="px-4 py-2.5 text-right font-medium">คงเหลือ</th><th className="px-4 py-2.5 text-right font-medium">ขั้นต่ำ</th>
              <th className="px-4 py-2.5 text-right font-medium">ราคา</th><th className="px-4 py-2.5 font-medium">ระดับสต็อก</th><th className="px-4 py-2.5"><span className="sr-only">การดำเนินการ</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => {
              const isLow = i.stock < i.min;
              return (
                <tr key={i.sku} className={isLow ? "bg-amber-50/50" : ""}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{i.sku}</td>
                  <td className="min-w-44 px-4 py-3">{i.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isLow ? "text-red-700" : ""}`}>{i.stock}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{i.min}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{baht(i.price)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-28 rounded-full bg-slate-200" role="img" aria-label={isLow ? "สต็อกต่ำกว่าขั้นต่ำ" : "สต็อกปกติ"}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (i.stock / (i.min * 2)) * 100)}%`, background: isLow ? "#ef4444" : "#10b981" }} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => onRestock(i.sku, i.min * 2)} className="min-h-10 whitespace-nowrap rounded-md px-3 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" style={{ background: ACCENT }}>รับของเข้า +{i.min * 2}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Payments({ role, onChanged }: { role: Role; onChanged: () => void }) {
  const [targets, setTargets] = useState<QrTarget[]>([]);
  const [error, setError] = useState("");
  const headers = { "x-demo-role": role };
  const load = useCallback(async () => {
    try {
      setTargets(await api<QrTarget[]>(role, "/qr-targets"));
      setError("");
    } catch (e) {
      setError(errText(e));
    }
  }, [role]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);
  const changed = () => { void load(); onChanged(); };
  const pending = targets.filter((t) => t.status === "pending");
  return (
    <div className="space-y-4 print:hidden">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <PayeeSettings scope={QR_SCOPE} headers={headers} accent={ACCENT} onSaved={changed} />
      <SandboxSimulate scope={QR_SCOPE} headers={headers} accent={ACCENT} onDone={changed}
        targets={pending.map((t) => ({ key: t.intentId, label: `${t.invoiceId} · ${t.customer}`, amount: t.payableAmount, reference: t.reference }))} />
      <UnmatchedPayments scope={QR_SCOPE} headers={headers} accent={ACCENT} onAssigned={changed}
        targets={targets.map((t) => ({ intentId: t.intentId, label: `${t.invoiceId} · ${baht(t.payableAmount)} · ${t.status === "pending" ? "รอชำระ" : "QR หมดอายุ"}` }))} />
    </div>
  );
}

const STACK_NOTES: [string, string][] = [
  ["Next.js", "ใช้ Route Handlers ภายใต้ /api/invoice-dashboard ให้ข้อมูลใบแจ้งหนี้ สต็อก และตัวเลขสรุปแดชบอร์ด โดยหน้าจอจะดึงข้อมูลเมื่อเปิดหน้าและหลังการเปลี่ยนแปลงทุกครั้ง"],
  ["TypeScript", "ใช้ type ร่วมกันสำหรับใบแจ้งหนี้ รายการสินค้า และ role เพื่อให้ API และหน้าจอตรงกันเสมอ"],
  ["SQLite (เดโมนี้)", "ข้อมูลลูกค้า สินค้า ใบแจ้งหนี้ และรายการสินค้าเก็บใน SQLite ยอดรวมและ VAT คำนวณที่ฝั่งเซิร์ฟเวอร์จากราคาในแคตตาล็อก และการตัดสต็อกทำใน transaction เดียว (ตอบ 409 หากสินค้าไม่พอ) ส่วนระบบจริงใช้ Supabase / PostgreSQL"],
  ["PromptPay QR ตรวจจับการชำระอัตโนมัติ", "เมื่อเปิดหน้าชำระเงิน ระบบจะสร้างรายการรับชำระด้วย QR สำหรับยอดรวม VAT ที่เซิร์ฟเวอร์คำนวณ บวกเศษสตางค์ที่ไม่ซ้ำกัน (เลขอ้างอิงคือเลขที่ใบแจ้งหนี้) เมื่อมีการแจ้งเงินเข้าที่ลงลายเซ็นด้วย HMAC-SHA256 เข้ามาที่ webhook ระบบจะจับคู่ด้วยยอดเงินหรือเลขอ้างอิง ไม่ประมวลผลซ้ำด้วย event id แล้วเปลี่ยนใบแจ้งหนี้เป็นชำระแล้วพร้อมบันทึกการชำระเงินใน transaction เดียว เงินที่จับคู่ไม่ได้จะไปอยู่ในรายการที่เฉพาะเจ้าของร้านเห็น เพื่อระบุการจับคู่เอง ในเดโมนี้การแจ้งเงินเข้ามาจากปุ่ม sandbox ส่วนระบบจริงจะเชื่อม webhook ตัวเดียวกันกับฟีดแจ้งเงินเข้าของธนาคารหรือผู้ให้บริการชำระเงิน"],
  ["ตรวจสลิปสำรอง (Thunder API)", "หากลูกค้ารอไม่ไหว สามารถอัปโหลดสลิปโอนเงินในหน้าต่าง QR ได้ เซิร์ฟเวอร์จะตรวจสลิปผ่าน Thunder API (ยอดเงิน ผู้รับ และใช้ได้ครั้งเดียว) แล้วบันทึกการชำระผ่าน transaction เดียวกัน ไม่มี endpoint สำหรับกดทำเครื่องหมายว่าชำระแล้วเฉยๆ หากไม่มี API key จะทำงานในโหมด sandbox ที่แสดงป้ายกำกับชัดเจน"],
  ["การแบ่งสิทธิ์ตาม role", "ทุก handler ตรวจ header x-demo-role (owner หรือ staff) โดย staff จะได้ 403 เมื่อเข้าแดชบอร์ดหรือลบใบแจ้งหนี้ นี่เป็นตัวจำลองแทนระบบเข้าสู่ระบบจริง ซึ่งระบบจริงจะใช้ session"],
  ["Recharts", "ระบบจริงจะใช้กราฟแบบโต้ตอบได้แทนกราฟ SVG ที่วาดเองในเดโมนี้ ส่วนยอดขายรายเดือนในเดโมคำนวณจาก SQL GROUP BY อยู่แล้ว"],
  ["Tailwind CSS", "ใช้ design token และสไตล์สำหรับพิมพ์ เพื่อให้หน้าตาสม่ำเสมอและพิมพ์ใบแจ้งหนี้ขนาด A4 ได้เรียบร้อย"],
];

export default function InvoiceDashboardPage() {
  const [role, setRole] = useState<Role>("owner");
  const [view, setView] = useState<View>("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stock, setStock] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [inv, items, cust] = await Promise.all([
        api<Invoice[]>(role, "/invoices"),
        api<Item[]>(role, "/inventory"),
        api<{ name: string }[]>(role, "/customers"),
      ]);
      setInvoices(inv);
      setStock(items);
      setCustomers(cust.map((c) => c.name));
      setSummary(role === "owner" ? await api<Summary>(role, "/dashboard") : null);
      setLoaded(true);
    } catch (e) {
      setError(errText(e));
    }
  }, [role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and role-change fetch
    void refresh();
  }, [refresh]);

  // Run a mutation, surface the server's message on failure, then reload from the server.
  const mutate = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errText(e));
    }
    await refresh();
  };

  const nav: { id: View; label: string; ownerOnly?: boolean }[] = [
    { id: "dashboard", label: "แดชบอร์ด", ownerOnly: true },
    { id: "invoices", label: "ใบแจ้งหนี้เดือนนี้" },
    { id: "builder", label: "สร้างใบแจ้งหนี้" },
    { id: "inventory", label: "สินค้าคงคลัง" },
    { id: "payments", label: "รับชำระ / Payments", ownerOnly: true },
  ];
  const visible = nav.filter((n) => role === "owner" || !n.ownerOnly);
  const current: View = visible.some((n) => n.id === view) ? view : "invoices";

  return (
    <DemoShell slug="invoice-dashboard">
      <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-slate-50">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg font-bold text-white" style={{ background: ACCENT }}>B</span>
              <div>
                <p className="font-bold leading-tight">BizLedger</p>
                <p className="text-xs text-slate-600">ร้านสยามออฟฟิศซัพพลาย</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">บทบาท:</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                {(["owner", "staff"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setError(""); setRole(r); }}
                    aria-pressed={role === r} className={`min-h-10 rounded-md px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${role === r ? "bg-white font-semibold shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {r === "owner" ? "เจ้าของ" : "พนักงาน"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Main">
            {visible.map((n) => (
              <button
                key={n.id}
                onClick={() => { setError(""); setView(n.id); }}
                aria-current={current === n.id ? "page" : undefined} className={`min-h-11 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${current === n.id ? "font-semibold" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                style={current === n.id ? { borderColor: ACCENT, color: ACCENT } : undefined}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          {role === "staff" && (
            <p className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 print:hidden">
              <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
              โหมดพนักงาน: เซิร์ฟเวอร์ปฏิเสธการดูรายได้และการลบใบแจ้งหนี้ (403)
            </p>
          )}
          {error && (
            <p role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 py-1 pl-3 pr-1 text-sm text-red-700 print:hidden">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="ปิดข้อความ" className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Icon name="close" /></button>
            </p>
          )}
          {!loaded && !error && <p className="text-sm text-slate-500">กำลังโหลดข้อมูล...</p>}
          {loaded && current === "dashboard" && role === "owner" && <Dashboard summary={summary} />}
          {loaded && current === "invoices" && (
            <InvoiceList
              invoices={invoices}
              role={role}
              onPaid={() => void refresh()}
              onDelete={(id) => mutate(() => api(role, `/invoices/${encodeURIComponent(id)}`, { method: "DELETE" }))}
              onStatus={(id, status) => mutate(() => api(role, `/invoices/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }))}
            />
          )}
          {loaded && current === "builder" && (
            <Builder products={stock} customers={customers} role={role} onCreated={refresh} onError={(m) => { setError(m); void refresh(); }} />
          )}
          {loaded && current === "inventory" && (
            <Inventory
              items={stock}
              onRestock={(sku, qty) => mutate(() => api(role, `/inventory/${encodeURIComponent(sku)}/restock`, { method: "POST", body: JSON.stringify({ qty }) }))}
            />
          )}

          {loaded && current === "payments" && role === "owner" && <Payments key={role} role={role} onChanged={() => void refresh()} />}

          <section className="mt-10 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 print:hidden">
            <h2 className="font-semibold">สร้างอย่างไร</h2>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              หมายเหตุ: เดโมนี้ไม่ได้เชื่อมต่อฟีดธนาคารจริง ปุ่ม &quot;จำลองแจ้งเงินเข้า (sandbox)&quot; ของเจ้าของร้านเป็นตัวแทนการแจ้งเงินเข้าจากธนาคาร
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
              <li><strong>ของจริงในเดโม:</strong> ใบแจ้งหนี้ สต็อก และยอดสรุปเก็บในฐานข้อมูลจริง ยอดรวมและ VAT คำนวณที่ฝั่งเซิร์ฟเวอร์ และสิทธิ์เจ้าของ/พนักงานถูกตรวจที่ API</li>
              <li><strong>การชำระเงิน:</strong> ระบบสร้าง QR PromptPay พร้อมยอดเศษสตางค์ไม่ซ้ำ เมื่อเงินเข้าจะจับคู่และเปลี่ยนใบแจ้งหนี้เป็นชำระแล้วอัตโนมัติ หรือแนบสลิปให้ตรวจสอบแทนได้</li>
              <li><strong>ระบบจริงจะใช้:</strong> Supabase / PostgreSQL ระบบเข้าสู่ระบบจริง และ webhook จากธนาคารหรือผู้ให้บริการชำระเงิน แทนปุ่มจำลอง</li>
            </ul>
            <details className="group mt-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
                ดูรายละเอียดทางเทคนิค
              </summary>
              <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-slate-700 sm:grid-cols-2">
                {STACK_NOTES.map(([name, note]) => (
                  <li key={name} className="rounded-lg bg-slate-50 p-3"><strong style={{ color: ACCENT }}>{name}</strong> — {note}</li>
                ))}
              </ul>
            </details>
          </section>
        </main>
      </div>
    </DemoShell>
  );
}
