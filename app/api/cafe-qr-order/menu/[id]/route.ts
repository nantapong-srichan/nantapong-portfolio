import { setAvailability } from "@/lib/db/cafe-qr-order";
import { bad, fail, readJson } from "../../_http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (req.headers.get("x-demo-role") !== "admin") {
    return Response.json({ error: "ต้องใช้สิทธิ์ผู้ดูแล" }, { status: 403 });
  }
  const body = await readJson(req);
  if (!body || typeof body.available !== "boolean") return bad("available must be a boolean");
  const { id } = await ctx.params;
  try {
    return Response.json({ item: setAvailability(id, body.available) });
  } catch (e) {
    return fail(e);
  }
}
