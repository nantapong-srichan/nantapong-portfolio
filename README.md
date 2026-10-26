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

## การ deploy

โปรเจกต์นี้ตั้งค่าเป็น static export สำหรับ GitHub Pages โดย build จะสร้างไฟล์ไว้ที่ `out/` และ workflow อยู่ที่ `.github/workflows/nextjs.yml`
