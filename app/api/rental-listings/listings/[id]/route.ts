import { getListing } from "@/lib/db/rental-listings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const listing = Number.isInteger(id) ? getListing(id) : null;
  if (!listing) return Response.json({ error: "ไม่พบประกาศนี้", code: "listing_not_found" }, { status: 404 });
  return Response.json({ listing });
}
