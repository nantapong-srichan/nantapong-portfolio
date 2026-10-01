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
  { id: "basic", name: "Basic", monthly: 990, rank: 1, tagline: "ฟิตเนสเต็มรูปแบบ เริ่มต้นง่ายๆ", perks: ["Gym floor 6:00-22:00", "Standard classes", "Locker room"] },
  { id: "plus", name: "Plus", monthly: 1590, rank: 2, tagline: "คลาสพรีเมียมไม่อั้น", perks: ["Everything in Basic", "Premium classes (HIIT, Boxing)", "2 guest passes / month"] },
  { id: "elite", name: "Elite", monthly: 2490, rank: 3, tagline: "ดูแลครบ พร้อมเทรนเนอร์", perks: ["Everything in Plus", "24/7 access", "1 PT session / month", "Sauna & recovery zone"] },
];

export const YEARLY_DISCOUNT = 0.2;

export function priceFor(plan: Plan, billing: Billing): number {
  return billing === "monthly" ? plan.monthly : Math.round(plan.monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface GymClass {
  id: string;
  day: (typeof DAYS)[number];
  time: string;
  name: string;
  coach: string;
  emoji: string;
  capacity: number;
  booked: number;
  minPlan: PlanId;
}

export const CLASSES: GymClass[] = [
  { id: "c1", day: "Mon", time: "07:00", name: "Morning Yoga", coach: "Coach Mai", emoji: "🧘", capacity: 20, booked: 14, minPlan: "basic" },
  { id: "c2", day: "Mon", time: "18:30", name: "HIIT Burn", coach: "Coach Tan", emoji: "🔥", capacity: 16, booked: 15, minPlan: "plus" },
  { id: "c3", day: "Tue", time: "12:15", name: "Core Express", coach: "Coach Ploy", emoji: "💪", capacity: 18, booked: 9, minPlan: "basic" },
  { id: "c4", day: "Tue", time: "19:00", name: "Boxing Fundamentals", coach: "Coach Beam", emoji: "🥊", capacity: 12, booked: 12, minPlan: "plus" },
  { id: "c5", day: "Wed", time: "07:00", name: "Spin Ride", coach: "Coach Nok", emoji: "🚴", capacity: 24, booked: 18, minPlan: "basic" },
  { id: "c6", day: "Wed", time: "19:30", name: "Strength Lab", coach: "Coach Tan", emoji: "🏋️", capacity: 14, booked: 7, minPlan: "plus" },
  { id: "c7", day: "Thu", time: "18:00", name: "Zumba Night", coach: "Coach Ploy", emoji: "💃", capacity: 30, booked: 22, minPlan: "basic" },
  { id: "c8", day: "Fri", time: "17:30", name: "Elite Performance", coach: "Coach Beam", emoji: "⚡", capacity: 8, booked: 5, minPlan: "elite" },
  { id: "c9", day: "Sat", time: "09:00", name: "Boot Camp", coach: "Coach Tan", emoji: "🪖", capacity: 20, booked: 19, minPlan: "plus" },
  { id: "c10", day: "Sun", time: "10:00", name: "Stretch & Restore", coach: "Coach Mai", emoji: "🌿", capacity: 20, booked: 6, minPlan: "basic" },
];
