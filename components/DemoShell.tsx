import Link from "next/link";
import { getDemo } from "@/lib/demos";

// Wrap every demo page: one slim bar (back link, demo badge, this demo's stack) with a collapsible production stack.
// Bar height is exposed as --demo-shell-h (2.25rem from sm, where it is sticky) so a page's own sticky header can use top-[var(--demo-shell-h)].
// The production stack opens as an overlay panel so the bar never grows and never pushes content.
export default function DemoShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const d = getDemo(slug);
  return (
    <div className="min-h-screen bg-white text-neutral-900 [--demo-shell-h:2.25rem]">
      <div className="relative z-50 border-b border-neutral-800 bg-neutral-950 text-xs text-neutral-300 sm:sticky sm:top-0">
        <div className="relative mx-auto flex min-h-11 items-center gap-2 px-3 sm:h-9 sm:min-h-0 sm:px-4">
          <Link href="/#work" className="-ml-1 flex min-h-11 shrink-0 items-center rounded px-1 font-medium text-white hover:underline focus-visible:outline-2 focus-visible:outline-amber-300 sm:min-h-0">
            <span aria-hidden="true">←</span>&nbsp;พอร์ตโฟลิโอ
          </Link>
          <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 font-semibold leading-none text-neutral-900">เดโม</span>
          <span className="hidden shrink-0 text-neutral-500 md:inline" aria-hidden="true">|</span>
          <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:flex whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Tech Stack (เดโมนี้)">
            <span className="hidden shrink-0 font-semibold text-white md:inline">Tech Stack:</span>
            {d.stack.map((s) => (
              <span key={s} className="shrink-0 rounded-full border border-neutral-600 px-2 py-0.5 leading-none text-neutral-200">{s}</span>
            ))}
          </div>
          <details className="group ml-auto shrink-0 sm:ml-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded px-1.5 font-semibold text-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300 sm:min-h-0 sm:py-1">
              <span className="sm:hidden">Tech Stack</span><span className="hidden sm:inline">งานจริง</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="absolute inset-x-0 top-full border-b border-neutral-800 bg-neutral-950 px-3 pb-3 pt-2 shadow-lg sm:px-4">
              <div className="mb-2 sm:hidden">
                <p className="mb-1.5 font-semibold text-white">Tech Stack (เดโมนี้)</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.stack.map((s) => (
                    <span key={s} className="rounded-full border border-neutral-600 px-2 py-0.5 text-neutral-200">{s}</span>
                  ))}
                </div>
              </div>
              <p className="mb-1.5 font-semibold text-white">Tech Stack (งานจริง)</p>
              <div className="flex flex-wrap gap-1.5">
                {d.productionStack.map((s) => (
                  <span key={s} className="rounded-full border border-neutral-700 px-2 py-0.5 text-neutral-300">{s}</span>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
      {children}
    </div>
  );
}
