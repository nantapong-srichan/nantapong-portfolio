import { useEffect, useRef } from "react";

// Client-side helpers shared by the QR payment components. Admin auth is the demo's concern: pass `headers`.
export type QrHeaders = Record<string, string>;

export type PayeeView = { type: "company" | "individual"; name: string; idMasked: string; isSample: boolean };
export type IntentStatus = "pending" | "paid" | "expired" | "cancelled";
export type IntentView = {
  id: string; refType: string; refId: string; status: IntentStatus; amount: number; baseAmount: number; reference: string;
  expiresAt: number; serverNow: number; paidVia: "webhook" | "slip" | "manual" | null; paidAt: string | null;
};
export type IntentResponse = { intent: IntentView; qrPayload: string | null; payee: PayeeView; sandbox: boolean };
export type AssignTarget = { intentId: string; label: string };

// All kit routes live under /api/<scope>/qrpay unless the demo mounts them elsewhere.
export const qrBase = (scope: string, apiBase?: string) => apiBase ?? `/api/${scope}/qrpay`;

export type QrResult<T> = { ok: boolean; status: number; body: T & { error?: string } };

export async function qrCall<T>(base: string, path: string, init?: RequestInit): Promise<QrResult<T>> {
  const res = await fetch(`${base}${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export const jsonInit = (method: string, payload: unknown, headers: QrHeaders = {}): RequestInit => ({
  method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload),
});

export const money = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Keeps the newest props readable from timers/effects without re-subscribing them.
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const REASON_LABEL: Record<string, string> = {
  unknown_reference: "ไม่พบเลขอ้างอิงนี้", amount_mismatch: "ยอดไม่ตรงกับรายการ", order_expired: "รายการหมดเวลาแล้ว",
  no_matching_order: "ไม่มีรายการที่ยอดตรงกัน", ambiguous_amount: "มีหลายรายการยอดตรงกัน", stock_insufficient: "สต็อกหมด ต้องคืนเงิน",
};
export const reasonLabel = (r: string) => REASON_LABEL[r] ?? (r.startsWith("order_already_") ? "รายการนี้ชำระ/ปิดไปแล้ว" : r);
