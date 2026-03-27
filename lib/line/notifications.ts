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

// เก็บ track ว่า user ไหนบันทึก web notification แล้วในรอบนี้
const dailySummaryNotifiedUsers = new Set<string>()

export async function resetDailySummaryTracking() {
  dailySummaryNotifiedUsers.clear()
}

export async function sendDailySummaryToLine(lineUserId: string, userId?: string) {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  // Base queries
  let eventsQuery = adminClient
    .from('events')
    .select('title, description, event_time, location, priority')
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
      const time = e.event_time ? e.event_time.slice(0, 5) + ' น.' : ''
      const loc = e.location && e.location !== 'ไม่มี' ? e.location : ''
      message += `\n📌 ${e.title}`
      if (time) message += ` (${time})`
      if (loc) message += `\n   📍 ${loc}`
      if (e.description) message += `\n   ${e.description}`
      message += '\n'
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

  // บันทึกแจ้งเตือนบนเว็บ (แค่ 1 ครั้งต่อ user)
  if (userId && !dailySummaryNotifiedUsers.has(userId)) {
    dailySummaryNotifiedUsers.add(userId)
    const eventCount = events?.length ?? 0
    const taskCount = tasks?.length ?? 0
    const eventDetails = events?.map(e => {
      const time = e.event_time ? e.event_time.slice(0, 5) + ' น.' : ''
      return `${e.title}${time ? ' (' + time + ')' : ''}${e.description ? ' - ' + e.description : ''}`
    }).join(', ') || ''
    const webMsg = eventCount > 0
      ? `นัดหมาย ${eventCount}: ${eventDetails}` + (taskCount > 0 ? ` | งานค้าง ${taskCount} รายการ` : '')
      : `ไม่มีนัดหมาย` + (taskCount > 0 ? ` | งานค้าง ${taskCount} รายการ` : '')
    await saveWebNotification(
      userId,
      `สรุปวันนี้ (${today})`,
      webMsg,
      'daily_summary'
    )
  }

  return sendTextMessage(lineUserId, truncateMessage(message))
}

const routineNotifiedUsers = new Set<string>()
const eventNotifiedUsers = new Set<string>()

export function resetReminderTracking() {
  routineNotifiedUsers.clear()
  eventNotifiedUsers.clear()
}

export async function sendRoutineReminderToLine(
  lineUserId: string,
  routine: { id: string; user_id?: string; title: string; description?: string | null; routine_time: string; remind_before_minutes: number }
) {
  const timeStr = routine.routine_time?.slice(0, 5) || ''
  let message = `⏰ เตือนกิจวัตร\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `📌 ${routine.title}\n`
  if (routine.description) message += `${routine.description}\n`
  message += `⏰ เวลา: ${timeStr} น.\n`
  message += `(เตือนก่อน ${routine.remind_before_minutes} นาที)`

  const routineKey = `${routine.user_id}:${routine.id}`
  if (routine.user_id && !routineNotifiedUsers.has(routineKey)) {
    routineNotifiedUsers.add(routineKey)
    const webMsg = routine.description
      ? `อีก ${routine.remind_before_minutes} นาที เวลา ${timeStr} น. — ${routine.description}`
      : `อีก ${routine.remind_before_minutes} นาที เวลา ${timeStr} น.`
    await saveWebNotification(
      routine.user_id,
      `⏰ ${routine.title}`,
      webMsg,
      'routine_reminder'
    )
  }

  return sendTextMessage(lineUserId, message)
}

export async function sendEventReminderToLine(
  lineUserId: string,
  event: { id: string; user_id?: string; title: string; description?: string | null; event_date: string; event_time: string | null; location: string | null },
  timeLabel: string
) {
  let message = `แจ้งเตือน: ${timeLabel}\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `📌 ${event.title}\n`
  if (event.description) message += `${event.description}\n`
  if (event.event_date) message += `📅 ${event.event_date}\n`
  if (event.event_time) message += `⏰ ${event.event_time.slice(0, 5)} น.\n`
  if (event.location && event.location !== 'ไม่มี') message += `📍 ${event.location}\n`

  const eventKey = `${event.user_id}:${event.id}:${timeLabel}`
  if (event.user_id && !eventNotifiedUsers.has(eventKey)) {
    eventNotifiedUsers.add(eventKey)
    const webMessage = [
      event.event_date,
      event.event_time?.slice(0, 5) + ' น.',
      event.location && event.location !== 'ไม่มี' ? event.location : null
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

const taskNotifiedUsers = new Set<string>()

export function resetTaskReminderTracking() {
  taskNotifiedUsers.clear()
}

export async function sendTaskReminderToLine(
  lineUserId: string,
  task: { id: string; user_id?: string; title: string; description?: string | null; due_date: string; due_time: string | null },
  timeLabel: string
) {
  let message = `แจ้งเตือนงาน: ${timeLabel}\n`
  message += '━━━━━━━━━━━━━━━\n'
  message += `📋 ${task.title}\n`
  if (task.description) message += `${task.description}\n`
  if (task.due_date) message += `📅 ${task.due_date}\n`
  if (task.due_time) message += `⏰ ${task.due_time.slice(0, 5)} น.\n`

  const taskKey = `${task.user_id}:${task.id}:${timeLabel}`
  if (task.user_id && !taskNotifiedUsers.has(taskKey)) {
    taskNotifiedUsers.add(taskKey)
    const webMessage = [
      task.due_date,
      task.due_time ? task.due_time.slice(0, 5) + ' น.' : null
    ].filter(Boolean).join(' | ')
    await saveWebNotification(
      task.user_id,
      `${timeLabel} ${task.title}`,
      webMessage,
      'task_reminder',
      task.id
    )
  }

  return sendTextMessage(lineUserId, message)
}
