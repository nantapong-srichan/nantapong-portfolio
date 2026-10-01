import { errorResponse, getBookingFresh } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";

// GET (x-booking-key) -> the owner's view of the booking (status after hold expiry / payment).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return Response.json({ booking: getBookingFresh((await ctx.params).id, req.headers.get("x-booking-key")) });
  } catch (e) {
    return errorResponse(e);
  }
}
