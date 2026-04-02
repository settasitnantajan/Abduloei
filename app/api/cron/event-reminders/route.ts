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
// ถ้าไม่มี assigned → ส่งทุกคน (true)
// ถ้ามี assigned → ส่งเฉพาะ LINE ของ member นั้น
const memberLineCache = new Map<string, string | null>()
async function shouldSendTo(assignedMemberId: string | null, lineUserId: string): Promise<boolean> {
  if (!assignedMemberId) return true // ไม่ได้ assign → ส่งทุกคน

  if (!memberLineCache.has(assignedMemberId)) {
    const memberLineId = await getMemberLineId(assignedMemberId)
    memberLineCache.set(assignedMemberId, memberLineId)
  }
  const memberLineId = memberLineCache.get(assignedMemberId)
  if (!memberLineId) return true // member ไม่มี LINE → ส่งทุกคน (fallback)
  return memberLineId === lineUserId // ส่งเฉพาะ LINE ที่ตรงกับ member
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

  try {
    for (const linkedUser of linkedUsers) {
      const { user_id: userId, line_user_id: lineUserId } = linkedUser
      const userFilter = userId ? true : false

      // --- เตือน 1 วันก่อน (23-25 ชม.) ---
      const in23h = new Date(nowMs + 23 * 60 * 60 * 1000)
      const in25h = new Date(nowMs + 25 * 60 * 60 * 1000)

      let query1d = adminClient
        .from('events')
        .select('id, user_id, title, description, event_date, event_time, location, assigned_member_id')
        .eq('reminder_1d_sent', false)
        .gte('event_date', in23h.toISOString().split('T')[0])
        .lte('event_date', in25h.toISOString().split('T')[0])

      if (userFilter) query1d = query1d.eq('user_id', userId)

      const { data: events1d, error: err1d } = await query1d

      if (err1d) console.error('[CRON] Error querying 1d events:', err1d)

      if (events1d) {
        for (const event of events1d) {
          const eventDateTime = buildEventDate(event.event_date, event.event_time)
          if (!eventDateTime) continue
          if (eventDateTime.getTime() < nowMs) continue // นัดผ่านไปแล้ว ข้าม

          const diffMs = eventDateTime.getTime() - nowMs
          const diffHours = diffMs / (1000 * 60 * 60)

          if (diffHours >= 23 && diffHours <= 25) {
            if (!(await shouldSendTo(event.assigned_member_id, lineUserId))) continue
            const result = await sendEventReminderToLine(lineUserId, event, 'พรุ่งนี้มีนัด!')
            if (result.success) {
              await adminClient
                .from('events')
                .update({ reminder_1d_sent: true })
                .eq('id', event.id)
              sent.push(`1d: ${event.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือน 1 ชม.ก่อน (55-65 นาที) ---
      const in55m = new Date(nowMs + 55 * 60 * 1000)
      const in65m = new Date(nowMs + 65 * 60 * 1000)

      let query1h = adminClient
        .from('events')
        .select('id, user_id, title, description, event_date, event_time, location, assigned_member_id')
        .eq('reminder_1h_sent', false)
        .gte('event_date', in55m.toISOString().split('T')[0])
        .lte('event_date', in65m.toISOString().split('T')[0])

      if (userFilter) query1h = query1h.eq('user_id', userId)

      const { data: events1h, error: err1h } = await query1h

      if (err1h) console.error('[CRON] Error querying 1h events:', err1h)

      if (events1h) {
        for (const event of events1h) {
          if (!event.event_time) continue

          const eventDateTime = buildEventDate(event.event_date, event.event_time)
          if (!eventDateTime) continue
          if (eventDateTime.getTime() < nowMs) continue // นัดผ่านไปแล้ว ข้าม

          const diffMs = eventDateTime.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= 45 && diffMinutes <= 75) {
            if (!(await shouldSendTo(event.assigned_member_id, lineUserId))) continue
            const result = await sendEventReminderToLine(lineUserId, event, 'อีก 1 ชั่วโมง!')
            if (result.success) {
              await adminClient
                .from('events')
                .update({ reminder_1h_sent: true })
                .eq('id', event.id)
              sent.push(`1h: ${event.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือนงาน (Tasks) ก่อน 1 วัน (22-26 ชม.) ---
      let taskQuery1d = adminClient
        .from('tasks')
        .select('id, user_id, title, description, due_date, due_time, assigned_member_id')
        .eq('status', 'pending')
        .eq('reminder_1d_sent', false)
        .not('due_date', 'is', null)

      if (userFilter) taskQuery1d = taskQuery1d.eq('user_id', userId)

      const { data: tasks1d } = await taskQuery1d

      if (tasks1d) {
        for (const task of tasks1d) {
          const taskDateTime = buildEventDate(task.due_date, task.due_time)
          if (!taskDateTime) continue
          if (taskDateTime.getTime() < nowMs) continue // งานผ่านไปแล้ว ข้าม

          const diffMs = taskDateTime.getTime() - nowMs
          const diffHours = diffMs / (1000 * 60 * 60)

          if (diffHours >= 23 && diffHours <= 25) {
            if (!(await shouldSendTo(task.assigned_member_id, lineUserId))) continue
            const result = await sendTaskReminderToLine(lineUserId, task, 'พรุ่งนี้มีงาน!')
            if (result.success) {
              await adminClient
                .from('tasks')
                .update({ reminder_1d_sent: true })
                .eq('id', task.id)
              sent.push(`task-1d: ${task.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือนงาน (Tasks) ก่อน 1 ชม. (40-80 นาที) ---
      let taskQuery1h = adminClient
        .from('tasks')
        .select('id, user_id, title, description, due_date, due_time, assigned_member_id')
        .eq('status', 'pending')
        .eq('reminder_1h_sent', false)
        .not('due_date', 'is', null)
        .not('due_time', 'is', null)

      if (userFilter) taskQuery1h = taskQuery1h.eq('user_id', userId)

      const { data: tasks1h } = await taskQuery1h

      if (tasks1h) {
        for (const task of tasks1h) {
          if (!task.due_time) continue

          const taskDateTime = buildEventDate(task.due_date, task.due_time)
          if (!taskDateTime) continue
          if (taskDateTime.getTime() < nowMs) continue // งานผ่านไปแล้ว ข้าม

          const diffMs = taskDateTime.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= 45 && diffMinutes <= 75) {
            if (!(await shouldSendTo(task.assigned_member_id, lineUserId))) continue
            const result = await sendTaskReminderToLine(lineUserId, task, 'อีก 1 ชั่วโมง!')
            if (result.success) {
              await adminClient
                .from('tasks')
                .update({ reminder_1h_sent: true })
                .eq('id', task.id)
              sent.push(`task-1h: ${task.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือนกิจวัตรประจำวัน (Routines) ---
      const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      const todayDow = bangkokNow.getDay()
      const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

      let routineQuery = adminClient
        .from('routines')
        .select('id, user_id, title, description, routine_time, days_of_week, remind_before_minutes, last_reminded_date, assigned_member_id')
        .eq('is_active', true)

      if (userFilter) routineQuery = routineQuery.eq('user_id', userId)

      const { data: routines, error: errRoutines } = await routineQuery

      if (errRoutines) console.error('[CRON] Error querying routines:', errRoutines)

      if (routines) {
        for (const routine of routines) {
          if (!routine.days_of_week.includes(todayDow)) continue
          if (routine.last_reminded_date === todayDateStr) continue

          const routineDateTime = buildEventDate(todayDateStr, routine.routine_time)
          if (!routineDateTime) continue

          const remindAt = new Date(routineDateTime.getTime() - routine.remind_before_minutes * 60 * 1000)
          const diffMs = remindAt.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= -2 && diffMinutes <= 15) {
            if (!(await shouldSendTo(routine.assigned_member_id, lineUserId))) continue
            const result = await sendRoutineReminderToLine(lineUserId, routine)
            if (result.success) {
              // อัพเดท last_reminded_date ทันทีเพื่อป้องกัน race condition
              await adminClient
                .from('routines')
                .update({ last_reminded_date: todayDateStr })
                .eq('id', routine.id)
              sent.push(`routine: ${routine.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือนกิจวัตรรายเดือน (Monthly Routines) ---
      const todayDom = bangkokNow.getDate()
      // เช็คว่าวันนี้เป็นวันสุดท้ายของเดือนไหม
      const lastDayOfMonth = new Date(bangkokNow.getFullYear(), bangkokNow.getMonth() + 1, 0).getDate()
      const isLastDay = todayDom === lastDayOfMonth
      // ดึง routine ที่ตรงวันที่ + ถ้าวันนี้เป็นวันสุดท้าย ดึง day_of_month=32 (สิ้นเดือน) ด้วย
      const matchDays = isLastDay ? [todayDom, 32] : [todayDom]

      let monthlyQuery = adminClient
        .from('monthly_routines')
        .select('id, user_id, title, description, routine_time, day_of_month, remind_before_minutes, last_reminded_date, assigned_member_id')
        .eq('is_active', true)
        .in('day_of_month', matchDays)

      if (userFilter) monthlyQuery = monthlyQuery.eq('user_id', userId)

      const { data: monthlyRoutines, error: errMonthly } = await monthlyQuery

      if (errMonthly) console.error('[CRON] Error querying monthly routines:', errMonthly)

      if (monthlyRoutines) {
        for (const routine of monthlyRoutines) {
          if (routine.last_reminded_date === todayDateStr) continue

          const routineDateTime = buildEventDate(todayDateStr, routine.routine_time)
          if (!routineDateTime) continue

          const remindAt = new Date(routineDateTime.getTime() - routine.remind_before_minutes * 60 * 1000)
          const diffMs = remindAt.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= -2 && diffMinutes <= 15) {
            if (!(await shouldSendTo(routine.assigned_member_id, lineUserId))) continue
            const result = await sendMonthlyRoutineReminderToLine(lineUserId, routine)
            if (result.success) {
              // อัพเดท last_reminded_date ทันทีเพื่อป้องกัน race condition
              await adminClient
                .from('monthly_routines')
                .update({ last_reminded_date: todayDateStr })
                .eq('id', routine.id)
              sent.push(`monthly: ${routine.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }
    }

    return NextResponse.json({ message: 'Event & routine reminders processed', sent, usersCount: linkedUsers.length })
  } catch (error) {
    console.error('[CRON] Event reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildEventDate(eventDate: string, eventTime: string | null): Date | null {
  // eventTime อาจเป็น "12:40", "12:40:00" หรือ null — ใช้แค่ HH:MM
  const time = eventTime ? eventTime.slice(0, 5) : '09:00'
  const dateStr = `${eventDate}T${time}:00+07:00`
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`[CRON] Invalid date: ${dateStr}`)
    return null
  }
  return date
}
