import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { sendUnifiedMorningSummaryToLine, resetDailySummaryTracking } from '@/lib/line/notifications'
import { getAllLinkedUsers } from '@/lib/db/line-linking'
import { verifyCronAuth } from '@/lib/cron-auth'

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

    // Group LINE IDs by user_id
    const userLineMap = new Map<string, string[]>()
    for (const { user_id, line_user_id } of linkedUsers) {
      // skip entries without a real user_id
      if (!user_id) continue
      if (!userLineMap.has(user_id)) userLineMap.set(user_id, [])
      userLineMap.get(user_id)!.push(line_user_id)
    }

    for (const [userId, lineIds] of userLineMap) {
      // DB-level dedup: เช็คว่าวันนี้ส่งไปแล้วหรือยัง
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

      // ส่งทุก LINE ID ของ user นี้
      for (const lineUserId of lineIds) {
        const result = await sendUnifiedMorningSummaryToLine(lineUserId, userId)
        if (result.success) {
          sent.push(`${userId.slice(0, 8)} → ${lineUserId.slice(0, 8)}`)
        }
      }
    }

    return NextResponse.json({ message: 'Daily summary sent', sent, usersCount: linkedUsers.length })
  } catch (error) {
    console.error('[CRON] Daily summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
