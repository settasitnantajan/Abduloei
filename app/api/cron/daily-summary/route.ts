import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendDailySummaryToLine } from '@/lib/line/notifications'

function verifyCronAuth(authHeader: string | null): { ok: boolean; status?: number; message?: string } {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured')
    return { ok: false, status: 500, message: 'Server misconfigured' }
  }
  if (!authHeader) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  const expected = `Bearer ${cronSecret}`
  if (authHeader.length !== expected.length) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  const isValid = crypto.timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expected)
  )
  if (!isValid) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }
  return { ok: true }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const lineUserId = process.env.LINE_USER_ID
  if (!lineUserId) {
    console.warn('[CRON] LINE_USER_ID not set, skipping daily summary')
    return NextResponse.json({ message: 'LINE_USER_ID not set, skipped' })
  }

  try {
    const result = await sendDailySummaryToLine(lineUserId)

    if (result.success) {
      return NextResponse.json({ message: 'Daily summary sent' })
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('[CRON] Daily summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
