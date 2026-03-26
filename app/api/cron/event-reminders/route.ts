import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendEventReminderToLine, sendRoutineReminderToLine } from '@/lib/line/notifications'

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
    console.warn('[CRON] LINE_USER_ID not set, skipping event reminders')
    return NextResponse.json({ message: 'LINE_USER_ID not set, skipped' })
  }

  const now = new Date()
  const nowMs = now.getTime()
  const sent: string[] = []

  try {
    // --- เตือน 1 วันก่อน (23-25 ชม.) ---
    const in23h = new Date(nowMs + 23 * 60 * 60 * 1000)
    const in25h = new Date(nowMs + 25 * 60 * 60 * 1000)

    const { data: events1d, error: err1d } = await adminClient
      .from('events')
      .select('id, title, event_date, event_time, location')
      .eq('reminder_1d_sent', false)
      .gte('event_date', in23h.toISOString().split('T')[0])
      .lte('event_date', in25h.toISOString().split('T')[0])

    if (err1d) {
      console.error('[CRON] Error querying 1d events:', err1d)
    }

    if (events1d) {
      for (const event of events1d) {
        const eventDateTime = buildEventDate(event.event_date, event.event_time)
        if (!eventDateTime) continue

        const diffMs = eventDateTime.getTime() - nowMs
        const diffHours = diffMs / (1000 * 60 * 60)

        if (diffHours >= 23 && diffHours <= 25) {
          const result = await sendEventReminderToLine(lineUserId, event, 'พรุ่งนี้มีนัด!')
          if (result.success) {
            await adminClient
              .from('events')
              .update({ reminder_1d_sent: true })
              .eq('id', event.id)
            sent.push(`1d: ${event.title}`)
          }
        }
      }
    }

    // --- เตือน 1 ชม.ก่อน (55-65 นาที) ---
    const in55m = new Date(nowMs + 55 * 60 * 1000)
    const in65m = new Date(nowMs + 65 * 60 * 1000)

    const { data: events1h, error: err1h } = await adminClient
      .from('events')
      .select('id, title, event_date, event_time, location')
      .eq('reminder_1h_sent', false)
      .gte('event_date', in55m.toISOString().split('T')[0])
      .lte('event_date', in65m.toISOString().split('T')[0])

    if (err1h) {
      console.error('[CRON] Error querying 1h events:', err1h)
    }

    if (events1h) {
      for (const event of events1h) {
        if (!event.event_time) continue

        const eventDateTime = buildEventDate(event.event_date, event.event_time)
        if (!eventDateTime) continue

        const diffMs = eventDateTime.getTime() - nowMs
        const diffMinutes = diffMs / (1000 * 60)

        if (diffMinutes >= 55 && diffMinutes <= 65) {
          const result = await sendEventReminderToLine(lineUserId, event, 'อีก 1 ชั่วโมง!')
          if (result.success) {
            await adminClient
              .from('events')
              .update({ reminder_1h_sent: true })
              .eq('id', event.id)
            sent.push(`1h: ${event.title}`)
          }
        }
      }
    }

    // --- เตือนกิจวัตรประจำวัน (Routines) ก่อนเวลา X นาที ---
    const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const todayDow = bangkokNow.getDay() // 0=อาทิตย์
    const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    const { data: routines, error: errRoutines } = await adminClient
      .from('routines')
      .select('id, user_id, title, routine_time, days_of_week, remind_before_minutes, last_reminded_date')
      .eq('is_active', true)

    if (errRoutines) {
      console.error('[CRON] Error querying routines:', errRoutines)
    }

    if (routines) {
      for (const routine of routines) {
        // เช็คว่าวันนี้ตรงกับ days_of_week ไหม
        if (!routine.days_of_week.includes(todayDow)) continue

        // เช็คว่าวันนี้เตือนไปแล้วหรือยัง
        if (routine.last_reminded_date === todayDateStr) continue

        // คำนวณเวลาที่ต้องเตือน = routine_time - remind_before_minutes
        const routineDateTime = buildEventDate(todayDateStr, routine.routine_time)
        if (!routineDateTime) continue

        const remindAt = new Date(routineDateTime.getTime() - routine.remind_before_minutes * 60 * 1000)
        const diffMs = remindAt.getTime() - nowMs
        const diffMinutes = diffMs / (1000 * 60)

        // เตือนถ้าอยู่ในช่วง -2 ถึง +13 นาที (รองรับ cron ทุก 15 นาที)
        if (diffMinutes >= -2 && diffMinutes <= 13) {
          const result = await sendRoutineReminderToLine(lineUserId, routine)
          if (result.success) {
            await adminClient
              .from('routines')
              .update({ last_reminded_date: todayDateStr })
              .eq('id', routine.id)
            sent.push(`routine: ${routine.title}`)
          }
        }
      }
    }

    return NextResponse.json({ message: 'Event & routine reminders processed', sent })
  } catch (error) {
    console.error('[CRON] Event reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildEventDate(eventDate: string, eventTime: string | null): Date | null {
  const dateStr = eventTime
    ? `${eventDate}T${eventTime}:00+07:00`
    : `${eventDate}T09:00:00+07:00`
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`[CRON] Invalid date: ${dateStr}`)
    return null
  }
  return date
}
