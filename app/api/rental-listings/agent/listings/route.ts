import { searchListings } from "@/lib/db/rental-listings";
import { requireAgent } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAgent(req);
  if (denied) return denied;
  return Response.json({ listings: searchListings({}, { includeUnpublished: true }) });
}
