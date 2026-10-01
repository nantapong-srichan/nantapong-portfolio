"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import OtpVerify from "@/components/OtpVerify";
import PayeeSettings from "@/components/qr/PayeeSettings";
import QrPayPanel from "@/components/qr/QrPayPanel";
import SandboxSimulate from "@/components/qr/SandboxSimulate";
import UnmatchedPayments from "@/components/qr/UnmatchedPayments";
import { DAYS, YEARLY_DISCOUNT, priceFor, type Billing, type Plan, type PlanId } from "./data";

const ACCENT = "#dc2626";
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const API = "/api/gym-membership";
const SCOPE = "gym-membership";
const ADMIN_HEADERS = { "x-demo-role": "admin" };
const MEMBER_KEY = "gym-membership:member-token";
const img = (name: string) => `/images/gym-membership/${name}.jpg`;

interface ClassItem {
  id: string;
  day: (typeof DAYS)[number];
  time: string;
  name: string;
  coach: string;
  image: string;
  capacity: number;
  booked: number;
  minPlan: PlanId;
  mine: boolean;
}
interface Subscription {
  planId: PlanId;
  interval: Billing;
  status: "active" | "canceled";
  nextBillingDate: string;
}
interface Payment {
  id: number;
  kind: string;
  planId: PlanId;
  amount: number;
  status: string;
  createdAt: string;
}
interface Pending {
  id: number;
  kind: "subscribe" | "resume" | "upgrade";
  planId: PlanId;
  interval: Billing;
  amount: number;
  payAmount: number;
  intentId: string;
  intentStatus: string;
  expiresAt: number;
}
interface Me {
  member: { id: string; name: string; phone: string | null } | null;
  subscription: Subscription | null;
  pending: Pending | null;
  bookings: string[];
  payments: Payment[];
}
const EMPTY_ME: Me = { member: null, subscription: null, pending: null, bookings: [], payments: [] };

class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// Server-issued credential from the first subscribe; there is no member until then.
const storedToken = () => localStorage.getItem(MEMBER_KEY);

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { ...(storedToken() ? { "x-member-token": storedToken() as string } : {}), "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new ApiFailure(res.status, data.error, data.message ?? "เกิดข้อผิดพลาด");
  return data as T;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const rankOf = (plans: Plan[], id: PlanId) => plans.find((p) => p.id === id)?.rank ?? 0;
const nameOf = (plans: Plan[], id: PlanId) => plans.find((p) => p.id === id)?.name ?? id;

const PAYMENT_LABEL: Record<string, string> = { subscribe: "สมัครสมาชิก", resume: "กลับมาใช้สมาชิก", upgrade: "ส่วนต่างอัปเกรด" };
const STATUS_LABEL: Record<string, string> = { succeeded: "ชำระแล้ว", pending: "รอชำระเงิน", cancelled: "ยกเลิก (คืนเงิน)" };

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IconCheck = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg {...svgProps} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const IconLock = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg {...svgProps} className={className}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
);
const IconUsers = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...svgProps} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.2a6.5 6.5 0 013.5 5.8" /></svg>
);
const IconCalendar = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...svgProps} className={className}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
const IconMedal = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...svgProps} className={className}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5" /></svg>
);
const IconClock = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg {...svgProps} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);

async function fetchAll() {
  const [p, c, me] = await Promise.all([
    api<{ plans: Plan[] }>("/plans"),
    api<{ classes: ClassItem[] }>("/classes"),
    api<Me>("/me"),
  ]);
  return { plans: p.plans, classes: c.classes, me };
}

export default function GymApp() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [me, setMe] = useState<Me>(EMPTY_ME);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<ClassItem | null>(null);
  const [payFor, setPayFor] = useState<Pending | null>(null);
  const [day, setDay] = useState<(typeof DAYS)[number]>("จ.");
  const [view, setView] = useState<"site" | "portal" | "admin">("site");
  const [toast, setToast] = useState("");

  const apply = (d: { plans: Plan[]; classes: ClassItem[]; me: Me }) => {
    setPlans(d.plans);
    setClasses(d.classes);
    setMe(d.me);
  };

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const refresh = useCallback(() => fetchAll().then(apply), []);

  useEffect(() => {
    fetchAll()
      .then((d) => {
        apply(d);
        setLoaded(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Run a mutation, then reload server state; surface the server's rejection message as-is.
  const act = async (fn: () => Promise<unknown>, okMessage?: string): Promise<boolean> => {
    try {
      await fn();
      await refresh();
      if (okMessage) notify(okMessage);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      await refresh().catch(() => undefined);
      return false;
    }
  };

  const sub = me.subscription;
  const active = sub?.status === "active";
  const myRank = active && sub ? rankOf(plans, sub.planId) : 0;
  const canAccess = (c: ClassItem) => myRank >= rankOf(plans, c.minPlan);

  const book = async (c: ClassItem) => {
    if (!active) return document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
    try {
      await api(`/classes/${c.id}/book`, { method: "POST" });
      await refresh();
      notify(`จอง ${c.name} แล้ว · ${c.day} ${c.time}`);
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "plan_required") setUpgradeFor(c);
      else notify(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      await refresh().catch(() => undefined);
    }
  };
  const cancelBooking = (c: ClassItem) =>
    act(() => api(`/classes/${c.id}/book`, { method: "DELETE" }), `ยกเลิก ${c.name} แล้ว`);

  // Subscribe / upgrade / resume only open a pending charge with a QR; the plan changes when the payment is detected.
  const beginCharge = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      const d = await fetchAll();
      apply(d);
      setUpgradeFor(null);
      setPayFor(d.me.pending);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      await refresh().catch(() => undefined);
      return false;
    }
  };

  const subscribe = async (plan: Plan, name: string, phone: string, otpToken: string, b: Billing) => {
    const ok = await beginCharge(async () => {
      const r = await api<{ memberToken: string }>("/subscribe", { method: "POST", body: { name, phone, otpToken, planId: plan.id, interval: b } });
      localStorage.setItem(MEMBER_KEY, r.memberToken);
    });
    if (ok) setCheckout(null);
    return ok;
  };

  const upgradeTo = (planId: PlanId) => beginCharge(() => api("/upgrade", { method: "POST", body: { planId } }));

  const onPaid = async () => {
    const kind = payFor?.kind;
    await refresh().catch(() => undefined);
    setPayFor(null);
    notify(kind === "upgrade" ? "อัปเกรดแพ็กเกจแล้ว" : kind === "resume" ? "กลับมาใช้สมาชิกอีกครั้งแล้ว" : "ยินดีต้อนรับสู่ IronPulse!");
    if (kind === "subscribe") {
      setView("portal");
      window.scrollTo({ top: 0 });
    }
  };

  const renewQr = () => act(() => api("/renew", { method: "POST" }));

  const cancelPlan = () => act(() => api("/cancel", { method: "POST" }), "ยกเลิกสมาชิกแล้ว จะไม่ต่ออายุอัตโนมัติ");
  const resumePlan = () => beginCharge(() => api("/resume", { method: "POST" }));

  const dayClasses = classes.filter((c) => c.day === day);
  const myBooked = classes.filter((c) => c.mine);
  const stats: [string, string, React.ReactNode][] = [
    ["2,400+", "สมาชิก", <IconUsers key="u" />],
    ["40+", "คลาส/สัปดาห์", <IconCalendar key="c" />],
    ["6", "โค้ชมืออาชีพ", <IconMedal key="m" />],
  ];
  const trainers = [
    { name: "โค้ชตาล", role: "HIIT / บูตแคมป์ / สร้างความแข็งแรง", image: "trainer-tan" },
    { name: "โค้ชพลอย", role: "คอร์ / ซุมบ้า", image: "trainer-ploy" },
    { name: "โค้ชบีม", role: "มวย / Elite สมรรถภาพสูง", image: "trainer-beam" },
  ];

  return (
    <div className="bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 sm:top-[calc(var(--demo-shell-h)+1px)] border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-lg font-black tracking-tight">
            IRON<span style={{ color: ACCENT }}>PULSE</span>
          </div>
          <nav aria-label="เมนูหลัก" className="flex items-center gap-0.5 text-sm sm:gap-1">
            <button onClick={() => setView("site")} className={`min-h-11 rounded-full px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${view === "site" ? "bg-white/10" : "text-neutral-400"}`}>หน้าแรก</button>
            <button
              onClick={() => (me.subscription ? setView("portal") : document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" }))}
              className={`min-h-11 rounded-full px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${view === "portal" ? "bg-white/10" : "text-neutral-400"}`}
            >
              พอร์ทัลสมาชิก
            </button>
            <button onClick={() => setView("admin")} className={`min-h-11 rounded-full px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${view === "admin" ? "bg-white/10" : "text-neutral-400"}`}>ผู้ดูแล</button>
          </nav>
        </div>
      </header>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[60] w-max max-w-[90vw] -translate-x-1/2 rounded-2xl px-5 py-2.5 text-center text-sm font-semibold text-white shadow-lg" style={{ background: ACCENT }}>
          {toast}
        </div>
      )}

      {loadError && <p role="alert" className="px-4 py-10 text-center text-red-400">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>}
      {!loaded && !loadError && <p className="px-4 py-24 text-center text-neutral-400">กำลังโหลดข้อมูล…</p>}

      {loaded && view === "admin" ? (
        <AdminPanel plans={plans} />
      ) : loaded && view === "portal" && me.member && sub ? (
        <Portal
          name={me.member.name}
          sub={sub}
          plans={plans}
          bookings={myBooked}
          payments={me.payments}
          pending={me.pending}
          onPay={() => setPayFor(me.pending)}
          onCancelBooking={cancelBooking}
          onUpgrade={upgradeTo}
          onCancel={cancelPlan}
          onReactivate={resumePlan}
        />
      ) : loaded ? (
        <>
          <section className="relative overflow-hidden px-4 py-16 text-center sm:py-28">
            <Image src={img("hero")} alt="โซนเวทเทรนนิงของ IronPulse" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-neutral-950/75" />
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 0%, ${ACCENT}, transparent 60%)` }} />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-red-300">สุขุมวิท · กรุงเทพฯ</p>
              <h1 className="mt-3 text-balance text-4xl font-black leading-[1.25] sm:text-6xl">สร้างร่างกายที่แข็งแกร่งกว่าเดิม</h1>
              <p className="mt-4 text-pretty leading-relaxed text-neutral-300">ซ้อมหนักขึ้น จองฉลาดขึ้น คลาสกว่า 40 คลาสต่อสัปดาห์ โค้ชมืออาชีพ และไม่มีสัญญาผูกมัด</p>
              <a href="#plans" className="mt-8 inline-flex min-h-12 items-center rounded-full px-7 py-3 font-bold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>เริ่มสมัครสมาชิก</a>
              <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
                {stats.map(([a, b, icon]) => (
                  <div key={b} className="flex flex-col items-center rounded-xl bg-black/40 py-3 backdrop-blur">
                    <span style={{ color: ACCENT }}>{icon}</span>
                    <div className="text-xl font-black">{a}</div>
                    <div className="text-neutral-300">{b}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-5xl gap-3 px-4 pt-12 sm:grid-cols-3">
            {[["weights", "โซนเวทและฟรีเวท"], ["cardio", "คาร์ดิโอและสปินไบค์"], ["class", "สตูดิโอคลาสกลุ่ม"]].map(([name, label]) => (
              <figure key={name} className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image src={img(name)} alt={label} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 text-sm font-semibold">{label}</figcaption>
              </figure>
            ))}
          </section>

          <section id="plans" className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-3xl font-black">แพ็กเกจสมาชิก</h2>
            <div className="mx-auto mt-6 flex w-fit rounded-full bg-white/10 p-1 text-sm" role="group" aria-label="รอบการเรียกเก็บเงิน">
              {(["monthly", "yearly"] as Billing[]).map((b) => (
                <button key={b} onClick={() => setBilling(b)} aria-pressed={billing === b} className={`min-h-11 rounded-full px-5 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${billing === b ? "text-white" : "text-neutral-400"}`} style={billing === b ? { background: ACCENT } : undefined}>
                  {b === "monthly" ? "รายเดือน" : "รายปี"}{b === "yearly" && ` ประหยัด ${YEARLY_DISCOUNT * 100}%`}
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {plans.map((p) => {
                const current = active && sub?.planId === p.id;
                const lower = active && p.rank < myRank;
                const featured = p.id === "plus";
                return (
                  <div key={p.id} className={`relative flex flex-col rounded-2xl border p-6 ${featured ? "border-red-500 bg-white/10" : "border-white/10 bg-white/5"}`}>
                    {featured && <span className="absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: ACCENT }}>ยอดนิยม</span>}
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <p className="text-sm leading-relaxed text-neutral-400">{p.tagline}</p>
                    <p className="mt-4 text-4xl font-black">{baht(priceFor(p, billing))}<span className="text-sm font-normal text-neutral-400"> /{billing === "monthly" ? "เดือน" : "ปี"}</span></p>
                    {billing === "yearly" && <p className="text-xs text-green-400">ประหยัด {baht(p.monthly * 12 - priceFor(p, "yearly"))} ต่อปี</p>}
                    <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed">
                      {p.perks.map((x) => (
                        <li key={x} className="flex items-start gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />{x}</li>
                      ))}
                    </ul>
                    <button
                      disabled={current || lower}
                      onClick={() => (active ? void upgradeTo(p.id) : setCheckout(p))}
                      className="mt-6 min-h-11 w-full rounded-full py-2.5 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      style={{ background: ACCENT }}
                    >
                      {current ? "แพ็กเกจปัจจุบัน" : lower ? "รวมอยู่ในแพ็กเกจของคุณ" : active ? `เปลี่ยนเป็น ${p.name}` : `สมัคร ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="classes" className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-3xl font-black">ตารางคลาสรายสัปดาห์</h2>
            <p className="mt-2 text-center text-sm text-neutral-400">
              {active && me.member && sub ? `เข้าสู่ระบบในชื่อ ${me.member.name} · แพ็กเกจ ${nameOf(plans, sub.planId)}` : "สมัครสมาชิกเพื่อจองคลาส"}
            </p>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {DAYS.map((d) => (
                <button key={d} onClick={() => setDay(d)} aria-pressed={day === d} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${day === d ? "text-white" : "bg-white/10 text-neutral-400"}`} style={day === d ? { background: ACCENT } : undefined}>{d}</button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {dayClasses.length === 0 && <p className="text-neutral-400">วันนี้ไม่มีคลาส พักผ่อนให้เต็มที่</p>}
              {dayClasses.map((c) => {
                const left = c.capacity - c.booked;
                const locked = active && !canAccess(c);
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:gap-4">
                    <Image src={img(c.image)} alt={c.name} width={160} height={160} className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold leading-snug">{c.name} {c.minPlan !== "basic" && <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">{nameOf(plans, c.minPlan)}+</span>}</div>
                      <div className="flex items-center gap-1 text-sm text-neutral-400"><IconClock className="h-3.5 w-3.5" />{c.time} · {c.coach}</div>
                      <div className={`text-xs ${left <= 2 ? "font-semibold text-red-400" : "text-neutral-400"}`}>{left <= 0 ? "เต็มแล้ว" : `เหลือ ${left} / ${c.capacity} ที่นั่ง`}</div>
                    </div>
                    {c.mine ? (
                      <button onClick={() => cancelBooking(c)} className="min-h-11 shrink-0 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">ยกเลิก</button>
                    ) : (
                      <button disabled={left <= 0 && !locked} onClick={() => book(c)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: locked ? "#52525b" : ACCENT }}>
                        {locked ? <><IconLock className="h-3.5 w-3.5" />อัปเกรด</> : left <= 0 ? "เต็ม" : "จอง"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-12">
            <h2 className="text-center text-3xl font-black">ทีมโค้ช</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {trainers.map((t) => (
                <div key={t.name} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <Image src={img(t.image)} alt={t.name} width={600} height={450} className="aspect-[4/3] w-full object-cover" />
                  <div className="p-4">
                    <div className="font-bold">{t.name}</div>
                    <div className="text-sm text-neutral-400">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="border-t border-white/10 bg-neutral-900 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-black">สร้างอย่างไร</h2>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
            <li><b className="text-white">ของจริงในเดโม:</b> แพ็กเกจ สมาชิก คลาส และการจองเก็บในฐานข้อมูลจริง เซิร์ฟเวอร์ตรวจที่นั่งเต็มและสิทธิ์ตามแพ็กเกจ</li>
            <li><b className="text-white">การชำระเงิน:</b> สร้าง QR PromptPay ยอดไม่ซ้ำ เมื่อเงินเข้าสมาชิกจึงเริ่มใช้งานได้ หรือแนบสลิปให้ตรวจสอบแทน</li>
            <li><b className="text-white">ระบบจริงจะใช้:</b> Supabase สำหรับข้อมูลและระบบเข้าสู่ระบบ และ webhook จากธนาคารเพื่อตรวจจับเงินเข้า</li>
          </ul>
          <details className="group mt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden" style={{ color: ACCENT }}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
          <ul className="mt-3 grid gap-3 text-sm leading-relaxed text-neutral-300 sm:grid-cols-2 [&>li]:rounded-xl [&>li]:border [&>li]:border-white/10 [&>li]:bg-white/5 [&>li]:p-4">
            <li><b className="text-white">Next.js + TypeScript</b> — หน้าเว็บและ Route Handlers อยู่ในโปรเจกต์เดียว ใช้ชนิดข้อมูล (type) ชุดเดียวกันทั้งหน้าจอและ API</li>
            <li><b className="text-white">SQLite ผ่าน Route Handlers (ในเดโมนี้)</b> — แพ็กเกจ สมาชิก การสมัคร คลาส และการจองเก็บในฐานข้อมูลจริง ตรวจที่นั่งเต็ม (409) และสิทธิ์ตามแพ็กเกจ (403) ที่ฝั่งเซิร์ฟเวอร์ในทรานแซกชันเดียว ข้อมูลอยู่ครบหลังรีเฟรชหน้า</li>
            <li><b className="text-white">Supabase (งานจริง)</b> — PostgreSQL และ Auth พร้อม row-level security (จำกัดสิทธิ์ระดับแถวข้อมูล) ให้สมาชิกแก้ไขได้เฉพาะข้อมูลของตัวเอง</li>
            <li><b className="text-white">เก็บค่าสมาชิกรายรอบ (งานจริง)</b> — ออก QR PromptPay (ลิงก์ชำระเงิน) ใหม่ทุกรอบบิลให้ลูกค้าสแกนจ่าย ระบบตรวจจับการโอนอัตโนมัติผ่าน webhook ของธนาคาร หรือยืนยันด้วยสลิป ส่วนการตัดบัตรอัตโนมัติรายเดือนอยู่นอกขอบเขตของเดโมนี้</li>
            <li><b className="text-white">QR PromptPay ตรวจจับเงินเข้าอัตโนมัติ (webhook + HMAC)</b> — การสมัคร กลับมาใช้สมาชิก และส่วนต่างอัปเกรดสร้างรายการรอชำระพร้อม QR ที่มียอดเศษสตางค์ไม่ซ้ำ ยอดคำนวณจากราคาในฐานข้อมูลฝั่งเซิร์ฟเวอร์ สมาชิกเริ่มใช้งานได้ หรือเปลี่ยนแพ็กเกจได้เฉพาะตอนที่ webhook ที่เซ็นลายเซ็นแล้วจับคู่ยอดสำเร็จ (ครั้งเดียวต่อรายการ) ยอดไม่ตรงเข้ารายการที่จับคู่ไม่ได้ให้ผู้ดูแลผูกเอง หน้านี้อัปเดตเองเมื่อเงินเข้า</li>
            <li><b className="text-white">Thunder API ตรวจสลิป (ทางสำรอง)</b> — ถ้าระบบยังไม่พบการโอน แนบสลิปได้ เซิร์ฟเวอร์ตรวจกับ Thunder สลิปแต่ละใบใช้ได้ครั้งเดียว (409) ผลลัพธ์เดียวกับ webhook คือผ่านขั้นตอนยืนยันการชำระเงินเดียวกัน</li>
            <li><b className="text-white">ThaiBulkSMS OTP</b> — ต้องยืนยันเบอร์โทรด้วย OTP ก่อนสมัคร เซิร์ฟเวอร์ตรวจโทเค็นยืนยันซ้ำและเก็บเบอร์ที่ยืนยันแล้วไว้กับสมาชิกใน SQLite</li>
            <li><b className="text-white">Tailwind CSS</b> — สไตล์ที่สอดคล้องกับแบรนด์และออกแบบมือถือเป็นหลัก</li>
          </ul>
          </details>
          <p className="mt-4 text-xs leading-relaxed text-amber-400">หมายเหตุ: เดโมนี้ยังไม่ได้เชื่อมต่อฟีดธนาคารจริง ปุ่ม sandbox ในแท็บผู้ดูแลจำลองการแจ้งเงินเข้า ใช้งานจริงต้องรับแจ้งเงินเข้าจากธนาคารหรือผู้ให้บริการชำระเงิน แทนปุ่มนี้ และใช้ SQLite เฉพาะในเดโม</p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">ถ้ายังไม่ได้ตั้งค่า API key ของ Thunder / ThaiBulkSMS เดโมจะเป็นโหมดทดสอบ (รับสลิปรูปใดก็ได้ และแสดงรหัส OTP บนหน้าจอ) สมาชิกในเดโมระบุตัวตนด้วยรหัสที่เก็บไว้ในเบราว์เซอร์นี้ ไม่มีระบบล็อกอิน</p>
        </div>
      </section>

      {checkout && <Checkout plan={checkout} billing={billing} onClose={() => setCheckout(null)} onPay={(n, ph, tok) => subscribe(checkout, n, ph, tok, billing)} />}
      {payFor && me.pending && <PayModal pending={me.pending} plans={plans} onPaid={onPaid} onRenew={renewQr} onClosed={() => void refresh().catch(() => undefined)} onClose={() => setPayFor(null)} />}
      {upgradeFor && (
        <Modal onClose={() => setUpgradeFor(null)}>
          <h3 className="flex items-start gap-2 text-xl font-black"><IconLock className="mt-1 h-5 w-5 shrink-0" />{upgradeFor.name} เป็นคลาสของแพ็กเกจ {nameOf(plans, upgradeFor.minPlan)}</h3>
          <p className="mt-2 text-sm text-neutral-400">แพ็กเกจ {sub ? nameOf(plans, sub.planId) : ""} ของคุณไม่รวมคลาสนี้ อัปเกรดเป็น {nameOf(plans, upgradeFor.minPlan)} เพื่อปลดล็อกและจองที่นั่ง</p>
          <button onClick={() => upgradeTo(upgradeFor.minPlan)} className="mt-5 w-full rounded-full py-3 font-bold text-white min-h-11 hover:brightness-110 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>
            อัปเกรดเป็น {nameOf(plans, upgradeFor.minPlan)} · {baht(priceFor(plans.find((p) => p.id === upgradeFor.minPlan) as Plan, sub?.interval ?? "monthly"))}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-6 text-neutral-100" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose} className="mt-3 min-h-11 w-full rounded-full text-sm text-neutral-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">ปิด</button>
      </div>
    </div>
  );
}

function Checkout({ plan, billing, onClose, onPay }: { plan: Plan; billing: Billing; onClose: () => void; onPay: (name: string, phone: string, otpToken: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 1 && !!otpToken;
  const field = "mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-base placeholder:text-neutral-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 sm:text-sm";

  const next = async () => {
    if (!otpToken) return;
    setBusy(true);
    const ok = await onPay(name.trim(), phone, otpToken);
    if (!ok) setBusy(false);
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-black">สมัครสมาชิก</h3>
      <p className="text-sm text-neutral-400">{plan.name} · {billing === "monthly" ? "รายเดือน" : "รายปี"} · <b className="text-white">{baht(priceFor(plan, billing))}</b></p>
      <label className="mt-4 block text-sm">ชื่อ-นามสกุล
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="สมชาย ใจดี" />
      </label>
      <label className="mt-3 block text-sm">เบอร์โทรศัพท์
        <input className={field} value={phone} onChange={(e) => { setPhone(e.target.value); setOtpToken(null); }} inputMode="tel" placeholder="0812345678" />
      </label>
      <div className="mt-3 rounded-xl bg-white p-2 text-neutral-900">
        <OtpVerify key={phone} phone={phone} accent={ACCENT} onVerified={setOtpToken} />
      </div>
      <button disabled={!valid || busy} onClick={next} className="mt-5 w-full rounded-full py-3 font-bold text-white disabled:opacity-50 min-h-11 hover:brightness-110 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>
        {busy ? "กำลังดำเนินการ…" : "ไปขั้นตอนชำระเงิน"}
      </button>
    </Modal>
  );
}

function PayModal({ pending, plans, onPaid, onRenew, onClosed, onClose }: {
  pending: Pending; plans: Plan[]; onPaid: () => void; onRenew: () => void; onClosed: () => void; onClose: () => void;
}) {
  const live = pending.intentStatus === "pending";
  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-black">ชำระเงินด้วย QR PromptPay</h3>
      <p className="text-sm text-neutral-400">{PAYMENT_LABEL[pending.kind]} · {nameOf(plans, pending.planId)} · ราคา <b className="text-white">{baht(pending.amount)}</b></p>
      {live ? (
        <div className="mt-3 rounded-xl bg-white p-2 text-neutral-900">
          <QrPayPanel key={pending.intentId} scope={SCOPE} intentId={pending.intentId} accent={ACCENT} className="space-y-3 p-2" onPaid={onPaid} onClosed={onClosed} />
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-white/5 p-4 text-sm">
          <p className="text-neutral-300">QR ของรายการนี้หมดเวลาแล้ว หากโอนไปแล้วระบบจะยังจับคู่ให้ได้ ถ้ายังไม่ได้โอนให้ขอ QR ใหม่</p>
          <button onClick={onRenew} className="mt-3 w-full rounded-full py-2.5 font-bold text-white min-h-11 hover:brightness-110 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>ขอ QR ใหม่</button>
        </div>
      )}
    </Modal>
  );
}

interface OpenCharge { id: number; kind: string; planId: string; memberName: string; intentId: string; intentStatus: string; payAmount: number; reference: string }

// Owner tools; the demo's stand-in for an admin session is the x-demo-role header.
function AdminPanel({ plans }: { plans: Plan[] }) {
  const [charges, setCharges] = useState<OpenCharge[]>([]);
  const [denied, setDenied] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/charges`, { headers: ADMIN_HEADERS, cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCharges(data.charges);
      else setDenied(data.error ?? "ไม่มีสิทธิ์");
    } catch { /* retry on next tick */ }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 3000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const label = (c: OpenCharge) => `${c.memberName} · ${PAYMENT_LABEL[c.kind] ?? c.kind} ${nameOf(plans, c.planId as PlanId)}`;
  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-neutral-900">
      <h1 className="text-3xl font-black text-neutral-100">ผู้ดูแล</h1>
      <p className="text-sm leading-relaxed text-neutral-400">เดโมใช้ส่วนหัวคำขอ x-demo-role: admin แทนระบบล็อกอินผู้ดูแล</p>
      {denied && <p role="alert" className="text-sm text-red-400">{denied}</p>}
      <PayeeSettings scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onSaved={load} />
      <SandboxSimulate
        scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onDone={load}
        targets={charges.filter((c) => c.intentStatus === "pending").map((c) => ({ key: c.intentId, label: label(c), amount: c.payAmount, reference: c.reference }))}
      />
      <UnmatchedPayments
        scope={SCOPE} headers={ADMIN_HEADERS} accent={ACCENT} onAssigned={load}
        targets={charges.map((c) => ({ intentId: c.intentId, label: `${label(c)} · ${baht(c.payAmount)}${c.intentStatus === "expired" ? " (QR หมดเวลา)" : ""}` }))}
      />
    </section>
  );
}

function Portal({ name, sub, plans, bookings, payments, pending, onPay, onCancelBooking, onUpgrade, onCancel, onReactivate }: {
  name: string;
  sub: Subscription;
  plans: Plan[];
  bookings: ClassItem[];
  payments: Payment[];
  pending: Pending | null;
  onPay: () => void;
  onCancelBooking: (c: ClassItem) => void;
  onUpgrade: (id: PlanId) => void;
  onCancel: () => void;
  onReactivate: () => void;
}) {
  const plan = plans.find((p) => p.id === sub.planId) as Plan;
  const canceled = sub.status === "canceled";
  const higher = plans.filter((p) => p.rank > plan.rank);
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">สวัสดี คุณ{name}</h1>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-400">แพ็กเกจปัจจุบัน</p>
            <p className="text-3xl font-black">{plan.name}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${canceled ? "bg-amber-400/20 text-amber-300" : "bg-green-500/20 text-green-400"}`}>
            {canceled ? "ยกเลิกแล้ว" : "ใช้งานอยู่"}
          </span>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-400">การเรียกเก็บเงิน</dt><dd className="font-semibold">{sub.interval === "monthly" ? "รายเดือน" : "รายปี"} · {baht(priceFor(plan, sub.interval))}</dd></div>
          <div><dt className="text-neutral-400">{canceled ? "ไม่ต่ออายุ ครบกำหนดเดิม" : "วันเรียกเก็บเงินครั้งถัดไป"}</dt><dd className="font-semibold">{fmtDate(sub.nextBillingDate)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {!canceled && higher.map((p) => (
            <button key={p.id} onClick={() => onUpgrade(p.id)} className="min-h-11 rounded-full px-4 py-2 text-sm font-bold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>อัปเกรดเป็น {p.name}</button>
          ))}
          {canceled ? (
            <button onClick={onReactivate} className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">กลับมาใช้สมาชิก</button>
          ) : (
            <button onClick={onCancel} className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">ยกเลิกสมาชิก</button>
          )}
        </div>
      </div>

      {pending && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-relaxed sm:flex-row sm:items-center sm:justify-between">
          <span>รอชำระเงิน {PAYMENT_LABEL[pending.kind]} {baht(pending.amount)} · สถานะจะเปลี่ยนเองเมื่อระบบตรวจพบการโอน</span>
          <button onClick={onPay} className="min-h-11 shrink-0 rounded-full px-4 py-2 font-bold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: ACCENT }}>ชำระเงิน</button>
        </div>
      )}

      <h2 className="mt-8 text-xl font-bold">การจองของฉัน</h2>
      <div className="mt-3 space-y-2">
        {bookings.length === 0 && <p className="text-sm text-neutral-400">ยังไม่ได้จองคลาส เลือกจากตารางคลาสในแท็บหน้าแรกได้เลย</p>}
        {bookings.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 text-sm">
            <Image src={img(c.image)} alt="" width={96} height={96} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 leading-snug"><b>{c.name}</b> · {c.day} {c.time}</span>
            <button onClick={() => onCancelBooking(c)} className="min-h-11 rounded-full px-3 text-red-400 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">ยกเลิก</button>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">ประวัติการชำระเงิน</h2>
      <div className="mt-3 space-y-2">
        {payments.length === 0 && <p className="text-sm text-neutral-400">ยังไม่มีรายการชำระเงิน</p>}
        {payments.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-white/5 p-3 text-sm">
            <span>{PAYMENT_LABEL[p.kind] ?? p.kind} · {nameOf(plans, p.planId)} · {fmtDate(p.createdAt)}</span>
            <span className="flex items-center gap-2 font-semibold">{baht(p.amount)}<span className={`flex items-center gap-1 text-xs ${p.status === "succeeded" ? "text-green-400" : "text-amber-300"}`}>{p.status === "succeeded" && <IconCheck className="h-3 w-3" />}{STATUS_LABEL[p.status] ?? p.status}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}
