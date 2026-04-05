import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { sendRoutineReminderToLine, sendMonthlyRoutineReminderToLine, sendHourlyHeadsUpToLine, resetReminderTracking, resetTaskReminderTracking, resetMonthlyRoutineTracking } from '@/lib/line/notifications'
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

  try {
    for (const userId of uniqueUserIds) {
      const lineIds = getLineIdsForUser(linkedUsers, userId)

      // === ระดับ 2: แจ้งเตือนรวม 1 ชม. (events + tasks + routines + monthly) ===
      const headsUpData = await fetchHourlyHeadsUpData(userId)

      // Filter events/tasks 45-75 นาทีที่ผ่าน shouldSendTo แล้วส่งรวม
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

        // ไม่ใส่ routines ใน heads-up 1 ชม. — routines จะแจ้งเตือนตามเวลาจริงแทน

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
      // รวม routines ที่พร้อมแจ้งเตือนเป็น 1 ข้อความต่อ LINE ID
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
            // ส่งแบบเดิม (1 อัน)
            const item = allRoutineItems[0]
            if (item.type === 'routine') {
              const result = await sendRoutineReminderToLine(lineUserId, item.routine)
              if (result.success) sent.push(`routine: ${item.routine.title} → ${lineUserId.slice(0, 8)}`)
            } else {
              const result = await sendMonthlyRoutineReminderToLine(lineUserId, item.routine)
              if (result.success) sent.push(`monthly: ${item.routine.title} → ${lineUserId.slice(0, 8)}`)
            }
          } else {
            // รวมเป็น 1 ข้อความ
            let message = `⏰ กิจวัตรที่ต้องทำ!\n`
            for (const item of allRoutineItems) {
              const r = item.routine
              const timeStr = r.routine_time?.slice(0, 5) || ''
              if (item.type === 'monthly') {
                const dom = (r as typeof readyMonthly[number]).day_of_month
                const dayLabel = dom === 32 ? 'สิ้นเดือน' : `วันที่ ${dom}`
                message += `\n📅 ${r.title} — ${dayLabel} ${timeStr} น.`
              } else {
                message += `\n⏰ ${r.title} — ${timeStr} น.`
              }
              if (r.description) message += `\n  ${r.description}`
            }

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

    return NextResponse.json({ message: 'Event & routine reminders processed', sent, usersCount: uniqueUserIds.length })
  } catch (error) {
    console.error('[CRON] Event reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
