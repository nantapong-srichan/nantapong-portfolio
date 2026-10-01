import type { Metadata } from "next";
import DemoShell from "@/components/DemoShell";
import GymApp from "./GymApp";

export const metadata: Metadata = {
  title: "IronPulse Fitness — Memberships & Classes",
  description: "Demo: gym memberships, class booking and member portal.",
};

export default function Page() {
  return (
    <DemoShell slug="gym-membership">
      <GymApp />
    </DemoShell>
  );
}
