import { HttpError, type Role } from "@/lib/db/invoice-dashboard";

export function roleOf(req: Request): Role {
  const role = req.headers.get("x-demo-role");
  if (role !== "owner" && role !== "staff") throw new HttpError(401, "ไม่พบ header x-demo-role หรือค่าไม่ถูกต้อง", "unauthorized");
  return role;
}

export function requireOwner(req: Request) {
  if (roleOf(req) !== "owner") throw new HttpError(403, "ต้องใช้บทบาทเจ้าของร้านเท่านั้น", "forbidden");
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, "ข้อมูลที่ส่งมาต้องเป็น JSON object", "body_invalid");
}

export function handle(fn: () => unknown | Promise<unknown>, okStatus = 200) {
  return Promise.resolve()
    .then(fn)
    .then((data) => (data === undefined ? new Response(null, { status: 204 }) : Response.json(data, { status: okStatus })))
    .catch((e: unknown) => {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status });
      console.error(e);
      return Response.json({ error: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง", code: "internal" }, { status: 500 });
    });
}
