import DemoShell from "@/components/DemoShell";
import SalonApp from "./SalonApp";

export const metadata = { title: "Studio Lumi — จองคิวออนไลน์" };

export default function Page() {
  return (
    <DemoShell slug="salon-booking">
      <SalonApp />
    </DemoShell>
  );
}
