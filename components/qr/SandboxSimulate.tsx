"use client";
import { useEffect, useState } from "react";
import { jsonInit, money, type QrHeaders, qrBase, qrCall } from "@/components/qr/shared";

export type SimulateTarget = { key: string; label: string; amount: number; reference?: string };

const WRONG_AMOUNT = 12.34;

// Sandbox "bank": the server signs a notification and feeds it to the real webhook, so every
// simulated payment still passes signature check and matching. Hidden/disabled in production.
export default function SandboxSimulate({ scope, headers, accent, apiBase, targets, onDone }: {
  scope: string; headers: QrHeaders; accent: string; apiBase?: string; targets: SimulateTarget[]; onDone?: () => void;
}) {
  const base = qrBase(scope, apiBase);
  const [sandbox, setSandbox] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      void qrCall<{ sandbox: boolean }>(base, "/settings").then((r) => setSandbox(r.ok ? r.body.sandbox : false)).catch(() => setSandbox(false));
    }, 0);
    return () => clearTimeout(t);
  }, [base]);

  async function simulate(amount: number, label: string, reference?: string) {
    const r = await qrCall<{ webhookStatus: number; webhook: { result?: string; error?: string } }>(base, "/simulate", jsonInit("POST", { amount, reference }, headers)).catch(() => null);
    setNote(r?.ok ? `${label}: webhook ตอบ ${r.body.webhookStatus} ${r.body.webhook.result ?? r.body.webhook.error ?? ""}` : (r?.body.error ?? "ส่งไม่สำเร็จ"));
    onDone?.();
  }

  if (sandbox === null) return null;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold">จำลองแจ้งเงินเข้า (sandbox)</h2>
      {!sandbox ? (
        <p className="mt-1 text-xs text-stone-600">ปิดอยู่ (production หรือ QRPAY_SANDBOX=0) ระบบรับแจ้งเงินเข้าจริงที่ POST {base}/webhook เท่านั้น</p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">ยังไม่ได้เชื่อมต่อฟีดธนาคารจริง ปุ่มนี้ให้เซิร์ฟเวอร์เซ็นลายเซ็น HMAC แล้วยิงเข้า webhook จริงตัวเดียวกับที่ธนาคารจะเรียก (เบราว์เซอร์ไม่เก็บความลับ)</p>
          {note && <p role="status" className="mt-2 break-words rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs text-teal-200">{note}</p>}
          <ul className="mt-2 space-y-2 text-sm">
            {targets.map((o) => (
              <li key={o.key} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{o.label} · {money(o.amount)}</span>
                <span className="flex flex-wrap gap-2">
                  <button onClick={() => void simulate(o.amount, o.label, o.reference)} className="min-h-11 rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ background: accent }}>จำลองแจ้งเงินเข้า (sandbox)</button>
                  <button onClick={() => void simulate(WRONG_AMOUNT, "ยอดไม่ตรง")} className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-xs text-stone-800 hover:bg-stone-50">ส่งยอดผิด {WRONG_AMOUNT}</button>
                </span>
              </li>
            ))}
            {targets.length === 0 && <li className="text-xs leading-relaxed text-stone-600">ไม่มีรายการรอชำระ ให้ลองสร้างรายการก่อน หรือส่งยอดผิดเพื่อดูการจับคู่ไม่ได้: <button onClick={() => void simulate(WRONG_AMOUNT, "ยอดไม่ตรง")} className="min-h-11 underline">ส่งยอด {WRONG_AMOUNT}</button></li>}
          </ul>
        </>
      )}
    </section>
  );
}
