import Image from "next/image";
import Link from "next/link";
import { demos } from "@/lib/demos";
import { profile } from "@/lib/profile";

const Section = ({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section id={id} className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
    {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{eyebrow}</p>}
    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    {intro && <p className="mt-3 max-w-3xl text-base leading-relaxed text-stone-600">{intro}</p>}
    <div className="mt-8">{children}</div>
  </section>
);

const Arrow = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1.5 h-4 w-4 shrink-0 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5l3.2 3L13 4.5" />
  </svg>
);

const Steps = ({ items }: { items: string[] }) => (
  <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-stone-700">
    {items.map((t, i) => (
      <li key={t} className="flex gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">{i + 1}</span>
        <span>{t}</span>
      </li>
    ))}
  </ol>
);

const navLinks = [
  ["#work", "ผลงาน"],
  ["#payments", "ชำระเงิน"],
  ["#about", "เกี่ยวกับ"],
  ["#experience", "ประสบการณ์"],
  ["#contact", "ติดต่อ"],
];

const MAX_CHIPS = 4;

const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-stone-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700";
const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-stone-100";

export default function Home() {
  return (
    <main>
      <nav className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2 text-sm">
          <a href="#top" className="flex min-h-11 items-center font-semibold tracking-tight">{profile.name}</a>
          <div className="hidden items-center gap-1 text-stone-600 md:flex">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="flex min-h-11 items-center rounded-md px-3 transition hover:text-stone-950">{label}</a>
            ))}
          </div>
          <a href="#contact" className="inline-flex min-h-11 items-center rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 md:min-h-10">ติดต่อ</a>
        </div>
      </nav>

      <header id="top" className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:pb-16 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" />
          รับงานฟรีแลนซ์ · เวลาประเทศไทย (GMT+7)
        </p>
        <h1 className="mt-6 max-w-4xl text-[2rem] font-bold leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.2]">{profile.headline}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg">{profile.tagline}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#work" className={btnPrimary}>ดูผลงาน <Arrow /></a>
          <a href={`mailto:${profile.email}`} className={btnSecondary}>ส่งอีเมลหา</a>
        </div>
        <ul className="mt-10 flex flex-wrap gap-2" aria-label="ทักษะ">
          {profile.skills.map((s) => (
            <li key={s} className="rounded-md border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700">{s}</li>
          ))}
        </ul>
      </header>

      <Section id="featured" eyebrow="ผลงานเด่น" title="แพลตฟอร์มที่ใช้งานจริง">
        <div className="grid gap-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold">{profile.platformName}</h3>
            <p className="mt-2 leading-relaxed text-stone-600">ออกแบบ พัฒนา และดูแลเองทั้งหมดคนเดียว มีผู้ใช้จริงที่จ่ายเงินใช้งาน</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link href="/case-study" className={`group ${btnPrimary}`}>อ่านกรณีศึกษา <Arrow /></Link>
              {profile.platformUrl && (
                <a href={profile.platformUrl} className={btnSecondary}>เข้าชมเว็บไซต์จริง ↗</a>
              )}
            </div>
          </div>
          <ul className="space-y-3 lg:col-span-3">
            {profile.proof.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-stone-700"><Check />{p}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="work"
        eyebrow="เดโม 7 ธุรกิจ"
        title="ตัวอย่างงานสำหรับธุรกิจขนาดเล็ก"
        intro="เดโมที่ใช้งานได้จริงบน API และฐานข้อมูล SQLite (การชำระเงินและอีเมลยังเป็นการจำลอง กรุณากรอกข้อมูลสมมติเท่านั้น) แต่ละงานระบุ Tech Stack ของเดโมนี้ และ Tech Stack ที่ผมจะใช้ในงานจริง"
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <Link
              key={d.slug}
              href={`/demos/${d.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
            >
              <div className="h-1.5 w-full" style={{ background: d.accent }} aria-hidden="true" />
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-stone-100 bg-stone-100">
                <Image
                  src={`/images/home/${d.slug}.jpg`}
                  alt={`ตัวอย่างหน้าจอ ${d.name}`}
                  fill
                  loading="lazy"
                  sizes="(min-width: 1152px) 368px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top ring-1 ring-inset ring-black/5"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="text-xs font-semibold text-stone-500">{d.industry}</span>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{d.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{d.tagline}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-stone-700">
                  {d.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full" style={{ background: d.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>
                {d.payment && (
                  <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[13px] leading-relaxed text-emerald-950">
                    <span className="font-semibold">การชำระเงิน: </span>{d.payment.summary}
                  </p>
                )}
                <div className="mt-5 space-y-4 border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-stone-600">Tech Stack (เดโมนี้)</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {d.stack.slice(0, MAX_CHIPS).map((s) => (
                        <li key={s} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{s}</li>
                      ))}
                      {d.stack.length > MAX_CHIPS && (
                        <li className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700" aria-label={`และอีก ${d.stack.length - MAX_CHIPS} รายการ`}>+{d.stack.length - MAX_CHIPS}</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-600">Tech Stack (งานจริง)</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {d.productionStack.slice(0, MAX_CHIPS).map((s) => (
                        <li key={s} className="rounded-md border border-stone-200 px-2 py-0.5 text-xs text-stone-600">{s}</li>
                      ))}
                      {d.productionStack.length > MAX_CHIPS && (
                        <li className="rounded-md border border-stone-200 px-2 py-0.5 text-xs text-stone-600" aria-label={`และอีก ${d.productionStack.length - MAX_CHIPS} รายการ`}>+{d.productionStack.length - MAX_CHIPS}</li>
                      )}
                    </ul>
                  </div>
                </div>
                <span className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-5 text-sm font-semibold" style={{ color: d.accent }}>
                  เปิดเดโม <Arrow />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section
        id="payments"
        eyebrow="ระบบชำระเงิน"
        title="ระบบชำระเงินทำงานอย่างไร"
        intro="เว็บ SME ส่วนใหญ่ไม่จำเป็นต้องรอเงินจากตัวกลาง ผมออกแบบให้ลูกค้าโอนเข้าบัญชีร้านโดยตรงผ่านพร้อมเพย์ (บริษัทหรือบุคคลก็ได้) แล้วระบบยืนยันให้เอง ด้วย QR ตรวจรับเงินอัตโนมัติหรือตรวจสลิปผ่าน Thunder API เงินเข้าบัญชีร้านทันที ไม่ต้องรอรอบจ่ายเงินของผู้ให้บริการ"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-emerald-800">แบบที่ 1</p>
            <h3 className="mt-1 text-lg font-semibold">QR PromptPay ตรวจรับเงินอัตโนมัติ (ไม่ต้องแนบสลิป)</h3>
            <Steps items={["สร้าง QR PromptPay ต่อออเดอร์ ยอดไม่ซ้ำกัน (บวกเศษสตางค์) พร้อมเวลาหมดอายุ", "ลูกค้าสแกนจ่ายเข้าบัญชีร้านโดยตรง (บริษัทหรือบุคคล)", "ธนาคารหรือผู้ให้บริการส่ง webhook แจ้งเงินเข้า ระบบตรวจลายเซ็นและกันส่งซ้ำ", "เทียบยอดกับออเดอร์ ปิดออเดอร์เองภายในไม่กี่วินาที เงินที่จับคู่ไม่ได้เข้าคิวให้เจ้าของร้านตรวจ"]} />
            <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-600">ใช้ในเดโม Linen &amp; Co. (ร้านเสื้อผ้า)</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold text-emerald-800">แบบที่ 2</p>
            <h3 className="mt-1 text-lg font-semibold">แนบสลิป ตรวจผ่าน Thunder API</h3>
            <Steps items={["ลูกค้าโอนเงินเข้าบัญชีร้านแล้วแนบสลิปในหน้าเว็บ", "ส่งรูปสลิปไปตรวจที่ Thunder API", "เซิร์ฟเวอร์เทียบยอดจริง บัญชีผู้รับ และกันสลิปซ้ำ", "อัปเดตสถานะเป็น 'ชำระแล้ว' อัตโนมัติ"]} />
            <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-600">ใช้ในเดโมคาเฟ่ ร้านทำมือ จองคิว ฟิตเนส และใบแจ้งหนี้ (เป็นตัวสำรองในร้านเสื้อผ้า)</p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-[15px] text-emerald-950">
            <h3 className="text-base font-semibold">โอนตรง + ตรวจสลิปอัตโนมัติ</h3>
            <ul className="mt-3 space-y-2 leading-relaxed">
              {["เงินเข้าบัญชีร้านทันที ไม่ต้องรอรอบจ่ายเงิน", "ค่าบริการตรวจสลิปต่ำ ไม่มีค่าธรรมเนียมต่อรายการแบบบัตร", "เหมาะกับร้านค้า ร้านอาหาร จองคิว ยอดไม่สูงมาก", "ฝั่งเซิร์ฟเวอร์คิดยอดเอง เทียบกับสลิป และห้ามใช้สลิปซ้ำ"].map((t) => (
                <li key={t} className="flex gap-2.5"><Check />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-[15px] text-stone-700 shadow-sm">
            <h3 className="text-base font-semibold text-stone-900">เมื่อไหร่ที่ยังควรใช้ Stripe หรือเกตเวย์บัตร</h3>
            <ul className="mt-3 space-y-2 leading-relaxed">
              {["ต้องตัดบัตรอัตโนมัติรายเดือน (subscription จริง)", "ลูกค้าต่างประเทศที่จ่ายด้วยบัตร", "ต้องการคืนเงิน/ระบบ dispute ครบวงจร", "แลกกับค่าธรรมเนียมและรอบโอนเงินเข้าบัญชีที่ช้ากว่า"].map((t) => (
                <li key={t} className="flex gap-2.5"><span aria-hidden="true" className="mt-[0.75em] h-1 w-1 shrink-0 rounded-full bg-stone-400" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-5 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          <span className="font-semibold">หมายเหตุ โหมดทดสอบ (sandbox): </span>
          ตอนนี้เดโมยังไม่มีบริการส่งแจ้งเงินเข้าจริง จึงมีปุ่มจำลอง webhook ที่เซิร์ฟเวอร์เซ็นลายเซ็นให้ และสลิปรับภาพใดก็ได้ เพราะยังไม่ได้ตั้งค่า API key ของ Thunder และ ThaiBulkSMS เมื่อใส่ key ใน environment ระบบจะเรียกบริการจริง
        </p>
      </Section>

      <Section id="about" eyebrow="เกี่ยวกับ" title="เกี่ยวกับผม" intro={profile.about}>
        <h3 className="mb-4 font-semibold">สิ่งที่ผมสร้างให้คุณได้</h3>
        <ul className="grid gap-4 sm:grid-cols-2">
          {profile.services.map((s) => (
            <li key={s} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-4 text-[15px] leading-relaxed text-stone-700 shadow-sm"><Check />{s}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-stone-600">
          ผมทำงานในเวลาที่ตรงกับคุณ รายงานความคืบหน้าสม่ำเสมอ และส่งมอบโค้ดที่สะอาดพร้อมเอกสารประกอบ
        </p>
      </Section>

      <Section id="experience" eyebrow="ประสบการณ์" title="ประสบการณ์และการศึกษา">
        <div className="max-w-3xl space-y-8 border-l-2 border-stone-200 pl-6">
          {profile.experience.map((e) => (
            <div key={e.role + e.org} className="relative">
              <span aria-hidden="true" className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full border-2 border-stone-50 bg-emerald-700 ring-1 ring-emerald-700" />
              <h3 className="font-semibold">{e.role}</h3>
              <p className="text-sm text-stone-600">{e.org} · {e.period}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-stone-700 marker:text-stone-400">
                {e.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
          <div className="relative">
            <span aria-hidden="true" className="absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full border-2 border-stone-50 bg-stone-400 ring-1 ring-stone-400" />
            <h3 className="font-semibold">การศึกษา</h3>
            <p className="text-[15px] text-stone-700">{profile.education}</p>
          </div>
        </div>
      </Section>

      <section id="contact" className="px-5 pb-16 pt-4 sm:pb-20">
        <div className="mx-auto max-w-6xl rounded-3xl bg-stone-900 px-6 py-12 text-white sm:px-12 sm:py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">คุยกันได้เลย</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-300">ส่งข้อความหรืออีเมลมาได้เลย ยินดีโทรคุยสั้น ๆ เพื่อประเมินขอบเขตงานของคุณ</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`mailto:${profile.email}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-semibold text-stone-900 transition hover:bg-stone-200">{profile.email}</a>
            <a href={profile.github} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-600 px-5 text-sm font-semibold text-white transition hover:bg-stone-800">GitHub</a>
            {profile.linkedin && <a href={profile.linkedin} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-600 px-5 text-sm font-semibold text-white transition hover:bg-stone-800">LinkedIn</a>}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {profile.name} · สร้างด้วย Next.js, TypeScript และ Tailwind CSS
      </footer>
    </main>
  );
}
