import { profile } from "@/lib/profile";
import { projects } from "@/lib/projects";

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

const navLinks = [
  ["#work", "ผลงาน"],
  ["#about", "เกี่ยวกับ"],
  ["#experience", "ประสบการณ์"],
  ["#contact", "ติดต่อ"],
];

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
        <p className="mt-3 flex flex-wrap items-center gap-y-1 text-lg font-semibold text-stone-500 sm:text-2xl" aria-label={profile.headlineStack.join(", ")}>
          {profile.headlineStack.map((s, i) => (
            <span key={s} className="whitespace-nowrap">
              {s}
              {i < profile.headlineStack.length - 1 && <span aria-hidden="true" className="px-2 text-stone-300">·</span>}
            </span>
          ))}
        </p>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg">{profile.tagline}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#work" className={btnPrimary}>ดูผลงาน <Arrow /></a>
          <a href={`mailto:${profile.email}`} className={btnSecondary}>ส่งอีเมลหา</a>
        </div>
      </header>

      <Section
        id="work"
        eyebrow="ผลงานที่ตรวจสอบได้"
        title="โปรเจกต์จาก GitHub"
        intro="รายการนี้คัดเฉพาะ repository สาธารณะที่เปิดดู source code ได้จริง กดที่การ์ดเพื่อดูรายละเอียด โค้ด และประวัติการพัฒนาบน GitHub"
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <a
              key={project.url}
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
            >
              <div className="h-1.5 w-full" style={{ background: project.accent }} aria-hidden="true" />
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-6 py-5">
                <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">Public repository</span>
                <span className="text-xs font-semibold" style={{ color: project.accent }}>{project.language}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-bold tracking-tight">{project.name}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-stone-600">{project.description}</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Tech stack</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {project.stack.map((item) => (
                    <li key={item} className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">{item}</li>
                  ))}
                </ul>
                <span className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-6 text-sm font-semibold" style={{ color: project.accent }}>
                  ดู repository บน GitHub <Arrow />
                </span>
              </div>
            </a>
          ))}
        </div>
        <p className="mt-6 text-sm text-stone-500">ดู repository ทั้งหมดได้ที่ <a href={profile.github} target="_blank" rel="noreferrer" className="font-semibold text-stone-800 underline underline-offset-4">GitHub profile</a></p>
      </Section>

      <Section id="about" eyebrow="เกี่ยวกับ" title="เกี่ยวกับผม" intro={profile.about}>
        <h3 className="mb-4 font-semibold">ทักษะ</h3>
        <dl className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profile.skillGroups.map((g) => (
            <div key={g.label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">{g.label}</dt>
              <dd className="mt-3">
                <ul className="flex flex-wrap gap-1.5">
                  {g.items.map((s) => (
                    <li key={s} className="rounded-md bg-stone-100 px-2 py-0.5 text-sm text-stone-700">{s}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
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
