import { memberIdFrom, readBody, respond, subscribe } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const POST = (req: Request) =>
  respond(async () => subscribe(memberIdFrom(req), await readBody(req)));
