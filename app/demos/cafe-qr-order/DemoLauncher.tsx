"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type TableLink = { table: number; token: string };
type Card = TableLink & { url: string; qr: string };

// DEMO ONLY: stands in for the printed stickers. Visitors have no physical QR, so every table's signed link is shown here.
export default function DemoLauncher({ accent }: { accent: string }) {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/cafe-qr-order/demo-tables", { cache: "no-store" });
      if (!res.ok) return;
      const { tables } = (await res.json()) as { tables: TableLink[] };
      const built = await Promise.all(
        tables.map(async (t) => {
          const url = `${window.location.origin}/demos/cafe-qr-order?t=${encodeURIComponent(t.token)}`;
          return { ...t, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
        }),
      );
      if (!cancelled) setCards(built);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <details open className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-900">
        สำหรับทดลองเดโม: จำลองสแกน QR โต๊ะ
        <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-amber-200 px-2 py-0.5 text-xs">DEMO ONLY</span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-amber-900">
        ร้านจริงจะพิมพ์สติกเกอร์ QR วางไว้ที่แต่ละโต๊ะ ลูกค้าไม่มีทางเปลี่ยนเลขโต๊ะได้ แต่ผู้ชมเดโมไม่มีสติกเกอร์จริง จึงกดเปิดเมนูของแต่ละโต๊ะจากตารางนี้แทน หรือใช้มือถือสแกน QR บนหน้าจอ
      </p>
      {cards.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">กำลังสร้าง QR…</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {cards.map((c) => (
            <li key={c.table} className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-sm font-semibold">โต๊ะ {c.table}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
              <img src={c.qr} alt={`QR ของโต๊ะ ${c.table}`} width={120} height={120} className="mx-auto mt-1 h-28 w-28" />
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-10 items-center rounded-full px-4 py-2 text-xs font-medium text-white"
                style={{ background: accent }}
              >
                เปิดเมนูโต๊ะ {c.table}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
