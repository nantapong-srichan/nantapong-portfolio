import { errorResponse, qrpay, requireAdmin } from "@/lib/db/handmade-shop";
import { createQrRoutes } from "@/lib/qr-route-handlers";

export const dynamic = "force-dynamic";

const handlers = createQrRoutes(qrpay);

// Per-intent status and slip upload belong to the order's owner and go through /pay/<orderKey>/...;
// here they are admin-only so a leaked intent id alone grants nothing.
type Ctx = Parameters<typeof handlers.GET>[1];
const guarded = (handler: typeof handlers.GET) => async (request: Request, ctx: Ctx) => {
  try {
    if ((await ctx.params).path[0] === "intents") requireAdmin(request);
    return handler(request, ctx);
  } catch (e) {
    return errorResponse(e);
  }
};

export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);
export const PUT = handlers.PUT;
