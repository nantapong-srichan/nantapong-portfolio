import { listCustomers } from "@/lib/db/invoice-dashboard";
import { handle, roleOf } from "../_http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(() => {
    roleOf(req);
    return listCustomers();
  });
}
