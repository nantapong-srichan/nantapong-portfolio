import { cancelSubscription, requireMemberId, respond } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => respond(() => cancelSubscription(requireMemberId(req)));
