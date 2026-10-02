# Nantapong Srichan - Portfolio

พอร์ตโฟลิโอนักพัฒนา Full-Stack (Next.js, TypeScript, Supabase) พร้อมเว็บตัวอย่างสำหรับ SME 7 เว็บ แต่ละเว็บแสดง Tech Stack ของเดโมและ Tech Stack ที่จะใช้ในงานจริง

## เดโม

| เดโม | ประเภท | การชำระเงิน / ยืนยันตัวตน |
| --- | --- | --- |
| Brew & Bean | คาเฟ่สั่งผ่าน QR + จอครัว | QR PromptPay ตรวจรับเงินอัตโนมัติ + สลิปสำรอง |
| Studio Lumi | จองคิวร้านเสริมสวย | OTP + QR มัดจำ 30% (ตรวจอัตโนมัติ) + สลิปสำรอง |
| Baan Craft | ร้านงานทำมือ | OTP + QR ตรวจอัตโนมัติ + สลิปสำรอง |
| IronPulse Fitness | สมาชิกฟิตเนส | OTP + QR ตรวจอัตโนมัติ + สลิปสำรอง |
| BizLedger | ใบแจ้งหนี้ / สต็อก | QR ต่อใบแจ้งหนี้ + สลิปสำรอง |
| Nest Rentals | อสังหาให้เช่า | OTP |
| Linen & Co. | ร้านเสื้อผ้า | QR PromptPay ตรวจรับเงินอัตโนมัติ (webhook) + สลิปสำรอง |

ระบบ QR ตรวจรับเงินอัตโนมัติเป็นชุดกลาง (`lib/qr-payments.ts`, `components/qr/`) อธิบายไว้ที่ [docs/qr-payments.md](docs/qr-payments.md) เงินเข้าบัญชีร้านโดยตรง (บริษัทหรือบุคคล ตั้งค่าได้ในหน้าผู้ดูแลของแต่ละเดโม)

## รัน

ต้องใช้ Node.js 22.5 ขึ้นไป (ใช้ `node:sqlite` ที่มากับ Node)

```bash
npm install
npm run dev
```

ฐานข้อมูลเดโมคือไฟล์ SQLite ที่ `data/demos.db` (สร้างและ seed อัตโนมัติ, ไม่ถูก commit) ตั้งค่าที่อยู่ไฟล์ได้ด้วย `DEMO_DB_PATH`

## โหมดทดสอบ (sandbox) และ API key

ทุกทางลัดสำหรับเดโม (สลิปปลอม, แสดงรหัส OTP บนหน้าจอ, secret webhook สำรอง, ปุ่มจำลองธนาคาร, ตัวเปิดโต๊ะของร้านกาแฟ) คุมด้วยสวิตช์เดียวคือ `sandboxEnabled()` ใน `lib/sandbox.ts`:

- **dev (`npm run dev`)**: เปิดอัตโนมัติ (ปิดได้ด้วย `QRPAY_SANDBOX=0`)
- **production**: **ปิดโดยปริยาย** เพื่อไม่ให้ deploy จริงรับสลิปปลอมหรือเปิดช่อง OTP bypass ถ้าไม่ตั้ง key ระบบจะตอบ "ยังไม่ได้ตั้งค่า" (สลิป) / 503 (OTP) / 503 (webhook)
- **เว็บ portfolio สาธารณะเป็นเดโมที่ไม่มีเงินจริง** จึงต้องตั้ง `DEMO_SANDBOX=1` ตอน deploy อย่างตั้งใจ (และตั้ง `CAFE_TABLE_SECRET` กับ `GYM_MEMBER_SECRET`) **ห้ามตั้ง `DEMO_SANDBOX=1` กับเว็บที่รับเงินจริง**

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:

- `DEMO_SANDBOX=1` - เปิดโหมดทดสอบใน production (เฉพาะเดโม)
- `THUNDER_API_KEY`, `THUNDER_EXPECT_RECEIVER` - ตรวจสลิป (Thunder API) นอก sandbox ต้องตั้ง `THUNDER_EXPECT_RECEIVER` ด้วย
- `THAIBULKSMS_OTP_KEY`, `THAIBULKSMS_OTP_SECRET` - ส่ง OTP (ThaiBulkSMS)
- `PAYMENT_WEBHOOK_SECRET` (หรือ `PAYMENT_WEBHOOK_SECRET_<SCOPE>` ต่อเดโม) - ลายเซ็น webhook แจ้งเงินเข้า ลงนามจาก `${scope}.${timestamp}.${body}`

หมายเหตุ: รูปแบบ request/response ของ Thunder และ ThaiBulkSMS ใน `lib/thunder.ts` และ `lib/thaibulksms.ts` เขียนจากเอกสาร ยังไม่ได้ทดสอบกับ API จริง ให้ลองด้วย key จริงก่อนใช้งาน

## ที่ต้องกรอกก่อนเผยแพร่

- `lib/profile.ts`: LinkedIn
- PromptPay ID ในเดโมร้านเสื้อผ้าเป็นเลขตัวอย่าง (0800000000)

## การ deploy

เดโมเก็บข้อมูลด้วย SQLite ในไฟล์ จึงเหมาะกับรันเอง/VPS/Docker ถ้า deploy บน Vercel ระบบไฟล์เขียนไม่ถาวร ข้อมูลเดโมจะรีเซ็ต (หน้า portfolio ยังใช้งานได้ปกติ) ถ้าต้องการให้ถาวรให้ย้าย `lib/db.ts` ไปใช้ Postgres/Supabase

## รูปภาพ

รูปในเดโมเป็นรูปสัญญาอนุญาต CC0 / Public Domain (ค้นผ่าน Openverse จาก StockSnap, Rawpixel ฯลฯ) อยู่ที่ `public/images/<เดโม>/` พร้อม `CREDITS.md` ที่ระบุผู้สร้าง (ถ้ามี) และลิงก์ต้นทาง ยกเว้น 3 รูปที่ยังเป็นรูป Unsplash (ระบุใน CREDITS.md) บางรูปไม่มีชื่อผู้สร้างเพราะ API ไม่ให้มา

## ข้อจำกัดของเดโม (ห้ามนำไปใช้จริงโดยไม่แก้)

- สิทธิ์ผู้ดูแล/เจ้าของ/พนักงานใช้ header `x-demo-role` ไม่มีระบบล็อกอินจริง
- เมื่อตั้ง `DEMO_SANDBOX=1` ค่า header `x-demo-role` เป็นข้อมูลสาธารณะ ใครก็เรียก endpoint ผู้ดูแลได้ และจะเห็นข้อมูลที่ผู้เข้าชมคนอื่นกรอกในเดโม (เบอร์โทร ที่อยู่) จึงต้องบอกผู้เข้าชมให้ใช้ข้อมูลสมมติเท่านั้น
- ลูกค้าเข้าถึงออเดอร์/การจองของตัวเองด้วย key ที่เก็บในเบราว์เซอร์ (ร้านทำมือ ร้านเสื้อผ้า จองคิว) และคาเฟ่ใช้ token โต๊ะที่เซ็นลายเซ็น ไม่มีบัญชีผู้ใช้จริง ถ้าล้างข้อมูลเบราว์เซอร์จะดูออเดอร์เดิมไม่ได้
- บน Vercel ฐานข้อมูล `/tmp` แยกตาม instance: ขั้นตอนเดโมอาจล้มเป็นระยะ (เช่น OTP หมดอายุ) ถ้าต้องการเดโมที่เสถียรให้ใช้ VPS/Docker พร้อม volume (ตั้ง `DEMO_DB_PATH`) หรือย้ายไป Postgres
- OTP token ใช้ได้สูงสุด 5 ครั้งภายใน 15 นาทีสำหรับเบอร์เดิม และขอ OTP ได้ 20 ครั้ง/วัน/IP (นับจาก `x-forwarded-for` ถ้าไม่มี proxy จะไม่นับ)
- รูปแบบ API ของ Thunder / ThaiBulkSMS ยังไม่ทดสอบกับของจริง
