# 📚 เอกสารโปรเจกต์ Abduloei

> สารบัญเอกสารทั้งหมดสำหรับ AI Home Assistant

---

## 🚀 เริ่มต้นใช้งาน (Quick Start)

แนะนำให้อ่านเอกสารตามลำดับนี้:

1. [Features](./FEATURES.md) - ทำความเข้าใจฟีเจอร์ทั้งหมด
2. [Supabase Connection](./SUPABASE-CONNECTION.md) - เชื่อมต่อ Database
3. [LINE Connection](./LINE-CONNECTION.md) - เชื่อมต่อ LINE API
4. [Database Schema](./DATABASE-SCHEMA.md) - โครงสร้าง Database
5. [UI Pages](./UI-PAGES.md) - การออกแบบหน้าต่างๆ

---

## 📖 เอกสารทั้งหมด

### 🔧 การตั้งค่าและเชื่อมต่อ (Setup & Connection)

#### [Supabase Connection](./SUPABASE-CONNECTION.md)
- วิธีการเชื่อมต่อ Supabase (Server-side only)
- การตั้งค่า Environment Variables
- การใช้ Server Client และ Service Role
- **สำคัญ**: ไม่ใช้ `NEXT_PUBLIC_*` เพื่อความปลอดภัย

#### [LINE Connection](./LINE-CONNECTION.md)
- การสร้าง LINE Official Account
- การเอา Channel ID, Secret, Access Token
- วิธีการทดสอบการเชื่อมต่อ
- ข้อจำกัด Free Tier (1,000 ข้อความ/เดือน)

#### [Gemini Models](./GEMINI-MODELS.md)
- รายการ AI Models ที่ใช้ได้ทั้งหมด (45 โมเดล)
- โมเดลที่แนะนำ: gemini-2.5-flash, gemini-2.5-pro
- ผลการทดสอบภาษาไทย
- ตัวอย่างการแปลงคำสั่งเป็น JSON

---

### 🗄️ Database & Schema

#### [Database Schema](./DATABASE-SCHEMA.md)
- โครงสร้างตาราง Database ทั้งหมด
- ความสัมพันธ์ระหว่างตาราง (ERD)
- Row Level Security (RLS) Policies
- Functions และ Triggers
- ตาราง:
  - `auth.users` - ข้อมูลผู้ใช้
  - `public.profiles` - โปรไฟล์เพิ่มเติม
  - `public.homes` - ข้อมูลบ้าน
  - `public.home_members` - สมาชิกในบ้าน
  - `public.events` - กิจกรรมและนัดหมาย
  - `public.tasks` - งานที่ต้องทำ
  - `public.notes` - บันทึกต่างๆ
  - `public.chat_conversations` - การสนทนา
  - `public.chat_messages` - ข้อความแชท

---

### ✨ Features & Design

#### [Features](./FEATURES.md)
- รายละเอียดฟีเจอร์ทั้งหมด 10+ ฟีเจอร์
- วิธีการทำงานของแต่ละฟีเจอร์
- การแจ้งเตือนผ่าน LINE
- Multi-home support
- Voice input
- AI Chat Assistant

#### [UI Pages](./UI-PAGES.md)
- การออกแบบหน้าต่างๆ
- Color Scheme (Dark Mode)
- Layout และ Navigation
- หน้าที่มี:
  - Login / Forgot Password / Reset Password
  - Dashboard
  - Chat
  - Events
  - Tasks
  - Notes
  - Settings
  - Homes

#### [LINE Integration](./LINE-INTEGRATION.md)
- วิธีการส่งการแจ้งเตือนผ่าน LINE
- การใช้ LINE Messaging API
- ตัวอย่าง Code สำหรับส่งข้อความ
- Rich Message Templates
- Webhook Integration

---

### 🧪 การทดสอบและวิจัย (Testing & Research)

#### [Login Test Summary](./LOGIN-TEST-SUMMARY.md)
- สรุปผลการทดสอบระบบ Login
- ปัญหาที่พบและวิธีแก้ไข
- Email + Password authentication
- Session management

#### [Test Report](./TEST-REPORT.md)
- รายงานการทดสอบแบบละเอียด
- Test cases ทั้งหมด
- ผลการทดสอบแต่ละฟีเจอร์
- Performance testing

#### [Research Summary](./research-summary.md)
- การวิจัยและแนวทางการพัฒนา
- เทคโนโลยีที่เลือกใช้และเหตุผล
- Best practices
- แนวทางการแก้ปัญหา

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16.1.6 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + Shadcn/ui + Dark Mode
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **Authentication**: Supabase Auth (Email + Password)
- **AI**: Google Gemini 2.5 Flash
- **Notifications**: LINE Messaging API
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod
- **State Management**: Zustand

---

## 📂 โครงสร้างโปรเจกต์

```
abduloei/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions (auth, etc.)
│   ├── api/               # API Routes
│   ├── login/             # Login page
│   ├── dashboard/         # Dashboard page
│   └── ...
├── components/            # React Components
│   ├── ui/               # Shadcn/ui components
│   └── ...
├── lib/                   # Utilities & Helpers
│   ├── supabase/         # Supabase clients (server-side only)
│   ├── validations/      # Zod schemas
│   └── ...
├── docs/                  # เอกสารทั้งหมด (อยู่ที่นี่)
├── scripts/               # Utility scripts
│   ├── create-test-user.ts
│   ├── test-login.ts
│   └── test-gemini.ts
└── ...
```

---

## 🔐 ความปลอดภัย (Security)

**สำคัญมาก**: โปรเจกต์นี้ใช้ **Server-side only** approach

- ❌ **ไม่ใช้** `NEXT_PUBLIC_SUPABASE_URL`
- ❌ **ไม่ใช้** Client-side Supabase
- ✅ **ใช้เฉพาะ** Server-side Supabase (`lib/supabase/server.ts`)
- ✅ **ใช้เฉพาะ** Server Actions สำหรับ Database queries
- ✅ Environment Variables ทั้งหมดเป็น server-side only

ดูรายละเอียดใน [Supabase Connection](./SUPABASE-CONNECTION.md)

---

## 📱 Features Status

### ✅ ทำเสร็จแล้ว
- ระบบ Login (Email + Password)
- Dark Mode (Black Background)
- Dashboard (Placeholder)
- Database Schema (พร้อมใช้งาน)
- Supabase Connection
- LINE API Connection
- Gemini API Setup

### 🚧 กำลังพัฒนา
- หน้า Chat (AI Conversation)
- Voice Input (Web Speech API)
- การจัดการ Events
- การจัดการ Tasks
- การจัดการ Notes
- Multi-home Support
- LINE Notifications

---

## 🎨 UI/UX Design

**Theme**: Dark Mode (Black Background)
- Background: `#000000`
- Card: `#1A1A1A`
- Card Hover: `#2A2A2A`
- Border: `#333333`
- Text: `#FFFFFF`
- LINE Green: `#00B900`

ดูรายละเอียดใน [UI Pages](./UI-PAGES.md)

---

## 🤖 AI Integration

**Model ที่ใช้**: `gemini-2.5-flash`

**ความสามารถ**:
- รองรับภาษาไทย 100%
- แปลงคำสั่งภาษาไทยเป็น JSON
- สร้าง Events, Tasks, Notes จากคำสั่ง
- ตอบคำถามและแชท
- Voice-to-Text (Web Speech API)

ดูโมเดลทั้งหมดใน [Gemini Models](./GEMINI-MODELS.md)

---

## 📞 Support & Contact

หากมีคำถามหรือปัญหา:
1. อ่านเอกสารที่เกี่ยวข้องก่อน
2. ตรวจสอบ [Test Report](./TEST-REPORT.md) ว่ามีปัญหาคล้ายกันหรือไม่
3. ดู [Research Summary](./research-summary.md) สำหรับแนวทางแก้ปัญหา

---

**Last Updated**: 9 มีนาคม 2026
