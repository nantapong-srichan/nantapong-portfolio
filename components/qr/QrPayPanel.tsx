"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import SlipUpload from "@/components/SlipUpload";
import { type IntentResponse, type IntentStatus, money, qrBase, qrCall, useLatest } from "@/components/qr/shared";

const DEFAULT_SANDBOX_NOTE = "เดโม: ยังไม่ได้เชื่อมต่อฟีดธนาคารจริง ให้จำลองแจ้งเงินเข้าจากหน้าแอดมินของเดโมนี้";
const CLOSED_COPY: Record<Exclude<IntentStatus, "pending">, string> = {
  paid: "ได้รับเงินแล้ว",
  expired: "หมดเวลาชำระเงิน QR นี้ใช้ไม่ได้แล้ว หากโอนไปแล้วให้ติดต่อร้าน",
  cancelled: "รายการถูกยกเลิก ร้านจะติดต่อคืนเงิน",
};

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" />
    </svg>
  );
}

// Shows the PromptPay QR for one payment intent, counts down, polls status every 2s and offers a slip upload fallback.
export default function QrPayPanel({ scope, intentId, accent, apiBase, className = "mt-4 space-y-3 rounded-xl bg-stone-50 p-4", sandboxNote = DEFAULT_SANDBOX_NOTE, onPaid, onClosed }: {
  scope: string;
  intentId: string;
  accent: string;
  apiBase?: string;
  className?: string;
  sandboxNote?: string;
  onPaid?: () => void;
  onClosed?: (status: Exclude<IntentStatus, "pending" | "paid">) => void;
}) {
  const base = qrBase(scope, apiBase);
  const [data, setData] = useState<IntentResponse | null>(null);
  const [error, setError] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [slipOpen, setSlipOpen] = useState(false);
  const callbacks = useLatest({ onPaid, onClosed });
  const lastStatus = useRef<IntentStatus | undefined>(undefined);

  const status = data?.intent.status ?? "pending";
  const payload = data?.qrPayload ?? null;
  const pending = status === "pending";

  const refresh = useCallback(async () => {
    try {
      const r = await qrCall<IntentResponse>(base, `/intents/${intentId}`);
      if (r.status === 404) return setError("ไม่พบรายการชำระเงิน (อาจถูกล้างข้อมูลเดโมแล้ว)");
      if (!r.ok) return;
      const next = r.body;
      const before = lastStatus.current;
      lastStatus.current = next.intent.status;
      setData(next);
      // Fire callbacks outside the state updater: calling a parent's setState during render is a React error.
      if (before === "pending" && next.intent.status !== "pending") {
        if (next.intent.status === "paid") callbacks.current.onPaid?.();
        else callbacks.current.onClosed?.(next.intent.status);
      }
      setSkew(r.body.intent.serverNow - Date.now());
      setError("");
    } catch { /* retry on next poll */ }
  }, [base, intentId, callbacks]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    if (!pending) return () => clearTimeout(first);
    const poll = setInterval(() => void refresh(), 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(poll); clearInterval(tick); };
  }, [refresh, pending]);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((s) => { if (!cancelled) setSvg(s); })
      .catch(() => { if (!cancelled) setError("สร้าง QR ไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [payload]);

  if (error && !data) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  if (!data) return <p className="py-6 text-center text-sm text-stone-600">กำลังสร้าง QR...</p>;
  if (status !== "pending") return <p role="status" className={`mt-4 rounded-lg border p-3 text-sm font-medium ${status === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-stone-100 text-stone-800"}`}>{CLOSED_COPY[status]}</p>;

  const { intent, payee, sandbox } = data;
  const remainingMs = Math.max(0, intent.expiresAt - (now + skew));
  const mm = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="h-52 w-52 shrink-0 rounded-xl border border-stone-200 bg-white p-2 sm:h-44 sm:w-44 sm:p-1">
          {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR PromptPay สำหรับชำระเงิน" /> : <p className="p-4 text-center text-xs text-stone-600">{error || "กำลังสร้าง QR..."}</p>}
        </div>
        <div className="w-full min-w-0 text-center text-sm sm:text-left">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-stone-900 sm:justify-start"><QrIcon />สแกนจ่ายผ่านแอปธนาคาร (PromptPay)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums leading-tight" style={{ color: accent }}>{money(intent.amount)}</p>
          <p className="text-xs leading-relaxed text-stone-600">โอนยอดนี้ให้ตรงทุกสตางค์ ระบบใช้ยอดนี้จับคู่รายการ</p>
          <p className="mt-1 break-words text-xs leading-relaxed text-stone-600">เข้าบัญชีร้าน: {payee.name || "-"} · {payee.type === "company" ? "บริษัท" : "บุคคลธรรมดา"} · {payee.idMasked}{payee.isSample ? " (บัญชีตัวอย่าง)" : ""}</p>
          <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tabular-nums text-amber-900">เหลือเวลา {mm}:{ss}</p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs leading-relaxed text-stone-700"><span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full" style={{ background: accent }} />กำลังรอแจ้งเงินเข้า หน้านี้จะอัปเดตเองเมื่อได้รับเงิน</p>
      {sandbox && <p className="text-xs leading-relaxed text-amber-800">{sandboxNote}</p>}
      <div>
        <button type="button" onClick={() => setSlipOpen((s) => !s)} className="min-h-11 text-left text-sm underline underline-offset-2" style={{ color: accent }}>ระบบยังไม่ตรวจพบการโอน? แนบสลิปแทน</button>
        {slipOpen && (
          <div className="mt-2">
            <SlipUpload amount={intent.amount} accent={accent} onPaid={() => void refresh()} submit={async (file) => {
              const body = new FormData();
              body.append("slip", file);
              const res = await qrCall<{ sandbox?: boolean }>(base, `/intents/${intentId}/slip`, { method: "POST", body });
              return res.ok ? { ok: true, sandbox: res.body.sandbox } : { ok: false, message: res.body.error };
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
