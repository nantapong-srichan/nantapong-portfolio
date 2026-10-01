import type { DatabaseSync } from "node:sqlite";
import { db } from "@/lib/db";

export const PROPERTY_TYPES = ["คอนโด", "บ้านเดี่ยว", "อพาร์ตเมนต์", "ทาวน์โฮม"] as const;
export const INQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export type ListingImage = { url: string; caption: string };
export type Listing = {
  id: number;
  title: string;
  type: string;
  area: string;
  price: number;
  bedrooms: number;
  sqm: number;
  description: string;
  amenities: string[];
  published: boolean;
  images: ListingImage[];
};
export type Inquiry = {
  id: number;
  listingId: number;
  listingTitle: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: InquiryStatus;
  phoneVerified: boolean;
  createdAt: string;
};

export type ListingFilters = {
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  area?: string;
};

const img = (n: number, id: number, caption: string): ListingImage => ({ url: `/images/rental-listings/l${id}-${n}.jpg`, caption });

type SeedListing = Omit<Listing, "images"> & { captions: [string, string, string] };

const seedListings: SeedListing[] = [
  { id: 1, title: "สตูดิโอวิวเมืองใกล้ BTS อารีย์", type: "คอนโด", area: "พญาไท", price: 14500, bedrooms: 1, sqm: 29, description: "สตูดิโอสว่างโปร่งชั้น 24 วิวเมือง เดินถึง BTS อารีย์ 5 นาที เฟอร์นิเจอร์ครบ พร้อมเข้าอยู่", amenities: ["สระว่ายน้ำ", "ฟิตเนส", "ไฟเบอร์ WiFi", "คีย์การ์ด"], published: true, captions: ["ตัวอาคาร", "ห้องนั่งเล่น", "ห้องนอน"] },
  { id: 2, title: "บ้านครอบครัวพร้อมสวน", type: "บ้านเดี่ยว", area: "ลาดพร้าว", price: 38000, bedrooms: 3, sqm: 180, description: "บ้านสองชั้นเงียบสงบในหมู่บ้านจัดสรร มีสวนส่วนตัวและที่จอดรถมีหลังคา 2 คัน เลี้ยงสัตว์ได้", amenities: ["สวน", "จอดรถ 2 คัน", "เลี้ยงสัตว์ได้", "รปภ. 24 ชม."], published: true, captions: ["ตัวบ้านและสวน", "ห้องทานอาหาร", "ห้องนอนใหญ่"] },
  { id: 3, title: "ห้องมุม 2 ห้องนอน ใกล้สะพานตากสิน", type: "คอนโด", area: "สาทร", price: 32000, bedrooms: 2, sqm: 68, description: "ห้องมุมวิวเมือง ระเบียงกว้าง เดินถึงท่าเรือสะพานตากสิน", amenities: ["วิวเมือง", "สระว่ายน้ำ", "โคเวิร์กกิ้ง", "รถรับส่ง"], published: true, captions: ["ห้องนั่งเล่น", "ครัว", "ห้องนอน"] },
  { id: 4, title: "อพาร์ตเมนต์น่าอยู่ใกล้ธรรมศาสตร์", type: "อพาร์ตเมนต์", area: "รังสิต", price: 6200, bedrooms: 1, sqm: 24, description: "ห้องเช่ารายเดือนราคาประหยัดสำหรับนักศึกษาและคนวัยทำงาน รวมค่าน้ำและค่าขยะ มีเครื่องซักผ้าทุกชั้น", amenities: ["เครื่องซักผ้า", "กล้องวงจรปิด", "ที่จอดมอเตอร์ไซค์"], published: true, captions: ["ห้องพัก", "มุมนั่งเล่น", "พื้นที่ใช้สอย"] },
  { id: 5, title: "ทาวน์โฮมอิฐแดง ทองหล่อ", type: "ทาวน์โฮม", area: "วัฒนา", price: 55000, bedrooms: 3, sqm: 210, description: "ทาวน์โฮม 3 ชั้น มีดาดฟ้า ใกล้คาเฟ่และร้านอาหารย่านทองหล่อ มีเฟอร์นิเจอร์บางส่วน", amenities: ["ดาดฟ้า", "ลิฟต์", "จอดรถ 2 คัน", "สมาร์ทล็อก"], published: true, captions: ["ตัวบ้าน", "บันได", "ห้องนั่งเล่น"] },
  { id: 6, title: "คอนโดมินิมอล 1 ห้องนอน รัชดา", type: "คอนโด", area: "ดินแดง", price: 11800, bedrooms: 1, sqm: 31, description: "ห้องสไตล์มูจิเงียบสงบ ห่างจาก MRT ห้วยขวาง 3 นาที มีตู้เสื้อผ้าบิลท์อินและครัวเล็ก", amenities: ["ฟิตเนส", "โคเวิร์กกิ้ง", "ไฟเบอร์ WiFi"], published: true, captions: ["ห้องนั่งเล่น", "มุมพักผ่อน", "ครัว"] },
  { id: 7, title: "อพาร์ตเมนต์เลี้ยงสัตว์ได้ เอกมัย", type: "อพาร์ตเมนต์", area: "วัฒนา", price: 17500, bedrooms: 2, sqm: 52, description: "2 ห้องนอนในอาคารโลว์ไรส์ มีลานเล็ก ๆ ยินดีต้อนรับแมวและสุนัขพันธุ์เล็ก", amenities: ["เลี้ยงสัตว์ได้", "ลานภายใน", "ที่จอดรถ"], published: false, captions: ["ห้องนั่งเล่น", "มุมผนังตกแต่ง", "พื้นที่เปิดโล่ง"] },
  { id: 8, title: "ทาวน์โฮมครอบครัว บางนา", type: "ทาวน์โฮม", area: "บางนา", price: 21000, bedrooms: 3, sqm: 140, description: "ทาวน์โฮมกว้างขวาง ใกล้เมกาบางนาและทางด่วน เหมาะกับครอบครัวที่เดินทางด้วยรถยนต์", amenities: ["ที่จอดรถ", "สระส่วนกลาง", "ใกล้ห้างสรรพสินค้า"], published: true, captions: ["แถวทาวน์โฮม", "ถนนหน้าบ้าน", "ลานระเบียงและสระ"] },
];

const seedInquiries = [
  { listingId: 1, name: "พิมพ์ชนก ส.", phone: "081 555 0101", email: "pim.s@example.com", message: "สตูดิโอยังว่างตั้งแต่ 1 พฤศจิกายนไหมคะ ขอเข้าชมห้องสุดสัปดาห์นี้ได้ไหมคะ", status: "new", ago: "-3 hours" },
  { listingId: 3, name: "แดเนียล ไรท์", phone: "081 555 0142", email: "daniel.w@example.com", message: "สนใจเช่าสัญญา 12 เดือน ถ้าเช่านานขึ้นต่อรองราคาได้ไหม", status: "contacted", ago: "-1 day" },
  { listingId: 2, name: "สมชาย ใจดี", phone: "089 555 0177", email: "somchai.j@example.com", message: "สนใจบ้านหลังนี้ครับ เลี้ยงสุนัขพันธุ์เล็กได้ไหมครับ", status: "closed", ago: "-2 days" },
];

let ready = false;

function init(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS rental_listings_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      area TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      bedrooms INTEGER NOT NULL CHECK (bedrooms >= 0),
      sqm INTEGER NOT NULL CHECK (sqm > 0),
      description TEXT NOT NULL,
      amenities TEXT NOT NULL DEFAULT '[]',
      published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS rental_listings_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES rental_listings_listings(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      url TEXT NOT NULL,
      caption TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rental_listings_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES rental_listings_listings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS rental_listings_idx_filter ON rental_listings_listings (published, type, price);
  `);
  // Databases created before OTP support lack this column.
  const cols = d.prepare("PRAGMA table_info(rental_listings_inquiries)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "phone_verified")) {
    d.exec("ALTER TABLE rental_listings_inquiries ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0 CHECK (phone_verified IN (0, 1))");
  }
  const { n } = d.prepare("SELECT COUNT(*) AS n FROM rental_listings_listings").get() as { n: number };
  if (n > 0) return;
  d.exec("BEGIN");
  try {
    const insL = d.prepare("INSERT INTO rental_listings_listings (id, title, type, area, price, bedrooms, sqm, description, amenities, published) VALUES (?,?,?,?,?,?,?,?,?,?)");
    const insI = d.prepare("INSERT INTO rental_listings_images (listing_id, position, url, caption) VALUES (?,?,?,?)");
    for (const l of seedListings) {
      insL.run(l.id, l.title, l.type, l.area, l.price, l.bedrooms, l.sqm, l.description, JSON.stringify(l.amenities), l.published ? 1 : 0);
      l.captions.forEach((c, i) => {
        const im = img(i + 1, l.id, c);
        insI.run(l.id, i, im.url, im.caption);
      });
    }
    const insQ = d.prepare("INSERT INTO rental_listings_inquiries (listing_id, name, phone, email, message, status, created_at) VALUES (?,?,?,?,?,?,datetime('now', ?))");
    for (const q of seedInquiries) insQ.run(q.listingId, q.name, q.phone, q.email, q.message, q.status, q.ago);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

function conn(): DatabaseSync {
  const d = db();
  if (!ready) {
    init(d);
    ready = true;
  }
  return d;
}

type ListingRow = { id: number; title: string; type: string; area: string; price: number; bedrooms: number; sqm: number; description: string; amenities: string; published: number };
type ImageRow = { listing_id: number; url: string; caption: string };

function hydrate(d: DatabaseSync, rows: ListingRow[]): Listing[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const images = d
    .prepare(`SELECT listing_id, url, caption FROM rental_listings_images WHERE listing_id IN (${ids.map(() => "?").join(",")}) ORDER BY listing_id, position`)
    .all(...ids) as ImageRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    area: r.area,
    price: r.price,
    bedrooms: r.bedrooms,
    sqm: r.sqm,
    description: r.description,
    amenities: JSON.parse(r.amenities) as string[],
    published: r.published === 1,
    images: images.filter((i) => i.listing_id === r.id).map((i) => ({ url: i.url, caption: i.caption })),
  }));
}

// bedrooms >= 3 means "3 or more", matching the UI filter.
export function searchListings(f: ListingFilters, opts: { includeUnpublished?: boolean } = {}): Listing[] {
  const d = conn();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (!opts.includeUnpublished) where.push("published = 1");
  if (f.type) { where.push("type = ?"); args.push(f.type); }
  if (f.minPrice !== undefined) { where.push("price >= ?"); args.push(f.minPrice); }
  if (f.maxPrice !== undefined) { where.push("price < ?"); args.push(f.maxPrice); }
  if (f.bedrooms !== undefined) {
    where.push(f.bedrooms >= 3 ? "bedrooms >= 3" : "bedrooms = ?");
    if (f.bedrooms < 3) args.push(f.bedrooms);
  }
  if (f.area) { where.push("area = ?"); args.push(f.area); }
  const sql = `SELECT * FROM rental_listings_listings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`;
  return hydrate(d, d.prepare(sql).all(...args) as ListingRow[]);
}

export function publishedAreas(): string[] {
  const rows = conn().prepare("SELECT DISTINCT area FROM rental_listings_listings WHERE published = 1 ORDER BY area").all() as { area: string }[];
  return rows.map((r) => r.area);
}

export function getListing(id: number, opts: { includeUnpublished?: boolean } = {}): Listing | null {
  const d = conn();
  const row = d.prepare("SELECT * FROM rental_listings_listings WHERE id = ?").get(id) as ListingRow | undefined;
  if (!row || (row.published !== 1 && !opts.includeUnpublished)) return null;
  return hydrate(d, [row])[0];
}

export function setPublished(id: number, published: boolean): Listing | null {
  const d = conn();
  const r = d.prepare("UPDATE rental_listings_listings SET published = ? WHERE id = ?").run(published ? 1 : 0, id);
  return r.changes === 0 ? null : getListing(id, { includeUnpublished: true });
}

type InquiryRow = { id: number; listing_id: number; title: string; name: string; phone: string; email: string; message: string; status: InquiryStatus; phone_verified: number; created_at: string };

const toInquiry = (r: InquiryRow): Inquiry => ({
  id: r.id,
  listingId: r.listing_id,
  listingTitle: r.title,
  name: r.name,
  phone: r.phone,
  email: r.email,
  message: r.message,
  status: r.status,
  phoneVerified: r.phone_verified === 1,
  // SQLite stores UTC without a zone marker.
  createdAt: r.created_at.replace(" ", "T") + "Z",
});

const inquirySelect = `SELECT q.*, l.title FROM rental_listings_inquiries q JOIN rental_listings_listings l ON l.id = q.listing_id`;

export function listInquiries(): Inquiry[] {
  return (conn().prepare(`${inquirySelect} ORDER BY q.created_at DESC, q.id DESC`).all() as InquiryRow[]).map(toInquiry);
}

export function createInquiry(i: { listingId: number; name: string; phone: string; email: string; message: string }, phoneVerified: boolean): Inquiry {
  const d = conn();
  const r = d
    .prepare("INSERT INTO rental_listings_inquiries (listing_id, name, phone, email, message, phone_verified) VALUES (?,?,?,?,?,?)")
    .run(i.listingId, i.name, i.phone, i.email, i.message, phoneVerified ? 1 : 0);
  return toInquiry(d.prepare(`${inquirySelect} WHERE q.id = ?`).get(Number(r.lastInsertRowid)) as InquiryRow);
}

export function setInquiryStatus(id: number, status: InquiryStatus): Inquiry | null {
  const d = conn();
  const r = d.prepare("UPDATE rental_listings_inquiries SET status = ? WHERE id = ?").run(status, id);
  if (r.changes === 0) return null;
  return toInquiry(d.prepare(`${inquirySelect} WHERE q.id = ?`).get(id) as InquiryRow);
}
