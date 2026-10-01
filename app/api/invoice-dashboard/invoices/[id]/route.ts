import { deleteInvoice, getInvoice, HttpError, setInvoiceStatus, type InvoiceStatus } from "@/lib/db/invoice-dashboard";
import { handle, readJson, requireOwner, roleOf } from "../../_http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    roleOf(req);
    return getInvoice((await ctx.params).id);
  });
}

export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    roleOf(req);
    const { status } = await readJson(req);
    if (status === "paid") throw new HttpError(403, "สถานะชำระแล้วตั้งได้เฉพาะเมื่อมีการยืนยันการชำระเงิน (webhook ของ QR สลิปที่ตรวจแล้ว หรือเจ้าของร้านผูกยอดเอง)", "paid_forbidden");
    if (status !== "pending" && status !== "overdue") throw new HttpError(400, "สถานะต้องเป็นรอชำระหรือเกินกำหนดเท่านั้น", "status_invalid");
    return setInvoiceStatus((await ctx.params).id, status as InvoiceStatus);
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    requireOwner(req);
    deleteInvoice((await ctx.params).id);
  });
}
