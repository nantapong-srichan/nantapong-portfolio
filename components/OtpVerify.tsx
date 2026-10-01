"use client";
import { useState } from "react";

// Phone OTP step (ThaiBulkSMS). Calls /api/otp/request and /api/otp/verify.
// onVerified gives the parent the verified token; the demo's own API must re-check it server-side (isOtpVerified).
export default function OtpVerify({ phone, accent, onVerified }: { phone: string; accent: string; onVerified: (token: string) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function call(url: string, body: unknown) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "เกิดข้อผิดพลาด"); return null; }
      return j;
    } catch { setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); return null; } finally { setBusy(false); }
  }

  if (done) return <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">ยืนยันเบอร์ {phone} แล้ว</p>;
  return (
    <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900">
      {!token ? (
        <button type="button" disabled={busy || !phone} onClick={async () => {
          const j = await call("/api/otp/request", { phone });
          if (j) { setToken(j.token); setDevCode(j.sandbox ? j.devCode : null); }
        }} className="min-h-11 w-full rounded-lg px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 sm:w-auto" style={{ background: accent, outlineColor: accent }}>
          ส่งรหัส OTP ไปที่ {phone || "เบอร์โทร"}
        </button>
      ) : (
        <>
          <p className="text-neutral-700">กรอกรหัส 6 หลักที่ส่งทาง SMS</p>
          {devCode && <p className="rounded bg-amber-50 px-2 py-1 text-xs leading-relaxed text-amber-900">โหมดทดสอบ (ยังไม่ได้ตั้งค่า ThaiBulkSMS): รหัสคือ <b>{devCode}</b></p>}
          <div className="flex flex-wrap items-center gap-2">
            <input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-label="รหัส OTP" autoComplete="one-time-code" className="min-h-11 w-36 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-base tracking-[0.3em] text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-1" style={{ outlineColor: accent }} placeholder="------" />
            <button type="button" disabled={busy || pin.length < 4} onClick={async () => {
              const j = await call("/api/otp/verify", { token, pin });
              if (j?.verified) { setDone(true); onVerified(token); }
            }} className="min-h-11 rounded-lg px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" style={{ background: accent, outlineColor: accent }}>ยืนยัน</button>
            <button type="button" disabled={busy} onClick={() => { setToken(null); setPin(""); }} className="min-h-11 px-2 text-neutral-600 underline hover:text-neutral-900 disabled:opacity-50">ขอรหัสใหม่</button>
          </div>
        </>
      )}
      {msg && <p role="alert" className="text-red-700">{msg}</p>}
    </div>
  );
}
