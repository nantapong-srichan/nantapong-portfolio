import { adminOpenCharges } from "@/lib/db/gym-membership";
import { qrErrorResponse, requireDemoAdmin } from "@/lib/qr-payments";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => {
  try {
    requireDemoAdmin(req);
    return Response.json(adminOpenCharges());
  } catch (e) {
    return qrErrorResponse(e);
  }
};
