"use client";
import { useEffect, useState } from "react";
import { jsonInit, type QrHeaders, qrBase, qrCall, useLatest } from "@/components/qr/shared";

type Payee = { type: "company" | "individual"; id: string; name: string; isSample: boolean };

// Admin form for the PromptPay account that receives the money (company or individual).
export default function PayeeSettings({ scope, headers, accent, apiBase, onSaved }: {
  scope: string; headers: QrHeaders; accent: string; apiBase?: string; onSaved?: () => void;
}) {
  const base = qrBase(scope, apiBase);
  const [payee, setPayee] = useState<Payee | null>(null);
  const latest = useLatest(headers);

  useEffect(() => {
    const t = setTimeout(() => {
      void qrCall<{ payee: Payee }>(base, "/payee", { headers: latest.current }).then((r) => { if (r.ok) setPayee(r.body.payee); }).catch(() => undefined);
    }, 0);
    return () => clearTimeout(t);
  }, [base, latest]);

  if (!payee) return <p className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">กำลังโหลดบัญชีรับเงิน...</p>;
  return <PayeeForm payee={payee} base={base} headers={headers} accent={accent} onSaved={(p) => { setPayee(p); onSaved?.(); }} />;
}

function PayeeForm({ payee, base, headers, accent, onSaved }: { payee: Payee; base: string; headers: QrHeaders; accent: string; onSaved: (p: Payee) => void }) {
  const [type, setType] = useState(payee.type);
  const [id, setId] = useState(payee.id);
  const [name, setName] = useState(payee.name);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await qrCall<{ payee: Payee }>(base, "/payee", jsonInit("PUT", { type, promptpayId: id, name }, headers)).catch(() => null);
    if (!r) return setMsg({ ok: false, text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    setMsg(r.ok ? { ok: true, text: "บันทึกแล้ว QR ของรายการใหม่จะใช้บัญชีนี้" } : { ok: false, text: r.body.error ?? "บันทึกไม่สำเร็จ" });
    if (r.ok) onSaved(r.body.payee);
  }
  const input = "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-1 sm:text-sm";
  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 text-stone-900" style={{ ["--tw-outline-color" as string]: accent }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">ตั้งค่าบัญชีรับเงิน</h2>
        {payee.isSample && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">ตัวอย่าง ไม่ใช่บัญชีจริง</span>}
      </div>
      <div className="flex flex-wrap gap-x-5 text-sm">
        {([["company", "บริษัท"], ["individual", "บุคคลธรรมดา"]] as const).map(([v, l]) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2"><input className="h-4 w-4" style={{ accentColor: accent }} type="radio" name="payee-type" checked={type === v} onChange={() => setType(v)} />{l}</label>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-stone-600">{type === "company" ? "บริษัท: เลขนิติบุคคล 13 หลัก (หรือ e-Wallet 15 หลัก)" : "บุคคลธรรมดา: เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"}</p>
      <input className={input} value={id} onChange={(e) => setId(e.target.value)} placeholder={type === "company" ? "เลขนิติบุคคล 13 หลัก" : "เบอร์โทร หรือเลขบัตรประชาชน"} inputMode="numeric" />
      <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อบัญชีที่แสดงให้ลูกค้า" />
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
      <button className="min-h-11 w-full rounded-full px-5 py-2 text-sm font-semibold text-white sm:w-auto" style={{ background: accent }}>บันทึกบัญชีรับเงิน</button>
      <p className="text-xs text-stone-600">ค่าเริ่มต้นเป็นเบอร์ตัวอย่าง 0800000000 เพื่อการสาธิตเท่านั้น</p>
    </form>
  );
}
