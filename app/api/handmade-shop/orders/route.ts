import { isOtpVerified, normalizeMsisdn } from "@/lib/thaibulksms";
import { createOrder, errorResponse, listOrders, requireAdmin, ShopError } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

const MAX_LINES = 20;
const MAX_QTY = 20;

// Admin only; customers read their own orders through POST /orders/mine with per-order keys.
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json({ orders: listOrders() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null) throw new ShopError(400, "Body must be a JSON object");
    const { name, address, items, phone, otpToken } = body as Record<string, unknown>;

    if (typeof name !== "string" || !name.trim() || name.length > 120) throw new ShopError(400, "name is required (max 120 chars)");
    if (typeof address !== "string" || !address.trim() || address.length > 500) throw new ShopError(400, "address is required (max 500 chars)");
    if (typeof phone !== "string" || typeof otpToken !== "string") throw new ShopError(403, "phone and otpToken are required: verify your phone first");
    if (!isOtpVerified(otpToken, phone)) throw new ShopError(403, "Phone number is not OTP-verified");
    const msisdn = normalizeMsisdn(phone);
    if (!msisdn) throw new ShopError(400, "Invalid phone number");
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
      throw new ShopError(400, `items must be a list of 1-${MAX_LINES} lines`);
    }
    const parsed = items.map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      if (!Number.isInteger(it.variantId) || !Number.isInteger(it.qty) || (it.qty as number) < 1 || (it.qty as number) > MAX_QTY) {
        throw new ShopError(400, `each item needs an integer variantId and qty between 1 and ${MAX_QTY}`);
      }
      return { variantId: it.variantId as number, qty: it.qty as number };
    });

    // orderKey is shown only here; the customer's browser must keep it.
    const { order, orderKey } = createOrder({ name: name.trim(), address: address.trim(), phone: msisdn, items: parsed });
    return Response.json({ order, orderKey }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
