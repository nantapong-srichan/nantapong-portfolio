import { requestOtp } from "@/lib/thaibulksms";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  if (typeof body?.phone !== "string") return Response.json({ error: "phone required" }, { status: 400 });
  // Behind a proxy (Vercel) the first x-forwarded-for entry is the client; without one the per-IP cap is skipped.
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const r = await requestOtp(body.phone, ip);
  if (!r.ok) return Response.json({ error: r.message }, { status: r.status });
  return Response.json({ token: r.token, refno: r.refno, sandbox: r.sandbox, devCode: r.devCode });
}
