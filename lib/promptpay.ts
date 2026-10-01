// PromptPay (Thai QR Payment, EMVCo merchant-presented) payload generator. Pure, no I/O.

export type PromptPayTarget =
  | { kind: "phone"; value: string } // 10 digits, e.g. 0812345678
  | { kind: "nationalId"; value: string } // 13 digits: citizen id or juristic/tax id
  | { kind: "ewallet"; value: string }; // 15 digits

export type AccountType = "company" | "individual";

const AID = "A000000677010111";

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final xor.
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// True when the trailing 4 hex chars equal the CRC of everything before them (including "6304").
export function hasValidCrc(payload: string): boolean {
  return /6304[0-9A-F]{4}$/.test(payload) && crc16(payload.slice(0, -4)) === payload.slice(-4);
}

// Classifies a raw id and checks it is allowed for the chosen account type.
// company: tax id (13) or e-wallet (15). individual: phone (10, leading 0) or national id (13).
export function parsePromptPayId(type: AccountType, raw: string): { ok: true; target: PromptPayTarget } | { ok: false; message: string } {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return { ok: false, message: "PromptPay ID ต้องเป็นตัวเลขเท่านั้น" };
  if (type === "company") {
    if (digits.length === 13) return { ok: true, target: { kind: "nationalId", value: digits } };
    if (digits.length === 15) return { ok: true, target: { kind: "ewallet", value: digits } };
    return { ok: false, message: "บริษัท: ใช้เลขนิติบุคคล 13 หลัก (หรือ e-Wallet 15 หลัก)" };
  }
  if (digits.length === 10 && digits.startsWith("0")) return { ok: true, target: { kind: "phone", value: digits } };
  if (digits.length === 13) return { ok: true, target: { kind: "nationalId", value: digits } };
  return { ok: false, message: "บุคคลธรรมดา: ใช้เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก" };
}

function proxyField(target: PromptPayTarget): string {
  switch (target.kind) {
    case "phone":
      // 0812345678 -> 0066812345678 (country code, no leading zero), 13 digits
      return tlv("01", `0066${target.value.slice(1)}`);
    case "nationalId":
      return tlv("02", target.value);
    case "ewallet":
      return tlv("03", target.value);
  }
}

// amountSatang is an integer count of satang; omit for an open-amount QR (static, tag 01 = 11).
export function buildPromptPayPayload(target: PromptPayTarget, amountSatang?: number): string {
  if (amountSatang !== undefined && (!Number.isInteger(amountSatang) || amountSatang <= 0)) {
    throw new Error("amountSatang must be a positive integer");
  }
  const dynamic = amountSatang !== undefined;
  const body =
    tlv("00", "01") +
    tlv("01", dynamic ? "12" : "11") +
    tlv("29", tlv("00", AID) + proxyField(target)) +
    tlv("58", "TH") +
    tlv("53", "764") +
    (dynamic ? tlv("54", (amountSatang / 100).toFixed(2)) : "") +
    "6304";
  return body + crc16(body);
}
