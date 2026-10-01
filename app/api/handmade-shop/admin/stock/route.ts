import { adminStock, errorResponse, requireAdmin } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json(adminStock());
  } catch (e) {
    return errorResponse(e);
  }
}
