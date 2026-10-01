import { isOtpVerified } from "@/lib/thaibulksms";
import { createBooking, errorResponse, isDate } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || Array.isArray(b)) return Response.json({ error: "invalid JSON" }, { status: 400 });
  const { staffId, serviceId, date, start, name, phone, email, note, otpToken } = b;
  if (typeof staffId !== "string" || typeof serviceId !== "string" || !isDate(date) || typeof start !== "number" || !Number.isInteger(start)) {
    return Response.json({ error: "staffId, serviceId, date and start are required" }, { status: 400 });
  }
  if (typeof name !== "string" || name.trim().length < 2) return Response.json({ error: "name required" }, { status: 400 });
  if (typeof phone !== "string" || !/^[0-9+\-\s]{9,}$/.test(phone)) return Response.json({ error: "valid phone required" }, { status: 400 });
  if (typeof email !== "string" || !/\S+@\S+\.\S+/.test(email)) return Response.json({ error: "valid email required" }, { status: 400 });
  if (typeof otpToken !== "string" || !isOtpVerified(otpToken, phone)) {
    return Response.json({ error: "ต้องยืนยันเบอร์โทรด้วย OTP ก่อนจอง" }, { status: 403 });
  }
  try {
    const { booking, accessKey } = createBooking({
      staffId, serviceId, date, start, client: name.trim().slice(0, 80), phone, email: email.trim().slice(0, 120),
      note: typeof note === "string" ? note.slice(0, 300) : "",
    }, phone);
    return Response.json({ booking, accessKey }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
