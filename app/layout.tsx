import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { profile } from "@/lib/profile";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: `${profile.name} — นักพัฒนาเว็บ Full-Stack`,
  description: profile.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`scroll-smooth ${notoThai.variable}`}>
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
