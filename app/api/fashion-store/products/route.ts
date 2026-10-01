import { errorResponse, listCatalog } from "@/lib/db/fashion-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(listCatalog());
  } catch (e) {
    return errorResponse(e);
  }
}
