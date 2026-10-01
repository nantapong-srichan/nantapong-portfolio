import { db } from "@/lib/db";
import { createHash, randomInt } from "node:crypto";
import { sandboxEnabled } from "@/lib/sandbox";

// ThaiBulkSMS OTP API (https://otp.thaibulksms.com/v2). Server-only.
// With THAIBULKSMS_OTP_KEY + THAIBULKSMS_OTP_SECRET set: real SMS via ThaiBulkSMS.
// Without keys: only while the sandbox is enabled (lib/sandbox.ts) no SMS is sent and the code is returned
// as `devCode` so the demo still works; otherwise requests fail with 503 (never leak a code in a real deploy).
const BASE = process.env.THAIBULKSMS_OTP_URL ?? "https://otp.thaibulksms.com/v2/otp";

// A verified token authorises at most this many orders/bookings, within this window.
export const OTP_TOKEN_MAX_USES = 5;
export const OTP_TOKEN_WINDOW_MS = 15 * 60_000;
export const OTP_IP_DAILY_LIMIT = 20;

function ensure() {
  db().exec(`CREATE TABLE IF NOT EXISTS otp_requests (
    token TEXT PRIMARY KEY, msisdn TEXT NOT NULL, code_hash TEXT, attempts INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0, verified_at INTEGER)`);
  const cols = (db().prepare("PRAGMA table_info(otp_requests)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("uses")) db().exec("ALTER TABLE otp_requests ADD COLUMN uses INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("verified_at")) db().exec("ALTER TABLE otp_requests ADD COLUMN verified_at INTEGER");
  db().exec("CREATE TABLE IF NOT EXISTS otp_ip_requests (ip TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (ip, day))");
}

// Counts one OTP request for this client today; false once the daily cap is hit.
function takeIpQuota(ip: string, now: number): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  db().prepare("DELETE FROM otp_ip_requests WHERE day < ?").run(day);
  const r = db()
    .prepare("INSERT INTO otp_ip_requests (ip, day, n) VALUES (?, ?, 1) ON CONFLICT (ip, day) DO UPDATE SET n = n + 1 WHERE n < ?")
    .run(ip, day, OTP_IP_DAILY_LIMIT);
  return r.changes > 0;
}

export const normalizeMsisdn = (raw: string): string | null => {
  const d = raw.replace(/[\s-]/g, "");
  if (/^0[689]\d{8}$/.test(d)) return d;
  if (/^\+66[689]\d{8}$/.test(d)) return "0" + d.slice(3);
  return null;
};

export type OtpRequest = { ok: true; token: string; refno?: string; sandbox: boolean; devCode?: string } | { ok: false; status: number; message: string };

// `clientIp` (null when unknown, e.g. local dev without a proxy) enables the per-IP daily cap.
export async function requestOtp(rawPhone: string, clientIp: string | null = null): Promise<OtpRequest> {
  const msisdn = normalizeMsisdn(rawPhone);
  if (!msisdn) return { ok: false, status: 400, message: "เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)" };
  ensure();
  const now = Date.now();
  const last = db().prepare("SELECT created_at FROM otp_requests WHERE msisdn = ? ORDER BY created_at DESC LIMIT 1").get(msisdn) as { created_at: number } | undefined;
  if (last && now - last.created_at < 30_000) return { ok: false, status: 429, message: "ขอรหัสได้ทุก 30 วินาที กรุณารอสักครู่" };

  const key = process.env.THAIBULKSMS_OTP_KEY, secret = process.env.THAIBULKSMS_OTP_SECRET;
  const sandbox = !key || !secret;
  if (sandbox && !sandboxEnabled()) return { ok: false, status: 503, message: "ระบบยืนยันเบอร์โทรด้วย OTP ยังไม่พร้อมใช้งาน" };
  if (clientIp && !takeIpQuota(clientIp, now)) return { ok: false, status: 429, message: "ขอรหัส OTP ครบจำนวนต่อวันแล้ว กรุณาลองใหม่พรุ่งนี้" };
  if (!key || !secret) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const token = "sbx_" + createHash("sha1").update(msisdn + now + code).digest("hex").slice(0, 20);
    db().prepare("INSERT INTO otp_requests (token, msisdn, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)")
      .run(token, msisdn, createHash("sha256").update(token + code).digest("hex"), now + 5 * 60_000, now);
    return { ok: true, token, sandbox: true, devCode: code };
  }
  try {
    const res = await fetch(`${BASE}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key, secret, msisdn }),
    });
    const j = (await res.json().catch(() => null)) as { token?: string; refno?: string } | null;
    if (!res.ok || !j?.token) return { ok: false, status: 502, message: "ส่ง OTP ไม่สำเร็จ ลองใหม่อีกครั้ง" };
    db().prepare("INSERT INTO otp_requests (token, msisdn, expires_at, created_at) VALUES (?,?,?,?)").run(j.token, msisdn, now + 5 * 60_000, now);
    return { ok: true, token: j.token, refno: j.refno, sandbox: false };
  } catch {
    return { ok: false, status: 502, message: "เชื่อมต่อบริการ SMS ไม่ได้" };
  }
}

// Returns the verified phone number (msisdn) on success.
export async function verifyOtp(token: string, pin: string): Promise<{ ok: true; msisdn: string } | { ok: false; status: number; message: string }> {
  ensure();
  const row = db().prepare("SELECT * FROM otp_requests WHERE token = ?").get(token) as
    | { msisdn: string; code_hash: string | null; attempts: number; verified: number; expires_at: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) return { ok: false, status: 400, message: "รหัส OTP หมดอายุ กรุณาขอใหม่" };
  if (row.attempts >= 5) return { ok: false, status: 429, message: "กรอกผิดเกินจำนวนครั้ง กรุณาขอรหัสใหม่" };
  db().prepare("UPDATE otp_requests SET attempts = attempts + 1 WHERE token = ?").run(token);
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, status: 400, message: "รหัส OTP ไม่ถูกต้อง" };

  let good = false;
  if (row.code_hash !== null) {
    good = row.code_hash === createHash("sha256").update(token + pin).digest("hex");
  } else {
    try {
      const res = await fetch(`${BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: process.env.THAIBULKSMS_OTP_KEY ?? "", secret: process.env.THAIBULKSMS_OTP_SECRET ?? "", token, pin }),
      });
      const j = (await res.json().catch(() => null)) as { status?: string } | null;
      good = res.ok && j?.status === "success";
    } catch {
      return { ok: false, status: 502, message: "เชื่อมต่อบริการ SMS ไม่ได้" };
    }
  }
  if (!good) return { ok: false, status: 400, message: "รหัส OTP ไม่ถูกต้อง" };
  db().prepare("UPDATE otp_requests SET verified = 1, verified_at = ? WHERE token = ? AND verified = 0").run(Date.now(), token);
  return { ok: true, msisdn: row.msisdn };
}

// Server-side gate: true only if this token was verified, belongs to this phone, is inside its window and has
// uses left. Each true consumes one use (atomic UPDATE), so one OTP cannot back unlimited orders.
export function isOtpVerified(token: string, rawPhone: string): boolean {
  ensure();
  const msisdn = normalizeMsisdn(rawPhone);
  if (!msisdn || typeof token !== "string") return false;
  const r = db()
    .prepare("UPDATE otp_requests SET uses = uses + 1 WHERE token = ? AND msisdn = ? AND verified = 1 AND uses < ? AND verified_at > ?")
    .run(token, msisdn, OTP_TOKEN_MAX_USES, Date.now() - OTP_TOKEN_WINDOW_MS);
  return r.changes > 0;
}
