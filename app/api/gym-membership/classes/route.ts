import { listClasses, memberIdFrom, respond } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => respond(() => ({ classes: listClasses(memberIdFrom(req)) }));
