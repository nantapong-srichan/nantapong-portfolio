import { errorResponse, requireAdmin, shipOrder } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

// The x-demo-role header is a demo stand-in for a real admin session.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await ctx.params;
    const out = shipOrder(id);
    return Response.json({ duplicate: out.duplicate, result: out.result }, { status: out.status });
  } catch (e) {
    return errorResponse(e);
  }
}
