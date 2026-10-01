import { qrErrorResponse, QrPayError } from "@/lib/qr-payments";
import { ConflictError, NotFoundError } from "@/lib/db/cafe-qr-order";

export const bad = (message: string) => Response.json({ error: message }, { status: 400 });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Maps domain errors to HTTP statuses; anything else is a real 500.
export function fail(e: unknown): Response {
  if (e instanceof ConflictError) return Response.json({ error: e.message }, { status: 409 });
  if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404 });
  if (e instanceof QrPayError) return qrErrorResponse(e);
  throw e;
}

export const parseId = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null);
