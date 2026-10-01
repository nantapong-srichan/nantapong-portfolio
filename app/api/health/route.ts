import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const row = db().prepare("SELECT sqlite_version() AS v").get() as { v: string };
  return Response.json({ ok: true, sqlite: row.v });
}
