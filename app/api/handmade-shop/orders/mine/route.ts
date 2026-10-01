import { errorResponse, listOrdersForCustomer, ShopError } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

const MAX_ORDERS = 30;

// Customer "my orders": body { orders: [{ id, key }] }; only entries whose key verifies are returned.
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null) throw new ShopError(400, "Body must be a JSON object");
    const list = (body as { orders?: unknown }).orders;
    if (!Array.isArray(list) || list.length > MAX_ORDERS) throw new ShopError(400, `orders must be a list of at most ${MAX_ORDERS} entries`);
    const creds = list.flatMap((c) => {
      const e = (c ?? {}) as Record<string, unknown>;
      return typeof e.id === "string" && typeof e.key === "string" ? [{ id: e.id, key: e.key }] : [];
    });
    return Response.json({ orders: listOrdersForCustomer(creds) });
  } catch (e) {
    return errorResponse(e);
  }
}
