import { isOtpVerified, normalizeMsisdn } from "@/lib/thaibulksms";
import { createInquiry, getListing } from "@/lib/db/rental-listings";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const parsed: unknown = await req.json().catch(() => null);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Response.json({ error: "ข้อมูลที่ส่งมาต้องเป็น JSON object", code: "body_invalid" }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const listingId = Number(body.listingId);
  const name = str("name");
  const phoneRaw = str("phone");
  const phone = normalizeMsisdn(phoneRaw);
  const otpToken = str("otpToken");
  const email = str("email");
  const message = str("message");

  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) errors.name = "กรุณากรอกชื่อ 2-100 ตัวอักษร";
  if (!phone) errors.phone = "กรุณากรอกเบอร์มือถือไทย เช่น 0812345678";
  if (!EMAIL.test(email) || email.length > 200) errors.email = "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@example.com";
  if (message.length < 5 || message.length > 1000) errors.message = "กรุณากรอกข้อความ 5-1000 ตัวอักษร";
  if (!Number.isInteger(listingId)) errors.listingId = "ไม่พบประกาศที่ต้องการสอบถาม";
  if (Object.keys(errors).length > 0) return Response.json({ error: "กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง", code: "validation_failed", errors }, { status: 400 });

  // Unpublished listings are not visible publicly, so they cannot receive inquiries.
  // Checked before the OTP so a missing listing does not burn an OTP use.
  if (!getListing(listingId)) return Response.json({ error: "ไม่พบประกาศนี้", code: "listing_not_found" }, { status: 404 });

  // Verification is checked server-side; the client flag is never trusted.
  if (!phone || !otpToken || !isOtpVerified(otpToken, phone)) {
    return Response.json({ error: "กรุณายืนยันเบอร์โทรด้วย OTP ก่อนส่งข้อความ", code: "phone_not_verified" }, { status: 403 });
  }

  const inquiry = createInquiry({ listingId, name, phone, email, message }, true);
  return Response.json({ inquiry }, { status: 201 });
}
