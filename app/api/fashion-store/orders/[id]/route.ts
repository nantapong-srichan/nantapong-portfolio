import { errorResponse, getPublicOrder } from "@/lib/db/fashion-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return Response.json({ order: getPublicOrder(id, request.headers.get("x-order-key")) });
  } catch (e) {
    return errorResponse(e);
  }
}
