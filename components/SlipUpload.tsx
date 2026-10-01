"use client";
import { useState } from "react";

// Slip upload step (Thunder API verification happens in the demo's own API route via verifySlip()).
// `submit` receives the file and must POST it as multipart to the demo API; return {ok, message, sandbox}.
export type SlipSubmit = (file: File) => Promise<{ ok: boolean; message?: string; sandbox?: boolean }>;

export default function SlipUpload({ amount, accent, submit, onPaid }: { amount: number; accent: string; submit: SlipSubmit; onPaid: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [paid, setPaid] = useState(false);

  if (paid) return <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">ตรวจสลิปสำเร็จ ยอด {amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท{sandbox ? " (โหมดทดสอบ)" : ""}</p>;
  return (
    <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900">
      <p className="leading-relaxed text-neutral-700">โอนเงิน <b>{amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</b> แล้วแนบสลิปเพื่อยืนยัน</p>
      <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMsg(null); }} aria-label="แนบสลิปโอนเงิน" className="block min-h-11 w-full cursor-pointer text-sm text-neutral-700 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:font-medium file:text-neutral-900 hover:file:bg-neutral-200" />
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
      {file && <img src={URL.createObjectURL(file)} alt="ตัวอย่างสลิป" className="max-h-48 max-w-full rounded-lg border border-neutral-200 object-contain" />}
      <button type="button" disabled={!file || busy} onClick={async () => {
        if (!file) return;
        setBusy(true); setMsg(null);
        const r: Awaited<ReturnType<SlipSubmit>> = await submit(file).catch(() => ({ ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
        setBusy(false);
        if (r.ok) { setSandbox(!!r.sandbox); setPaid(true); onPaid(); } else setMsg(r.message ?? "ตรวจสลิปไม่ผ่าน");
      }} className="min-h-11 w-full rounded-lg px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 sm:w-auto" style={{ background: accent, outlineColor: accent }}>
        {busy ? "กำลังตรวจสลิป..." : "ส่งสลิปตรวจสอบ"}
      </button>
      {msg && <p role="alert" className="text-red-700">{msg}</p>}
    </div>
  );
}
