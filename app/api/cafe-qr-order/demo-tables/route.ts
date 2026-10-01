import { signTable, TABLE_COUNT } from "@/lib/db/cafe-qr-order";
import { sandboxEnabled } from "@/lib/sandbox";

export const dynamic = "force-dynamic";

// DEMO ONLY: hands out signed table tokens so portfolio visitors can simulate scanning a table sticker.
// Real tables would have their QR printed once; this route must not exist in a real deployment.
export async function GET() {
  if (!sandboxEnabled() && process.env.CAFE_DEMO_LAUNCHER !== "1") {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => ({ table: i + 1, token: signTable(i + 1) }));
  return Response.json({ tables });
}
