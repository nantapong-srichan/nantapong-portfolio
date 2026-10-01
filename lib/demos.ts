export type Demo = {
  slug: string;
  name: string;
  tagline: string;
  industry: string;
  stack: string[]; // Tech Stack: what this demo actually runs on
  productionStack: string[]; // Tech Stack I'd use in a real production build
  features: string[];
  payment: { summary: string; steps: string[] } | null; // how money flows in this demo
  accent: string; // tailwind-free hex, used for card accents
};

export const demos: Demo[] = [
  {
    slug: "cafe-qr-order",
    name: "Brew & Bean",
    tagline: "สั่งอาหารผ่าน QR ที่โต๊ะและจอแสดงออเดอร์ในครัวสำหรับคาเฟ่",
    industry: "คาเฟ่ / ร้านอาหาร",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "Polling 3 วินาที", "Thunder API (ตรวจสลิป)", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "Supabase Realtime", "Thunder API (ตรวจสลิป PromptPay)", "Tailwind CSS"],
    features: ["เมนู QR แยกตามโต๊ะ", "บอร์ดออเดอร์ในครัวแบบเรียลไทม์", "ชำระเงินด้วย QR พร้อมเพย์", "จัดการเมนูโดยผู้ดูแล"],
    payment: { summary: "โอน PromptPay เข้าบัญชีร้านโดยตรง แล้วระบบตรวจสลิปให้อัตโนมัติ", steps: ["ลูกค้าสั่งผ่าน QR ที่โต๊ะ ครัวทำอาหารเสร็จ", "ลูกค้าโอนเงินตามยอดบิลเข้าบัญชีร้าน", "แนบสลิปในหน้าเว็บ ระบบเทียบยอดและกันสลิปซ้ำ", "ออเดอร์เปลี่ยนเป็น 'ชำระแล้ว' ทันที"] },
    accent: "#b45309",
  },
  {
    slug: "salon-booking",
    name: "Studio Lumi",
    tagline: "ระบบจองคิวออนไลน์สำหรับร้านเสริมสวยหรือคลินิก",
    industry: "ร้านเสริมสวย / คลินิก",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "Transaction + UNIQUE constraint", "Thunder API (ตรวจสลิปมัดจำ)", "ThaiBulkSMS OTP", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase Auth", "Resend", "Thunder API", "ThaiBulkSMS OTP", "Tailwind CSS"],
    features: ["ช่วงเวลาว่างแยกตามช่าง", "อีเมลยืนยันการจอง", "ปฏิทินพนักงาน", "ชำระเงินมัดจำ"],
    payment: { summary: "ยืนยันเบอร์ด้วย OTP แล้วโอนมัดจำ 30% พร้อมตรวจสลิปอัตโนมัติ", steps: ["ลูกค้าเลือกบริการและเวลา แล้วยืนยันเบอร์ด้วย OTP (ThaiBulkSMS)", "โอนเงินมัดจำเข้าบัญชีร้าน", "แนบสลิป ระบบตรวจยอดและสลิปซ้ำ", "คิวเปลี่ยนเป็น 'ยืนยันแล้ว' และขึ้นในปฏิทินช่าง"] },
    accent: "#be185d",
  },
  {
    slug: "handmade-shop",
    name: "Baan Craft",
    tagline: "ร้านค้าออนไลน์สำหรับแบรนด์งานทำมือขนาดเล็ก",
    industry: "ร้านค้าออนไลน์",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "Admin เฉพาะสิทธิ์ + idempotent", "Thunder API (ตรวจสลิป)", "ThaiBulkSMS OTP", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "Thunder API (สลิป)", "PromptPay QR", "ThaiBulkSMS OTP", "Supabase Storage", "Webhooks", "Tailwind CSS"],
    features: ["แคตตาล็อกสินค้าและตัวเลือก", "ตะกร้าและชำระเงิน", "สถานะคำสั่งซื้อผ่าน Webhook", "ติดตามสต็อกสินค้า"],
    payment: { summary: "โอนเงินเข้าบัญชีร้านแล้วตรวจสลิปอัตโนมัติ ตัดสต็อกเมื่อชำระแล้วเท่านั้น", steps: ["ลูกค้ายืนยันเบอร์ด้วย OTP แล้วสั่งซื้อ (ราคาคิดฝั่งเซิร์ฟเวอร์)", "โอนเงินและแนบสลิป", "ระบบตรวจสลิปแล้วเปลี่ยนสถานะเป็น 'ชำระแล้ว' และตัดสต็อก", "ร้านกดจัดส่งจากหน้า Admin"] },
    accent: "#15803d",
  },
  {
    slug: "gym-membership",
    name: "IronPulse Fitness",
    tagline: "สมาชิก ตารางคลาส และการเก็บเงินรายเดือนสำหรับยิม",
    industry: "ยิม / สตูดิโอ",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "Transaction + ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์", "Thunder API (ตรวจสลิป)", "ThaiBulkSMS OTP", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "Thunder API (สลิป)", "PromptPay QR", "ThaiBulkSMS OTP", "Supabase Auth + RLS", "Tailwind CSS"],
    features: ["แพ็กเกจและการสมัครสมาชิก", "จองคลาสพร้อมจำกัดจำนวนที่นั่ง", "พอร์ทัลสมาชิก", "สิทธิ์ตามแพ็กเกจ"],
    payment: { summary: "ชำระค่าแพ็กเกจด้วยการโอนและตรวจสลิป สมาชิกเริ่มใช้งานหลังสลิปผ่าน", steps: ["สมัครและยืนยันเบอร์ด้วย OTP", "โอนค่าแพ็กเกจรายเดือนหรือรายปี", "แนบสลิป ระบบตรวจยอดและสลิปซ้ำ", "แพ็กเกจเปิดใช้งานและสิทธิ์จองคลาสถูกปลดล็อก"] },
    accent: "#dc2626",
  },
  {
    slug: "invoice-dashboard",
    name: "BizLedger",
    tagline: "ใบแจ้งหนี้ สต็อก และแดชบอร์ดยอดขายสำหรับ SME",
    industry: "SaaS ระบบหลังบ้าน",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "ตรวจสิทธิ์ตามบทบาทฝั่งเซิร์ฟเวอร์", "SVG chart", "Thunder API (ตรวจสลิป)", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "PostgreSQL", "สิทธิ์ตามบทบาท", "Recharts", "Thunder API (สลิป)", "Tailwind CSS"],
    features: ["สร้างใบแจ้งหนี้และดูแบบ PDF", "ระดับสต็อกและแจ้งเตือน", "กราฟยอดขาย", "สิทธิ์เจ้าของ / พนักงาน"],
    payment: { summary: "ลูกค้าโอนเงิน ร้านแนบสลิปเพื่อปิดใบแจ้งหนี้โดยตรวจกับยอดในระบบ", steps: ["ออกใบแจ้งหนี้ ระบบคำนวณ VAT 7% ฝั่งเซิร์ฟเวอร์", "ลูกค้าโอนเงินและส่งสลิป", "แนบสลิปในใบแจ้งหนี้ ระบบเทียบกับยอดรวมจริง", "ใบแจ้งหนี้เปลี่ยนเป็น 'ชำระแล้ว'"] },
    accent: "#2563eb",
  },
  {
    slug: "rental-listings",
    name: "Nest Rentals",
    tagline: "เว็บประกาศอสังหาริมทรัพย์และอพาร์ตเมนต์ พร้อมระบบจัดการคำถามจากลูกค้า",
    industry: "อสังหาริมทรัพย์",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "ตัวกรองฝั่งเซิร์ฟเวอร์", "ThaiBulkSMS OTP", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase Storage", "Server Actions", "ThaiBulkSMS OTP", "Tailwind CSS"],
    features: ["ค้นหาและตัวกรอง", "แกลเลอรีรายละเอียดประกาศ", "ฟอร์มสอบถามส่งเข้ากล่องข้อความผู้ดูแล", "แดชบอร์ดนายหน้า"],
    payment: null,
    accent: "#7c3aed",
  },
  {
    slug: "fashion-store",
    name: "Linen & Co.",
    tagline: "ร้านเสื้อผ้าออนไลน์ รับเงินเข้าบัญชีร้านโดยตรงด้วย PromptPay ตรวจรับเงินอัตโนมัติ",
    industry: "ร้านเสื้อผ้า / แฟชั่น",
    stack: ["Next.js", "TypeScript", "SQLite", "Route Handlers (REST API)", "PromptPay QR (EMVCo)", "Webhook + HMAC", "Thunder API (สลิปสำรอง)", "ThaiBulkSMS OTP", "Tailwind CSS"],
    productionStack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase Storage", "PromptPay QR", "Webhook รับเงินจากธนาคาร/ผู้ให้บริการ", "Thunder API", "ThaiBulkSMS OTP", "Tailwind CSS"],
    features: ["ตารางไซซ์และสีพร้อมสต็อกแยกตัวเลือก", "QR PromptPay แยกตามออเดอร์ ตรวจรับเงินอัตโนมัติ", "แนบสลิปเป็นทางสำรอง", "รับเงินเข้าบัญชีบริษัทหรือบุคคลก็ได้"],
    payment: { summary: "สแกน QR PromptPay ของออเดอร์ ระบบรับแจ้งเงินเข้าแล้วปิดออเดอร์เอง ไม่ต้องแนบสลิป (แนบสลิปได้เมื่อจำเป็น)", steps: ["ลูกค้ายืนยันเบอร์ด้วย OTP แล้วสั่งซื้อ ระบบสร้าง QR ที่มียอดและเลขอ้างอิงของออเดอร์", "ลูกค้าสแกนจ่ายเข้าบัญชีร้านโดยตรง (บริษัทหรือบุคคล)", "ธนาคารหรือผู้ให้บริการยิง webhook ที่ลงลายเซ็น ระบบตรวจลายเซ็น ยอด และเลขอ้างอิง", "ออเดอร์เปลี่ยนเป็น 'ชำระแล้ว' ภายในไม่กี่วินาที ถ้าไม่ได้รับแจ้ง ลูกค้าแนบสลิปแทนได้"] },
    accent: "#0f766e",
  },
];

export const getDemo = (slug: string) => demos.find((d) => d.slug === slug)!;
