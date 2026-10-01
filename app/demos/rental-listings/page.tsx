"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import OtpVerify from "@/components/OtpVerify";
import DemoShell from "@/components/DemoShell";
import { getDemo } from "@/lib/demos";

type InquiryStatus = "new" | "contacted" | "closed";

type Listing = {
  id: number;
  title: string;
  type: string;
  area: string;
  price: number;
  bedrooms: number;
  sqm: number;
  description: string;
  amenities: string[];
  published: boolean;
  images: { url: string; caption: string }[];
};

type Inquiry = {
  id: number;
  listingId: number;
  listingTitle: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: InquiryStatus;
  phoneVerified: boolean;
  createdAt: string;
};

const API = "/api/rental-listings";
const AGENT_HEADERS = { "x-demo-role": "agent" };

const priceRanges = [
  { label: "ทุกราคา", min: undefined, max: undefined },
  { label: "ต่ำกว่า 10,000", min: undefined, max: 10000 },
  { label: "10,000 – 20,000", min: 10000, max: 20000 },
  { label: "20,000 – 40,000", min: 20000, max: 40000 },
  { label: "40,000+", min: 40000, max: undefined },
];

const statusStyle: Record<InquiryStatus, string> = {
  new: "bg-violet-100 text-violet-900",
  contacted: "bg-amber-100 text-amber-900",
  closed: "bg-emerald-100 text-emerald-900",
};

const statusLabel: Record<InquiryStatus, string> = { new: "ใหม่", contacted: "ติดต่อแล้ว", closed: "ปิดงาน" };

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีก่อน`;
  if (mins < 1440) return `${Math.round(mins / 60)} ชั่วโมงก่อน`;
  return `${Math.round(mins / 1440)} วันก่อน`;
}

function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

function CheckIcon({ light = false }: { light?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${light ? "text-violet-200" : "text-violet-700"}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

function Gallery({ listing }: { listing: Listing }) {
  const [active, setActive] = useState(0);
  const current = listing.images[active];
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-200 shadow-sm">
        <Image src={current.url} alt={`${listing.title} - ${current.caption}`} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" priority />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {current.caption} · {active + 1}/{listing.images.length}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {listing.images.map((im, i) => (
          <button
            key={im.url}
            type="button"
            aria-label={`ดูรูปที่ ${i + 1}: ${im.caption}`}
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={`relative aspect-[16/9] overflow-hidden rounded-xl ring-offset-2 transition focus-visible:outline-2 focus-visible:outline-violet-700 ${active === i ? "ring-2 ring-violet-700" : "opacity-70 hover:opacity-100"}`}
          >
            <Image src={im.url} alt="" fill sizes="20vw" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function InquiryForm({ listing, onSent }: { listing: Listing; onSent: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFailure("");
    try {
      const res = await fetch(`${API}/inquiries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, name, phone, email, message, otpToken }),
      });
      if (res.ok) {
        setName("");
        setPhone("");
        setOtpToken(null);
        setVerifiedPhone("");
        setEmail("");
        setMessage("");
        setSent(true);
        onSent();
      } else {
        const data = (await res.json()) as { error?: string; errors?: Record<string, string> };
        setErrors(data.errors ?? {});
        setFailure(data.errors ? "" : (data.error ?? "ส่งไม่สำเร็จ"));
      }
    } catch {
      setFailure("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none placeholder:text-neutral-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200 sm:text-sm";
  const err = (k: string) => (errors[k] ? <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors[k]}</p> : null);

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">ส่งข้อความเรียบร้อยแล้ว</p>
        <p className="mt-1">นายหน้าจะตอบกลับภายใน 1 วันทำการ ดูข้อความที่เข้ามาได้ในแท็บแดชบอร์ดนายหน้า</p>
        <button type="button" onClick={() => setSent(false)} className="mt-3 inline-flex min-h-11 items-center font-medium text-violet-700 underline">
          ส่งอีกข้อความ
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-md">
      <div><h3 className="text-lg font-bold">สอบถามที่พักนี้</h3><p className="mt-0.5 text-xs text-neutral-600">{listing.title} · {baht(listing.price)} / เดือน</p></div>
      <div>
        <input className={field} placeholder="ชื่อของคุณ" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อ" />
        {err("name")}
      </div>
      <div>
        <input className={field} type="tel" placeholder="เบอร์โทร" value={phone} onChange={(e) => {
          setPhone(e.target.value);
          if (e.target.value !== verifiedPhone) setOtpToken(null);
        }} aria-label="เบอร์โทร" />
        {err("phone")}
        <div className="mt-2">
          {otpToken && phone === verifiedPhone ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">ยืนยันเบอร์ {phone} แล้ว</p>
          ) : (
            <OtpVerify key={phone} phone={phone} accent="#7c3aed" onVerified={(t) => { setOtpToken(t); setVerifiedPhone(phone); }} />
          )}
        </div>
      </div>
      <div>
        <input className={field} type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="อีเมล" />
        {err("email")}
      </div>
      <div>
        <textarea rows={3} className={field} placeholder="ต้องการนัดดูห้อง..." value={message} onChange={(e) => setMessage(e.target.value)} aria-label="ข้อความ" />
        {err("message")}
      </div>
      {failure && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>}
      <button type="submit" disabled={busy || !otpToken} className="min-h-11 w-full rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-700">
        {busy ? "กำลังส่ง..." : otpToken ? "ส่งข้อความสอบถาม" : "ยืนยันเบอร์โทรด้วย OTP ก่อนส่ง"}
      </button>
    </form>
  );
}

export default function RentalListingsPage() {
  const demo = getDemo("rental-listings");
  const [tab, setTab] = useState<"browse" | "agent">("browse");
  const [results, setResults] = useState<Listing[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [agentListings, setAgentListings] = useState<Listing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [type, setType] = useState("ทั้งหมด");
  const [priceIdx, setPriceIdx] = useState(0);
  const [beds, setBeds] = useState(0);
  const [area, setArea] = useState("ทั้งหมด");

  const loadListings = useCallback(async () => {
    const range = priceRanges[priceIdx];
    const q = new URLSearchParams();
    if (type !== "ทั้งหมด") q.set("type", type);
    if (range.min !== undefined) q.set("minPrice", String(range.min));
    if (range.max !== undefined) q.set("maxPrice", String(range.max));
    if (beds > 0) q.set("bedrooms", String(beds));
    if (area !== "ทั้งหมด") q.set("area", area);
    try {
      const res = await fetch(`${API}/listings?${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { listings: Listing[]; areas: string[] };
      setResults(data.listings);
      setAreas(data.areas);
      setLoadError("");
    } catch {
      setLoadError("โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [type, priceIdx, beds, area]);

  const loadAgent = useCallback(async () => {
    try {
      const [li, qi] = await Promise.all([
        fetch(`${API}/agent/listings`, { headers: AGENT_HEADERS, cache: "no-store" }),
        fetch(`${API}/agent/inquiries`, { headers: AGENT_HEADERS, cache: "no-store" }),
      ]);
      if (li.ok) setAgentListings(((await li.json()) as { listings: Listing[] }).listings);
      if (qi.ok) setInquiries(((await qi.json()) as { inquiries: Inquiry[] }).inquiries);
    } catch {
      setLoadError("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/filter change
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for the badge and dashboard
    void loadAgent();
  }, [loadAgent, tab]);

  const newCount = useMemo(() => inquiries.filter((i) => i.status === "new").length, [inquiries]);

  const openListing = async (id: number) => {
    const res = await fetch(`${API}/listings/${id}`, { cache: "no-store" });
    if (res.ok) setSelected(((await res.json()) as { listing: Listing }).listing);
    else {
      setSelected(null);
      void loadListings();
    }
  };

  const setStatus = async (id: number, status: InquiryStatus) => {
    await fetch(`${API}/agent/inquiries/${id}`, {
      method: "PATCH",
      headers: { ...AGENT_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadAgent();
  };

  const togglePublish = async (l: Listing) => {
    await fetch(`${API}/agent/listings/${l.id}`, {
      method: "PATCH",
      headers: { ...AGENT_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ published: !l.published }),
    });
    await Promise.all([loadAgent(), loadListings()]);
  };

  const resetFilters = () => {
    setType("ทั้งหมด");
    setPriceIdx(0);
    setBeds(0);
    setArea("ทั้งหมด");
  };

  const select = "min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-neutral-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200";

  return (
    <DemoShell slug="rental-listings">
      <header className="relative z-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:py-4">
          <button type="button" onClick={() => { setTab("browse"); setSelected(null); }} className="flex min-h-11 shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: demo.accent }}><HomeIcon /></span>
            <span className="text-left leading-tight">
              <span className="block whitespace-nowrap text-lg font-bold">{demo.name}</span>
              <span className="hidden text-xs text-neutral-600 sm:block">บ้านและคอนโดให้เช่า · กรุงเทพฯ</span>
            </span>
          </button>
          <nav className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm whitespace-nowrap" aria-label="เมนูหลัก">
            <button type="button" onClick={() => { setTab("browse"); setSelected(null); }} className={`min-h-10 rounded-full px-3 py-1.5 font-medium sm:px-4 ${tab === "browse" ? "bg-white text-violet-800 shadow" : "text-neutral-700 hover:text-violet-800"}`}>
              ค้นหา<span className="hidden sm:inline">ที่พัก</span>
            </button>
            <button type="button" onClick={() => setTab("agent")} className={`min-h-10 rounded-full px-3 py-1.5 font-medium sm:px-4 ${tab === "agent" ? "bg-white text-violet-800 shadow" : "text-neutral-700 hover:text-violet-800"}`}>
              <span className="sm:hidden">นายหน้า</span><span className="hidden sm:inline">แดชบอร์ดนายหน้า</span>
              {newCount > 0 && <span className="ml-1.5 rounded-full bg-violet-700 px-1.5 py-0.5 text-[11px] text-white">{newCount}</span>}
            </button>
          </nav>
        </div>
      </header>

      {tab === "browse" && !selected && (
        <>
          <section className="relative overflow-hidden px-4 pb-24 pt-12 text-white sm:pt-16">
            <Image src="/images/rental-listings/hero.jpg" alt="" fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-r from-violet-950/90 via-violet-900/70 to-violet-800/35" />
            <div className="relative mx-auto max-w-6xl">
              <p className="text-sm font-semibold text-violet-200">บ้านและคอนโดให้เช่า กรุงเทพฯ</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight"><span className="inline-block">หาบ้านที่ใช่</span> <span className="inline-block">ไม่ต้องวนหลายรอบ</span></h1>
              <p className="mt-4 max-w-xl leading-relaxed text-violet-50">ประกาศผ่านการตรวจสอบ ราคาเช่ารายเดือนชัดเจน ติดต่อนายหน้าได้ทันที และได้รับการตอบกลับภายใน 1 วันทำการ</p>
              <ul className="mt-6 flex flex-col gap-2 text-sm text-violet-50 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <li className="flex items-center gap-1.5"><CheckIcon light /> ประกาศผ่านการตรวจสอบ</li>
                <li className="flex items-center gap-1.5"><CheckIcon light /> ราคาชัดเจน ไม่มีค่าแอบแฝง</li>
                <li className="flex items-center gap-1.5"><CheckIcon light /> ตอบกลับใน 1 วันทำการ</li>
              </ul>
            </div>
          </section>

          <section className="mx-auto -mt-14 max-w-6xl px-4 pb-10">
            <div className="relative grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg md:grid-cols-5">
              <label className="text-xs font-semibold text-neutral-700">
                ประเภท
                <select className={`${select} mt-1 w-full`} value={type} onChange={(e) => setType(e.target.value)}>
                  {["ทั้งหมด", "คอนโด", "บ้านเดี่ยว", "อพาร์ตเมนต์", "ทาวน์โฮม"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-700">
                ราคา / เดือน
                <select className={`${select} mt-1 w-full`} value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))}>
                  {priceRanges.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-700">
                ห้องนอน
                <select className={`${select} mt-1 w-full`} value={beds} onChange={(e) => setBeds(Number(e.target.value))}>
                  <option value={0}>ทั้งหมด</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3+</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-700">
                พื้นที่
                <select className={`${select} mt-1 w-full`} value={area} onChange={(e) => setArea(e.target.value)}>
                  <option>ทั้งหมด</option>
                  {areas.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <button type="button" onClick={resetFilters} className="col-span-2 min-h-11 self-end rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 md:col-span-1">
                ล้างตัวกรอง
              </button>
            </div>

            {loadError && <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}
            <div className="mt-8 flex items-baseline justify-between"><h2 className="text-xl font-bold">ที่พักให้เช่า</h2><p className="text-sm text-neutral-600" aria-live="polite">{loading ? "กำลังโหลด..." : `พบ ${results.length} รายการ`}</p></div>

            {loading ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-neutral-100" />)}
              </div>
            ) : results.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
                <p className="font-semibold text-neutral-800">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
                <p className="mt-1 text-sm text-neutral-600">ลองปรับตัวกรองให้กว้างขึ้น หรือล้างตัวกรองเพื่อดูทั้งหมด</p>
                <button type="button" onClick={resetFilters} className="mt-4 min-h-11 rounded-lg bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800">ล้างตัวกรอง</button>
              </div>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((l) => (
                  <button key={l.id} type="button" onClick={() => openListing(l.id)} className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">
                    <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
                      <Image src={l.images[0].url} alt={l.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-violet-800 shadow-sm">{l.type}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-xs font-medium text-neutral-600">{l.area}, กรุงเทพฯ</p>
                      <h2 className="mt-1 font-semibold leading-snug">{l.title}</h2>
                      <p className="mt-1 text-sm text-neutral-600">{l.bedrooms} ห้องนอน · {l.sqm} ตร.ม.</p>
                      <p className="mt-auto pt-3 text-xl font-bold text-violet-800">{baht(l.price)}<span className="text-sm font-normal text-neutral-600"> / เดือน</span></p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "browse" && selected && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <button type="button" onClick={() => setSelected(null)} className="mb-2 flex min-h-11 items-center gap-1 text-sm font-medium text-violet-800 hover:underline">
            <ArrowLeftIcon /> กลับไปหน้ารายการ
          </button>
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            <div>
              <Gallery key={selected.id} listing={selected} />
              <div className="mt-6">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">{selected.type} · {selected.area}</span>
                <h1 className="mt-2 text-2xl font-bold">{selected.title}</h1>
                <p className="mt-1 text-2xl font-bold text-violet-800">{baht(selected.price)}<span className="text-base font-normal text-neutral-600"> / เดือน</span></p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><dt className="text-neutral-600">ห้องนอน</dt><dd className="font-semibold">{selected.bedrooms}</dd></div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><dt className="text-neutral-600">ขนาด</dt><dd className="font-semibold">{selected.sqm} ตร.ม.</dd></div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><dt className="text-neutral-600">เงินประกัน</dt><dd className="font-semibold">2 เดือน</dd></div>
                </dl>
                <p className="mt-4 leading-relaxed text-neutral-700">{selected.description}</p>
                <h2 className="mt-6 font-semibold">สิ่งอำนวยความสะดวก</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.amenities.map((a) => <span key={a} className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs"><CheckIcon /> {a}</span>)}
                </div>
              </div>
            </div>
            <div className="lg:sticky lg:top-16 lg:self-start">
              <InquiryForm key={selected.id} listing={selected} onSent={loadAgent} />
            </div>
          </div>
        </section>
      )}

      {tab === "agent" && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-bold">แดชบอร์ดนายหน้า</h1>
          <p className="mt-1 text-sm text-neutral-600">จัดการข้อความสอบถามและเลือกประกาศที่แสดงบนเว็บไซต์</p>

          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-neutral-200 bg-white p-3"><dd className="text-2xl font-bold text-violet-800">{newCount}</dd><dt className="text-xs text-neutral-600">ข้อความใหม่</dt></div>
            <div className="rounded-xl border border-neutral-200 bg-white p-3"><dd className="text-2xl font-bold">{inquiries.length}</dd><dt className="text-xs text-neutral-600">ข้อความทั้งหมด</dt></div>
            <div className="rounded-xl border border-neutral-200 bg-white p-3"><dd className="text-2xl font-bold">{agentListings.filter((l) => l.published).length}/{agentListings.length}</dd><dt className="text-xs text-neutral-600">ประกาศที่เผยแพร่</dt></div>
          </dl>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-semibold">กล่องข้อความ ({inquiries.length})</h2>
              {inquiries.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">ยังไม่มีข้อความสอบถาม ลองส่งข้อความจากหน้าค้นหาที่พักดู</p>}
              <ul className="space-y-3">
                {inquiries.map((q) => (
                  <li key={q.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {q.name}
                          {q.phoneVerified && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">ยืนยันเบอร์แล้ว</span>}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-neutral-600 sm:break-normal">{q.phone} · {q.email}</p><p className="text-xs text-neutral-600">{timeAgo(q.createdAt)}</p>
                      </div>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[q.status]}`}>{statusLabel[q.status]}</span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-violet-800">เรื่อง: {q.listingTitle}</p>
                    <p className="mt-1 text-sm text-neutral-700">{q.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["new", "contacted", "closed"] as InquiryStatus[]).map((s) => (
                        <button key={s} type="button" onClick={() => setStatus(q.id, s)} disabled={q.status === s} className="min-h-11 rounded-lg border border-neutral-300 px-3.5 text-sm font-medium hover:bg-neutral-100 disabled:border-violet-700 disabled:bg-violet-700 disabled:text-white">
                          {statusLabel[s]}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 font-semibold">ประกาศ (เผยแพร่ {agentListings.filter((l) => l.published).length} รายการ)</h2>
              <ul className="space-y-3">
                {agentListings.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                      <Image src={l.images[0].url} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-neutral-600">{baht(l.price)} · {l.area}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={l.published}
                      aria-label={`เผยแพร่ ${l.title}`}
                      onClick={() => togglePublish(l)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition before:absolute before:-inset-2 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${l.published ? "bg-violet-700" : "bg-neutral-400"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${l.published ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-neutral-200 bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-lg font-bold">สร้างอย่างไร</h2>
          <p className="mt-1 text-sm text-neutral-600">หมายเหตุ: ภาพทรัพย์ทั้งหมดเป็นภาพถ่ายสต็อกลิขสิทธิ์เปิด (CC0) เพื่อประกอบการสาธิต ไม่ใช่ทรัพย์จริงตามชื่อประกาศ</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">เดโมนี้เก็บข้อมูลจริงใน SQLite ผ่าน Route Handlers ของ Next.js (ตัวกรองทำงานฝั่งเซิร์ฟเวอร์ ประกาศที่ปิดอยู่ไม่ถูกส่งออกทาง API สาธารณะ) ส่วนนายหน้าจำลองด้วย header ระบุบทบาท ในงานจริงจะใช้:</p>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700">
            <li><b>ของจริงในเดโม:</b> ประกาศ ตัวกรอง และข้อความสอบถามเก็บในฐานข้อมูลจริง กรองฝั่งเซิร์ฟเวอร์ และต้องยืนยันเบอร์ด้วย OTP ก่อนส่งข้อความ</li>
            <li><b>การชำระเงิน:</b> เดโมนี้ไม่มีการชำระเงิน เป็นการสอบถามและนัดดูห้องกับนายหน้าเท่านั้น</li>
            <li><b>ระบบจริงจะใช้:</b> PostgreSQL, Supabase Storage สำหรับรูป และระบบเข้าสู่ระบบจริงสำหรับนายหน้า</li>
          </ul>
          <details className="group mt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-semibold text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 [&::-webkit-details-marker]:hidden">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
              ดูรายละเอียดทางเทคนิค
            </summary>
          <ul className="mt-3 grid gap-3 text-sm leading-relaxed text-neutral-700 sm:grid-cols-2">
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>Next.js + TypeScript:</b> หน้าประกาศเรนเดอร์ฝั่งเซิร์ฟเวอร์ เป็นมิตรกับ SEO พร้อมตัวกรองที่ใช้ type ครบ</li>
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>PostgreSQL:</b> เก็บประกาศ ข้อความสอบถาม และสถานะ พร้อมดัชนีค้นหา (index) เพื่อให้กรองข้อมูลได้เร็ว (เดโมนี้ใช้ SQLite)</li>
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>Supabase Storage:</b> เก็บรูปที่นายหน้าอัปโหลด และส่งผ่าน CDN (เดโมนี้เสิร์ฟรูปจากโฟลเดอร์ในโปรเจกต์)</li>
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>Server Actions:</b> ตรวจสอบและบันทึกฟอร์มสอบถามและการเปิด/ปิดประกาศอย่างปลอดภัย พร้อมตรวจสิทธิ์จากการเข้าสู่ระบบจริง</li>
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>ThaiBulkSMS OTP:</b> ฟอร์มสอบถามต้องยืนยันเบอร์โทรด้วย OTP ทาง SMS ก่อน เซิร์ฟเวอร์ตรวจโทเค็นยืนยันซ้ำทุกครั้ง (403 หากยังไม่ยืนยัน) แล้วบันทึกเบอร์ที่ยืนยันแล้วลง SQLite และแสดงป้ายยืนยันเบอร์ในกล่องข้อความนายหน้า หากยังไม่ได้ตั้งค่า API key จะเป็นโหมดทดสอบ (ไม่ส่ง SMS จริง)</li>
            <li className="rounded-xl border border-neutral-200 bg-white p-4"><b>Tailwind CSS:</b> หน้าตาที่รองรับทุกหน้าจอ ออกแบบมือถือเป็นหลัก และปรับแบรนด์ได้เร็ว</li>
          </ul>
          </details>
        </div>
      </section>
    </DemoShell>
  );
}
