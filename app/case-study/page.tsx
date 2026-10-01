import Link from "next/link";
import { profile } from "@/lib/profile";

export const metadata = { title: `Case study — ${profile.platformName}` };

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10">
    <h2 className="mb-3 text-xl font-bold">{title}</h2>
    <div className="space-y-3 text-neutral-700">{children}</div>
  </section>
);

export default function CaseStudy() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/" className="text-sm text-emerald-700 hover:underline">← Back</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Case study: {profile.platformName}</h1>
      <p className="mt-2 text-neutral-600">Solo-built exam-prep SaaS with paying users. Next.js · TypeScript · Supabase · Stripe · Twilio Verify</p>

      <Block title="The problem">
        <p>Exam candidates needed realistic timed practice, instant scoring and a way to pay locally (PromptPay) without a clunky checkout. {/* TODO: refine with real context */}</p>
      </Block>
      <Block title="What I built">
        <ul className="list-disc space-y-1.5 pl-5">
          {profile.proof.map((p) => <li key={p}>{p}</li>)}
          <li>Webhook-driven access control: product entitlements update the moment Stripe confirms payment</li>
        </ul>
      </Block>
      <Block title="Results">
        <p>Live in production, designed, built and operated by one developer. SMS costs reduced by moving OTP delivery to a local provider via a Supabase hook.</p>
        <p className="text-sm text-neutral-500">{/* TODO */}Add real numbers here: registered users, paying customers, uptime.</p>
      </Block>
      <Block title="Screenshots">
        <p className="text-sm text-neutral-500">TODO: add 3–4 images to /public/case-study (exam page, score result, payment page) and render them here.</p>
      </Block>
    </main>
  );
}
