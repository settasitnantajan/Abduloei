# Abduloei - AI Home Assistant

> ผู้ช่วย AI สำหรับจัดการบ้านและครอบครัวไทย

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-orange)](https://ai.google.dev/)

---

## 🏠 เกี่ยวกับโปรเจกต์

Abduloei เป็นแอปพลิเคชัน AI Home Assistant ที่ออกแบบมาสำหรับครอบครัวไทยโดยเฉพาะ ช่วยจัดการ:

- 📅 **กิจกรรมและนัดหมาย** (Events)
- ✅ **งานที่ต้องทำ** (Tasks)
- 📝 **บันทึกและโน้ต** (Notes)
- 💬 **แชทกับ AI** (ภาษาไทย)
- 🔔 **แจ้งเตือนผ่าน LINE**
- 🏡 **จัดการหลายบ้าน** (Multi-home support)

---

## 🚀 Tech Stack

- **Frontend:** Next.js 16.1.6 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + Shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **AI:** Google Gemini 2.5 Flash
- **Notifications:** LINE Messaging API
- **Animations:** Framer Motion

---

## 📚 เอกสาร

ดูเอกสารทั้งหมดในโฟลเดอร์ [`/docs`](./docs/)

### 📖 สารบัญ

#### การตั้งค่า & Connection
- [Supabase Connection](./docs/SUPABASE-CONNECTION.md) - การเชื่อมต่อ Database
- [LINE Connection](./docs/LINE-CONNECTION.md) - การเชื่อมต่อ LINE Messaging API
- [Gemini Models](./docs/GEMINI-MODELS.md) - รายการ AI Models ที่ใช้ได้

#### Database & Schema
- [Database Schema](./docs/DATABASE-SCHEMA.md) - โครงสร้าง Database ทั้งหมด

#### Features & Design
- [Features](./docs/FEATURES.md) - รายละเอียดฟีเจอร์ทั้งหมด
- [UI Pages](./docs/UI-PAGES.md) - การออกแบบ UI แต่ละหน้า
- [LINE Integration](./docs/LINE-INTEGRATION.md) - การส่งการแจ้งเตือนผ่าน LINE

#### Research & Testing
- [Research Summary](./docs/research-summary.md) - วิจัยและแนวทาง
- [Login Test Summary](./docs/LOGIN-TEST-SUMMARY.md) - สรุปการทดสอบระบบ Login
- [Test Report](./docs/TEST-REPORT.md) - รายงานการทดสอบแบบละเอียด

---

## 🛠️ การติดตั้ง

### 1. Clone Repository
```bash
git clone <repository-url>
cd abduloei
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment Variables
สร้างไฟล์ `.env.local`:
```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=your_database_url

# LINE Messaging API
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. รัน Development Server
```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## 🧪 การทดสอบ

### สร้าง Test User
```bash
npm run create-test-user
```

### ทดสอบระบบ Login
```bash
npm run test-login
```

### ทดสอบ Gemini API
```bash
npm run test-gemini
```

---

## 📱 Features ที่ทำเสร็จแล้ว

- ✅ **ระบบ Login** (Email + Password)
- ✅ **Dark Mode**
- ✅ **Dashboard** (Placeholder)
- ✅ **Database Schema** (พร้อมใช้งาน)
- ✅ **Supabase Connection**
- ✅ **LINE API Connection**
- ✅ **Gemini API Setup**

---

## 🔜 Features ที่กำลังพัฒนา

- 🚧 **หน้า Chat** (AI Conversation)
- 🚧 **Voice Input** (Web Speech API)
- 🚧 **การจัดการ Events**
- 🚧 **การจัดการ Tasks**
- 🚧 **การจัดการ Notes**
- 🚧 **Multi-home Support**
- 🚧 **LINE Notifications**

---

## 👥 การพัฒนา

### Project Structure
```
abduloei/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── api/               # API Routes
│   ├── login/             # Login page
│   ├── dashboard/         # Dashboard page
│   └── ...
├── components/            # React Components
│   ├── ui/               # Shadcn/ui components
│   └── ...
├── lib/                   # Utilities & Helpers
│   ├── supabase/         # Supabase clients
│   ├── validations/      # Zod schemas
│   └── ...
├── docs/                  # เอกสารทั้งหมด
├── scripts/               # Utility scripts
└── ...
```

### คำสั่งที่ใช้บ่อย
```bash
npm run dev              # รัน dev server
npm run build            # Build สำหรับ production
npm run start            # รัน production server
npm run create-test-user # สร้าง test user
npm run test-login       # ทดสอบ login
npm run test-gemini      # ทดสอบ Gemini API
```

---

## 📄 License

This project is private and proprietary.

---

## 🙏 Credits

- **Next.js** - React Framework
- **Supabase** - Backend-as-a-Service
- **Google Gemini** - AI/LLM
- **LINE** - Messaging API
- **Shadcn/ui** - UI Components

---

**Last Updated:** 9 มีนาคม 2026
