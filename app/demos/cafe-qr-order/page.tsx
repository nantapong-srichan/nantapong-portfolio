import DemoShell from "@/components/DemoShell";
import { verifyTable } from "@/lib/db/cafe-qr-order";
import CafeApp from "./CafeApp";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const table = token ? verifyTable(token) : null;
  return (
    <DemoShell slug="cafe-qr-order">
      <CafeApp table={table} tableToken={table ? token : null} />
    </DemoShell>
  );
}
