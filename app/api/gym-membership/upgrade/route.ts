import { readBody, requireMemberId, respond, upgradeSubscription } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const POST = (req: Request) =>
  respond(async () => upgradeSubscription(requireMemberId(req), await readBody(req)));
