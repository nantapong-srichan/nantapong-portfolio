"use client";

import { useMemo, useState } from "react";

const ACCENT = "#be185d";
const OPEN = 10 * 60;
const CLOSE = 19 * 60;
const STEP = 30;

type Service = { id: string; name: string; th: string; price: number; mins: number; emoji: string };
type Staff = { id: string; name: string; role: string; emoji: string };
type Booking = { staffId: string; date: string; start: number; mins: number; service: string; client: string };

const SERVICES: Service[] = [
  { id: "cut", name: "Signature Haircut", th: "ตัดผม + สไตล์ลิ่ง", price: 650, mins: 60, emoji: "✂️" },
  { id: "color", name: "Full Color", th: "ทำสีผมทั้งหัว", price: 2400, mins: 120, emoji: "🎨" },
  { id: "treat", name: "Keratin Treatment", th: "เคราตินบำรุงผม", price: 1800, mins: 90, emoji: "💧" },
  { id: "nail", name: "Gel Manicure", th: "ทำเล็บเจล", price: 590, mins: 60, emoji: "💅" },
  { id: "facial", name: "Glow Facial", th: "ทรีตเมนต์หน้าใส", price: 1200, mins: 60, emoji: "🌸" },
  { id: "spa", name: "Scalp Spa", th: "สปาหนังศีรษะ", price: 890, mins: 30, emoji: "🌿" },
];

const STAFF: Staff[] = [
  { id: "mild", name: "Mild", role: "Senior Stylist", emoji: "👩‍🎤" },
  { id: "ploy", name: "Ploy", role: "Colorist", emoji: "👩‍🦰" },
  { id: "ken", name: "Ken", role: "Nail & Skin", emoji: "🧑‍🎨" },
];

const DAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 2 + i)));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => ({
  dow: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
  num: d.getUTCDate(),
  full: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
});
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

// Deterministic pre-existing bookings so the grid always shows taken slots.
function seedBookings(): Booking[] {
  const names = ["คุณแอน", "คุณบีม", "Nok", "คุณเอ", "Fah", "คุณมิ้นท์"];
  const out: Booking[] = [];
  DAYS.forEach((d, di) => {
    STAFF.forEach((s, si) => {
      const start = OPEN + ((di * 3 + si * 2) % 6) * 60;
      const svc = SERVICES[(di + si) % SERVICES.length];
      out.push({ staffId: s.id, date: iso(d), start, mins: svc.mins, service: svc.name, client: names[(di + si) % names.length] });
      if ((di + si) % 2 === 0) {
        out.push({ staffId: s.id, date: iso(d), start: 15 * 60 + (si % 2) * 30, mins: 60, service: "Gel Manicure", client: names[(di * 2 + si) % names.length] });
      }
    });
  });
  return out;
}

function isFree(bookings: Booking[], staffId: string, date: string, start: number, mins: number) {
  if (start + mins > CLOSE) return false;
  return !bookings.some((b) => b.staffId === staffId && b.date === date && start < b.start + b.mins && b.start < start + mins);
}

const STEPS = ["Service", "Staff", "Time", "Details", "Deposit", "Done"];

export default function SalonApp() {
  const [tab, setTab] = useState<"book" | "calendar">("book");
  const [step, setStep] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(iso(DAYS[0]));
  const [start, setStart] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", exp: "12/28", cvc: "123" });
  const [paying, setPaying] = useState(false);
  const [calStaff, setCalStaff] = useState("mild");
  const [calDate, setCalDate] = useState(iso(DAYS[0]));

  const service = SERVICES.find((s) => s.id === serviceId) ?? null;
  const staff = STAFF.find((s) => s.id === staffId) ?? null;
  const deposit = service ? Math.round(service.price * 0.3) : 0;

  const slots = useMemo(() => {
    if (!service || !staffId) return [];
    const list: { t: number; free: boolean }[] = [];
    for (let t = OPEN; t < CLOSE; t += STEP) list.push({ t, free: isFree(bookings, staffId, date, t, service.mins) });
    return list;
  }, [bookings, service, staffId, date]);

  const formValid = form.name.trim().length > 1 && /^[0-9+\-\s]{9,}$/.test(form.phone) && /\S+@\S+\.\S+/.test(form.email);
  const ref = useMemo(() => (step === 5 && service && start !== null ? `LUMI-${(date.slice(8) + fmt(start).replace(":", "") + service.id).toUpperCase()}` : ""), [step, service, start, date]);

  function pay() {
    if (!service || !staffId || start === null) return;
    setPaying(true);
    setTimeout(() => {
      setBookings((b) => [...b, { staffId, date, start, mins: service.mins, service: service.name, client: form.name }]);
      setPaying(false);
      setStep(5);
    }, 1200);
  }

  function reset() {
    setStep(0); setServiceId(null); setStaffId(null); setStart(null);
    setForm({ name: "", phone: "", email: "", note: "" });
  }

  const dayInfo = dayLabel(new Date(date + "T00:00:00Z"));

  return (
    <main className="mx-auto max-w-3xl pb-16" style={{ ["--a" as string]: ACCENT }}>
      <header className="px-5 pb-8 pt-10 text-center" style={{ background: "linear-gradient(180deg,#fdf2f8,#fff)" }}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white" style={{ background: ACCENT }}>✦</div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: ACCENT }}>Studio Lumi</h1>
        <p className="mt-1 text-sm text-neutral-600">Hair · Nails · Skin — สุขุมวิท 31, กรุงเทพฯ</p>
        <p className="mt-3 text-neutral-700">จองคิวออนไลน์ได้ตลอด 24 ชม. ยืนยันทันทีทางอีเมล</p>
        <p className="mt-1 text-xs text-neutral-500">เปิดทุกวัน 10:00 – 19:00</p>
      </header>

      <div className="mx-5 mb-6 flex rounded-full bg-neutral-100 p-1 text-sm font-medium">
        {([["book", "จองคิว / Book"], ["calendar", "ปฏิทินช่าง / Staff calendar"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="flex-1 rounded-full px-3 py-2 transition"
            style={tab === k ? { background: ACCENT, color: "#fff" } : undefined}>{l}</button>
        ))}
      </div>

      {tab === "book" ? (
        <section className="px-5">
          <ol className="mb-6 flex items-center justify-between text-[11px] text-neutral-500">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center gap-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold"
                  style={i <= step ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{i < step ? "✓" : i + 1}</span>
                <span className={i === step ? "font-semibold text-neutral-900" : ""}>{s}</span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">เลือกบริการ</h2>
              {SERVICES.map((s) => (
                <button key={s.id} onClick={() => { setServiceId(s.id); setStart(null); setStep(1); }}
                  className="flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:shadow-md"
                  style={serviceId === s.id ? { borderColor: ACCENT, background: "#fdf2f8" } : undefined}>
                  <span className="text-3xl">{s.emoji}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-sm text-neutral-500">{s.th} · {s.mins} นาที</span>
                  </span>
                  <span className="font-semibold" style={{ color: ACCENT }}>{baht(s.price)}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && service && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">เลือกช่าง</h2>
              {STAFF.map((s) => {
                const open = DAYS.reduce((n, d) => n + Array.from({ length: (CLOSE - OPEN) / STEP }, (_, i) => OPEN + i * STEP).filter((t) => isFree(bookings, s.id, iso(d), t, service.mins)).length, 0);
                return (
                  <button key={s.id} onClick={() => { setStaffId(s.id); setStart(null); setStep(2); }}
                    className="flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:shadow-md">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-2xl">{s.emoji}</span>
                    <span className="flex-1"><span className="block font-medium">{s.name}</span><span className="block text-sm text-neutral-500">{s.role}</span></span>
                    <span className="text-xs text-neutral-500">{open} ช่วงเวลาว่างใน 7 วัน</span>
                  </button>
                );
              })}
              <Back onClick={() => setStep(0)} />
            </div>
          )}

          {step === 2 && service && staff && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">เลือกวันและเวลา · {staff.name}</h2>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                {DAYS.map((d) => {
                  const l = dayLabel(d);
                  const on = iso(d) === date;
                  return (
                    <button key={iso(d)} onClick={() => { setDate(iso(d)); setStart(null); }}
                      className="flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 text-sm"
                      style={on ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>
                      <span className="text-xs opacity-80">{l.dow}</span><span className="text-lg font-semibold">{l.num}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 text-sm text-neutral-600">{dayInfo.full} · ใช้เวลา {service.mins} นาที</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map(({ t, free }) => (
                  <button key={t} disabled={!free} onClick={() => setStart(t)}
                    className="rounded-lg border py-2 text-sm disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 disabled:line-through"
                    style={start === t ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{fmt(t)}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">ช่วงที่ขีดฆ่า = มีคิวแล้ว</p>
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
                  <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="rounded-lg border px-3 py-2 text-base" />
                </label>
              ))}
              <label className="grid gap-1 text-sm">หมายเหตุ (ไม่บังคับ)
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="rounded-lg border px-3 py-2 text-base" />
              </label>
              <div className="flex items-center justify-between"><Back onClick={() => setStep(2)} /><Next disabled={!formValid} onClick={() => setStep(4)} label="ไปชำระมัดจำ" /></div>
            </div>
          )}

          {step === 4 && service && staff && start !== null && (
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">ชำระมัดจำ 30%</h2>
              <Summary service={service} staff={staff} date={dayInfo.full} start={start} />
              <div className="flex justify-between rounded-xl bg-pink-50 p-4 text-sm">
                <span>มัดจำวันนี้ (หักจากยอดรวมหน้าร้าน)</span><span className="font-semibold" style={{ color: ACCENT }}>{baht(deposit)}</span>
              </div>
              <label className="grid gap-1 text-sm">หมายเลขบัตร (ทดสอบ)
                <input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} className="rounded-lg border px-3 py-2 text-base" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">หมดอายุ<input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} className="rounded-lg border px-3 py-2 text-base" /></label>
                <label className="grid gap-1 text-sm">CVC<input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} className="rounded-lg border px-3 py-2 text-base" /></label>
              </div>
              <p className="text-xs text-neutral-500">เดโม่เท่านั้น — ไม่มีการตัดเงินจริง ยกเลิกฟรีก่อนนัด 24 ชม.</p>
              <div className="flex items-center justify-between">
                <Back onClick={() => setStep(3)} />
                <button onClick={pay} disabled={paying || card.number.length < 12} className="rounded-full px-6 py-3 font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>
                  {paying ? "กำลังดำเนินการ…" : `จ่ายมัดจำ ${baht(deposit)}`}
                </button>
              </div>
            </div>
          )}

          {step === 5 && service && staff && start !== null && (
            <div className="grid gap-4">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</div>
                <h2 className="text-xl font-semibold">จองคิวสำเร็จ!</h2>
                <p className="text-sm text-neutral-600">รหัสการจอง <b>{ref}</b></p>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-neutral-50 text-sm">
                <div className="border-b bg-neutral-100 px-4 py-2 text-xs text-neutral-600">
                  <div><b>From:</b> Studio Lumi &lt;booking@studiolumi.example&gt;</div>
                  <div><b>To:</b> {form.email}</div>
                  <div><b>Subject:</b> ยืนยันการจอง {ref} · {dayInfo.full} {fmt(start)}</div>
                </div>
                <div className="grid gap-2 bg-white p-4">
                  <div className="text-lg font-semibold" style={{ color: ACCENT }}>✦ Studio Lumi</div>
                  <p>สวัสดีค่ะ คุณ{form.name}</p>
                  <p>เราได้รับการจองและมัดจำของคุณเรียบร้อยแล้ว:</p>
                  <ul className="rounded-lg bg-pink-50 p-3">
                    <li>บริการ: {service.name} ({service.mins} นาที)</li>
                    <li>ช่าง: {staff.name}</li>
                    <li>วันเวลา: {dayInfo.full}, {fmt(start)}–{fmt(start + service.mins)}</li>
                    <li>มัดจำชำระแล้ว: {baht(deposit)} · คงเหลือ {baht(service.price - deposit)}</li>
                  </ul>
                  <p className="text-xs text-neutral-500">เลื่อนหรือยกเลิกได้ก่อนนัด 24 ชม. ที่ลิงก์ในอีเมลนี้ — แล้วพบกันนะคะ</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setCalStaff(staff.id); setCalDate(date); setTab("calendar"); }} className="flex-1 rounded-full border py-3 font-medium">ดูในปฏิทินช่าง</button>
                <button onClick={reset} className="flex-1 rounded-full py-3 font-medium text-white" style={{ background: ACCENT }}>จองคิวใหม่</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="px-5">
          <h2 className="mb-1 text-lg font-semibold">ปฏิทินช่าง (มุมมองรายวัน)</h2>
          <p className="mb-3 text-sm text-neutral-500">พนักงานเห็นคิวทั้งหมด รวมคิวที่เพิ่งจองจากหน้าเว็บ</p>
          <div className="mb-3 flex gap-2">
            {STAFF.map((s) => (
              <button key={s.id} onClick={() => setCalStaff(s.id)} className="flex-1 rounded-full border px-3 py-2 text-sm"
                style={calStaff === s.id ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>{s.emoji} {s.name}</button>
            ))}
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            {DAYS.map((d) => {
              const l = dayLabel(d);
              return (
                <button key={iso(d)} onClick={() => setCalDate(iso(d))} className="flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 text-sm"
                  style={calDate === iso(d) ? { background: ACCENT, borderColor: ACCENT, color: "#fff" } : undefined}>
                  <span className="text-xs opacity-80">{l.dow}</span><span className="text-lg font-semibold">{l.num}</span>
                </button>
              );
            })}
          </div>
          <DayView bookings={bookings.filter((b) => b.staffId === calStaff && b.date === calDate)} />
        </section>
      )}

      <section className="mx-5 mt-12 rounded-2xl border bg-neutral-50 p-5 text-sm">
        <h2 className="mb-3 font-semibold">How it&apos;s built</h2>
        <ul className="grid gap-1.5 text-neutral-700">
          <li><b>Next.js + TypeScript</b> — server-rendered booking pages and typed API routes for availability.</li>
          <li><b>PostgreSQL</b> — services, staff, working hours and bookings; an exclusion constraint prevents double-booking a slot.</li>
          <li><b>Supabase Auth</b> — staff sign in to manage their own calendar; customers book as guests or with a magic link.</li>
          <li><b>Resend</b> — sends the confirmation and 24-hour reminder emails shown in the preview above.</li>
          <li><b>Tailwind CSS</b> — mobile-first styling with a per-brand theme.</li>
          <li><b>Deposit payment</b> — this demo mocks the card step; production would use a payment provider with webhooks to confirm.</li>
        </ul>
      </section>
    </main>
  );
}

function DayView({ bookings }: { bookings: Booking[] }) {
  const rows = Array.from({ length: (CLOSE - OPEN) / 60 }, (_, i) => OPEN + i * 60);
  const sorted = [...bookings].sort((a, b) => a.start - b.start);
  return (
    <div className="relative rounded-2xl border" style={{ height: rows.length * 56 }}>
      {rows.map((t, i) => (
        <div key={t} className="absolute inset-x-0 border-t text-[11px] text-neutral-400" style={{ top: i * 56 }}>
          <span className="ml-2">{fmt(t)}</span>
        </div>
      ))}
      {sorted.map((b, i) => (
        <div key={i} className="absolute left-14 right-2 overflow-hidden rounded-lg px-3 py-1 text-xs text-white shadow"
          style={{ top: ((b.start - OPEN) / 60) * 56 + 2, height: (b.mins / 60) * 56 - 4, background: ACCENT }}>
          <b>{fmt(b.start)}–{fmt(b.start + b.mins)}</b> {b.client}
          <div className="opacity-90">{b.service}</div>
        </div>
      ))}
      {sorted.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">ไม่มีคิวในวันนี้</p>}
    </div>
  );
}

function Summary({ service, staff, date, start }: { service: Service; staff: Staff; date: string; start: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 text-sm">
      <div className="font-medium">{service.emoji} {service.name} · {baht(service.price)}</div>
      <div className="text-neutral-600">{staff.name} · {date} · {fmt(start)}–{fmt(start + service.mins)}</div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="px-2 py-2 text-sm text-neutral-600 underline">← ย้อนกลับ</button>;
}

function Next({ onClick, disabled, label = "ถัดไป" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <button onClick={onClick} disabled={disabled} className="rounded-full px-6 py-3 font-medium text-white disabled:opacity-40" style={{ background: ACCENT }}>{label}</button>;
}
