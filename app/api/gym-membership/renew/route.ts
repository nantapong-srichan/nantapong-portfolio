import { renewPending, requireMemberId, respond } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => respond(() => renewPending(requireMemberId(req)));
