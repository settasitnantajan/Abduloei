import { adminClient } from '@/lib/supabase/admin'
import { sendTextMessage } from '@/lib/line/client'

const LINE_MESSAGE_MAX_LENGTH = 5000

function truncateMessage(message: string): string {
  if (message.length <= LINE_MESSAGE_MAX_LENGTH) return message
  return message.substring(0, LINE_MESSAGE_MAX_LENGTH - 20) + '\n\n...ข้อความถูกตัด'
}

async function saveWebNotification(userId: string, title: string, message: string, type: string, eventId?: string) {
  try {
    await adminClient.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      event_id: eventId || null,
    })
  } catch (err) {
    console.error('[Notifications] saveWebNotification error:', err)
  }
}

export async function sendDailySummaryToLine(lineUserId: string, userId?: string) {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  // Base queries
  let eventsQuery = adminClient
    .from('events')
    .select('title, event_time, location, priority')
    .eq('event_date', today)
    .order('event_time', { ascending: true })

  let tasksQuery = adminClient
    .from('tasks')
    .select('title, due_date, priority')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(10)

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  let notesQuery = adminClient
    .from('notes')
    .select('title, category')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(5)

  // Filter ตาม user ถ้ามี
  if (userId) {
    eventsQuery = eventsQuery.eq('user_id', userId)
    tasksQuery = tasksQuery.eq('user_id', userId)
    notesQuery = notesQuery.eq('user_id', userId)
  }

  const [
    { data: events, error: eventsError },
    { data: tasks, error: tasksError },
    { data: notes, error: notesError },
  ] = await Promise.all([eventsQuery, tasksQuery, notesQuery])

  if (eventsError) console.error('[Notifications] Events query failed:', eventsError)
  if (tasksError) console.error('[Notifications] Tasks query failed:', tasksError)
  if (notesError) console.error('[Notifications] Notes query failed:', notesError)

  // สร้างข้อความ
  let message = `สรุปวันนี้ (${today})\n`
  message += '━━━━━━━━━━━━━━━\n'

  if (events && events.length > 0) {
    message += `\nนัดหมายวันนี้ (${events.length} รายการ):\n`
    for (const e of events) {
      const time = e.event_time ? ` ${e.event_time}` : ''
      const loc = e.location ? ` @ ${e.location}` : ''
      message += `- ${e.title}${time}${loc}\n`
    }
  } else {
    message += '\nวันนี้ไม่มีนัดหมาย\n'
  }

  if (tasks && tasks.length > 0) {
    message += `\nงานค้าง (${tasks.length} รายการ):\n`
    for (const t of tasks) {
      const due = t.due_date ? ` (กำหนด ${t.due_date})` : ''
      message += `- ${t.title}${due}\n`
    }
  }

  if (notes && notes.length > 0) {
    message += `\nบันทึกล่าสุด (${notes.length}):\n`
    for (const n of notes) {
      const cat = n.category ? ` [${n.category}]` : ''
      message += `- ${n.title}${cat}\n`
    }
  }

  message += '\nขอให้เป็นวันที่ดีนะคะ!'

  // บันทึกแจ้งเตือนบนเว็บด้วย
  if (userId) {
    const eventCount = events?.length ?? 0
    const taskCount = tasks?.length ?? 0
    await saveWebNotification(
      userId,
      `สรุปวันนี้ (${today})`,
      `นัดหมาย ${eventCount} รายการ, งานค้าง ${taskCount} รายการ`,
      'daily_summary'
    )
  }

  return sendTextMessage(lineUserId, truncateMessage(message))
}

export async function sendRoutineReminderToLine(
  lineUserId: string,
  routine: { id: string; user_id?: string; title: string; routine_time: string; remind_before_minutes: number }
) {
  const timeStr = routine.routine_time?.slice(0, 5) || ''
  let message = `⏰ เตือนกิจวัตร\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `${routine.title}\n`
  message += `เวลา: ${timeStr} น.\n`
  message += `(เตือนก่อน ${routine.remind_before_minutes} นาที)`

  if (routine.user_id) {
    await saveWebNotification(
      routine.user_id,
      `⏰ ${routine.title}`,
      `อีก ${routine.remind_before_minutes} นาที เวลา ${timeStr} น.`,
      'routine_reminder'
    )
  }

  return sendTextMessage(lineUserId, message)
}

export async function sendEventReminderToLine(
  lineUserId: string,
  event: { id: string; user_id?: string; title: string; event_date: string; event_time: string | null; location: string | null },
  timeLabel: string
) {
  let message = `แจ้งเตือน: ${timeLabel}\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `${event.title}\n`
  if (event.event_date) message += `วันที่: ${event.event_date}\n`
  if (event.event_time) message += `เวลา: ${event.event_time}\n`
  if (event.location) message += `สถานที่: ${event.location}\n`

  if (event.user_id) {
    const webMessage = [
      event.event_date,
      event.event_time,
      event.location
    ].filter(Boolean).join(' | ')
    await saveWebNotification(
      event.user_id,
      `${timeLabel} ${event.title}`,
      webMessage,
      'reminder',
      event.id
    )
  }

  return sendTextMessage(lineUserId, message)
}
