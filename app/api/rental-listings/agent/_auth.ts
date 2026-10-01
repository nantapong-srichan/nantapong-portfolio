// Demo-grade role check: real deployments would verify a session instead of a header.
export function requireAgent(req: Request): Response | null {
  return req.headers.get("x-demo-role") === "agent"
    ? null
    : Response.json({ error: "ต้องใช้บทบาทนายหน้าเท่านั้น (x-demo-role: agent)", code: "forbidden" }, { status: 403 });
}
