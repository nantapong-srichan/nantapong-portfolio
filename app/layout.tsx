import type { Metadata } from "next";
import "./globals.css";
import { profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: `${profile.name} — Full-Stack Developer`,
  description: profile.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
