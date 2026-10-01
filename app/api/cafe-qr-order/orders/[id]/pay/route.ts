import { startPayment, verifyTable } from "@/lib/db/cafe-qr-order";
import { bad, fail, parseId } from "../../../_http";

export const dynamic = "force-dynamic";

// Creates (or resumes) the QR payment intent for the order total held in the DB. It never marks anything paid.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  if (id === null) return bad("invalid order id");
  // The signed table token is the customer's capability; the order must belong to that table.
  const table = verifyTable(req.headers.get("x-table-token"));
  if (table === null) return Response.json({ error: "QR ของโต๊ะไม่ถูกต้อง กรุณาสแกน QR ที่โต๊ะอีกครั้ง" }, { status: 403 });
  try {
    return Response.json({ order: startPayment(id, table) });
  } catch (e) {
    return fail(e);
  }
}
