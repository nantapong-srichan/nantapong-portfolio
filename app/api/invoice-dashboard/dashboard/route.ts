import { dashboard } from "@/lib/db/invoice-dashboard";
import { handle, requireOwner } from "../_http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(() => {
    requireOwner(req);
    return dashboard();
  });
}
