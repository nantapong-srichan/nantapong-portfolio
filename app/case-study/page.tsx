import Link from "next/link";
import { profile } from "@/lib/profile";

export const metadata = { title: `กรณีศึกษา — ${profile.platformName}` };

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-12 border-t border-stone-200 pt-8">
    <h2 className="mb-4 text-xl font-bold tracking-tight">{title}</h2>
    <div className="space-y-3 text-[15px] leading-relaxed text-stone-700 sm:text-base">{children}</div>
  </section>
);

export default function CaseStudy() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:underline">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4L3 8l4 4" /></svg>
        กลับหน้าแรก
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">กรณีศึกษา</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{profile.platformName}</h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">SaaS ทำข้อสอบ มีผู้ใช้งานจริง</p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tech Stack">
        {["Next.js", "TypeScript", "Supabase", "Stripe", "ThaiBulkSMS", "Thunder API"].map((s) => (
          <li key={s} className="rounded-md border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700">{s}</li>
        ))}
      </ul>

      <Block title="ปัญหา">
        <p>ผู้สอบต้องการฝึกทำข้อสอบจับเวลาเสมือนจริง ตรวจคะแนนทันที และชำระเงินด้วยวิธีที่คุ้นเคย (พร้อมเพย์) โดยไม่ต้องผ่านขั้นตอนที่ยุ่งยาก {/* TODO: refine with real context */}</p>
      </Block>
      <Block title="สิ่งที่ผมสร้าง">
        <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
          {profile.proof.map((p) => <li key={p}>{p}</li>)}
          <li>ควบคุมสิทธิ์การเข้าถึงด้วย Webhook: สิทธิ์ใช้งานสินค้าอัปเดตทันทีที่แนบสลิปยืนยันการชำระเงินผ่าน ThunderApi และ ให้ Stripe เป็นทางเลือกสำรองสำหรับทีมงานเมื่อตัว API หลักมีปัญหา</li>
        </ul>
      </Block>
      <Block title="ผลลัพธ์">
        <p>เปิดใช้งานจริงแล้ว ออกแบบ พัฒนา และดูแลโดยนักพัฒนาคนเดียว ลดค่า SMS ด้วยการย้ายการส่ง OTP ไปใช้ผู้ให้บริการในประเทศผ่าน Supabase hook</p>
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-stone-500">{/* TODO */}เพิ่มตัวเลขจริงตรงนี้: จำนวนผู้ใช้ที่ลงทะเบียน ลูกค้าที่จ่ายเงิน และ uptime</p>
      </Block>
      <Block title="ภาพหน้าจอ">
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-stone-500">TODO: เพิ่มรูป 3–4 รูปใน /public/case-study (หน้าสอบ ผลคะแนน หน้าชำระเงิน) แล้วแสดงที่นี่</p>
      </Block>
    </main>
  );
}
