export type PlanId = "basic" | "plus" | "elite";
export type Billing = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  tagline: string;
  perks: string[];
  rank: number;
}

export const PLANS: Plan[] = [
  { id: "basic", name: "Basic", monthly: 990, rank: 1, tagline: "ฟิตเนสเต็มรูปแบบ เริ่มต้นง่ายๆ", perks: ["ฟิตเนสเปิด 6:00-22:00 น.", "คลาสมาตรฐาน", "ห้องล็อกเกอร์"] },
  { id: "plus", name: "Plus", monthly: 1590, rank: 2, tagline: "คลาสพรีเมียมไม่อั้น", perks: ["ครบทุกอย่างใน Basic", "คลาสพรีเมียม (HIIT, มวย)", "บัตรผู้เยี่ยมชม 2 ใบ/เดือน"] },
  { id: "elite", name: "Elite", monthly: 2490, rank: 3, tagline: "ดูแลครบ พร้อมเทรนเนอร์", perks: ["ครบทุกอย่างใน Plus", "เข้าใช้ได้ 24 ชม.", "เทรนเนอร์ส่วนตัว 1 ครั้ง/เดือน", "ซาวน่าและโซนฟื้นฟูร่างกาย"] },
];

export const YEARLY_DISCOUNT = 0.2;

export function priceFor(plan: Plan, billing: Billing): number {
  return billing === "monthly" ? plan.monthly : Math.round(plan.monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export const DAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] as const;

export interface GymClass {
  id: string;
  day: (typeof DAYS)[number];
  time: string;
  name: string;
  coach: string;
  image: string;
  capacity: number;
  /** Seats already taken by other members (demo baseline). */
  baseBooked: number;
  minPlan: PlanId;
}

export const CLASSES: GymClass[] = [
  { id: "c1", day: "จ.", time: "07:00", name: "โยคะยามเช้า", coach: "โค้ชไหม", image: "yoga", capacity: 20, baseBooked: 14, minPlan: "basic" },
  { id: "c2", day: "จ.", time: "18:30", name: "HIIT เผาผลาญ", coach: "โค้ชตาล", image: "hiit", capacity: 16, baseBooked: 15, minPlan: "plus" },
  { id: "c3", day: "อ.", time: "12:15", name: "คอร์เอ็กซ์เพรส", coach: "โค้ชพลอย", image: "core", capacity: 18, baseBooked: 9, minPlan: "basic" },
  { id: "c4", day: "อ.", time: "19:00", name: "มวยพื้นฐาน", coach: "โค้ชบีม", image: "trainer-beam", capacity: 12, baseBooked: 12, minPlan: "plus" },
  { id: "c5", day: "พ.", time: "07:00", name: "สปินไบค์", coach: "โค้ชนก", image: "cardio", capacity: 24, baseBooked: 18, minPlan: "basic" },
  { id: "c6", day: "พ.", time: "19:30", name: "สร้างความแข็งแรง", coach: "โค้ชตาล", image: "weights", capacity: 14, baseBooked: 7, minPlan: "plus" },
  { id: "c7", day: "พฤ.", time: "18:00", name: "ซุมบ้าไนท์", coach: "โค้ชพลอย", image: "class", capacity: 30, baseBooked: 22, minPlan: "basic" },
  { id: "c8", day: "ศ.", time: "17:30", name: "Elite สมรรถภาพสูง", coach: "โค้ชบีม", image: "elite", capacity: 8, baseBooked: 5, minPlan: "elite" },
  { id: "c9", day: "ส.", time: "09:00", name: "บูตแคมป์", coach: "โค้ชตาล", image: "bootcamp", capacity: 20, baseBooked: 19, minPlan: "plus" },
  { id: "c10", day: "อา.", time: "10:00", name: "ยืดเหยียดและฟื้นฟู", coach: "โค้ชไหม", image: "yoga", capacity: 20, baseBooked: 6, minPlan: "basic" },
];
