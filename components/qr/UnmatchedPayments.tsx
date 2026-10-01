"use client";
import { useCallback, useEffect, useState } from "react";
import { type AssignTarget, jsonInit, money, type QrHeaders, qrBase, qrCall, reasonLabel, useLatest } from "@/components/qr/shared";

type Unmatched = {
  id: number; eventId: string; provider: string; amount: number; reference: string | null; paidAt: string; reason: string;
  status: "open" | "assigned"; assignedRefType: string | null; assignedRefId: string | null;
};

// Admin list of money that arrived but could not be paired automatically, with manual assignment.
// `targets` are the intents the owner may assign to (pending or recently expired), labelled by the demo.
export default function UnmatchedPayments({ scope, headers, accent, apiBase, targets, pollMs = 3000, onAssigned }: {
  scope: string; headers: QrHeaders; accent: string; apiBase?: string; targets: AssignTarget[]; pollMs?: number; onAssigned?: () => void;
}) {
  const base = qrBase(scope, apiBase);
  const [rows, setRows] = useState<Unmatched[] | null>(null);
  const [note, setNote] = useState("");
  const latest = useLatest(headers);

  const load = useCallback(async () => {
    try {
      const r = await qrCall<{ unmatched: Unmatched[] }>(base, "/unmatched", { headers: latest.current });
      if (r.ok) setRows(r.body.unmatched);
    } catch { /* keep last data */ }
  }, [base, latest]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const poll = setInterval(() => void load(), pollMs);
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [load, pollMs]);

  async function assign(unmatchedId: number, intentId: string, label: string) {
    const r = await qrCall<{ refId?: string }>(base, `/unmatched/${unmatchedId}/assign`, jsonInit("POST", { intentId }, latest.current));
    setNote(r.ok ? `จับคู่เงินเข้ากับ ${label} แล้ว` : (r.body.error ?? "จับคู่ไม่สำเร็จ"));
    await load();
    if (r.ok) onAssigned?.();
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold">เงินเข้าที่ยังจับคู่ไม่ได้</h2>
      {note && <p role="status" className="mt-2 break-words rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs text-teal-200">{note}</p>}
      {!rows || rows.length === 0 ? <p className="mt-2 text-xs text-stone-600">{rows ? "ไม่มีรายการ" : "กำลังโหลด..."}</p> : (
        <ul className="mt-2 space-y-3 text-sm">
          {rows.map((u) => <Row key={u.id} u={u} targets={targets} accent={accent} onAssign={assign} />)}
        </ul>
      )}
      {rows?.some((u) => u.status === "open") && <p className="mt-2 text-xs text-stone-600">เลือกรายการแล้วกดจับคู่ ระบบจะเปลี่ยนรายการนั้นเป็นชำระแล้ว</p>}
    </section>
  );
}

function Row({ u, targets, accent, onAssign }: { u: Unmatched; targets: AssignTarget[]; accent: string; onAssign: (id: number, intentId: string, label: string) => Promise<void> }) {
  const [target, setTarget] = useState("");
  return (
    <li className="rounded-xl border border-stone-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{money(u.amount)} <span className="text-xs font-normal text-stone-600">· {u.provider}{u.reference ? ` · อ้างอิง ${u.reference}` : ""}</span></span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.status === "open" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{u.status === "open" ? "รอจับคู่" : `จับคู่กับ ${u.assignedRefId}`}</span>
      </div>
      <p className="mt-1 text-xs text-stone-600">เหตุผล: {reasonLabel(u.reason)} · event {u.eventId}</p>
      {u.status === "open" && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-11 min-w-0 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-900 sm:flex-1">
            <option value="">เลือกรายการ</option>
            {targets.map((t) => <option key={t.intentId} value={t.intentId}>{t.label}</option>)}
          </select>
          <button disabled={!target} onClick={() => void onAssign(u.id, target, targets.find((t) => t.intentId === target)?.label ?? target)} className="min-h-11 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: accent }}>จับคู่กับรายการ</button>
        </div>
      )}
    </li>
  );
}
