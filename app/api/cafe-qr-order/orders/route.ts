import { listOrders, MAX_QTY, placeOrder, verifyTable } from "@/lib/db/cafe-qr-order";
import { bad, fail, readJson } from "../_http";

export const dynamic = "force-dynamic";

const forbid = (message: string) => Response.json({ error: message }, { status: 403 });
const isStaff = (req: Request) => ["staff", "admin"].includes(req.headers.get("x-demo-role") ?? "");

// Customers are scoped to the table of their verified token; the full list is for staff screens only.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("tableToken");
  if (token !== null) {
    const table = verifyTable(token);
    if (table === null) return forbid("QR ของโต๊ะไม่ถูกต้อง กรุณาสแกน QR ที่โต๊ะอีกครั้ง");
    return Response.json({ table, orders: listOrders(table) });
  }
  if (!isStaff(req)) return forbid("ต้องสแกน QR ที่โต๊ะเพื่อดูออเดอร์");
  return Response.json({ orders: listOrders() });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return bad("JSON body required");
  const table = verifyTable(body.tableToken);
  if (table === null) return forbid("ไม่พบ QR ของโต๊ะที่ถูกต้อง กรุณาสแกน QR ที่โต๊ะเพื่อสั่งอาหาร");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 40) return bad("items must be a non-empty array");

  const merged = new Map<string, number>();
  for (const raw of body.items as unknown[]) {
    const it = raw as { id?: unknown; qty?: unknown } | null;
    if (!it || typeof it.id !== "string" || it.id.length > 40 || !Number.isInteger(it.qty) || (it.qty as number) < 1 || (it.qty as number) > MAX_QTY) {
      return bad(`each item needs a string id and an integer qty 1-${MAX_QTY}`);
    }
    merged.set(it.id, (merged.get(it.id) ?? 0) + (it.qty as number));
  }
  if ([...merged.values()].some((q) => q > MAX_QTY)) return bad(`qty per item is limited to ${MAX_QTY}`);

  try {
    const order = placeOrder(table, [...merged].map(([id, qty]) => ({ id, qty })));
    return Response.json({ order }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
