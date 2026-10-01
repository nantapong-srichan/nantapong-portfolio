"use client";

import { useState } from "react";
import DemoShell from "@/components/DemoShell";

const ACCENT = "#2563eb";
const VAT_RATE = 0.07;

type Role = "owner" | "staff";
type View = "dashboard" | "invoices" | "builder" | "inventory";
type Status = "paid" | "pending" | "overdue" | "draft";
type Invoice = { id: string; customer: string; date: string; amount: number; status: Status };
type Line = { id: number; desc: string; qty: number; price: number };
type Item = { sku: string; name: string; stock: number; min: number; price: number };

const baht = (n: number) =>
  "฿" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = [
  { m: "May", sales: 182000, cost: 121000 },
  { m: "Jun", sales: 214500, cost: 140000 },
  { m: "Jul", sales: 198300, cost: 132000 },
  { m: "Aug", sales: 256800, cost: 161000 },
  { m: "Sep", sales: 241200, cost: 150000 },
  { m: "Oct", sales: 287900, cost: 176000 },
];

const INITIAL_INVOICES: Invoice[] = [
  { id: "INV-2410-018", customer: "บริษัท สยามพาณิชย์ จำกัด", date: "2026-10-01", amount: 48150, status: "pending" },
  { id: "INV-2410-017", customer: "ร้านกาแฟ บ้านสวน", date: "2026-09-29", amount: 12840, status: "paid" },
  { id: "INV-2410-016", customer: "หจก. ไทยเฟอร์นิเจอร์", date: "2026-09-27", amount: 73920, status: "paid" },
  { id: "INV-2410-015", customer: "Northgate Trading Co.", date: "2026-09-20", amount: 29960, status: "overdue" },
  { id: "INV-2410-014", customer: "คุณสมศักดิ์ วงศ์ทอง", date: "2026-09-18", amount: 5350, status: "paid" },
  { id: "INV-2410-013", customer: "โรงแรม ริมน้ำ รีสอร์ท", date: "2026-09-12", amount: 96300, status: "overdue" },
  { id: "INV-2410-012", customer: "Bangkok Print Studio", date: "2026-09-10", amount: 18725, status: "pending" },
  { id: "INV-2410-011", customer: "บริษัท กรีนเลฟ ออร์แกนิค จำกัด", date: "2026-09-05", amount: 34240, status: "draft" },
];

const INITIAL_STOCK: Item[] = [
  { sku: "PK-1001", name: "กล่องกระดาษ ขนาด M", stock: 420, min: 150, price: 18 },
  { sku: "PK-1002", name: "เทปกาว OPP 2 นิ้ว", stock: 36, min: 60, price: 42 },
  { sku: "ST-2010", name: "กระดาษ A4 80 แกรม (รีม)", stock: 18, min: 40, price: 125 },
  { sku: "ST-2044", name: "ปากกาลูกลื่น สีน้ำเงิน (โหล)", stock: 95, min: 30, price: 68 },
  { sku: "EL-3005", name: "ปลั๊กพ่วง 4 ช่อง 3 เมตร", stock: 8, min: 15, price: 259 },
  { sku: "EL-3012", name: "หลอด LED 12W", stock: 140, min: 50, price: 59 },
  { sku: "CL-4001", name: "น้ำยาทำความสะอาด 5 ลิตร", stock: 52, min: 20, price: 190 },
];

const STATUS_STYLE: Record<Status, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
};
const STATUS_LABEL: Record<Status, string> = {
  paid: "ชำระแล้ว / Paid",
  pending: "รอชำระ / Pending",
  overdue: "เกินกำหนด / Overdue",
  draft: "ฉบับร่าง / Draft",
};

function Badge({ status }: { status: Status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className={`mt-1 text-xs ${tone ?? "text-slate-500"}`}>{note}</p>
    </div>
  );
}

function SalesChart() {
  const W = 600;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = 300000;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / MONTHS.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = MONTHS.map((d, i) => `${i ? "L" : "M"}${pad.l + step * i + step / 2},${y(d.sales - d.cost)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly sales bars with gross profit line">
      {[0, 100000, 200000, 300000].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">{t / 1000}k</text>
        </g>
      ))}
      {MONTHS.map((d, i) => {
        const x = pad.l + step * i + step * 0.2;
        return (
          <g key={d.m}>
            <rect x={x} y={y(d.sales)} width={step * 0.6} height={pad.t + ih - y(d.sales)} rx="4" fill={ACCENT} opacity={i === MONTHS.length - 1 ? 1 : 0.55}>
              <title>{`${d.m}: ${baht(d.sales)}`}</title>
            </rect>
            <text x={x + step * 0.3} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">{d.m}</text>
          </g>
        );
      })}
      <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
      {MONTHS.map((d, i) => (
        <circle key={d.m} cx={pad.l + step * i + step / 2} cy={y(d.sales - d.cost)} r="3.5" fill="#f59e0b" />
      ))}
    </svg>
  );
}

function Dashboard({ invoices, lowCount }: { invoices: Invoice[]; lowCount: number }) {
  const outstanding = invoices.filter((i) => i.status === "pending" || i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="ยอดขายเดือนนี้ / Revenue" value={baht(287900)} note="▲ 19.4% จากเดือนก่อน" tone="text-emerald-600" />
        <Kpi label="ยอดค้างชำระ / Outstanding" value={baht(outstanding)} note={`${overdue} ใบเกินกำหนด`} tone="text-red-600" />
        <Kpi label="ใบแจ้งหนี้ / Invoices" value={String(invoices.length)} note="ออกในเดือนตุลาคม" />
        <Kpi label="สินค้าใกล้หมด / Low stock" value={String(lowCount)} note="ต้องสั่งซื้อเพิ่ม" tone="text-amber-600" />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">ยอดขายรายเดือน / Monthly sales</h2>
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />Sales</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Gross profit</span>
          </div>
        </div>
        <SalesChart />
      </section>
    </div>
  );
}

function InvoiceList({ invoices, role, onDelete }: { invoices: Invoice[]; role: Role; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<Status | "all">("all");
  const filters: (Status | "all")[] = ["all", "paid", "pending", "overdue", "draft"];
  const rows = invoices.filter((i) => filter === "all" || i.status === filter);
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filter === f ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            style={filter === f ? { background: ACCENT } : undefined}
          >
            {f} ({f === "all" ? invoices.length : invoices.filter((i) => i.status === f).length})
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">เลขที่</th>
              <th className="px-4 py-2">ลูกค้า</th>
              <th className="px-4 py-2">วันที่</th>
              <th className="px-4 py-2 text-right">ยอดรวม</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                <td className="px-4 py-3">{i.customer}</td>
                <td className="px-4 py-3 text-slate-600">{i.date}</td>
                <td className="px-4 py-3 text-right font-medium">{baht(i.amount)}</td>
                <td className="px-4 py-3"><Badge status={i.status} /></td>
                <td className="px-4 py-3 text-right">
                  {role === "owner" ? (
                    <button onClick={() => onDelete(i.id)} className="text-xs text-red-600 hover:underline">ลบ / Delete</button>
                  ) : (
                    <span className="text-xs text-slate-400" title="Owner only">🔒</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">ไม่พบใบแจ้งหนี้ในสถานะนี้</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Builder({ onSave }: { onSave: (inv: Invoice) => void }) {
  const [customer, setCustomer] = useState("บริษัท ตัวอย่าง จำกัด");
  const [lines, setLines] = useState<Line[]>([
    { id: 1, desc: "กล่องกระดาษ ขนาด M", qty: 100, price: 18 },
    { id: 2, desc: "เทปกาว OPP 2 นิ้ว", qty: 12, price: 42 },
  ]);
  const [nextId, setNextId] = useState(3);
  const [saved, setSaved] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  const patch = (id: number, p: Partial<Line>) => {
    setSaved(false);
    setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  };
  const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h2 className="font-semibold">สร้างใบแจ้งหนี้ / New invoice</h2>
        <label className="block text-sm">
          <span className="text-slate-600">ลูกค้า / Customer</span>
          <input className={input} value={customer} onChange={(e) => { setSaved(false); setCustomer(e.target.value); }} />
        </label>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_64px_88px_28px] gap-2 text-xs text-slate-500">
            <span>รายการ</span><span>จำนวน</span><span>ราคา/หน่วย</span><span />
          </div>
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_64px_88px_28px] gap-2">
              <input className={input} value={l.desc} onChange={(e) => patch(l.id, { desc: e.target.value })} aria-label="Description" />
              <input className={input} type="number" min={1} value={l.qty} onChange={(e) => patch(l.id, { qty: Math.max(0, Number(e.target.value)) })} aria-label="Quantity" />
              <input className={input} type="number" min={0} value={l.price} onChange={(e) => patch(l.id, { price: Math.max(0, Number(e.target.value)) })} aria-label="Unit price" />
              <button onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="text-slate-400 hover:text-red-600" aria-label="Remove line">✕</button>
            </div>
          ))}
          <button
            onClick={() => { setLines([...lines, { id: nextId, desc: "", qty: 1, price: 0 }]); setNextId(nextId + 1); }}
            className="text-sm font-medium hover:underline"
            style={{ color: ACCENT }}
          >
            + เพิ่มรายการ / Add line
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            disabled={lines.length === 0}
            onClick={() => {
              onSave({ id: `INV-2410-0${19 + Math.floor(total) % 80}`, customer, date: "2026-10-01", amount: total, status: "draft" });
              setSaved(true);
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            บันทึกฉบับร่าง / Save draft
          </button>
          <button onClick={() => window.print()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            พิมพ์ / Print
          </button>
          {saved && <span className="self-center text-sm text-emerald-600">บันทึกแล้ว — ดูในรายการใบแจ้งหนี้</span>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold" style={{ color: ACCENT }}>BizLedger</p>
            <p className="text-xs text-slate-500">บริษัท บิซเลดเจอร์ จำกัด<br />99/9 ถ.สุขุมวิท กรุงเทพฯ 10110<br />Tax ID 0105500000000</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">ใบแจ้งหนี้ / INVOICE</p>
            <p className="text-xs text-slate-500">วันที่ 2026-10-01</p>
          </div>
        </div>
        <p className="mt-6 text-xs uppercase text-slate-500">เรียน / Bill to</p>
        <p className="font-medium">{customer || "—"}</p>
        <table className="mt-5 w-full text-sm">
          <thead className="border-b border-slate-300 text-left text-xs text-slate-500">
            <tr><th className="py-1">รายการ</th><th className="text-right">จำนวน</th><th className="text-right">ราคา</th><th className="text-right">รวม</th></tr>
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
        </table>
        <dl className="ml-auto mt-4 w-56 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">ยอดก่อน VAT</dt><dd>{baht(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">VAT 7%</dt><dd>{baht(vat)}</dd></div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold"><dt>รวมทั้งสิ้น</dt><dd>{baht(total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function Inventory({ items, onRestock }: { items: Item[]; onRestock: (sku: string) => void }) {
  const low = items.filter((i) => i.stock < i.min);
  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>แจ้งเตือนสินค้าใกล้หมด ({low.length} รายการ):</strong> {low.map((i) => i.name).join(", ")}
        </div>
      )}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">SKU</th><th className="px-4 py-2">สินค้า</th>
              <th className="px-4 py-2 text-right">คงเหลือ</th><th className="px-4 py-2 text-right">ขั้นต่ำ</th>
              <th className="px-4 py-2 text-right">ราคา</th><th className="px-4 py-2">ระดับสต็อก</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => {
              const isLow = i.stock < i.min;
              return (
                <tr key={i.sku} className={isLow ? "bg-amber-50/50" : ""}>
                  <td className="px-4 py-3 font-mono text-xs">{i.sku}</td>
                  <td className="px-4 py-3">{i.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-red-600" : ""}`}>{i.stock}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.min}</td>
                  <td className="px-4 py-3 text-right">{baht(i.price)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-28 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (i.stock / (i.min * 2)) * 100)}%`, background: isLow ? "#ef4444" : "#10b981" }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isLow && <button onClick={() => onRestock(i.sku)} className="rounded-md px-2.5 py-1 text-xs font-medium text-white" style={{ background: ACCENT }}>รับของเข้า +{i.min * 2}</button>}
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

const STACK_NOTES: [string, string][] = [
  ["Next.js", "App Router pages and server actions render the back-office and generate invoice PDFs server-side."],
  ["TypeScript", "Shared types for invoices, line items and roles keep the API and UI in sync."],
  ["PostgreSQL", "Stores invoices, line items, stock movements and users with transactional invoice numbering."],
  ["Role-based access", "Owner/staff role checked in middleware and on every server action, not just hidden in the UI."],
  ["Recharts", "Replaces this hand-drawn SVG with interactive charts fed by aggregated monthly sales queries."],
  ["Tailwind CSS", "Design tokens and print styles give a consistent UI and clean A4 invoice output."],
];

export default function InvoiceDashboardPage() {
  const [role, setRole] = useState<Role>("owner");
  const [view, setView] = useState<View>("dashboard");
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [stock, setStock] = useState(INITIAL_STOCK);

  const nav: { id: View; label: string; ownerOnly?: boolean }[] = [
    { id: "dashboard", label: "แดชบอร์ด / Dashboard", ownerOnly: true },
    { id: "invoices", label: "ใบแจ้งหนี้ / Invoices" },
    { id: "builder", label: "สร้างใบแจ้งหนี้ / New invoice" },
    { id: "inventory", label: "สินค้าคงคลัง / Inventory" },
  ];
  const visible = nav.filter((n) => role === "owner" || !n.ownerOnly);
  const current: View = visible.some((n) => n.id === view) ? view : "invoices";
  const lowCount = stock.filter((i) => i.stock < i.min).length;

  return (
    <DemoShell slug="invoice-dashboard">
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg font-bold text-white" style={{ background: ACCENT }}>B</span>
              <div>
                <p className="font-bold leading-tight">BizLedger</p>
                <p className="text-xs text-slate-500">ร้านสยามออฟฟิศซัพพลาย</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">บทบาท / Role:</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {(["owner", "staff"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-md px-3 py-1 capitalize ${role === r ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}
                  >
                    {r === "owner" ? "Owner" : "Staff"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Main">
            {visible.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${current === n.id ? "font-semibold" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                style={current === n.id ? { borderColor: ACCENT, color: ACCENT } : undefined}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          {role === "staff" && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 print:hidden">
              โหมดพนักงาน: ไม่สามารถดูรายได้หรือลบใบแจ้งหนี้ได้ / Staff mode — revenue and deletion are hidden.
            </p>
          )}
          {current === "dashboard" && role === "owner" && <Dashboard invoices={invoices} lowCount={lowCount} />}
          {current === "invoices" && (
            <InvoiceList invoices={invoices} role={role} onDelete={(id) => setInvoices(invoices.filter((i) => i.id !== id))} />
          )}
          {current === "builder" && <Builder onSave={(inv) => setInvoices([inv, ...invoices])} />}
          {current === "inventory" && (
            <Inventory items={stock} onRestock={(sku) => setStock(stock.map((i) => (i.sku === sku ? { ...i, stock: i.stock + i.min * 2 } : i)))} />
          )}

          <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
            <h2 className="font-semibold">How it&apos;s built</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {STACK_NOTES.map(([name, note]) => (
                <li key={name}><strong style={{ color: ACCENT }}>{name}</strong> — {note}</li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </DemoShell>
  );
}
