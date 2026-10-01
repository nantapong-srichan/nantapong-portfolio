import type { Metadata } from "next";
import { getDemo } from "@/lib/demos";

const d = getDemo("rental-listings");
export const metadata: Metadata = { title: `${d.name} | ${d.industry}`, description: d.tagline };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
