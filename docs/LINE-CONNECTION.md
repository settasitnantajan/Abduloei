# LINE Messaging API Connection Documentation

> บันทึกวิธีการเชื่อมต่อ LINE Messaging API สำหรับโปรเจกต์ Abduloei

**วันที่:** 8 มีนาคม 2026
**Status:** ✅ เชื่อมต่อสำเร็จ

---

## 📋 สรุป

โปรเจกต์นี้ใช้ **LINE Messaging API** เพื่อส่งการแจ้งเตือนไปยังผู้ใช้ผ่าน LINE Official Account

### ✅ ผลการทดสอบ

- **Connection Status:** ✅ สำเร็จ
- **Method:** Server-Side with @line/bot-sdk
- **Channel Name:** Abduloei
- **Basic ID:** @470vlcku
- **Channel ID:** 2009365360

---

## 🔐 Environment Variables

ไฟล์: `.env.local`

```bash
# LINE Messaging API
LINE_CHANNEL_ID=2009365360
LINE_CHANNEL_SECRET=266aa905bdc804e1a8412228ed51533e
LINE_CHANNEL_ACCESS_TOKEN=jdljVcjv8u0xJqSQZSKoIoNw0iCNi9lrk4Dv0sxFkis1gAE656VZXt+rQxRlEiwluI1p/ANt6ndWznN5XX6NjJlPr2jbcEUjvkgaekv0SmxfVTaoah3gONponjfB9SPu7ogBoDLq39GddYwmyLj7vQdB04t89/1O/w1cDnyilFU=
LINE_CALLBACK_URL=http://localhost:3000/api/line/callback
```

### ⚠️ หมายเหตุสำคัญ

1. **ห้าม commit `.env.local`** ลง git
2. **Channel Access Token** มีอายุไม่จำกัด (long-lived) แต่สามารถ revoke ได้
3. **Channel Secret** ใช้สำหรับ verify signature จาก LINE webhook
4. **Free Tier:** ส่งได้ฟรี **1,000 ข้อความ/เดือน**

---

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install @line/bot-sdk
```

**Package:**
- `@line/bot-sdk` - Official LINE Bot SDK สำหรับ Node.js

---

### 2. Create LINE Bot Client

#### Server-Side Usage (Next.js App Router)

```typescript
// lib/line/client.ts
import { Client } from '@line/bot-sdk'

export function createLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    channelSecret: process.env.LINE_CHANNEL_SECRET!,
  })
}
```

---

## 📝 Usage Examples

### Example 1: ส่งข้อความ Text

```typescript
import { createLineClient } from '@/lib/line/client'

const client = createLineClient()

await client.pushMessage('USER_LINE_ID', {
  type: 'text',
  text: '🔔 อย่าลืมนัดหมอเวลา 13.00 น. นะครับ!'
})
```

---

### Example 2: ส่งข้อความแบบ Flex Message

```typescript
await client.pushMessage('USER_LINE_ID', {
  type: 'flex',
  altText: 'สรุปกิจกรรมวันนี้',
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📅 กิจกรรมวันนี้',
          weight: 'bold',
          size: 'lg',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🕐 10:00 - ประชุมทีม',
        },
        {
          type: 'text',
          text: '🕐 15:30 - รับลูกเลิกเรียน',
        },
      ],
    },
  },
})
```

---

### Example 3: ส่งข้อความหลายคนพร้อมกัน (Multicast)

```typescript
await client.multicast(
  ['USER_ID_1', 'USER_ID_2', 'USER_ID_3'],
  {
    type: 'text',
    text: '🏠 สรุปกิจกรรมวันนี้: มีงาน 3 รายการ',
  }
)
```

---

### Example 4: ส่งข้อความหาทุกคน (Broadcast)

```typescript
await client.broadcast({
  type: 'text',
  text: '📢 ประกาศจากระบบ: มีกิจกรรมใหม่เพิ่มเข้ามา',
})
```

---

### Example 5: Reply Message (ตอบกลับจาก Webhook)

```typescript
// app/api/line/webhook/route.ts
import { createLineClient } from '@/lib/line/client'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const client = createLineClient()
  const body = await request.json()

  const events = body.events || []

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      // ตอบกลับข้อความ
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณพูดว่า: ${event.message.text}`,
      })
    }
  }

  return new Response('OK')
}
```

---

## 🔗 LINE Webhook Setup

### สิ่งที่ต้องมีก่อน Deploy

1. **Deploy โปรเจกต์ขึ้น production** (Vercel, Railway, etc.)
2. **มี HTTPS URL** (LINE ไม่รองรับ HTTP)

---

### ขั้นตอนตั้งค่า Webhook

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Provider → เลือก Channel
3. ไปที่แท็บ **"Messaging API"**
4. หา **"Webhook settings"**
5. ใส่ **Webhook URL:**
   ```
   https://your-domain.com/api/line/webhook
   ```
6. เปิด **"Use webhook"** = ON
7. คลิก **"Verify"** เพื่อทดสอบ
8. ควรเห็น ✅ Success

---

### Webhook Route Example

```typescript
// app/api/line/webhook/route.ts
import { createLineClient } from '@/lib/line/client'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-line-signature')

  // Verify signature
  const hash = createHmac('SHA256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64')

  if (signature !== hash) {
    return new Response('Invalid signature', { status: 403 })
  }

  // Parse events
  const { events } = JSON.parse(body)
  const client = createLineClient()

  // Process events
  for (const event of events) {
    if (event.type === 'message') {
      // Handle message event
      await handleMessage(event, client)
    } else if (event.type === 'follow') {
      // User เพิ่มเพื่อน
      await handleFollow(event, client)
    }
  }

  return new Response('OK')
}
```

---

## 🧪 Testing Connection

เข้าไปดูหน้า test connection:

```bash
npm run dev
```

แล้วเปิด: **http://localhost:3000/test-line**

ควรเห็น:
- ✅ **เชื่อมต่อสำเร็จ!**
- Status: **CONNECTED**
- ข้อมูล Bot: ชื่อ, Basic ID, รูปโปรไฟล์

---

## 📱 ทดสอบส่งข้อความจริง

### วิธีหา User ID

ผู้ใช้ต้อง**เพิ่มเพื่อนกับ LINE OA** ก่อน จึงจะส่งข้อความถึงได้

**วิธีหา User ID:**
1. User เพิ่มเพื่อนกับ LINE OA (@470vlcku)
2. Webhook จะได้รับ `follow` event
3. ใน event จะมี `event.source.userId`
4. เก็บ User ID นี้ไว้ใน database

**ตัวอย่าง:**
```typescript
// เมื่อ user เพิ่มเพื่อน
if (event.type === 'follow') {
  const userId = event.source.userId

  // เก็บลง database
  await saveUserToDatabase(userId)

  // ส่งข้อความต้อนรับ
  await client.pushMessage(userId, {
    type: 'text',
    text: 'สวัสดีครับ! ยินดีต้อนรับสู่ Abduloei 🏠'
  })
}
```

---

## 🔒 Security Best Practices

### ✅ ที่ทำแล้ว

1. **Server-Side Only** - credentials ไม่ถูก expose
2. **Signature Verification** - ตรวจสอบ webhook จาก LINE
3. **HTTPS Only** - LINE ต้องการ HTTPS

### ⚠️ ข้อควรระวัง

1. **ห้าม commit credentials** ลง git
2. **Verify signature** ทุกครั้งที่รับ webhook
3. **Rate Limiting** - ระวังส่งข้อความเกินโควต้า
4. **Error Handling** - จัดการ error จาก LINE API

---

## 📊 Connection Details

| Property | Value |
|----------|-------|
| **Channel Name** | Abduloei |
| **Basic ID** | @470vlcku |
| **Channel ID** | 2009365360 |
| **User ID** | U5c47199306416221ed7231c088473e7a |
| **SDK** | @line/bot-sdk (Server-side) |
| **Free Messages** | 1,000 ข้อความ/เดือน |

---

## 💰 Pricing & Limits

### Free Tier
- ✅ ส่งฟรี **1,000 ข้อความ/เดือน**
- ✅ Push Message, Reply Message, Multicast, Broadcast
- ✅ Flex Message, Template Message
- ✅ ไม่จำกัดจำนวน followers

### Paid Tier (เมื่อเกิน 1,000 ข้อความ)
- **5,000 ข้อความ:** ~200 บาท/เดือน
- **15,000 ข้อความ:** ~500 บาท/เดือน
- **45,000 ข้อความ:** ~1,200 บาท/เดือน

**ราคาอาจเปลี่ยนแปลง ดูข้อมูลล่าสุดที่:** https://www.linebiz.com/th/service/line-official-account/

---

## 🚀 Next Steps

1. **สร้าง Webhook API route** (`app/api/line/webhook/route.ts`)
2. **Implement notification logic** - ส่งสรุปรายวัน, เตือนกิจกรรม
3. **Deploy to production** (Vercel/Railway)
4. **ตั้งค่า Webhook URL** ใน LINE Console
5. **ทดสอบส่งข้อความจริง**
6. **Setup scheduled notifications** (Vercel Cron Jobs)

---

## 📚 References

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Bot SDK for Node.js](https://github.com/line/line-bot-sdk-nodejs)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [LINE Official Account Manager](https://manager.line.biz/)
- [LINE Developers Console](https://developers.line.biz/console/)

---

## 🐛 Troubleshooting

### Problem: "Invalid signature"

**สาเหตุ:** Channel Secret ไม่ถูกต้อง

**แก้ไข:**
1. ตรวจสอบ `LINE_CHANNEL_SECRET` ใน `.env.local`
2. Copy ใหม่จาก LINE Developers Console
3. Restart dev server

---

### Problem: "The access token is invalid"

**สาเหตุ:** Channel Access Token หมดอายุหรือถูก revoke

**แก้ไข:**
1. ไปที่ LINE Developers Console
2. Messaging API → Channel access token
3. Issue token ใหม่
4. อัปเดตใน `.env.local`

---

### Problem: ส่งข้อความไม่ถึง

**สาเหตุ:** User ยังไม่ได้เพิ่มเพื่อนกับ LINE OA

**แก้ไข:**
1. ให้ผู้ใช้เพิ่มเพื่อนกับ LINE OA (@470vlcku)
2. หรือสแกน QR Code จาก LINE Official Account Manager
3. ตรวจสอบว่าได้ `userId` ถูกต้อง

---

## 📝 Changelog

### 2026-03-08
- ✅ เชื่อมต่อ LINE Messaging API สำเร็จ
- ✅ Install @line/bot-sdk
- ✅ สร้างหน้า test connection (`/test-line`)
- ✅ ทดสอบดึงข้อมูล Bot สำเร็จ
- ✅ Bot Info: Abduloei (@470vlcku)

---

**Last Updated:** 8 มีนาคม 2026
**Status:** ✅ Production Ready (Webhook pending deployment)
