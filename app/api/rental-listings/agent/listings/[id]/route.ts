import { getListing, setPublished } from "@/lib/db/rental-listings";
import { requireAgent } from "../../_auth";

export const dynamic = "force-dynamic";

// Body { published: boolean } sets the flag; an empty body toggles it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAgent(req);
  if (denied) return denied;
  const id = Number((await params).id);
  const current = Number.isInteger(id) ? getListing(id, { includeUnpublished: true }) : null;
  if (!current) return Response.json({ error: "ไม่พบประกาศนี้", code: "listing_not_found" }, { status: 404 });

  const text = await req.text();
  let parsed: unknown = {};
  if (text.trim() !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json({ error: "รูปแบบ JSON ไม่ถูกต้อง", code: "json_invalid" }, { status: 400 });
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Response.json({ error: "ข้อมูลที่ส่งมาต้องเป็น JSON object", code: "body_invalid" }, { status: 400 });
  }
  const body = parsed as { published?: unknown };
  if (body.published !== undefined && typeof body.published !== "boolean") {
    return Response.json({ error: "ค่าสถานะเผยแพร่ต้องเป็นจริงหรือเท็จ", code: "published_invalid" }, { status: 400 });
  }
  const next = body.published ?? !current.published;
  return Response.json({ listing: setPublished(id, next) });
}
