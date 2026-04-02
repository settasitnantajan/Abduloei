import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendDailySummaryToLine, resetDailySummaryTracking } from '@/lib/line/notifications'
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

  resetDailySummaryTracking()
  const linkedUsers = await getAllLinkedUsers()

  if (linkedUsers.length === 0) {
    return NextResponse.json({ message: 'No linked users, skipped' })
  }

  const sent: string[] = []

  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    for (const { user_id: userId, line_user_id: lineUserId } of linkedUsers) {
      // เช็คว่าวันนี้ส่ง daily_summary ไปแล้วหรือยัง (DB-level dedup)
      if (userId) {
        const { data: existing } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'daily_summary')
          .gte('created_at', todayStr + 'T00:00:00+07:00')
          .limit(1)

        if (existing && existing.length > 0) {
          console.log(`[CRON] Daily summary already sent for ${userId.slice(0, 8)} today, skipping`)
          continue
        }
      }

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
