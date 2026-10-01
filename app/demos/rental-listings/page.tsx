"use client";

import { useMemo, useState } from "react";
import DemoShell from "@/components/DemoShell";
import { getDemo } from "@/lib/demos";

type PropertyType = "Condo" | "House" | "Apartment" | "Townhome";
type InquiryStatus = "new" | "contacted" | "closed";

type Listing = {
  id: number;
  title: string;
  type: PropertyType;
  area: string;
  price: number;
  bedrooms: number;
  sqm: number;
  emoji: string;
  hues: [number, number][];
  description: string;
  amenities: string[];
  published: boolean;
};

type Inquiry = {
  id: number;
  listingId: number;
  name: string;
  contact: string;
  message: string;
  status: InquiryStatus;
  at: string;
};

const initialListings: Listing[] = [
  { id: 1, title: "Skyline Studio near BTS Ari", type: "Condo", area: "Phaya Thai", price: 14500, bedrooms: 1, sqm: 29, emoji: "🌆", hues: [[265, 285], [215, 250], [320, 350]], description: "Bright studio on the 24th floor with a city view, five minutes' walk to BTS Ari. Fully furnished, ready to move in.", amenities: ["Pool", "Gym", "Fiber WiFi", "Key card access"], published: true },
  { id: 2, title: "Family House with Garden", type: "House", area: "Ladprao", price: 38000, bedrooms: 3, sqm: 180, emoji: "🏡", hues: [[140, 170], [80, 120], [30, 50]], description: "Quiet two-storey house in a gated village with a private garden and two covered parking spaces. Pets allowed.", amenities: ["Garden", "2 parking", "Pet friendly", "24h security"], published: true },
  { id: 3, title: "Riverside 2-Bed Corner Unit", type: "Condo", area: "Sathorn", price: 32000, bedrooms: 2, sqm: 68, emoji: "🌉", hues: [[200, 230], [250, 280], [170, 190]], description: "Corner unit facing the Chao Phraya with a large balcony. Walking distance to the Saphan Taksin pier.", amenities: ["River view", "Pool", "Co-working", "Shuttle"], published: true },
  { id: 4, title: "Cozy Apartment by Thammasat", type: "Apartment", area: "Rangsit", price: 6200, bedrooms: 1, sqm: 24, emoji: "🛏️", hues: [[20, 40], [340, 360], [45, 60]], description: "Affordable monthly rental for students and young workers. Water and trash included, laundry on every floor.", amenities: ["Laundry", "CCTV", "Motorbike parking"], published: true },
  { id: 5, title: "Modern Townhome Thonglor", type: "Townhome", area: "Watthana", price: 55000, bedrooms: 3, sqm: 210, emoji: "🏙️", hues: [[290, 320], [240, 270], [10, 30]], description: "Three-floor townhome with a rooftop terrace, minutes from Thonglor cafes and restaurants. Partly furnished.", amenities: ["Rooftop", "Elevator", "2 parking", "Smart lock"], published: true },
  { id: 6, title: "Minimal 1-Bed Ratchada", type: "Condo", area: "Din Daeng", price: 11800, bedrooms: 1, sqm: 31, emoji: "🪴", hues: [[160, 190], [200, 220], [100, 130]], description: "Quiet Muji-style room, 3 minutes from MRT Huai Khwang. Built-in wardrobe and kitchenette.", amenities: ["Gym", "Co-working", "Fiber WiFi"], published: true },
  { id: 7, title: "Pet-friendly Apartment Ekkamai", type: "Apartment", area: "Watthana", price: 17500, bedrooms: 2, sqm: 52, emoji: "🐶", hues: [[35, 55], [10, 30], [280, 300]], description: "Two bedrooms in a low-rise building with a small courtyard. Cats and small dogs welcome.", amenities: ["Pet friendly", "Courtyard", "Parking"], published: false },
  { id: 8, title: "Garden Townhome Bangna", type: "Townhome", area: "Bangna", price: 21000, bedrooms: 3, sqm: 140, emoji: "🌳", hues: [[120, 150], [60, 90], [180, 200]], description: "Spacious townhome close to Mega Bangna and the expressway. Great for families commuting by car.", amenities: ["Garden", "Parking", "Near mall"], published: true },
];

const initialInquiries: Inquiry[] = [
  { id: 1, listingId: 1, name: "Pimchanok S.", contact: "pim.s@example.com", message: "Is the studio still available from 1 November? Can I view it this weekend?", status: "new", at: "Today 09:12" },
  { id: 2, listingId: 3, name: "Daniel Wright", contact: "+66 81 555 0142", message: "Interested in a 12-month lease. Is the price negotiable for a longer term?", status: "contacted", at: "Yesterday 16:40" },
  { id: 3, listingId: 2, name: "คุณสมชาย ใจดี", contact: "LINE: somchai.j", message: "สนใจบ้านหลังนี้ครับ เลี้ยงสุนัขพันธุ์เล็กได้ไหมครับ", status: "closed", at: "2 days ago" },
];

const priceRanges = [
  { label: "Any price", min: 0, max: Infinity },
  { label: "Under 10,000", min: 0, max: 10000 },
  { label: "10,000 – 20,000", min: 10000, max: 20000 },
  { label: "20,000 – 40,000", min: 20000, max: 40000 },
  { label: "40,000+", min: 40000, max: Infinity },
];

const statusStyle: Record<InquiryStatus, string> = {
  new: "bg-violet-100 text-violet-800",
  contacted: "bg-amber-100 text-amber-800",
  closed: "bg-emerald-100 text-emerald-800",
};

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const gradient = ([a, b]: [number, number], i: number) =>
  `linear-gradient(${135 + i * 40}deg, hsl(${a} 70% 62%), hsl(${b} 75% 45%))`;

function Gallery({ listing }: { listing: Listing }) {
  const [active, setActive] = useState(0);
  const labels = ["Living room", "Bedroom", "View"];
  return (
    <div>
      <div
        className="flex aspect-[16/10] items-end justify-between rounded-2xl p-4 text-white"
        style={{ background: gradient(listing.hues[active], active) }}
      >
        <span className="text-6xl drop-shadow sm:text-8xl">{listing.emoji}</span>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs">
          {labels[active]} · {active + 1}/{listing.hues.length}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {listing.hues.map((h, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show photo ${i + 1}: ${labels[i]}`}
            onClick={() => setActive(i)}
            className={`aspect-[16/9] rounded-lg ring-offset-2 transition ${active === i ? "ring-2 ring-violet-600" : "opacity-70 hover:opacity-100"}`}
            style={{ background: gradient(h, i) }}
          />
        ))}
      </div>
    </div>
  );
}

function InquiryForm({ listing, onSubmit }: { listing: Listing; onSubmit: (i: Omit<Inquiry, "id" | "status" | "at">) => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ listingId: listing.id, name: name.trim(), contact: contact.trim(), message: message.trim() });
    setName("");
    setContact("");
    setMessage("");
    setSent(true);
  };

  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200";

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Inquiry sent. ส่งข้อความเรียบร้อยแล้ว</p>
        <p className="mt-1">An agent will reply within one business day. Check the Agent dashboard tab to see it arrive in the inbox.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-3 font-medium text-violet-700 underline">
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Ask about this place</h3>
      <input required className={field} placeholder="Your name / ชื่อ" value={name} onChange={(e) => setName(e.target.value)} />
      <input required className={field} placeholder="Email, phone or LINE ID" value={contact} onChange={(e) => setContact(e.target.value)} />
      <textarea required rows={3} className={field} placeholder="I'd like to book a viewing..." value={message} onChange={(e) => setMessage(e.target.value)} />
      <button type="submit" className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
        Send inquiry
      </button>
    </form>
  );
}

export default function RentalListingsPage() {
  const demo = getDemo("rental-listings");
  const [tab, setTab] = useState<"browse" | "agent">("browse");
  const [listings, setListings] = useState(initialListings);
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [type, setType] = useState("All");
  const [priceIdx, setPriceIdx] = useState(0);
  const [beds, setBeds] = useState(0);
  const [area, setArea] = useState("All");

  const areas = useMemo(() => Array.from(new Set(initialListings.map((l) => l.area))).sort(), []);
  const newCount = inquiries.filter((i) => i.status === "new").length;

  const results = useMemo(() => {
    const range = priceRanges[priceIdx];
    return listings.filter(
      (l) =>
        l.published &&
        (type === "All" || l.type === type) &&
        l.price >= range.min &&
        l.price < range.max &&
        (beds === 0 || (beds === 3 ? l.bedrooms >= 3 : l.bedrooms === beds)) &&
        (area === "All" || l.area === area),
    );
  }, [listings, type, priceIdx, beds, area]);

  const selected = listings.find((l) => l.id === selectedId) ?? null;

  const addInquiry = (i: Omit<Inquiry, "id" | "status" | "at">) =>
    setInquiries((prev) => [{ ...i, id: Date.now(), status: "new", at: "Just now" }, ...prev]);

  const setStatus = (id: number, status: InquiryStatus) =>
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

  const togglePublish = (id: number) =>
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, published: !l.published } : l)));

  const resetFilters = () => {
    setType("All");
    setPriceIdx(0);
    setBeds(0);
    setArea("All");
  };

  const select = "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600";

  return (
    <DemoShell slug="rental-listings">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button type="button" onClick={() => { setTab("browse"); setSelectedId(null); }} className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-lg text-white" style={{ background: demo.accent }}>🏠</span>
            <span className="text-left leading-tight">
              <span className="block text-lg font-bold">{demo.name}</span>
              <span className="block text-xs text-neutral-500">บ้านและคอนโดให้เช่า · Bangkok</span>
            </span>
          </button>
          <nav className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm">
            <button type="button" onClick={() => setTab("browse")} className={`rounded-full px-4 py-1.5 font-medium ${tab === "browse" ? "bg-white shadow text-violet-700" : "text-neutral-600"}`}>
              Browse
            </button>
            <button type="button" onClick={() => setTab("agent")} className={`rounded-full px-4 py-1.5 font-medium ${tab === "agent" ? "bg-white shadow text-violet-700" : "text-neutral-600"}`}>
              Agent dashboard
              {newCount > 0 && <span className="ml-1.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">{newCount}</span>}
            </button>
          </nav>
        </div>
      </header>

      {tab === "browse" && !selected && (
        <>
          <section className="bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 px-4 py-12 text-white">
            <div className="mx-auto max-w-6xl">
              <h1 className="max-w-xl text-3xl font-bold sm:text-4xl">Find a home you&apos;ll love, without the runaround.</h1>
              <p className="mt-3 max-w-xl text-violet-100">หาบ้านเช่าที่ใช่ ราคาชัดเจน ติดต่อเอเจนต์ได้ทันที. Verified listings, transparent monthly prices, and replies within one business day.</p>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-5">
              <label className="text-xs font-medium text-neutral-600">
                Type
                <select className={`${select} mt-1 w-full`} value={type} onChange={(e) => setType(e.target.value)}>
                  {["All", "Condo", "House", "Apartment", "Townhome"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Price / month
                <select className={`${select} mt-1 w-full`} value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))}>
                  {priceRanges.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Bedrooms
                <select className={`${select} mt-1 w-full`} value={beds} onChange={(e) => setBeds(Number(e.target.value))}>
                  <option value={0}>Any</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3+</option>
                </select>
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Area
                <select className={`${select} mt-1 w-full`} value={area} onChange={(e) => setArea(e.target.value)}>
                  <option>All</option>
                  {areas.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <button type="button" onClick={resetFilters} className="self-end rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                Reset filters
              </button>
            </div>

            <p className="mt-6 text-sm text-neutral-500">{results.length} properties found · พบ {results.length} รายการ</p>

            {results.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
                No matches. Try widening your filters.
              </div>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((l) => (
                  <button key={l.id} type="button" onClick={() => setSelectedId(l.id)} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="grid aspect-[16/10] place-items-center text-6xl" style={{ background: gradient(l.hues[0], 0) }}>
                      <span className="drop-shadow">{l.emoji}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">{l.type}</span>
                        <span className="text-neutral-500">{l.area}</span>
                      </div>
                      <h2 className="mt-2 font-semibold leading-snug">{l.title}</h2>
                      <p className="mt-1 text-sm text-neutral-500">{l.bedrooms} bed · {l.sqm} sqm</p>
                      <p className="mt-3 text-lg font-bold text-violet-700">{baht(l.price)}<span className="text-sm font-normal text-neutral-500"> / month</span></p>
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
          <button type="button" onClick={() => setSelectedId(null)} className="mb-4 text-sm font-medium text-violet-700 hover:underline">
            ← Back to listings
          </button>
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            <div>
              <Gallery key={selected.id} listing={selected} />
              <div className="mt-6">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">{selected.type} · {selected.area}</span>
                <h1 className="mt-2 text-2xl font-bold">{selected.title}</h1>
                <p className="mt-1 text-2xl font-bold text-violet-700">{baht(selected.price)}<span className="text-base font-normal text-neutral-500"> / month</span></p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl bg-neutral-100 p-3"><dt className="text-neutral-500">Bedrooms</dt><dd className="font-semibold">{selected.bedrooms}</dd></div>
                  <div className="rounded-xl bg-neutral-100 p-3"><dt className="text-neutral-500">Size</dt><dd className="font-semibold">{selected.sqm} sqm</dd></div>
                  <div className="rounded-xl bg-neutral-100 p-3"><dt className="text-neutral-500">Deposit</dt><dd className="font-semibold">2 months</dd></div>
                </dl>
                <p className="mt-4 text-neutral-700">{selected.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.amenities.map((a) => <span key={a} className="rounded-full border border-neutral-300 px-3 py-1 text-xs">✓ {a}</span>)}
                </div>
              </div>
            </div>
            <div className="lg:sticky lg:top-16 lg:self-start">
              <InquiryForm key={selected.id} listing={selected} onSubmit={addInquiry} />
            </div>
          </div>
        </section>
      )}

      {tab === "agent" && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-bold">Agent dashboard</h1>
          <p className="text-sm text-neutral-500">Manage inquiries and decide which listings are live. จัดการข้อความและสถานะประกาศ</p>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-semibold">Inbox ({inquiries.length})</h2>
              <ul className="space-y-3">
                {inquiries.map((q) => {
                  const l = listings.find((x) => x.id === q.listingId);
                  return (
                    <li key={q.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{q.name}</p>
                          <p className="text-xs text-neutral-500">{q.contact} · {q.at}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[q.status]}`}>{q.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-violet-700">Re: {l?.title}</p>
                      <p className="mt-1 text-sm text-neutral-700">{q.message}</p>
                      <div className="mt-3 flex gap-2">
                        {(["new", "contacted", "closed"] as InquiryStatus[]).map((s) => (
                          <button key={s} type="button" onClick={() => setStatus(q.id, s)} disabled={q.status === s} className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium capitalize hover:bg-neutral-100 disabled:bg-violet-600 disabled:text-white">
                            {s}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 font-semibold">Listings ({listings.filter((l) => l.published).length} live)</h2>
              <ul className="space-y-3">
                {listings.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: gradient(l.hues[0], 0) }}>{l.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-neutral-500">{baht(l.price)} · {l.area}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={l.published}
                      aria-label={`Publish ${l.title}`}
                      onClick={() => togglePublish(l.id)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${l.published ? "bg-violet-600" : "bg-neutral-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${l.published ? "left-5" : "left-0.5"}`} />
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
          <h2 className="text-lg font-bold">How it&apos;s built</h2>
          <p className="mt-1 text-sm text-neutral-500">This demo runs on in-memory data. In production:</p>
          <ul className="mt-4 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
            <li><b>Next.js + TypeScript:</b> server-rendered, SEO-friendly listing pages with typed filters.</li>
            <li><b>PostgreSQL:</b> stores listings, inquiries and status, with indexed queries for filtering.</li>
            <li><b>Supabase Storage:</b> hosts agent-uploaded property photos behind a CDN.</li>
            <li><b>Server Actions:</b> validate and save inquiry forms and publish toggles securely.</li>
            <li><b>Tailwind CSS:</b> a responsive, mobile-first interface that is quick to rebrand.</li>
          </ul>
        </div>
      </section>
    </DemoShell>
  );
}
