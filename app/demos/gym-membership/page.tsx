import type { Metadata } from "next";
import DemoShell from "@/components/DemoShell";
import GymApp from "./GymApp";

export const metadata: Metadata = {
  title: "IronPulse Fitness — สมาชิกและคลาสออกกำลังกาย",
  description: "เดโม: ระบบสมาชิกยิม จองคลาส และพอร์ทัลสมาชิก",
};

export default function Page() {
  return (
    <DemoShell slug="gym-membership">
      <GymApp />
    </DemoShell>
  );
}
