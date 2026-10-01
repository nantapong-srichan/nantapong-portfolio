import { busyRanges, dayCalendar, isDate } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";

// GET ?staff=ID&date=YYYY-MM-DD
//   public               -> { busy: [{ start, mins }] } time ranges only
//   x-demo-role: admin   -> { bookings } with client contact details (staff calendar)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const staff = q.get("staff") ?? "";
  const date = q.get("date");
  if (!staff || staff.length > 40 || !isDate(date)) return Response.json({ error: "staff and date required" }, { status: 400 });
  if (req.headers.get("x-demo-role") === "admin") return Response.json({ bookings: dayCalendar(staff, date) });
  return Response.json({ busy: busyRanges(staff, date) });
}
