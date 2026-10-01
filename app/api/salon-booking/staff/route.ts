import { listStaff } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ staff: listStaff() });
}
