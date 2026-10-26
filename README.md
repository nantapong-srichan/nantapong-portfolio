# Nantapong Srichan - Portfolio

พอร์ตโฟลิโอนักพัฒนา Full-Stack ที่แสดงเฉพาะโปรเจกต์สาธารณะซึ่งตรวจสอบได้จาก GitHub

## รันในเครื่อง

ต้องใช้ Node.js 22.5 ขึ้นไป

```bash
npm install
npm run dev
```

## โปรเจกต์ที่แสดง

รายการผลงานอยู่ที่ `lib/projects.ts` และทุกการ์ดลิงก์ไปยัง public repository จริงของ GitHub โดยตรง

### Tech stack ที่ใช้ในแต่ละโปรเจกต์

| โปรเจกต์ | Tech stack |
| --- | --- |
| Office Camera | C#, .NET 8, Avalonia UI, LibVLCSharp, go2rtc |
| Health App - Meal Tracking System | Flutter, Dart, tflite_flutter, Express.js, MongoDB, JWT, Google Cloud Storage |
| Real-Time Learning & Project Management System | Next.js, React, TypeScript, NestJS, Prisma ORM, PostgreSQL, REST API |

คำอธิบายและ tech stack ของโปรเจกต์อ้างอิงจาก source code และ README ของแต่ละ repository ไม่รวมเทคโนโลยีที่ยังอยู่ใน roadmap เท่านั้น

## การ deploy

โปรเจกต์นี้ตั้งค่าเป็น static export สำหรับ GitHub Pages โดย build จะสร้างไฟล์ไว้ที่ `out/` และ workflow อยู่ที่ `.github/workflows/nextjs.yml`
