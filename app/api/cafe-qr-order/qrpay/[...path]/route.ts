import { qrpay } from "@/lib/db/cafe-qr-order";
import { createQrRoutes } from "@/lib/qr-route-handlers";

export const dynamic = "force-dynamic";

const handlers = createQrRoutes(qrpay);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
