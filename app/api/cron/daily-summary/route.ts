import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendDailySummaryToLine } from '@/lib/line/notifications'
import { getAllLinkedUsers } from '@/lib/db/line-linking'

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

  // ดึง users ที่ผูก LINE แล้ว + fallback env
  let linkedUsers = await getAllLinkedUsers()

  if (linkedUsers.length === 0) {
    const fallbackLineUserId = process.env.LINE_USER_ID
    if (!fallbackLineUserId) {
      return NextResponse.json({ message: 'No linked users and LINE_USER_ID not set, skipped' })
    }
    linkedUsers = [{ user_id: '', line_user_id: fallbackLineUserId }]
  }

  const sent: string[] = []

  try {
    for (const { user_id: userId, line_user_id: lineUserId } of linkedUsers) {
      const result = await sendDailySummaryToLine(lineUserId, userId || undefined)
      if (result.success) {
        sent.push(userId ? userId.slice(0, 8) : 'env')
      }
    }

    return NextResponse.json({ message: 'Daily summary sent', sent, usersCount: linkedUsers.length })
  } catch (error) {
    console.error('[CRON] Daily summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
