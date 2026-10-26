export type Project = {
  name: string;
  description: string;
  url: string;
  language: string;
  stack: string[];
  accent: string;
};

// Curated from the public repositories currently visible on the GitHub profile.
// Keep this list limited to work that can be verified by opening the source repo.
export const projects: Project[] = [
  {
    name: "Office Camera",
    description: "แอปเดสก์ท็อปข้ามแพลตฟอร์มสำหรับดูภาพจากกล้อง Xiaomi C400 หลายตัวในหน้าจอเดียว",
    url: "https://github.com/nantapong-srichan/xiaomi-cam-for-office",
    language: "C#",
    stack: [".NET 8", "Avalonia", "LibVLCSharp", "go2rtc"],
    accent: "#2563eb",
  },
  {
    name: "Health App - Meal Tracking System",
    description: "แอป Flutter สำหรับบันทึกมื้ออาหาร ติดตามแคลอรี และจัดการข้อมูลสุขภาพส่วนตัว",
    url: "https://github.com/nantapong-srichan/Health-Tdee",
    language: "Dart",
    stack: ["Flutter", "AI Food Recognition", "Nutrition Tracking"],
    accent: "#0f766e",
  },
  {
    name: "Real-Time Project Management System",
    description: "โปรเจกต์ระบบจัดการโปรเจกต์แบบเรียลไทม์ที่เผยแพร่เป็น source code สาธารณะ",
    url: "https://github.com/nantapong-srichan/Real-Time-Project-Management-System",
    language: "HTML",
    stack: ["Public Repository", "Source Code"],
    accent: "#7c3aed",
  },
];
