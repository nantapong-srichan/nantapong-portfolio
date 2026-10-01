import { openInvoiceQr } from "@/lib/db/invoice-dashboard";
import { handle, roleOf } from "../../../_http";

export const dynamic = "force-dynamic";

// Owner and staff may both open a QR for an unpaid invoice; the amount comes from the stored total.
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    roleOf(req);
    return openInvoiceQr((await ctx.params).id);
  });
}
