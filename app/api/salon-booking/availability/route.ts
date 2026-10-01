import { availability, errorResponse, isDate, openSlotCounts } from "@/lib/db/salon-booking";
export const dynamic = "force-dynamic";

// GET ?date=YYYY-MM-DD&service=ID&staff=ID  -> slots for that staff member
// GET ?dates=D1,D2,...&service=ID           -> open-slot totals per staff across dates
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const service = q.get("service") ?? "";
  try {
    const dates = q.get("dates");
    if (dates) {
      const list = dates.split(",");
      if (!service || list.length === 0 || list.length > 31 || !list.every(isDate)) {
        return Response.json({ error: "service and valid dates required" }, { status: 400 });
      }
      return Response.json({ counts: openSlotCounts(service, list) });
    }
    const date = q.get("date");
    const staff = q.get("staff") ?? "";
    if (!isDate(date) || !staff || !service) {
      return Response.json({ error: "date, staff and service required" }, { status: 400 });
    }
    return Response.json({ slots: availability(staff, date, service) });
  } catch (e) {
    return errorResponse(e);
  }
}
