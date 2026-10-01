import Link from "next/link";
import { demos } from "@/lib/demos";
import { profile } from "@/lib/profile";

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-5xl px-5 py-14">
    <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
    {children}
  </section>
);

export default function Home() {
  return (
    <main>
      <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold">{profile.name}</span>
          <div className="flex gap-5 text-neutral-600">
            <a href="#work" className="hover:text-black">Work</a>
            <a href="#about" className="hover:text-black">About</a>
            <a href="#experience" className="hover:text-black">Experience</a>
            <a href="#contact" className="hover:text-black">Contact</a>
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-5xl px-5 pb-10 pt-20">
        <p className="mb-3 text-sm font-medium text-emerald-700">Open to freelance projects · GMT+7</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{profile.headline}</h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-600">{profile.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#work" className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">See my work</a>
          <a href={`mailto:${profile.email}`} className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-white">Email me</a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-2">
          {profile.skills.map((s) => (
            <li key={s} className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700">{s}</li>
          ))}
        </ul>
      </header>

      <Section id="featured" title="Featured: production platform">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h3 className="text-lg font-semibold">{profile.platformName}</h3>
          <p className="mt-2 text-neutral-600">Designed, built and run solo. Real users pay to use it.</p>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-neutral-700">
            {profile.proof.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/case-study" className="font-medium text-emerald-700 hover:underline">Read the case study →</Link>
            {profile.platformUrl && <a href={profile.platformUrl} className="font-medium hover:underline">Visit live site ↗</a>}
          </div>
        </div>
      </Section>

      <Section id="work" title="Sample builds for small businesses">
        <p className="-mt-3 mb-6 max-w-2xl text-neutral-600">
          Interactive demos with mock data. Each one lists the stack I would use in production.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <Link key={d.slug} href={`/demos/${d.slug}`} className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="mb-4 h-1.5 w-12 rounded-full" style={{ background: d.accent }} />
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{d.industry}</span>
              <h3 className="mt-1 text-lg font-semibold">{d.name}</h3>
              <p className="mt-1 text-sm text-neutral-600">{d.tagline}</p>
              <ul className="mt-3 space-y-1 text-sm text-neutral-700">
                {d.features.map((f) => <li key={f}>· {f}</li>)}
              </ul>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.stack.map((s) => (
                  <span key={s} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{s}</span>
                ))}
              </div>
              <span className="mt-auto pt-4 text-sm font-medium group-hover:underline" style={{ color: d.accent }}>Open demo →</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="about" title="About">
        <p className="max-w-3xl text-neutral-700">{profile.about}</p>
        <h3 className="mb-3 mt-8 font-semibold">What I can build for you</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {profile.services.map((s) => (
            <li key={s} className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">→ {s}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-neutral-600">
          I work in your time zone overlap, give regular progress updates, and hand over clean, documented code.
        </p>
      </Section>

      <Section id="experience" title="Experience">
        <div className="space-y-6">
          {profile.experience.map((e) => (
            <div key={e.role + e.org}>
              <h3 className="font-semibold">{e.role} · <span className="font-normal text-neutral-600">{e.org}</span></h3>
              <p className="text-sm text-neutral-500">{e.period}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700">
                {e.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="font-semibold">Education</h3>
            <p className="text-neutral-700">{profile.education}</p>
          </div>
        </div>
      </Section>

      <Section id="contact" title="Let's talk">
        <p className="max-w-2xl text-neutral-700">Message me or email. Happy to do a short call to scope your project.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
          <a href={`mailto:${profile.email}`} className="text-emerald-700 hover:underline">{profile.email}</a>
          <a href={profile.github} className="hover:underline">GitHub</a>
          {profile.linkedin && <a href={profile.linkedin} className="hover:underline">LinkedIn</a>}
        </div>
      </Section>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} {profile.name} · Built with Next.js, TypeScript & Tailwind CSS
      </footer>
    </main>
  );
}
