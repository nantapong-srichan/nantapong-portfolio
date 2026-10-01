"use client";

import { useState } from "react";
import {
  CLASSES, DAYS, PLANS, YEARLY_DISCOUNT, priceFor,
  type Billing, type GymClass, type Plan, type PlanId,
} from "./data";

const ACCENT = "#dc2626";
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

interface Membership {
  planId: PlanId;
  billing: Billing;
  nextBilling: Date;
  cancelled: boolean;
  name: string;
}

function addPeriod(billing: Billing): Date {
  const d = new Date();
  if (billing === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const planById = (id: PlanId) => PLANS.find((p) => p.id === id) as Plan;

export default function GymApp() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<GymClass | null>(null);
  const [bookings, setBookings] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<(typeof DAYS)[number]>("Mon");
  const [view, setView] = useState<"site" | "portal">("site");
  const [toast, setToast] = useState("");

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const rank = membership && !membership.cancelled ? planById(membership.planId).rank : 0;
  const canAccess = (c: GymClass) => rank >= planById(c.minPlan).rank;
  const seats = (c: GymClass) => c.capacity - c.booked - (bookings.has(c.id) ? 1 : 0);

  const book = (c: GymClass) => {
    if (!membership || membership.cancelled) return document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
    if (!canAccess(c)) return setUpgradeFor(c);
    setBookings((s) => new Set(s).add(c.id));
    notify(`Booked ${c.name} · ${c.day} ${c.time}`);
  };
  const cancelBooking = (c: GymClass) => {
    setBookings((s) => {
      const n = new Set(s);
      n.delete(c.id);
      return n;
    });
    notify(`Cancelled ${c.name}`);
  };

  const subscribe = (plan: Plan, name: string, b: Billing) => {
    setMembership({ planId: plan.id, billing: b, nextBilling: addPeriod(b), cancelled: false, name });
    setCheckout(null);
    setUpgradeFor(null);
    setView("portal");
    notify(`Welcome to IronPulse, ${name}!`);
    window.scrollTo({ top: 0 });
  };

  const upgradeTo = (planId: PlanId) => {
    if (!membership) return;
    setMembership({ ...membership, planId, cancelled: false });
    setUpgradeFor(null);
    notify(`Plan changed to ${planById(planId).name}`);
  };

  const cancelPlan = () => {
    if (!membership) return;
    setMembership({ ...membership, cancelled: true });
    setBookings(new Set());
    notify("Membership will not renew");
  };

  const dayClasses = CLASSES.filter((c) => c.day === day);
  const myBooked = CLASSES.filter((c) => bookings.has(c.id));

  return (
    <div className="bg-neutral-950 text-neutral-100">
      <header className="sticky top-9 z-40 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-lg font-black tracking-tight">
            IRON<span style={{ color: ACCENT }}>PULSE</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setView("site")} className={`rounded-full px-3 py-1.5 ${view === "site" ? "bg-white/10" : "text-neutral-400"}`}>Home</button>
            <button
              onClick={() => (membership ? setView("portal") : document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" }))}
              className={`rounded-full px-3 py-1.5 ${view === "portal" ? "bg-white/10" : "text-neutral-400"}`}
            >
              Member portal
            </button>
          </nav>
        </div>
      </header>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg" style={{ background: ACCENT }}>
          {toast}
        </div>
      )}

      {view === "portal" && membership ? (
        <Portal
          membership={membership}
          bookings={myBooked}
          onCancelBooking={cancelBooking}
          onUpgrade={upgradeTo}
          onCancel={cancelPlan}
          onReactivate={() => setMembership({ ...membership, cancelled: false })}
        />
      ) : (
        <>
          <section className="relative overflow-hidden px-4 py-16 text-center sm:py-24">
            <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 50% 0%, ${ACCENT}, transparent 60%)` }} />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>Sukhumvit · Bangkok</p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">สร้างร่างกายที่แข็งแกร่งกว่าเดิม</h1>
              <p className="mt-4 text-neutral-400">Train harder, book smarter. 40+ weekly classes, pro coaches and zero lock-in contracts.</p>
              <a href="#plans" className="mt-8 inline-block rounded-full px-7 py-3 font-bold text-white" style={{ background: ACCENT }}>เริ่มสมัครสมาชิก</a>
              <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
                {[["2,400+", "Members"], ["40+", "Classes / week"], ["6", "Pro coaches"]].map(([a, b]) => (
                  <div key={b} className="rounded-xl bg-white/5 py-3">
                    <div className="text-xl font-black">{a}</div>
                    <div className="text-neutral-400">{b}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="plans" className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-3xl font-black">Membership plans</h2>
            <div className="mx-auto mt-6 flex w-fit rounded-full bg-white/10 p-1 text-sm">
              {(["monthly", "yearly"] as Billing[]).map((b) => (
                <button key={b} onClick={() => setBilling(b)} className={`rounded-full px-5 py-2 font-semibold capitalize ${billing === b ? "text-white" : "text-neutral-400"}`} style={billing === b ? { background: ACCENT } : undefined}>
                  {b}{b === "yearly" && ` −${YEARLY_DISCOUNT * 100}%`}
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PLANS.map((p) => {
                const current = membership && !membership.cancelled && membership.planId === p.id;
                const featured = p.id === "plus";
                return (
                  <div key={p.id} className={`relative rounded-2xl border p-6 ${featured ? "border-red-500 bg-white/10" : "border-white/10 bg-white/5"}`}>
                    {featured && <span className="absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: ACCENT }}>Most popular</span>}
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <p className="text-sm text-neutral-400">{p.tagline}</p>
                    <p className="mt-4 text-4xl font-black">{baht(priceFor(p, billing))}<span className="text-sm font-normal text-neutral-400"> /{billing === "monthly" ? "mo" : "yr"}</span></p>
                    {billing === "yearly" && <p className="text-xs text-green-400">Save {baht(p.monthly * 12 - priceFor(p, "yearly"))} a year</p>}
                    <ul className="mt-4 space-y-2 text-sm">
                      {p.perks.map((x) => <li key={x}>✓ {x}</li>)}
                    </ul>
                    <button
                      disabled={!!current}
                      onClick={() => (membership && !membership.cancelled ? upgradeTo(p.id) : setCheckout(p))}
                      className="mt-6 w-full rounded-full py-2.5 font-bold text-white disabled:opacity-50"
                      style={{ background: ACCENT }}
                    >
                      {current ? "Current plan" : membership && !membership.cancelled ? `Switch to ${p.name}` : `Join ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="classes" className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="text-center text-3xl font-black">Weekly class schedule</h2>
            <p className="mt-2 text-center text-sm text-neutral-400">
              {membership && !membership.cancelled ? `Signed in as ${membership.name} · ${planById(membership.planId).name} plan` : "Subscribe to book classes"}
            </p>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {DAYS.map((d) => (
                <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${day === d ? "text-white" : "bg-white/10 text-neutral-400"}`} style={day === d ? { background: ACCENT } : undefined}>{d}</button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {dayClasses.length === 0 && <p className="text-neutral-400">No classes today — rest up.</p>}
              {dayClasses.map((c) => {
                const left = seats(c);
                const mine = bookings.has(c.id);
                const locked = !canAccess(c) && !!membership && !membership.cancelled;
                return (
                  <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-3xl">{c.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{c.name} {c.minPlan !== "basic" && <span className="ml-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">{planById(c.minPlan).name}+</span>}</div>
                      <div className="text-sm text-neutral-400">{c.time} · {c.coach}</div>
                      <div className={`text-xs ${left <= 2 ? "text-red-400" : "text-neutral-400"}`}>{left === 0 ? "Full" : `${left} / ${c.capacity} spots left`}</div>
                    </div>
                    {mine ? (
                      <button onClick={() => cancelBooking(c)} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Cancel</button>
                    ) : (
                      <button disabled={left === 0 && !locked} onClick={() => book(c)} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: locked ? "#52525b" : ACCENT }}>
                        {locked ? "🔒 Upgrade" : left === 0 ? "Full" : "Book"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="border-t border-white/10 bg-neutral-900 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-black">How it&apos;s built</h2>
          <ul className="mt-4 grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
            <li><b className="text-white">Next.js + TypeScript</b> — server-rendered marketing pages with typed, client-side portal and booking UI.</li>
            <li><b className="text-white">Stripe Subscriptions</b> — hosted checkout, recurring monthly/yearly billing, proration on upgrade, webhooks for cancellations.</li>
            <li><b className="text-white">Supabase Auth + RLS</b> — member login; row-level security so members only read and write their own bookings and plan.</li>
            <li><b className="text-white">Tailwind CSS</b> — brand-consistent, mobile-first styling. Entitlements here are checked by plan rank; in production they derive from the Stripe subscription state.</li>
          </ul>
          <p className="mt-4 text-xs text-neutral-500">This demo runs entirely in memory — no payments are processed.</p>
        </div>
      </section>

      {checkout && <Checkout plan={checkout} billing={billing} onClose={() => setCheckout(null)} onPay={(n) => subscribe(checkout, n, billing)} />}
      {upgradeFor && (
        <Modal onClose={() => setUpgradeFor(null)}>
          <h3 className="text-xl font-black">🔒 {upgradeFor.name} is a {planById(upgradeFor.minPlan).name} class</h3>
          <p className="mt-2 text-sm text-neutral-400">Your {membership ? planById(membership.planId).name : ""} plan doesn&apos;t include this class. Upgrade to {planById(upgradeFor.minPlan).name} to unlock it and book your spot.</p>
          <button onClick={() => upgradeTo(upgradeFor.minPlan)} className="mt-5 w-full rounded-full py-3 font-bold text-white" style={{ background: ACCENT }}>
            Upgrade to {planById(upgradeFor.minPlan).name} · {baht(priceFor(planById(upgradeFor.minPlan), membership?.billing ?? "monthly"))}
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-neutral-900 p-6 text-neutral-100" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-neutral-400">Close</button>
      </div>
    </div>
  );
}

function Checkout({ plan, billing, onClose, onPay }: { plan: Plan; billing: Billing; onClose: () => void; onPay: (name: string) => void }) {
  const [name, setName] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [paying, setPaying] = useState(false);
  const valid = name.trim().length > 1 && card.replace(/\s/g, "").length >= 16;
  const field = "mt-1 w-full rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm";

  const pay = () => {
    setPaying(true);
    setTimeout(() => onPay(name.trim()), 900);
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-black">Checkout</h3>
      <p className="text-sm text-neutral-400">{plan.name} · {billing} · <b className="text-white">{baht(priceFor(plan, billing))}</b></p>
      <label className="mt-4 block text-sm">Full name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="สมชาย ใจดี" />
      </label>
      <label className="mt-3 block text-sm">Card number (test)
        <input className={field} value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" />
      </label>
      <button disabled={!valid || paying} onClick={pay} className="mt-5 w-full rounded-full py-3 font-bold text-white disabled:opacity-50" style={{ background: ACCENT }}>
        {paying ? "Processing…" : `Pay ${baht(priceFor(plan, billing))}`}
      </button>
    </Modal>
  );
}

function Portal({ membership, bookings, onCancelBooking, onUpgrade, onCancel, onReactivate }: {
  membership: Membership;
  bookings: GymClass[];
  onCancelBooking: (c: GymClass) => void;
  onUpgrade: (id: PlanId) => void;
  onCancel: () => void;
  onReactivate: () => void;
}) {
  const plan = planById(membership.planId);
  const higher = PLANS.filter((p) => p.rank > plan.rank);
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">สวัสดี, {membership.name} 👋</h1>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-neutral-400">Current plan</p>
            <p className="text-3xl font-black">{plan.name}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${membership.cancelled ? "bg-amber-400/20 text-amber-300" : "bg-green-500/20 text-green-400"}`}>
            {membership.cancelled ? "Ends " + fmtDate(membership.nextBilling) : "Active"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-neutral-400">Billing</dt><dd className="font-semibold capitalize">{membership.billing} · {baht(priceFor(plan, membership.billing))}</dd></div>
          <div><dt className="text-neutral-400">{membership.cancelled ? "Access until" : "Next billing date"}</dt><dd className="font-semibold">{fmtDate(membership.nextBilling)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {higher.map((p) => (
            <button key={p.id} onClick={() => onUpgrade(p.id)} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: ACCENT }}>Upgrade to {p.name}</button>
          ))}
          {membership.cancelled ? (
            <button onClick={onReactivate} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Resume membership</button>
          ) : (
            <button onClick={onCancel} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Cancel membership</button>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-xl font-bold">My bookings</h2>
      <div className="mt-3 space-y-2">
        {bookings.length === 0 && <p className="text-sm text-neutral-400">No classes booked yet. Pick one from the schedule on the Home tab.</p>}
        {bookings.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm">
            <span>{c.emoji} <b>{c.name}</b> · {c.day} {c.time}</span>
            <button onClick={() => onCancelBooking(c)} className="text-red-400">Cancel</button>
          </div>
        ))}
      </div>
    </section>
  );
}
