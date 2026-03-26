import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { replyLineMessage } from '@/lib/line/client'
import { verifyAndLinkCode } from '@/lib/db/line-linking'
import { adminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) {
    return NextResponse.json({ error: 'LINE_CHANNEL_SECRET not set' }, { status: 500 })
  }

  const bodyText = await request.text()

  // Verify LINE signature ด้วย constant-time comparison
  const signature = request.headers.get('x-line-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const expectedSignature = crypto
    .createHmac('SHA256', channelSecret)
    .update(bodyText)
    .digest('base64')

  if (signature.length !== expectedSignature.length) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )

  if (!isValid) {
    console.warn('[LINE Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let body: { events?: Array<{ type: string; source?: { userId?: string }; replyToken?: string; message?: { text?: string } }> }
  try {
    body = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const events = body.events || []

  for (const event of events) {
    const userId = event.source?.userId
    const eventType = event.type

    console.log(`[LINE Webhook] Event: ${eventType}, User ID: ${userId}`)

    if (eventType === 'follow' && userId) {
      // เช็คว่า LINE ID นี้ผูกอยู่แล้วหรือยัง
      const { data: existing } = await adminClient
        .from('user_line_accounts')
        .select('user_id')
        .eq('line_user_id', userId)
        .maybeSingle()

      if (event.replyToken) {
        if (existing) {
          await replyLineMessage(event.replyToken, [
            { type: 'text', text: 'ยินดีต้อนรับกลับค่ะ! ระบบพร้อมส่งแจ้งเตือนให้แล้วนะคะ' },
          ])
        } else {
          await replyLineMessage(event.replyToken, [
            { type: 'text', text: 'สวัสดีค่ะ! กรุณาพิมพ์รหัส 6 หลักจากเว็บเพื่อเชื่อมบัญชีนะคะ' },
          ])
        }
      }
    }

    if (eventType === 'message' && userId) {
      const messageText = event.message?.text?.trim() || ''

      // เช็คว่าเป็น linking code 6 หลักหรือไม่
      if (/^\d{6}$/.test(messageText)) {
        const result = await verifyAndLinkCode(userId, messageText)

        if (event.replyToken) {
          if (result.success) {
            await replyLineMessage(event.replyToken, [
              { type: 'text', text: 'เชื่อมบัญชีสำเร็จแล้วค่ะ! ระบบจะส่งแจ้งเตือนนัดหมายและกิจวัตรให้ทาง LINE นะคะ' },
            ])
          } else {
            await replyLineMessage(event.replyToken, [
              { type: 'text', text: `${result.error || 'รหัสไม่ถูกต้อง'} กรุณาสร้างรหัสใหม่จากเว็บค่ะ` },
            ])
          }
        }
      } else {
        // ข้อความทั่วไป
        if (event.replyToken) {
          await replyLineMessage(event.replyToken, [
            { type: 'text', text: 'ได้รับข้อความแล้วค่ะ' },
          ])
        }
      }
    }
  }

  return NextResponse.json({ message: 'OK' })
}
