import { listPlans, respond } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const GET = () => respond(() => ({ plans: listPlans() }));
