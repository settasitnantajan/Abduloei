import { adminClient } from '@/lib/supabase/admin'
import { sendTextMessage } from '@/lib/line/client'

const LINE_MESSAGE_MAX_LENGTH = 5000

function truncateMessage(message: string): string {
  if (message.length <= LINE_MESSAGE_MAX_LENGTH) return message
  return message.substring(0, LINE_MESSAGE_MAX_LENGTH - 20) + '\n\n...ข้อความถูกตัด'
}

export async function sendDailySummaryToLine(lineUserId: string) {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  // Query events วันนี้
  const { data: events, error: eventsError } = await adminClient
    .from('events')
    .select('title, event_time, location, priority')
    .eq('event_date', today)
    .order('event_time', { ascending: true })

  if (eventsError) {
    console.error('[Notifications] Events query failed:', eventsError)
  }

  // Query tasks ที่ยัง pending
  const { data: tasks, error: tasksError } = await adminClient
    .from('tasks')
    .select('title, due_date, priority')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(10)

  if (tasksError) {
    console.error('[Notifications] Tasks query failed:', tasksError)
  }

  // Query notes ล่าสุด (24 ชม.)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: notes, error: notesError } = await adminClient
    .from('notes')
    .select('title, category')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(5)

  if (notesError) {
    console.error('[Notifications] Notes query failed:', notesError)
  }

  // สร้างข้อความ
  let message = `สรุปวันนี้ (${today})\n`
  message += '━━━━━━━━━━━━━━━\n'

  // นัดหมาย
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

  // งาน
  if (tasks && tasks.length > 0) {
    message += `\nงานค้าง (${tasks.length} รายการ):\n`
    for (const t of tasks) {
      const due = t.due_date ? ` (กำหนด ${t.due_date})` : ''
      message += `- ${t.title}${due}\n`
    }
  }

  // บันทึกล่าสุด
  if (notes && notes.length > 0) {
    message += `\nบันทึกล่าสุด (${notes.length}):\n`
    for (const n of notes) {
      const cat = n.category ? ` [${n.category}]` : ''
      message += `- ${n.title}${cat}\n`
    }
  }

  message += '\nขอให้เป็นวันที่ดีนะคะ!'

  return sendTextMessage(lineUserId, truncateMessage(message))
}

export async function sendEventReminderToLine(
  lineUserId: string,
  event: { id: string; title: string; event_date: string; event_time: string | null; location: string | null },
  timeLabel: string
) {
  let message = `แจ้งเตือน: ${timeLabel}\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `${event.title}\n`
  if (event.event_date) message += `วันที่: ${event.event_date}\n`
  if (event.event_time) message += `เวลา: ${event.event_time}\n`
  if (event.location) message += `สถานที่: ${event.location}\n`

  return sendTextMessage(lineUserId, message)
}
