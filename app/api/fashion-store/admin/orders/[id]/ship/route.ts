import { errorResponse, requireAdmin, shipOrder } from "@/lib/db/fashion-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await ctx.params;
    return Response.json(shipOrder(id));
  } catch (e) {
    return errorResponse(e);
  }
}
