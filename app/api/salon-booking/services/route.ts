import { listServices } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ services: listServices() });
}
