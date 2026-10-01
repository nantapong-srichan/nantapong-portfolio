import { errorResponse, listCatalog } from "@/lib/db/handmade-shop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(listCatalog());
  } catch (e) {
    return errorResponse(e);
  }
}
