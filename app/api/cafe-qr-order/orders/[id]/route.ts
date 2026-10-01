import { advanceOrder, type OrderStatus } from "@/lib/db/cafe-qr-order";
import { bad, fail, parseId, readJson } from "../../_http";

export const dynamic = "force-dynamic";

const statuses: OrderStatus[] = ["new", "preparing", "ready", "paid"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!["staff", "admin"].includes(req.headers.get("x-demo-role") ?? "")) {
    return Response.json({ error: "staff role required" }, { status: 403 });
  }
  const id = parseId((await ctx.params).id);
  if (id === null) return bad("invalid order id");
  const body = await readJson(req);
  const status = body?.status;
  if (typeof status !== "string" || !statuses.includes(status as OrderStatus)) {
    return bad(`status must be one of ${statuses.join(", ")}`);
  }
  try {
    return Response.json({ order: advanceOrder(id, status as OrderStatus) });
  } catch (e) {
    return fail(e);
  }
}
