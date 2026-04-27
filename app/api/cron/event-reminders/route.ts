import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { sendRoutineReminderToLine, sendMonthlyRoutineReminderToLine, sendHourlyHeadsUpToLine, sendUnifiedMorningSummaryToLine, sendWeeklySummaryToLine, resetReminderTracking, resetTaskReminderTracking, resetMonthlyRoutineTracking, resetDailySummaryTracking } from '@/lib/line/notifications'
import { fetchHourlyHeadsUpData } from '@/lib/line/timeline-data'
import { getAllLinkedUsers } from '@/lib/db/line-linking'
import { getMemberLineId } from '@/lib/db/home-members'
import { sendTextMessage } from '@/lib/line/client'
import { verifyCronAuth } from '@/lib/cron-auth'

// เช็คว่าควรส่งไป LINE นี้ไหม ตาม assigned_member_id
const memberLineCache = new Map<string, string | null>()
async function shouldSendTo(assignedMemberId: string | null, lineUserId: string): Promise<boolean> {
  if (!assignedMemberId) return true
  if (!memberLineCache.has(assignedMemberId)) {
    const memberLineId = await getMemberLineId(assignedMemberId)
    memberLineCache.set(assignedMemberId, memberLineId)
  }
  const memberLineId = memberLineCache.get(assignedMemberId)
  if (!memberLineId) return true
  return memberLineId === lineUserId
}

// หา LINE IDs ที่ต้องส่งสำหรับ user_id นี้
function getLineIdsForUser(linkedUsers: Array<{ user_id: string; line_user_id: string }>, userId: string): string[] {
  return linkedUsers.filter(u => u.user_id === userId).map(u => u.line_user_id)
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request.headers.get('authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const linkedUsers = await getAllLinkedUsers()

  if (linkedUsers.length === 0) {
    return NextResponse.json({ message: 'No linked users, skipped' })
  }

  resetReminderTracking()
  resetTaskReminderTracking()
  resetMonthlyRoutineTracking()
  memberLineCache.clear()
  const sent: string[] = []

  // หา unique user_ids
  const uniqueUserIds = [...new Set(linkedUsers.map(u => u.user_id).filter(Boolean))]

  // === เวลาปัจจุบัน (Bangkok) ===
  const now = new Date()
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const currentHour = bangkokNow.getHours()
  const currentMinute = bangkokNow.getMinutes()
  const currentDay = bangkokNow.getDay() // 0=อาทิตย์

  try {
    // === สรุปประจำวัน: ส่งช่วง 09:00-09:05 ===
    if (currentHour === 9 && currentMinute <= 5) {
      resetDailySummaryTracking()
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

      // Group LINE IDs by user_id
      const userLineMap = new Map<string, string[]>()
      for (const { user_id, line_user_id } of linkedUsers) {
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

        for (const lineUserId of lineIds) {
          const result = await sendUnifiedMorningSummaryToLine(lineUserId, userId)
          if (result.success) {
            sent.push(`daily: ${userId.slice(0, 8)} → ${lineUserId.slice(0, 8)}`)
          }
        }
      }
    }

    // === สรุปรายสัปดาห์: ส่งทุกวันอาทิตย์ 12:00-12:05 ===
    if (currentDay === 0 && currentHour === 12 && currentMinute <= 5) {
      const mondayOffset = -6
      const monday = new Date(bangkokNow)
      monday.setDate(bangkokNow.getDate() + mondayOffset)
      const mondayStr = monday.toLocaleDateString('en-CA')

      const userLineMap = new Map<string, string[]>()
      for (const { user_id, line_user_id } of linkedUsers) {
        if (!user_id) continue
        if (!userLineMap.has(user_id)) userLineMap.set(user_id, [])
        userLineMap.get(user_id)!.push(line_user_id)
      }

      for (const [userId, lineIds] of userLineMap) {
        // DB-level dedup: เช็คว่าสัปดาห์นี้ส่งไปแล้วหรือยัง
        const { data: existing } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'weekly_summary')
          .gte('created_at', mondayStr + 'T00:00:00+07:00')
          .limit(1)

        if (existing && existing.length > 0) {
          console.log(`[CRON] Weekly summary already sent for ${userId.slice(0, 8)} this week, skipping`)
          continue
        }

        for (const lineUserId of lineIds) {
          const result = await sendWeeklySummaryToLine(lineUserId, userId)
          if (result.success) {
            sent.push(`weekly: ${userId.slice(0, 8)} → ${lineUserId.slice(0, 8)}`)
          }
        }
      }
    }

    // === แจ้งเตือน event/task/routine (ทุกรอบ) ===
    for (const userId of uniqueUserIds) {
      const lineIds = getLineIdsForUser(linkedUsers, userId)

      // === ระดับ 2: แจ้งเตือนรวม 1 ชม. (events + tasks) ===
      const headsUpData = await fetchHourlyHeadsUpData(userId)

      for (const lineUserId of lineIds) {
        // Filter events ตาม assigned_member_id
        const filteredEvents = []
        for (const e of headsUpData.upcomingEvents) {
          if (await shouldSendTo(e.assigned_member_id, lineUserId)) {
            filteredEvents.push(e)
          }
        }

        // Filter tasks ตาม assigned_member_id
        const filteredTasks = []
        for (const t of headsUpData.upcomingTasks) {
          if (await shouldSendTo(t.assigned_member_id, lineUserId)) {
            filteredTasks.push(t)
          }
        }

        const lineData = {
          upcomingEvents: filteredEvents,
          upcomingTasks: filteredTasks,
          upcomingRoutines: [] as typeof headsUpData.upcomingRoutines,
          upcomingMonthlyRoutines: [] as typeof headsUpData.upcomingMonthlyRoutines,
        }

        if (lineData.upcomingEvents.length > 0 || lineData.upcomingTasks.length > 0) {
          const result = await sendHourlyHeadsUpToLine(lineUserId, userId, lineData)
          if (result.success) sent.push(`headsup: ${lineData.upcomingEvents.length}e+${lineData.upcomingTasks.length}t → ${lineUserId.slice(0, 8)}`)
        }
      }

      // Batch update dedup flags สำหรับ events ที่ส่งแล้ว
      const eventIds = headsUpData.upcomingEvents.map(e => e.id)
      if (eventIds.length > 0) {
        await adminClient.from('events').update({ reminder_1h_sent: true }).in('id', eventIds)
      }

      // Batch update dedup flags สำหรับ tasks ที่ส่งแล้ว
      const taskIds = headsUpData.upcomingTasks.map(t => t.id)
      if (taskIds.length > 0) {
        await adminClient.from('tasks').update({ reminder_1h_sent: true }).in('id', taskIds)
      }

      // === Routine reminder ตามเวลาจริง ===
      const readyRoutines = headsUpData.upcomingRoutines
      const readyMonthly = headsUpData.upcomingMonthlyRoutines

      if (readyRoutines.length > 0 || readyMonthly.length > 0) {
        for (const lineUserId of lineIds) {
          // Filter routines ตาม assigned_member_id
          const routinesForLine = []
          for (const r of readyRoutines) {
            if (await shouldSendTo(r.assigned_member_id, lineUserId)) {
              routinesForLine.push(r)
            }
          }
          const monthlyForLine = []
          for (const r of readyMonthly) {
            if (await shouldSendTo(r.assigned_member_id, lineUserId)) {
              monthlyForLine.push(r)
            }
          }

          // ถ้ามีหลายอันรวมเป็น 1 ข้อความ
          const allRoutineItems = [
            ...routinesForLine.map(r => ({
              type: 'routine' as const,
              routine: r,
            })),
            ...monthlyForLine.map(r => ({
              type: 'monthly' as const,
              routine: r,
            })),
          ]

          if (allRoutineItems.length === 0) continue

          if (allRoutineItems.length === 1) {
            const item = allRoutineItems[0]
            if (item.type === 'routine') {
              const result = await sendRoutineReminderToLine(lineUserId, item.routine)
              if (result.success) sent.push(`routine: ${item.routine.title} → ${lineUserId.slice(0, 8)}`)
            } else {
              const result = await sendMonthlyRoutineReminderToLine(lineUserId, item.routine)
              if (result.success) sent.push(`monthly: ${item.routine.title} → ${lineUserId.slice(0, 8)}`)
            }
          } else {
            let message = `⏰ กิจวัตรที่ต้องทำ!\n`
            allRoutineItems.forEach((item, i) => {
              const r = item.routine
              const timeStr = r.routine_time?.slice(0, 5) || ''
              if (item.type === 'monthly') {
                const dom = (r as typeof readyMonthly[number]).day_of_month
                const dayLabel = dom === 32 ? 'สิ้นเดือน' : `ทุกวันที่ ${dom}`
                message += `\n${i + 1}. 📅 ${r.title}\n`
                message += `   🕐 เวลา ${timeStr} น. (${dayLabel})\n`
              } else {
                message += `\n${i + 1}. ⏰ ${r.title}\n`
                message += `   🕐 เวลา ${timeStr} น.\n`
              }
              if (r.description) message += `   📝 ${r.description}\n`
            })

            const result = await sendTextMessage(lineUserId, message)
            if (result.success) sent.push(`routines-combined: ${allRoutineItems.length} → ${lineUserId.slice(0, 8)}`)
          }
        }

        // Batch update dedup flags สำหรับ routines
        const routineIds = readyRoutines.map(r => r.id)
        if (routineIds.length > 0) {
          await adminClient.from('routines').update({ last_reminded_date: headsUpData.todayDateStr }).in('id', routineIds)
        }

        // Batch update dedup flags สำหรับ monthly routines
        const monthlyIds = readyMonthly.map(r => r.id)
        if (monthlyIds.length > 0) {
          await adminClient.from('monthly_routines').update({ last_reminded_date: headsUpData.todayDateStr }).in('id', monthlyIds)
        }
      }
    }

    return NextResponse.json({ message: 'All reminders processed', sent, usersCount: uniqueUserIds.length })
  } catch (error) {
    console.error('[CRON] Event reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
