import { requireMemberId, respond, resumeSubscription } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => respond(() => resumeSubscription(requireMemberId(req)));
