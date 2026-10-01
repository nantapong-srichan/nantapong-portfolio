import { bookClass, cancelBooking, requireMemberId, respond } from "@/lib/db/gym-membership";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) =>
  respond(async () => bookClass(requireMemberId(req), (await params).id));

export const DELETE = (req: Request, { params }: Ctx) =>
  respond(async () => cancelBooking(requireMemberId(req), (await params).id));
