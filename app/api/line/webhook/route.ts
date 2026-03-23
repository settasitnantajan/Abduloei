import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { replyLineMessage } from '@/lib/line/client'

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

    if (eventType === 'follow') {
      console.log(`[LINE Webhook] New follower! LINE User ID: ${userId}`)
      console.log('[LINE Webhook] เอา User ID นี้ไปใส่ใน .env.local เป็น LINE_USER_ID')

      if (event.replyToken) {
        await replyLineMessage(event.replyToken, [
          { type: 'text', text: 'สวัสดีค่ะ! ระบบพร้อมส่งแจ้งเตือนให้แล้วนะคะ' },
        ])
      }
    }

    if (eventType === 'message') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[LINE Webhook] Message from ${userId}: ${event.message?.text || '(non-text)'}`)
      }

      if (event.replyToken) {
        await replyLineMessage(event.replyToken, [
          { type: 'text', text: 'ได้รับข้อความแล้วค่ะ' },
        ])
      }
    }
  }

  return NextResponse.json({ message: 'OK' })
}
