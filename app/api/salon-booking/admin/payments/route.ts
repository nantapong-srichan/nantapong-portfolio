import { adminPaymentTargets } from "@/lib/db/salon-booking";
import { qrErrorResponse, requireDemoAdmin } from "@/lib/qr-payments";
export const dynamic = "force-dynamic";

// GET (x-demo-role: admin) -> bookings awaiting a deposit, for the admin simulate/assign panels.
export async function GET(req: Request) {
  try {
    requireDemoAdmin(req);
    return Response.json({ bookings: adminPaymentTargets() });
  } catch (e) {
    return qrErrorResponse(e);
  }
}
