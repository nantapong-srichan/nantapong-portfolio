import { db } from "@/lib/db";
import { sandboxEnabled } from "@/lib/sandbox";

// Thunder API slip verification (https://thunder.in.th). Server-only.
// With THUNDER_API_KEY set: calls the real API. Without it: only while the sandbox is enabled
// (lib/sandbox.ts) any image is accepted and the expected amount echoed, flagged `sandbox: true`;
// otherwise slip checking is reported as not configured.
// Outside the sandbox THUNDER_EXPECT_RECEIVER is mandatory, so a slip to someone else's account never passes.
const SLIP_CLOCK_SLACK_MS = 2 * 60_000; // slip times are minute-resolution and clocks drift
const ENDPOINT = process.env.THUNDER_API_URL ?? "https://api.thunder.in.th/v1/verify";

export type SlipResult =
  | { ok: true; sandbox: boolean; transRef: string; amount: number; sender?: string; date?: string }
  | { ok: false; code: "invalid_slip" | "wrong_amount" | "wrong_receiver" | "duplicate" | "provider_error" | "bad_image"; message: string };

function ensure() {
  db().exec(
    "CREATE TABLE IF NOT EXISTS used_slips (trans_ref TEXT PRIMARY KEY, used_for TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
}

// `usedFor` e.g. "cafe-qr-order:order:12". Each slip (transRef) can be redeemed once, ever.
// `notBefore` (epoch ms) rejects slips dated before the payment request was created, when the slip carries a date.
export async function verifySlip(file: File, expectedAmount: number, usedFor: string, notBefore?: number): Promise<SlipResult> {
  if (!file.type.startsWith("image/") || file.size === 0 || file.size > 5_000_000) {
    return { ok: false, code: "bad_image", message: "แนบรูปสลิปเป็นไฟล์ภาพขนาดไม่เกิน 5MB" };
  }
  const key = process.env.THUNDER_API_KEY;
  const sandbox = !key && sandboxEnabled();
  const expectReceiver = process.env.THUNDER_EXPECT_RECEIVER; // last digits of the receiving account / PromptPay id
  const notConfigured: SlipResult = { ok: false, code: "provider_error", message: "ยังไม่ได้ตั้งค่าบริการตรวจสลิป กรุณาติดต่อร้าน" };
  if (!key && !sandbox) return notConfigured;
  if (!sandbox && !expectReceiver) return notConfigured;
  ensure();
  let transRef: string;
  let amount: number;
  let sender: string | undefined;
  let date: string | undefined;

  if (sandbox) {
    // Deterministic per-file ref so re-uploading the same image is caught as a duplicate.
    const buf = Buffer.from(await file.arrayBuffer());
    const { createHash } = await import("node:crypto");
    transRef = "SANDBOX" + createHash("sha1").update(buf).digest("hex").slice(0, 16).toUpperCase();
    amount = expectedAmount;
  } else {
    const form = new FormData();
    form.append("image", file);
    let res: Response;
    try {
      res = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    } catch {
      return { ok: false, code: "provider_error", message: "เชื่อมต่อบริการตรวจสลิปไม่ได้ ลองใหม่อีกครั้ง" };
    }
    const json = (await res.json().catch(() => null)) as {
      data?: {
        transRef?: string;
        date?: string;
        amount?: { amount?: number };
        sender?: { account?: { name?: { th?: string; en?: string } } };
        receiver?: { account?: { bank?: { account?: string }; proxy?: { account?: string } } };
      };
    } | null;
    if (!res.ok || !json?.data?.transRef || typeof json.data.amount?.amount !== "number") {
      return res.status >= 500
        ? { ok: false, code: "provider_error", message: "บริการตรวจสลิปขัดข้อง ลองใหม่อีกครั้ง" }
        : { ok: false, code: "invalid_slip", message: "ตรวจสลิปไม่ผ่าน กรุณาแนบสลิปโอนเงินที่ชัดเจน" };
    }
    transRef = json.data.transRef;
    amount = json.data.amount.amount;
    sender = json.data.sender?.account?.name?.th ?? json.data.sender?.account?.name?.en;
    date = json.data.date;
    if (expectReceiver) {
      const r = json.data.receiver?.account;
      const got = `${r?.bank?.account ?? ""}${r?.proxy?.account ?? ""}`.replace(/\D/g, "");
      const want = expectReceiver.replace(/\D/g, "");
      // Slip masks digits (xxx-x-x1234-x), so compare only the visible digits as a suffix/contains check.
      // Outside the sandbox a slip that shows no receiver digits is rejected too.
      const mismatch = got && want && !want.includes(got.slice(-4)) && !got.includes(want.slice(-4));
      if (mismatch || (!sandbox && (!got || !want))) {
        return { ok: false, code: "wrong_receiver", message: "สลิปนี้โอนเข้าบัญชีที่ไม่ถูกต้อง" };
      }
    }
    const slipTime = date ? Date.parse(date) : NaN;
    if (notBefore !== undefined && !Number.isNaN(slipTime) && slipTime < notBefore - SLIP_CLOCK_SLACK_MS) {
      return { ok: false, code: "invalid_slip", message: "สลิปนี้ลงวันที่ก่อนรายการชำระเงินนี้ถูกสร้าง จึงใช้ยืนยันไม่ได้" };
    }
  }

  if (Math.abs(amount - expectedAmount) > 0.009) {
    return { ok: false, code: "wrong_amount", message: `ยอดในสลิป ${amount.toFixed(2)} บาท ไม่ตรงกับยอดที่ต้องชำระ ${expectedAmount.toFixed(2)} บาท` };
  }
  const ins = db().prepare("INSERT OR IGNORE INTO used_slips (trans_ref, used_for, amount) VALUES (?, ?, ?)").run(transRef, usedFor, amount);
  if (ins.changes === 0) return { ok: false, code: "duplicate", message: "สลิปนี้ถูกใช้ยืนยันการชำระเงินไปแล้ว" };
  return { ok: true, sandbox, transRef, amount, sender, date };
}

// Release a slip if the follow-up DB write fails, so the customer can retry.
export function releaseSlip(transRef: string) {
  ensure();
  db().prepare("DELETE FROM used_slips WHERE trans_ref = ?").run(transRef);
}
