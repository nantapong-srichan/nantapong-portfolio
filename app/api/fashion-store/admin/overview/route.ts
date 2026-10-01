import { adminOverview, errorResponse, requireAdmin } from "@/lib/db/fashion-store";

export const dynamic = "force-dynamic";

// The x-demo-role header is a demo stand-in for a real admin session.
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json(adminOverview());
  } catch (e) {
    return errorResponse(e);
  }
}
