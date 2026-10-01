import { listMenu } from "@/lib/db/cafe-qr-order";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ menu: listMenu() });
}
