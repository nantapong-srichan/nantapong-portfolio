import { assertIntentKey, errorResponse, qrpay } from "@/lib/db/handmade-shop";
import { intentGet, slipPost } from "@/lib/qr-route-handlers";

export const dynamic = "force-dynamic";

// Customer-side payment endpoints. The shared QR panel cannot send custom headers, so the per-order key
// travels as a path segment: /api/handmade-shop/pay/<orderKey>/intents/<intentId>[/slip].
type Ctx = { params: Promise<{ key: string; path: string[] }> };

async function authorise(ctx: Ctx, tail: "status" | "slip") {
  const { key, path } = await ctx.params;
  const shapeOk = path[0] === "intents" && path.length === (tail === "slip" ? 3 : 2) && (tail === "status" || path[2] === "slip");
  if (!shapeOk) return null;
  assertIntentKey(path[1], key);
  return path[1];
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const intentId = await authorise(ctx, "status");
    if (!intentId) return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });
    return intentGet(qrpay)(request, [intentId]);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const intentId = await authorise(ctx, "slip");
    if (!intentId) return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });
    return slipPost(qrpay)(request, [intentId]);
  } catch (e) {
    return errorResponse(e);
  }
}
