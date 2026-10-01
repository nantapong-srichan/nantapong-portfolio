import { errorResponse, retryDeposit } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";

// POST (x-booking-key) -> after the QR expired, re-claim the slot (409 if someone else took it) and issue a new QR.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return Response.json({ booking: retryDeposit((await ctx.params).id, req.headers.get("x-booking-key")) });
  } catch (e) {
    return errorResponse(e);
  }
}
