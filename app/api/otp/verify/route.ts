import { verifyOtp } from "@/lib/thaibulksms";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { token?: string; pin?: string } | null;
  if (typeof b?.token !== "string" || typeof b?.pin !== "string") return Response.json({ error: "token and pin required" }, { status: 400 });
  const r = await verifyOtp(b.token, b.pin);
  if (!r.ok) return Response.json({ error: r.message }, { status: r.status });
  return Response.json({ verified: true });
}
