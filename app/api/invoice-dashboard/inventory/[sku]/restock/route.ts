import { HttpError, restock } from "@/lib/db/invoice-dashboard";
import { handle, readJson, roleOf } from "../../../_http";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: { params: Promise<{ sku: string }> }) {
  return handle(async () => {
    roleOf(req);
    const { qty } = await readJson(req);
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 100000) throw new HttpError(400, "จำนวนที่เติมต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 100,000", "qty_invalid");
    return restock((await ctx.params).sku, qty);
  });
}
