import { createInvoice, HttpError, listInvoices, type NewInvoiceInput } from "@/lib/db/invoice-dashboard";
import { handle, readJson, roleOf } from "../_http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(() => {
    roleOf(req);
    return listInvoices();
  });
}

function parseNewInvoice(body: Record<string, unknown>): NewInvoiceInput {
  const customer = typeof body.customer === "string" ? body.customer.trim() : "";
  if (!customer || customer.length > 120) throw new HttpError(400, "กรุณาระบุชื่อลูกค้า (ไม่เกิน 120 ตัวอักษร)", "customer_invalid");
  const status = body.status ?? "draft";
  if (status !== "draft" && status !== "pending") throw new HttpError(400, "สถานะต้องเป็นฉบับร่างหรือรอชำระเท่านั้น (สถานะชำระแล้วต้องผ่านการยืนยันการชำระเงิน)", "status_invalid");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) throw new HttpError(400, "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ และไม่เกิน 50 รายการ", "items_invalid");
  const items = body.items.map((raw: unknown, n: number) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new HttpError(400, `รายการที่ ${n + 1} มีรูปแบบไม่ถูกต้อง`, "item_invalid");
    const it = raw as Record<string, unknown>;
    const qty = it.qty;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 100000) throw new HttpError(400, `จำนวนของรายการที่ ${n + 1} ต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 100,000`, "qty_invalid");
    if (typeof it.sku === "string" && it.sku !== "" && it.sku.length <= 40) return { sku: it.sku, qty };
    const description = typeof it.description === "string" ? it.description.trim() : "";
    if (!description || description.length > 200) throw new HttpError(400, `รายการที่ ${n + 1} ต้องเลือกสินค้าหรือระบุชื่อรายการ (ไม่เกิน 200 ตัวอักษร)`, "description_invalid");
    const unitPrice = it.unitPrice;
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0.01 || unitPrice > 10_000_000) throw new HttpError(400, `ราคาต่อหน่วยของรายการที่ ${n + 1} ต้องอยู่ระหว่าง 0.01 ถึง 10,000,000 บาท`, "unit_price_invalid");
    return { description, qty, unitPrice };
  });
  return { customer, status, items };
}

export function POST(req: Request) {
  return handle(async () => {
    roleOf(req);
    return createInvoice(parseNewInvoice(await readJson(req)));
  }, 201);
}
