import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendEventReminderToLine, sendRoutineReminderToLine, sendTaskReminderToLine, sendMonthlyRoutineReminderToLine, resetReminderTracking, resetTaskReminderTracking, resetMonthlyRoutineTracking } from '@/lib/line/notifications'
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
  const routinesSentIds = new Set<string>()
  const monthlyRoutinesSentIds = new Set<string>()

  try {
    for (const linkedUser of linkedUsers) {
      const { user_id: userId, line_user_id: lineUserId } = linkedUser
      const userFilter = userId ? true : false

      // --- เตือน 1 วันก่อน (23-25 ชม.) ---
      const in23h = new Date(nowMs + 23 * 60 * 60 * 1000)
      const in25h = new Date(nowMs + 25 * 60 * 60 * 1000)

      let query1d = adminClient
        .from('events')
        .select('id, user_id, title, description, event_date, event_time, location')
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

          const diffMs = eventDateTime.getTime() - nowMs
          const diffHours = diffMs / (1000 * 60 * 60)

          if (diffHours >= 22 && diffHours <= 26) {
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
        .select('id, user_id, title, description, event_date, event_time, location')
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

          const diffMs = eventDateTime.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= 40 && diffMinutes <= 80) {
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
        .select('id, user_id, title, description, due_date, due_time')
        .eq('status', 'pending')
        .eq('reminder_1d_sent', false)
        .not('due_date', 'is', null)

      if (userFilter) taskQuery1d = taskQuery1d.eq('user_id', userId)

      const { data: tasks1d } = await taskQuery1d

      if (tasks1d) {
        for (const task of tasks1d) {
          const taskDateTime = buildEventDate(task.due_date, task.due_time)
          if (!taskDateTime) continue

          const diffMs = taskDateTime.getTime() - nowMs
          const diffHours = diffMs / (1000 * 60 * 60)

          if (diffHours >= 22 && diffHours <= 26) {
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
        .select('id, user_id, title, description, due_date, due_time')
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

          const diffMs = taskDateTime.getTime() - nowMs
          const diffMinutes = diffMs / (1000 * 60)

          if (diffMinutes >= 40 && diffMinutes <= 80) {
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
        .select('id, user_id, title, description, routine_time, days_of_week, remind_before_minutes, last_reminded_date')
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

          if (diffMinutes >= -5 && diffMinutes <= 20) {
            const result = await sendRoutineReminderToLine(lineUserId, routine)
            if (result.success) {
              // เก็บ routine id ไว้ update last_reminded_date ทีหลัง (หลังส่งครบทุก LINE ID)
              if (!routinesSentIds.has(routine.id)) routinesSentIds.add(routine.id)
              sent.push(`routine: ${routine.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }

      // --- เตือนกิจวัตรรายเดือน (Monthly Routines) ---
      const todayDom = bangkokNow.getDate()

      let monthlyQuery = adminClient
        .from('monthly_routines')
        .select('id, user_id, title, description, routine_time, day_of_month, remind_before_minutes, last_reminded_date')
        .eq('is_active', true)
        .eq('day_of_month', todayDom)

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

          if (diffMinutes >= -5 && diffMinutes <= 20) {
            const result = await sendMonthlyRoutineReminderToLine(lineUserId, routine)
            if (result.success) {
              if (!monthlyRoutinesSentIds.has(routine.id)) monthlyRoutinesSentIds.add(routine.id)
              sent.push(`monthly: ${routine.title} (${userId ? userId.slice(0, 8) : 'env'})`)
            }
          }
        }
      }
    }

    // Update last_reminded_date หลังส่งครบทุก LINE ID แล้ว
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    for (const routineId of routinesSentIds) {
      await adminClient
        .from('routines')
        .update({ last_reminded_date: todayStr })
        .eq('id', routineId)
    }
    for (const routineId of monthlyRoutinesSentIds) {
      await adminClient
        .from('monthly_routines')
        .update({ last_reminded_date: todayStr })
        .eq('id', routineId)
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
