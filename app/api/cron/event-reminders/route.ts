import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendEventReminderToLine, sendRoutineReminderToLine, sendTaskReminderToLine, sendMonthlyRoutineReminderToLine, resetReminderTracking, resetTaskReminderTracking, resetMonthlyRoutineTracking } from '@/lib/line/notifications'
import { getAllLinkedUsers } from '@/lib/db/line-linking'
import { getMemberLineId } from '@/lib/db/home-members'

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
  const now = new Date()
  const nowMs = now.getTime()
  const sent: string[] = []

  // หา unique user_ids
  const uniqueUserIds = [...new Set(linkedUsers.map(u => u.user_id).filter(Boolean))]

  try {
    for (const userId of uniqueUserIds) {
      const lineIds = getLineIdsForUser(linkedUsers, userId)

      // --- เตือน 1 วันก่อน (23-25 ชม.) ---
      const in23h = new Date(nowMs + 23 * 60 * 60 * 1000)
      const in25h = new Date(nowMs + 25 * 60 * 60 * 1000)

      const { data: events1d } = await adminClient
        .from('events')
        .select('id, user_id, title, description, event_date, event_time, location, assigned_member_id')
        .eq('reminder_1d_sent', false)
        .eq('user_id', userId)
        .gte('event_date', in23h.toISOString().split('T')[0])
        .lte('event_date', in25h.toISOString().split('T')[0])

      if (events1d) {
        for (const event of events1d) {
          const eventDateTime = buildEventDate(event.event_date, event.event_time)
          if (!eventDateTime) continue
          if (eventDateTime.getTime() < nowMs) continue

          const diffHours = (eventDateTime.getTime() - nowMs) / (1000 * 60 * 60)
          if (diffHours >= 23 && diffHours <= 25) {
            // ส่งทุก LINE ID ก่อน แล้วค่อย update flag
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(event.assigned_member_id, lineUserId))) continue
              const result = await sendEventReminderToLine(lineUserId, event, 'พรุ่งนี้มีนัด!')
              if (result.success) sent.push(`1d: ${event.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('events').update({ reminder_1d_sent: true }).eq('id', event.id)
          }
        }
      }

      // --- เตือน 1 ชม.ก่อน (45-75 นาที) ---
      const in55m = new Date(nowMs + 55 * 60 * 1000)
      const in65m = new Date(nowMs + 65 * 60 * 1000)

      const { data: events1h } = await adminClient
        .from('events')
        .select('id, user_id, title, description, event_date, event_time, location, assigned_member_id')
        .eq('reminder_1h_sent', false)
        .eq('user_id', userId)
        .gte('event_date', in55m.toISOString().split('T')[0])
        .lte('event_date', in65m.toISOString().split('T')[0])

      if (events1h) {
        for (const event of events1h) {
          if (!event.event_time) continue
          const eventDateTime = buildEventDate(event.event_date, event.event_time)
          if (!eventDateTime) continue
          if (eventDateTime.getTime() < nowMs) continue

          const diffMinutes = (eventDateTime.getTime() - nowMs) / (1000 * 60)
          if (diffMinutes >= 45 && diffMinutes <= 75) {
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(event.assigned_member_id, lineUserId))) continue
              const result = await sendEventReminderToLine(lineUserId, event, 'อีก 1 ชั่วโมง!')
              if (result.success) sent.push(`1h: ${event.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('events').update({ reminder_1h_sent: true }).eq('id', event.id)
          }
        }
      }

      // --- เตือนงาน (Tasks) ก่อน 1 วัน ---
      const { data: tasks1d } = await adminClient
        .from('tasks')
        .select('id, user_id, title, description, due_date, due_time, assigned_member_id')
        .eq('status', 'pending')
        .eq('reminder_1d_sent', false)
        .eq('user_id', userId)
        .not('due_date', 'is', null)

      if (tasks1d) {
        for (const task of tasks1d) {
          const taskDateTime = buildEventDate(task.due_date, task.due_time)
          if (!taskDateTime) continue
          if (taskDateTime.getTime() < nowMs) continue

          const diffHours = (taskDateTime.getTime() - nowMs) / (1000 * 60 * 60)
          if (diffHours >= 23 && diffHours <= 25) {
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(task.assigned_member_id, lineUserId))) continue
              const result = await sendTaskReminderToLine(lineUserId, task, 'พรุ่งนี้มีงาน!')
              if (result.success) sent.push(`task-1d: ${task.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('tasks').update({ reminder_1d_sent: true }).eq('id', task.id)
          }
        }
      }

      // --- เตือนงาน (Tasks) ก่อน 1 ชม. ---
      const { data: tasks1h } = await adminClient
        .from('tasks')
        .select('id, user_id, title, description, due_date, due_time, assigned_member_id')
        .eq('status', 'pending')
        .eq('reminder_1h_sent', false)
        .eq('user_id', userId)
        .not('due_date', 'is', null)
        .not('due_time', 'is', null)

      if (tasks1h) {
        for (const task of tasks1h) {
          if (!task.due_time) continue
          const taskDateTime = buildEventDate(task.due_date, task.due_time)
          if (!taskDateTime) continue
          if (taskDateTime.getTime() < nowMs) continue

          const diffMinutes = (taskDateTime.getTime() - nowMs) / (1000 * 60)
          if (diffMinutes >= 45 && diffMinutes <= 75) {
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(task.assigned_member_id, lineUserId))) continue
              const result = await sendTaskReminderToLine(lineUserId, task, 'อีก 1 ชั่วโมง!')
              if (result.success) sent.push(`task-1h: ${task.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('tasks').update({ reminder_1h_sent: true }).eq('id', task.id)
          }
        }
      }

      // --- เตือนกิจวัตรประจำวัน (Routines) ---
      const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      const todayDow = bangkokNow.getDay()
      const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

      const { data: routines } = await adminClient
        .from('routines')
        .select('id, user_id, title, description, routine_time, days_of_week, remind_before_minutes, last_reminded_date, assigned_member_id')
        .eq('is_active', true)
        .eq('user_id', userId)

      if (routines) {
        for (const routine of routines) {
          if (!routine.days_of_week.includes(todayDow)) continue
          if (routine.last_reminded_date === todayDateStr) continue

          const routineDateTime = buildEventDate(todayDateStr, routine.routine_time)
          if (!routineDateTime) continue

          const remindAt = new Date(routineDateTime.getTime() - routine.remind_before_minutes * 60 * 1000)
          const diffMinutes = (remindAt.getTime() - nowMs) / (1000 * 60)

          if (diffMinutes >= -2 && diffMinutes <= 15) {
            // ส่งทุก LINE ID ก่อน แล้วค่อย update
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(routine.assigned_member_id, lineUserId))) continue
              const result = await sendRoutineReminderToLine(lineUserId, routine)
              if (result.success) sent.push(`routine: ${routine.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('routines').update({ last_reminded_date: todayDateStr }).eq('id', routine.id)
          }
        }
      }

      // --- เตือนกิจวัตรรายเดือน (Monthly Routines) ---
      const todayDom = bangkokNow.getDate()
      const lastDayOfMonth = new Date(bangkokNow.getFullYear(), bangkokNow.getMonth() + 1, 0).getDate()
      const isLastDay = todayDom === lastDayOfMonth
      const matchDays = isLastDay ? [todayDom, 32] : [todayDom]

      const { data: monthlyRoutines } = await adminClient
        .from('monthly_routines')
        .select('id, user_id, title, description, routine_time, day_of_month, remind_before_minutes, last_reminded_date, assigned_member_id')
        .eq('is_active', true)
        .eq('user_id', userId)
        .in('day_of_month', matchDays)

      if (monthlyRoutines) {
        for (const routine of monthlyRoutines) {
          if (routine.last_reminded_date === todayDateStr) continue

          const routineDateTime = buildEventDate(todayDateStr, routine.routine_time)
          if (!routineDateTime) continue

          const remindAt = new Date(routineDateTime.getTime() - routine.remind_before_minutes * 60 * 1000)
          const diffMinutes = (remindAt.getTime() - nowMs) / (1000 * 60)

          if (diffMinutes >= -2 && diffMinutes <= 15) {
            for (const lineUserId of lineIds) {
              if (!(await shouldSendTo(routine.assigned_member_id, lineUserId))) continue
              const result = await sendMonthlyRoutineReminderToLine(lineUserId, routine)
              if (result.success) sent.push(`monthly: ${routine.title} → ${lineUserId.slice(0, 8)}`)
            }
            await adminClient.from('monthly_routines').update({ last_reminded_date: todayDateStr }).eq('id', routine.id)
          }
        }
      }
    }

    return NextResponse.json({ message: 'Event & routine reminders processed', sent, usersCount: uniqueUserIds.length })
  } catch (error) {
    console.error('[CRON] Event reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildEventDate(eventDate: string, eventTime: string | null): Date | null {
  const time = eventTime ? eventTime.slice(0, 5) : '09:00'
  const dateStr = `${eventDate}T${time}:00+07:00`
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`[CRON] Invalid date: ${dateStr}`)
    return null
  }
  return date
}
