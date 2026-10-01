"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import OtpVerify from "@/components/OtpVerify";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";

const ACCENT = "#be185d";
const OPEN = 10 * 60;
const CLOSE = 19 * 60;
const API = "/api/salon-booking";
const SCOPE = "salon-booking";
// Demo stand-in for a real staff login: only the new admin panels use it.
const ADMIN_HEADERS = { "x-demo-role": "admin" };

type Service = { id: string; name: string; th: string; price: number; mins: number; image: string };
type Staff = { id: string; name: string; role: string; image: string };
type Booking = {
  id: string; ref: string; staffId: string; serviceId: string; date: string; start: number; mins: number;
  service: string; client: string; price: number; deposit: number; status: "pending_deposit" | "deposit_paid" | "expired";
  slipSandbox: boolean | null; intentId: string | null; paidVia: "webhook" | "slip" | "manual" | null;
};
type CalBooking = Pick<Booking, "id" | "ref" | "start" | "mins" | "service" | "client" | "status"> & { phone: string; note: string };
type Busy = { start: number; mins: number };
type AdminBooking = {
  ref: string; client: string; service: string; date: string; start: number; status: Booking["status"];
  intentId: string; intentStatus: "pending" | "paid" | "expired" | "cancelled"; payAmount: number; reference: string;
};
type Slot = { t: number; free: boolean };

const KEYS_STORAGE = "salon-booking-keys";
// Per-booking capability returned once at creation; the server requires it to read or retry that booking.
function saveBookingKey(id: string, key: string) {
  try {
    const map = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}") as Record<string, string>;
    localStorage.setItem(KEYS_STORAGE, JSON.stringify({ ...map, [id]: key }));
  } catch { /* storage unavailable: the key still lives in component state */ }
}

function readBookingKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}") as Record<string, string>; } catch { return {}; }
}

const DAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 2 + i)));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => ({
  dow: d.toLocaleDateString("th-TH-u-ca-gregory", { weekday: "short", timeZone: "UTC" }),
  num: d.getUTCDate(),
  full: d.toLocaleDateString("th-TH-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
});
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const ARROW_LEFT = "M19 12H5M11 6l-6 6 6 6";
const SPARK = "M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z";

const STEPS = ["บริการ", "ช่าง", "เวลา", "ข้อมูล", "มัดจำ", "เสร็จสิ้น"];

export default function SalonApp() {
  const [tab, setTab] = useState<"book" | "mine" | "calendar" | "admin">("book");
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadError, setLoadError] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(iso(DAYS[0]));
  const [start, setStart] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [payError, setPayError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [calStaff, setCalStaff] = useState("mild");
  const [calDate, setCalDate] = useState(iso(DAYS[0]));
  const [bookingKey, setBookingKey] = useState("");
  const [staffMode, setStaffMode] = useState(false);
  const [calBookings, setCalBookings] = useState<CalBooking[]>([]);
  const [calBusy, setCalBusy] = useState<Busy[]>([]);
  const [adminRows, setAdminRows] = useState<AdminBooking[]>([]);
  const [adminError, setAdminError] = useState("");
  const [mine, setMine] = useState<Booking[] | null>(null);
  const [mineKeys, setMineKeys] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [mineError, setMineError] = useState<{ id: string; msg: string } | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const staff = staffList.find((s) => s.id === staffId) ?? null;
  const deposit = service ? Math.round(service.price * 0.3) : 0;

  useEffect(() => {
    Promise.all([api<{ services: Service[] }>("/services"), api<{ staff: Staff[] }>("/staff")])
      .then(([s, t]) => { setServices(s.data.services); setStaffList(t.data.staff); })
      .catch(() => setLoadError("โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  // Re-fetched whenever the step changes, so returning after a 409 shows fresh availability.
  useEffect(() => {
    if (step !== 2 || !serviceId || !staffId) return;
    let live = true;
    api<{ slots: Slot[] }>(`/availability?date=${date}&staff=${staffId}&service=${serviceId}`).then((r) => { if (live && r.ok) setSlots(r.data.slots); });
    return () => { live = false; };
  }, [step, serviceId, staffId, date]);

  useEffect(() => {
    if (!serviceId || step !== 1) return;
    api<{ counts: { staffId: string; open: number }[] }>(`/availability?service=${serviceId}&dates=${DAYS.map(iso).join(",")}`).then((r) => {
      if (r.ok) setOpenCounts(Object.fromEntries(r.data.counts.map((c) => [c.staffId, c.open])));
    });
  }, [serviceId, step]);

  useEffect(() => {
    if (tab !== "calendar") return;
    let live = true;
    api<{ bookings?: CalBooking[]; busy?: Busy[] }>(`/calendar?staff=${calStaff}&date=${calDate}`, staffMode ? { headers: ADMIN_HEADERS } : undefined).then((r) => {
      if (!live || !r.ok) return;
      setCalBookings(r.data.bookings ?? []);
      setCalBusy(r.data.busy ?? []);
    });
    return () => { live = false; };
  }, [tab, calStaff, calDate, staffMode]);

  const formValid = form.name.trim().length > 1 && /^[0-9+\-\s]{9,}$/.test(form.phone) && /\S+@\S+\.\S+/.test(form.email);

  // Creating the booking claims the slot (server requires a verified phone); 409 means someone got there first.
  async function createHold() {
    if (!service || !staffId || start === null || !otpToken) return;
    setCreating(true);
    setPayError("");
    try {
      const created = await api<{ booking: Booking; accessKey: string }>("/bookings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ staffId, serviceId: service.id, date, start, ...form, otpToken }),
      });
      if (created.status === 409) {
        setStart(null);
        setStep(2);
        setPayError("ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาใหม่");
        return;
      }
      if (!created.ok) { setPayError(created.data.error ?? "จองไม่สำเร็จ"); return; }
      saveBookingKey(created.data.booking.id, created.data.accessKey);
      setBookingKey(created.data.accessKey);
      setBooking(created.data.booking);
      setStep(4);
    } finally {
      setCreating(false);
    }
  }

  // Re-reads the booking after the QR flips to paid or the hold expires.
  const refreshBooking = useCallback(async (id: string) => {
    const r = await api<{ booking: Booking }>(`/bookings/${id}`, { headers: { "x-booking-key": bookingKey } });
    if (r.ok) setBooking(r.data.booking);
    return r.ok ? r.data.booking : null;
  }, [bookingKey]);

  // After the hold expired: re-claim the slot (409 = taken meanwhile) and show a fresh QR.
  async function retryPayment() {
    if (!booking) return;
    setPayError("");
    const r = await api<{ booking: Booking }>(`/bookings/${booking.id}/retry`, { method: "POST", headers: { "x-booking-key": bookingKey } });
    if (r.status === 409) {
      setBooking(null); setStart(null); setStep(2);
      setPayError("คิวนี้ถูกจองโดยผู้อื่นแล้วระหว่างที่หมดเวลา กรุณาเลือกเวลาใหม่");
      return;
    }
    if (!r.ok) { setPayError(r.data.error ?? "ขอ QR ใหม่ไม่สำเร็จ"); return; }
    setBooking(r.data.booking);
  }

  const loadAdmin = useCallback(async () => {
    const r = await api<{ bookings: AdminBooking[] }>("/admin/payments", { headers: ADMIN_HEADERS });
    if (r.ok) { setAdminRows(r.data.bookings); setAdminError(""); } else setAdminError(r.data.error ?? "โหลดไม่สำเร็จ");
  }, []);

  useEffect(() => {
    if (tab !== "admin" || !staffMode) return;
    const t = setInterval(() => void loadAdmin(), 3000);
    const first = setTimeout(() => void loadAdmin(), 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [tab, staffMode, loadAdmin]);

  // Bookings are recovered from the per-booking keys saved in this browser; stale or unreadable ones are skipped.
  const loadMine = useCallback(async () => {
    const keys = readBookingKeys();
    const rows = await Promise.all(Object.entries(keys).map(async ([id, key]) => {
      try {
        const r = await api<{ booking: Booking }>(`/bookings/${id}`, { headers: { "x-booking-key": key } });
        return r.ok ? r.data.booking : null;
      } catch { return null; }
    }));
    setMineKeys(keys);
    setMine(rows.filter((b): b is Booking => b !== null).sort((a, b) => (b.date + String(b.start).padStart(4, "0")).localeCompare(a.date + String(a.start).padStart(4, "0"))));
  }, []);

  useEffect(() => {
    if (tab !== "mine") return;
    const t = setTimeout(() => void loadMine(), 0);
    return () => clearTimeout(t);
  }, [tab, loadMine]);

  // Expired booking: try to re-claim the same slot; if it was taken, start a new booking for the same service and staff.
  async function rebook(b: Booking) {
    setMineError(null);
    const r = await api<{ booking: Booking }>(`/bookings/${b.id}/retry`, { method: "POST", headers: { "x-booking-key": mineKeys[b.id] ?? "" } });
    if (r.status === 409) {
      reset(); setServiceId(b.serviceId); setStaffId(b.staffId); setDate(b.date); setStep(2); setTab("book");
      setPayError("คิวเดิมถูกจองโดยผู้อื่นแล้ว กรุณาเลือกเวลาใหม่");
      return;
    }
    if (!r.ok) { setMineError({ id: b.id, msg: r.data.error ?? "จองอีกครั้งไม่สำเร็จ" }); return; }
    setPayingId(b.id);
    await loadMine();
  }

  function reset() {
    setStep(0); setServiceId(null); setStaffId(null); setStart(null); setBooking(null); setBookingKey(""); setOtpToken(null); setPayError("");
    setForm({ name: "", phone: "", email: "", note: "" });
  }

  const dayInfo = dayLabel(new Date(date + "T00:00:00Z"));
  const ref = booking?.ref ?? "";

  return (
    <main className="mx-auto max-w-3xl pb-16">
      <header className="relative overflow-hidden rounded-b-3xl text-center text-white">
        <Image src="/images/salon-booking/hero.jpg" alt="ภายในร้าน Studio Lumi" width={1000} height={750} priority className="h-72 w-full object-cover sm:h-80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5" style={{ background: "linear-gradient(180deg,rgba(80,10,45,.55),rgba(20,0,10,.75))" }}>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: ACCENT }}><Icon d={SPARK} className="h-7 w-7" /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Studio Lumi</h1>
          <p className="mt-1 text-sm text-pink-100">Hair · Nails · Skin — สุขุมวิท 31, กรุงเทพฯ</p>
          <p className="mt-3 text-balance px-2 leading-relaxed">จองคิวออนไลน์ได้ตลอด 24 ชม. ยืนยันทันทีทางอีเมล</p>
          <p className="mt-1 text-xs text-pink-50">เปิดทุกวัน 10:00 – 19:00</p>
        </div>
      </header>

      <div className="mx-5 mt-6 flex items-center justify-end gap-2 text-sm text-neutral-700">
        <span>มุมมอง:</span>
        <button role="switch" aria-checked={staffMode} onClick={() => setStaffMode((v) => !v)} className="min-h-11 rounded-full border border-neutral-200 bg-white px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
          style={staffMode ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{staffMode ? "ผู้ดูแล/พนักงาน" : "ลูกค้า"}</button>
      </div>
      <div role="tablist" className="mx-5 mb-6 mt-2 flex rounded-full bg-pink-50 p-1 text-sm font-medium text-neutral-700 ring-1 ring-pink-100">
        {([["book", "จองคิว"], ["mine", "การจองของฉัน"], ["calendar", "ปฏิทินช่าง"], ["admin", "แอดมิน"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="min-h-11 flex-1 rounded-full px-2 py-2 text-xs transition sm:px-3 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
            style={tab === k ? { background: ACCENT, color: "#fff" } : undefined}>{l}</button>
        ))}
      </div>

      {loadError && <p className="mx-5 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

      {tab === "book" ? (
        <section className="px-5">
          <ol className="mb-6 flex items-center justify-between text-xs text-neutral-600">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-xs font-semibold"
                  style={i <= step ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{i < step ? <Icon d={CHECK} className="h-3.5 w-3.5" /> : i + 1}</span>
                <span className={`text-center leading-tight ${i === step ? "font-semibold text-neutral-900" : ""}`}>{s}</span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">เลือกบริการ</h2>
              {services.map((s) => (
                <button key={s.id} onClick={() => { setServiceId(s.id); setStart(null); setStep(1); }}
                  className="flex min-h-20 items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition hover:border-pink-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
                  style={serviceId === s.id ? { borderColor: ACCENT, background: "#fdf2f8" } : undefined}>
                  <Image src={s.image} alt={s.name} width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-sm text-neutral-600">{s.th} · {s.mins} นาที</span>
                  </span>
                  <span className="shrink-0 font-semibold" style={{ color: ACCENT }}>{baht(s.price)}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && service && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">เลือกช่าง</h2>
              {staffList.map((s) => (
                <button key={s.id} onClick={() => { setStaffId(s.id); setStart(null); setStep(2); }}
                  className="flex min-h-20 items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition hover:border-pink-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]">
                  <Image src={s.image} alt={`ช่าง ${s.name}`} width={64} height={64} className="h-16 w-16 rounded-full object-cover object-top" />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{s.name}</span><span className="block text-sm text-neutral-600">{s.role}</span></span>
                  <span className="max-w-[7rem] shrink-0 text-right text-xs leading-snug text-neutral-600">ว่าง {openCounts[s.id] ?? "…"} ช่วง<br />ใน 7 วัน</span>
                </button>
              ))}
              <Back onClick={() => setStep(0)} />
            </div>
          )}

          {step === 2 && service && staff && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">เลือกวันและเวลา · {staff.name}</h2>
              {payError && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{payError}</p>}
              <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-2">
                {DAYS.map((d) => {
                  const l = dayLabel(d);
                  const on = iso(d) === date;
                  return (
                    <button key={iso(d)} onClick={() => { setDate(iso(d)); setStart(null); setPayError(""); }}
                      className="flex min-h-14 min-w-14 shrink-0 flex-col items-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
                      style={on ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>
                      <span className="text-xs opacity-80">{l.dow}</span><span className="text-lg font-semibold">{l.num}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 text-sm text-neutral-600">{dayInfo.full} · ใช้เวลา {service.mins} นาที</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map(({ t, free }) => (
                  <button key={t} disabled={!free} onClick={() => { setStart(t); setPayError(""); }}
                    className="min-h-11 rounded-lg border border-neutral-200 bg-white py-2 text-sm tabular-nums hover:border-pink-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:line-through"
                    style={start === t ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{fmt(t)}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-600">ช่วงที่ขีดฆ่า = มีคิวแล้ว</p>
              <div className="mt-5 flex items-center justify-between">
                <Back onClick={() => setStep(1)} />
                <Next disabled={start === null} onClick={() => setStep(3)} />
              </div>
            </div>
          )}

          {step === 3 && service && staff && start !== null && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">ข้อมูลผู้จอง</h2>
              <Summary service={service} staff={staff} date={dayInfo.full} start={start} />
              {([["name", "ชื่อ-นามสกุล", "text"], ["phone", "เบอร์โทรศัพท์", "tel"], ["email", "อีเมล (รับใบยืนยัน)", "email"]] as const).map(([k, l, type]) => (
                <label key={k} className="grid gap-1 text-sm">{l}
                  <input type={type} value={form[k]} onChange={(e) => { setForm({ ...form, [k]: e.target.value }); if (k === "phone") setOtpToken(null); }} className="min-h-11 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base focus:border-[#be185d] focus:outline-2 focus:outline-[#be185d]" />
                </label>
              ))}
              {/^0[689]\d{8}$/.test(form.phone.replace(/[\s-]/g, "")) ? (
                <OtpVerify key={form.phone} phone={form.phone} accent={ACCENT} onVerified={setOtpToken} />
              ) : (
                <p className="text-xs text-neutral-600">กรอกเบอร์มือถือไทย 10 หลัก (เช่น 0812345678) เพื่อรับรหัส OTP ยืนยันเบอร์</p>
              )}
              {payError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{payError}</p>}
              <label className="grid gap-1 text-sm">หมายเหตุ (ไม่บังคับ)
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="min-h-11 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base focus:border-[#be185d] focus:outline-2 focus:outline-[#be185d]" />
              </label>
              <div className="flex items-center justify-between"><Back onClick={() => setStep(2)} /><Next disabled={!formValid || !otpToken || creating} onClick={createHold} label={creating ? "กำลังจองคิว…" : "จองคิวและชำระมัดจำ"} /></div>
            </div>
          )}

          {step === 4 && service && staff && start !== null && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">ชำระมัดจำ 30%</h2>
              <Summary service={service} staff={staff} date={dayInfo.full} start={start} />
              <div className="flex items-center justify-between gap-3 rounded-xl bg-pink-50 p-4 text-sm">
                <span>มัดจำวันนี้ (หักจากยอดรวมหน้าร้าน)</span><span className="font-semibold" style={{ color: ACCENT }}>{baht(deposit)}</span>
              </div>
              {booking && booking.status !== "expired" && booking.intentId && (
                <QrPayPanel key={booking.intentId} scope={SCOPE} intentId={booking.intentId} accent={ACCENT}
                  onPaid={() => { void refreshBooking(booking.id).then(() => setStep(5)); }}
                  onClosed={() => void refreshBooking(booking.id)} />
              )}
              {booking?.status === "expired" && (
                <div className="grid gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p>หมดเวลาชำระมัดจำ คิวที่จองไว้ถูกปล่อยแล้ว หากคิวนี้ยังว่างสามารถขอ QR ใหม่ได้ (หากโอนไปแล้วให้ติดต่อร้าน)</p>
                  {payError && <p className="text-red-700">{payError}</p>}
                  <button onClick={retryPayment} className="min-h-11 rounded-full py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>ขอ QR ใหม่ / ลองชำระอีกครั้ง</button>
                </div>
              )}
              <p className="text-xs leading-relaxed text-neutral-600">คิวถูกกันไว้ให้ 10 นาทีระหว่างชำระมัดจำ ยอดโอนมีเศษสตางค์เฉพาะรายการเพื่อให้ระบบจับคู่การชำระเงินอัตโนมัติ · ยกเลิกฟรีก่อนนัด 24 ชม.</p>
            </div>
          )}

          {step === 5 && service && staff && start !== null && (
            <div className="grid gap-4">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><Icon d={CHECK} className="h-7 w-7" /></div>
                <h2 className="text-xl font-semibold">จองคิวสำเร็จ!</h2>
                <p className="text-sm leading-relaxed text-neutral-600">รหัสการจอง <b>{ref}</b> · สถานะมัดจำ: ชำระแล้ว ({booking?.paidVia === "slip" ? "ตรวจสลิปแล้ว" : booking?.paidVia === "manual" ? "ร้านยืนยันเอง" : "ระบบตรวจพบเงินเข้าอัตโนมัติ"})</p>
                {booking?.slipSandbox && <p className="mt-1 text-xs text-amber-700">ชำระผ่านสลิปในโหมดทดสอบ: ระบบรับสลิปเป็นภาพใดก็ได้และไม่ได้ตรวจกับธนาคารจริง</p>}
              </div>
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 text-sm">
                <div className="break-words border-b border-neutral-200 bg-neutral-100 px-4 py-2 text-xs leading-relaxed text-neutral-600">
                  <div><b>จาก:</b> Studio Lumi &lt;booking@studiolumi.example&gt;</div>
                  <div><b>ถึง:</b> {form.email}</div>
                  <div><b>หัวข้อ:</b> ยืนยันการจอง {ref} · {dayInfo.full} {fmt(start)}</div>
                </div>
                <div className="grid gap-2 bg-white p-4">
                  <div className="flex items-center gap-1.5 text-lg font-semibold" style={{ color: ACCENT }}><Icon d={SPARK} className="h-5 w-5" /> Studio Lumi</div>
                  <p>สวัสดีค่ะ คุณ{form.name}</p>
                  <p>เราได้รับการจองและมัดจำของคุณเรียบร้อยแล้ว:</p>
                  <ul className="grid gap-1 rounded-lg bg-pink-50 p-3 leading-relaxed">
                    <li>บริการ: {service.name} ({service.mins} นาที)</li>
                    <li>ช่าง: {staff.name}</li>
                    <li>วันเวลา: {dayInfo.full}, {fmt(start)}–{fmt(start + service.mins)}</li>
                    <li>มัดจำชำระแล้ว: {baht(deposit)} · คงเหลือ {baht(service.price - deposit)}</li>
                  </ul>
                  <p className="text-xs leading-relaxed text-neutral-600">เลื่อนหรือยกเลิกได้ก่อนนัด 24 ชม. ที่ลิงก์ในอีเมลนี้ — แล้วพบกันนะคะ (อีเมลนี้เป็นตัวอย่าง ไม่ได้ส่งจริง)</p>
                </div>
              </div>
              <p className="text-center text-xs text-neutral-600">เก็บรหัสการจองไว้ — เปิดดูย้อนหลังได้ที่แท็บ &quot;การจองของฉัน&quot; แม้โหลดหน้าใหม่</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={() => { setCalStaff(staff.id); setCalDate(date); setTab("calendar"); }} className="min-h-12 flex-1 rounded-full border border-neutral-200 bg-white py-3 font-medium hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]">ดูในปฏิทินช่าง</button>
                <button onClick={reset} className="min-h-12 flex-1 rounded-full py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>จองคิวใหม่</button>
              </div>
            </div>
          )}
        </section>
      ) : tab === "mine" ? (
        <section className="grid gap-3 px-5">
          <h2 className="text-lg font-semibold">การจองของฉัน</h2>
          {mine === null ? <p className="rounded-xl bg-neutral-50 py-6 text-center text-neutral-600">กำลังโหลด…</p>
            : mine.length === 0 ? (
              <div className="grid gap-3 rounded-xl bg-neutral-50 py-6 text-center text-neutral-600">
                <p>ยังไม่มีการจองจากเบราว์เซอร์นี้</p>
                <button onClick={() => setTab("book")} className="mx-auto min-h-11 rounded-full px-6 py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>จองคิว</button>
              </div>
            ) : mine.map((b) => {
              const info = { paid: ["ชำระมัดจำแล้ว", "bg-green-100 text-green-800"], pending: ["รอชำระมัดจำ", "bg-amber-100 text-amber-800"], expired: ["หมดเวลา", "bg-neutral-200 text-neutral-700"] }[b.status === "deposit_paid" ? "paid" : b.status === "pending_deposit" ? "pending" : "expired"];
              const who = staffList.find((t) => t.id === b.staffId)?.name ?? b.staffId;
              return (
                <article key={b.id} className="grid gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">รหัสการจอง {b.ref}</span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${info[1]}`}>{info[0]}</span>
                  </div>
                  <div className="leading-relaxed text-neutral-700">
                    <div>{b.service} · ช่าง {who}</div>
                    <div>{dayLabel(new Date(b.date + "T00:00:00Z")).full}, {fmt(b.start)}–{fmt(b.start + b.mins)}</div>
                    <div>มัดจำ {baht(b.deposit)} · คงเหลือชำระที่ร้าน <b style={{ color: ACCENT }}>{baht(b.price - b.deposit)}</b></div>
                  </div>
                  {b.status === "pending_deposit" && b.intentId && (payingId === b.id ? (
                    <QrPayPanel key={b.intentId} scope={SCOPE} intentId={b.intentId} accent={ACCENT}
                      onPaid={() => { setPayingId(null); void loadMine(); }} onClosed={() => void loadMine()} />
                  ) : (
                    <button onClick={() => setPayingId(b.id)} className="min-h-11 rounded-full py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>ชำระมัดจำต่อ</button>
                  ))}
                  {b.status === "expired" && (
                    <>
                      <p className="text-xs leading-relaxed text-neutral-600">คิวที่กันไว้หมดเวลาแล้ว หากคิวเดิมยังว่างจะได้ QR ใหม่ทันที (หากโอนไปแล้วให้ติดต่อร้าน)</p>
                      {mineError?.id === b.id && <p className="rounded-lg bg-red-50 p-3 text-red-700">{mineError.msg}</p>}
                      <button onClick={() => void rebook(b)} className="min-h-11 rounded-full py-2.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>จองอีกครั้ง</button>
                    </>
                  )}
                </article>
              );
            })}
        </section>
      ) : tab === "admin" && !staffMode ? (
        <section className="px-5"><p className="rounded-xl bg-neutral-50 py-6 text-center text-neutral-600">แท็บนี้สำหรับผู้ดูแล/พนักงาน — สลับมุมมองด้านบนเพื่อเข้าใช้งาน</p></section>
      ) : tab === "admin" ? (
        <section className="grid gap-4 px-5">
          <h2 className="text-lg font-semibold">แอดมิน · บัญชีรับเงินและมัดจำ</h2>
          <p className="text-xs leading-relaxed text-neutral-600">เดโมใช้ header x-demo-role: admin แทนการล็อกอินพนักงาน (production ใช้ Supabase Auth)</p>
          {adminError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{adminError}</p>}
          <PayeeSettings scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onSaved={() => void loadAdmin()} />
          <SandboxSimulate scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onDone={() => void loadAdmin()}
            targets={adminRows.filter((r) => r.intentStatus === "pending").map((r) => ({ key: r.ref, label: `${r.ref} · ${r.client}`, amount: r.payAmount, reference: r.reference }))} />
          <UnmatchedPayments scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onAssigned={() => void loadAdmin()}
            targets={adminRows.filter((r) => r.status !== "deposit_paid").map((r) => ({ intentId: r.intentId, label: `${r.ref} · ${r.client} · ฿${r.payAmount.toFixed(2)} · ${r.status === "expired" ? "หมดเวลา" : "รอมัดจำ"}` }))} />
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
            <h3 className="mb-2 font-semibold">คิวที่รอมัดจำ / หมดเวลา</h3>
            {adminRows.length === 0 ? <p className="rounded-xl bg-neutral-50 py-6 text-center text-neutral-500">ยังไม่มีคิวที่รอมัดจำหรือหมดเวลา</p> : (
              <ul className="grid divide-y divide-neutral-200">
                {adminRows.map((r) => (
                  <li key={r.intentId} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-3">
                    <span>{r.ref} · {r.client} · {r.date} {fmt(r.start)}</span>
                    <span className="text-neutral-600 sm:text-right">฿{r.payAmount.toFixed(2)} · {r.status === "expired" ? "หมดเวลา (ปล่อยคิวแล้ว)" : "รอมัดจำ"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className="px-5">
          <h2 className="mb-1 text-lg font-semibold">ปฏิทินช่าง (มุมมองรายวัน)</h2>
          <p className="mb-3 text-sm text-neutral-600">{staffMode ? "พนักงานเห็นคิวและชื่อลูกค้าทั้งหมดจากฐานข้อมูล รวมคิวที่เพิ่งจองจากหน้าเว็บ" : "ลูกค้าเห็นเฉพาะช่วงเวลาที่ไม่ว่าง สลับเป็นผู้ดูแล/พนักงานเพื่อดูรายละเอียดคิว"}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {staffList.map((s) => (
              <button key={s.id} onClick={() => setCalStaff(s.id)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
                style={calStaff === s.id ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>
                <Image src={s.image} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover object-top" />{s.name}
              </button>
            ))}
          </div>
          <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-2">
            {DAYS.map((d) => {
              const l = dayLabel(d);
              return (
                <button key={iso(d)} onClick={() => setCalDate(iso(d))} className="flex min-h-14 min-w-14 shrink-0 flex-col items-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"
                  style={calDate === iso(d) ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>
                  <span className="text-xs opacity-80">{l.dow}</span><span className="text-lg font-semibold">{l.num}</span>
                </button>
              );
            })}
          </div>
          <DayView bookings={calBookings} busy={calBusy} />
        </section>
      )}

      <section className="mx-5 mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed">
        <h2 className="mb-3 font-semibold">สร้างอย่างไร</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-neutral-700">
          <li>ของจริงในเดโมนี้: บริการ ช่วงเวลาว่าง และการจองเก็บใน SQLite ผ่าน API จริง จองซ้อนเวลากันไม่ได้</li>
          <li>การชำระเงิน: มัดจำ 30% ผ่าน PromptPay QR ที่ระบบตรวจจับเงินเข้าอัตโนมัติด้วย webhook ที่เซ็นลายเซ็นไว้ และมีการอัปโหลดสลิปเป็นทางสำรอง</li>
          <li>ในงานจริง: Supabase (PostgreSQL และ Auth) ส่งอีเมลด้วย Resend และรับแจ้งเงินเข้าจากธนาคารหรือผู้ให้บริการชำระเงิน</li>
        </ul>
        <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-neutral-700">หมายเหตุความจริงของเดโม: เดโมนี้ยังไม่ได้เชื่อมต่อฟีดแจ้งเงินเข้าจากธนาคารจริง ปุ่มจำลองในแท็บแอดมินส่งการแจ้งเงินเข้าที่ลงลายเซ็นแล้วเข้าสู่ webhook ตัวจริงเพื่อสาธิตการตรวจจับอัตโนมัติ และบัญชีรับเงินเริ่มต้นเป็นเลขตัวอย่าง</p>
        <details className="group mt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d] [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
        <ul className="mt-2 grid gap-3 text-neutral-700">
          <li><b>Next.js + TypeScript</b> — ใช้ Route Handlers ภายใต้ /api/salon-booking ดูแลบริการ ช่างหรือพนักงาน ช่วงเวลาว่าง การจอง การชำระมัดจำ และปฏิทินรายวันของพนักงาน</li>
          <li><b>SQLite (เดโมนี้) / PostgreSQL ผ่าน Supabase (ระบบจริง)</b> — ข้อมูลบริการ พนักงาน การจอง และช่วงเวลาแต่ละช่องเป็นข้อมูลจริงและยังอยู่ครบแม้โหลดหน้าใหม่ ระบบกำหนด primary key บน (พนักงาน, วัน, ช่วงเวลา) จึงจองซ้อนกันไม่ได้ และ API จะตอบกลับ 409 โดยการบันทึกการจองทำใน transaction เดียว ส่วนระบบจริงจะใช้ exclusion constraint บนช่วงเวลาแทน</li>
          <li><b>Supabase Auth</b> — ใช้เฉพาะระบบจริง: พนักงานเข้าสู่ระบบเพื่อจัดการปฏิทินของตัวเอง ในเดโมนี้ปฏิทินรายละเอียดคิวและแท็บแอดมินใช้ x-demo-role จำลองสิทธิ์แทน ส่วนลูกค้าเห็นเฉพาะช่วงเวลาที่ไม่ว่าง</li>
          <li><b>Resend</b> — ใช้เฉพาะระบบจริง: ส่งอีเมลยืนยันการจองและอีเมลเตือนล่วงหน้า 24 ชั่วโมง อีเมลที่เห็นด้านบนเป็นเพียงตัวอย่าง ไม่ได้ส่งจริง</li>
          <li><b>PromptPay QR พร้อมตรวจจับการชำระอัตโนมัติ</b> — เมื่อสร้างการจอง ระบบจะกันช่วงเวลาไว้และออกรายการรับชำระมัดจำ 30% (คำนวณที่ฝั่งเซิร์ฟเวอร์) โดยมียอดเศษสตางค์ไม่ซ้ำกัน แสดงเป็น PromptPay QR พร้อมนับถอยหลัง 10 นาที จากนั้น webhook ที่ลงลายเซ็น (HMAC-SHA256 ตรวจเวลา และไม่ประมวลผลซ้ำด้วย event id) จะจับคู่ยอดเงินที่เข้ามาและเปลี่ยนสถานะการจองเป็นชำระแล้วเพียงครั้งเดียว หน้าจอจะอัปเดตเองอัตโนมัติ หากรายการหมดอายุโดยยังไม่ชำระ ระบบจะปล่อยช่วงเวลากลับคืนและลูกค้าขอ QR ใหม่ได้ ส่วนเงินที่เข้ามาช้าหรือยอดไม่ตรงจะไปอยู่ในรายการที่ยังจับคู่ไม่ได้ ซึ่งแอดมินระบุการจับคู่เองได้</li>
          <li><b>ตรวจสลิปด้วย Thunder API (ทางเลือกสำรอง)</b> — ลูกค้ายังอัปโหลดสลิปโอนเงินได้ เซิร์ฟเวอร์จะตรวจสลิป (ยอดเงิน ผู้รับ และเลขอ้างอิง transaction ที่ใช้ได้ครั้งเดียว) ผ่านชุดระบบชำระเงินเดียวกัน ก่อนเปลี่ยนสถานะการจองเป็นชำระแล้ว หากไม่มี THUNDER_API_KEY จะทำงานในโหมด sandbox ที่แสดงป้ายชัดเจนและรับรูปภาพใดก็ได้</li>
          <li><b>ระบบจริง</b> — webhook จะรับข้อมูลจากฟีดแจ้งเงินเข้า PromptPay ของธนาคารหรือผู้ให้บริการชำระเงิน พร้อม PAYMENT_WEBHOOK_SECRET จริง และแท็บแอดมินจะอยู่หลังระบบเข้าสู่ระบบของพนักงานจริง แทน header x-demo-role</li>
          <li><b>ThaiBulkSMS OTP</b> — การจองต้องใช้เบอร์โทรที่ยืนยันด้วยรหัสครั้งเดียว และ API ตรวจสอบ OTP token ซ้ำที่ฝั่งเซิร์ฟเวอร์ หากไม่มี key ของ ThaiBulkSMS ระบบจะแสดงรหัสบนหน้าจอในโหมด sandbox แทนการส่ง SMS</li>
          <li><b>Tailwind CSS</b> — จัดหน้าตาแบบ mobile-first พร้อมธีมแยกตามแบรนด์</li>
        </ul>
        </details>
      </section>
    </main>
  );
}

function DayView({ bookings, busy }: { bookings: CalBooking[]; busy: Busy[] }) {
  const rows = Array.from({ length: (CLOSE - OPEN) / 60 }, (_, i) => OPEN + i * 60);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white" style={{ height: rows.length * 56 }}>
      {rows.map((t, i) => (
        <div key={t} className="absolute inset-x-0 border-t border-neutral-200 text-xs text-neutral-500" style={{ top: i * 56 }}>
          <span className="ml-2">{fmt(t)}</span>
        </div>
      ))}
      {bookings.map((b) => (
        <div key={b.id} className="absolute left-14 right-2 overflow-hidden rounded-lg px-3 py-1 text-xs text-white shadow"
          style={{ top: ((b.start - OPEN) / 60) * 56 + 2, height: (b.mins / 60) * 56 - 4, background: b.status === "deposit_paid" ? ACCENT : "#6b7280" }}>
          <b>{fmt(b.start)}–{fmt(b.start + b.mins)}</b> {b.client}
          <div className="opacity-90">{b.service} · {b.status === "deposit_paid" ? "มัดจำแล้ว" : "รอมัดจำ"}</div>
        </div>
      ))}
      {busy.map((b) => (
        <div key={b.start} className="absolute left-14 right-2 overflow-hidden rounded-lg bg-neutral-500 px-3 py-1 text-xs text-white shadow"
          style={{ top: ((b.start - OPEN) / 60) * 56 + 2, height: (b.mins / 60) * 56 - 4 }}>
          <b>{fmt(b.start)}–{fmt(b.start + b.mins)}</b> ไม่ว่าง
        </div>
      ))}
      {bookings.length === 0 && busy.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">ไม่มีคิวในวันนี้</p>}
    </div>
  );
}

function Summary({ service, staff, date, start }: { service: Service; staff: Staff; date: string; start: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
      <Image src={service.image} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
      <div>
        <div className="font-medium">{service.name} · {baht(service.price)}</div>
        <div className="leading-relaxed text-neutral-600">{staff.name} · {date} · {fmt(start)}–{fmt(start + service.mins)}</div>
      </div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-11 items-center gap-1 px-2 text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]"><Icon d={ARROW_LEFT} className="h-3.5 w-3.5" /> ย้อนกลับ</button>;
}

function Next({ onClick, disabled, label = "ถัดไป" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <button onClick={onClick} disabled={disabled} className="min-h-12 rounded-full px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#be185d]" style={{ background: ACCENT }}>{label}</button>;
}
