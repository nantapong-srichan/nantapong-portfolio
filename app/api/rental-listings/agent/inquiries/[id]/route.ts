import { INQUIRY_STATUSES, setInquiryStatus, type InquiryStatus } from "@/lib/db/rental-listings";
import { requireAgent } from "../../_auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAgent(req);
  if (denied) return denied;
  const id = Number((await params).id);
  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (typeof body !== "object" || body === null || !(INQUIRY_STATUSES as readonly unknown[]).includes(body.status)) {
    return Response.json({ error: "สถานะต้องเป็น ใหม่ ติดต่อแล้ว หรือปิดแล้ว เท่านั้น", code: "status_invalid" }, { status: 400 });
  }
  const inquiry = Number.isInteger(id) ? setInquiryStatus(id, body.status as InquiryStatus) : null;
  if (!inquiry) return Response.json({ error: "ไม่พบข้อความสอบถามนี้", code: "inquiry_not_found" }, { status: 404 });
  return Response.json({ inquiry });
}
