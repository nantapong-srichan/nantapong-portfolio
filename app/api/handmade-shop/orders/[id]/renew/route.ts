import { errorResponse, renewPayment } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

// Re-issues a QR for an unpaid order whose previous one expired. Never marks anything paid.
// Requires the per-order key (x-order-key) returned when the order was created.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return Response.json({ order: renewPayment(id, request.headers.get("x-order-key")) });
  } catch (e) {
    return errorResponse(e);
  }
}
