import Link from "next/link";
import { getDemo } from "@/lib/demos";

// Wrap every demo page: shows a slim bar with the stack used. Demo UI goes inside.
export default function DemoShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const d = getDemo(slug);
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 bg-neutral-950 px-4 py-2 text-xs text-neutral-300">
        <Link href="/#work" className="font-medium text-white hover:underline">← Portfolio</Link>
        <span className="rounded bg-amber-400 px-1.5 py-0.5 font-semibold text-neutral-900">DEMO</span>
        <span>Stack:</span>
        {d.stack.map((s) => (
          <span key={s} className="rounded-full border border-neutral-700 px-2 py-0.5">{s}</span>
        ))}
      </div>
      {children}
    </div>
  );
}
