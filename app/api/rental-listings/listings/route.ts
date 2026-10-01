import { PROPERTY_TYPES, publishedAreas, searchListings } from "@/lib/db/rental-listings";

export const dynamic = "force-dynamic";

function intParam(sp: URLSearchParams, key: string): number | undefined | "bad" {
  const raw = sp.get(key);
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : "bad";
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const minPrice = intParam(sp, "minPrice");
  const maxPrice = intParam(sp, "maxPrice");
  const bedrooms = intParam(sp, "bedrooms");
  if (minPrice === "bad" || maxPrice === "bad" || bedrooms === "bad") {
    return Response.json({ error: "ราคาต่ำสุด ราคาสูงสุด และจำนวนห้องนอนต้องเป็นจำนวนเต็มที่ไม่ติดลบ", code: "filter_invalid" }, { status: 400 });
  }
  const type = sp.get("type") || undefined;
  if (type && !(PROPERTY_TYPES as readonly string[]).includes(type)) {
    return Response.json({ error: "ไม่รู้จักประเภทที่อยู่อาศัยนี้", code: "type_invalid" }, { status: 400 });
  }
  const listings = searchListings({ type, minPrice, maxPrice, bedrooms, area: sp.get("area") || undefined });
  return Response.json({ listings, areas: publishedAreas() });
}
