import { adminClient } from '@/lib/supabase/admin'
import { sendTextMessage } from '@/lib/line/client'
import { fetchMorningSummaryData } from '@/lib/line/timeline-data'

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
  const remindLabel = routine.remind_before_minutes > 0 ? ` (อีก ${routine.remind_before_minutes} นาที)` : ''
  let message = `⏰ กิจวัตรประจำสัปดาห์${remindLabel}\n`
  message += `📌 ${routine.title}\n`
  message += `🕐 เวลา ${timeStr} น.`
  if (routine.description) message += `\n📝 ${routine.description}`

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
  const dateLabel = event.event_date ? formatThaiDate(event.event_date) : ''
  let message = `🔔 ${timeLabel}\n`
  message += `📌 ${event.title}\n`
  if (dateLabel) message += `📆 ${dateLabel}`
  if (event.event_time) message += ` 🕐 ${event.event_time.slice(0, 5)} น.`
  if (event.location && event.location !== 'ไม่มี') message += `\n📍 ${event.location}`
  if (event.description) message += `\n📝 ${event.description}`

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

const monthlyRoutineNotifiedUsers = new Set<string>()

export function resetMonthlyRoutineTracking() {
  monthlyRoutineNotifiedUsers.clear()
}

export async function sendMonthlyRoutineReminderToLine(
  lineUserId: string,
  routine: { id: string; user_id?: string; title: string; description?: string | null; routine_time: string; day_of_month: number; remind_before_minutes: number }
) {
  const timeStr = routine.routine_time?.slice(0, 5) || ''
  const dayLabel = routine.day_of_month === 32 ? 'สิ้นเดือน' : `ทุกวันที่ ${routine.day_of_month}`
  const remindLabel = routine.remind_before_minutes > 0 ? ` (อีก ${routine.remind_before_minutes} นาที)` : ''
  let message = `📅 กิจวัตรรายเดือน${remindLabel}\n`
  message += `📌 ${routine.title}\n`
  message += `🕐 เวลา ${timeStr} น. (${dayLabel})`
  if (routine.description) message += `\n📝 ${routine.description}`

  const key = `${routine.user_id}:${routine.id}`
  if (routine.user_id && !monthlyRoutineNotifiedUsers.has(key)) {
    monthlyRoutineNotifiedUsers.add(key)
    const webMsg = routine.description
      ? `ทุกวันที่ ${routine.day_of_month} เวลา ${timeStr} น. — ${routine.description}`
      : `ทุกวันที่ ${routine.day_of_month} เวลา ${timeStr} น.`
    await saveWebNotification(
      routine.user_id,
      `📅 ${routine.title}`,
      webMsg,
      'monthly_routine_reminder'
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
  const dateLabel = task.due_date ? formatThaiDate(task.due_date) : ''
  let message = `🔔 ${timeLabel}\n`
  message += `📋 ${task.title}\n`
  if (dateLabel) message += `📆 ${dateLabel}`
  if (task.due_time) message += ` 🕐 ${task.due_time.slice(0, 5)} น.`
  if (task.description) message += `\n📝 ${task.description}`

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

// === Unified Timeline Notifications ===

const MONTHS_TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function formatThaiDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTHS_TH_SHORT[parseInt(m) - 1]}`
}

export function buildMorningSummaryMessage(data: Awaited<ReturnType<typeof fetchMorningSummaryData>>): string {
  const dateLabel = formatThaiDate(data.today)
  const DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
  const bangkokNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const dayName = DAYS_TH[bangkokNow.getDay()]

  let message = `🌅 สรุปประจำวัน\n`
  message += `📆 วัน${dayName}ที่ ${dateLabel}\n`

  const hasAnything = data.todayRoutines.length > 0 || data.todayEvents.length > 0 ||
    data.todayTasks.length > 0 || data.todayMonthlyRoutines.length > 0 ||
    data.recentNotes.length > 0

  if (!hasAnything && data.tomorrowEvents.length === 0 && data.tomorrowRoutines.length === 0) {
    message += '\n✨ วันนี้ว่างๆ ไม่มีนัด ไม่มีงาน'
    if (data.pendingTaskCount > 0) {
      message += `\n\n📝 งานค้างรวม ${data.pendingTaskCount} รายการ`
    }
    message += '\n\nขอให้เป็นวันที่ดีนะคะ! 💪'
    return message
  }

  // กิจวัตรประจำวัน (weekly routines)
  if (data.todayRoutines.length > 0) {
    message += `\n⏰ กิจวัตรประจำวัน (${data.todayRoutines.length} รายการ)\n`
    data.todayRoutines.forEach((r, i) => {
      const time = r.routine_time?.slice(0, 5) || '--:--'
      message += `${i + 1}. ${r.title}\n`
      message += `   🕐 เวลา ${time} น.\n`
      if (r.description) message += `   📝 ${r.description}\n`
    })
  }

  // กิจวัตรรายเดือน (monthly routines)
  if (data.todayMonthlyRoutines.length > 0) {
    message += `\n📅 กิจวัตรรายเดือน (${data.todayMonthlyRoutines.length} รายการ)\n`
    data.todayMonthlyRoutines.forEach((r, i) => {
      const time = r.routine_time?.slice(0, 5) || '--:--'
      const dayLabel = r.day_of_month === 32 ? 'สิ้นเดือน' : `ทุกวันที่ ${r.day_of_month}`
      message += `${i + 1}. ${r.title}\n`
      message += `   🕐 เวลา ${time} น. (${dayLabel})\n`
      if (r.description) message += `   📝 ${r.description}\n`
    })
  }

  // นัดหมาย
  if (data.todayEvents.length > 0) {
    message += `\n📌 นัดหมายวันนี้ (${data.todayEvents.length} รายการ)\n`
    data.todayEvents.forEach((e, i) => {
      const time = e.event_time ? e.event_time.slice(0, 5) : '--:--'
      message += `${i + 1}. ${e.title}\n`
      message += `   🕐 เวลา ${time} น.\n`
      if (e.location && e.location !== 'ไม่มี') message += `   📍 ${e.location}\n`
      if (e.priority && e.priority !== 'low') message += `   ⚡ ความสำคัญ: ${e.priority === 'high' ? 'สูง' : 'ปานกลาง'}\n`
      if (e.description) message += `   📝 ${e.description}\n`
    })
  }

  // งานวันนี้
  if (data.todayTasks.length > 0) {
    message += `\n📋 งานวันนี้ (${data.todayTasks.length} รายการ)\n`
    data.todayTasks.forEach((t, i) => {
      const time = t.due_time ? t.due_time.slice(0, 5) : null
      message += `${i + 1}. ${t.title}\n`
      if (time) message += `   🕐 กำหนด ${time} น.\n`
      if (t.priority && t.priority !== 'low') message += `   ⚡ ความสำคัญ: ${t.priority === 'high' ? 'สูง' : 'ปานกลาง'}\n`
      if (t.description) message += `   📝 ${t.description}\n`
    })
  }

  // บันทึกล่าสุด
  if (data.recentNotes.length > 0) {
    message += `\n🗒️ บันทึกล่าสุด (${data.recentNotes.length} รายการ)\n`
    data.recentNotes.forEach((n, i) => {
      const cat = n.category ? ` [${n.category}]` : ''
      message += `${i + 1}. ${n.title}${cat}\n`
    })
  }

  // งานค้างรวม
  if (data.pendingTaskCount > data.todayTasks.length) {
    message += `\n⚠️ งานค้างรวมทั้งหมด: ${data.pendingTaskCount} รายการ`
  }

  // พรุ่งนี้
  const tomorrowAll = [
    ...data.tomorrowEvents.map(e => ({
      time: e.event_time?.slice(0, 5) || '',
      label: `📌 ${e.title}`,
      loc: e.location && e.location !== 'ไม่มี' ? e.location : '',
    })),
    ...data.tomorrowRoutines.map(r => ({
      time: r.routine_time?.slice(0, 5) || '',
      label: `⏰ ${r.title}`,
      loc: '',
    })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))

  if (tomorrowAll.length > 0) {
    message += `\n\n🔜 พรุ่งนี้ (${tomorrowAll.length} รายการ)\n`
    tomorrowAll.slice(0, 5).forEach((item, i) => {
      message += `${i + 1}. ${item.label}\n`
      if (item.time) message += `   🕐 เวลา ${item.time} น.\n`
      if (item.loc) message += `   📍 ${item.loc}\n`
    })
    if (tomorrowAll.length > 5) {
      message += `   ...อีก ${tomorrowAll.length - 5} รายการ\n`
    }
  }

  message += `\nขอให้เป็นวันที่ดีนะคะ! 💪`
  return message
}

interface HeadsUpEvent {
  title: string
  event_time?: string | null
  location?: string | null
}
interface HeadsUpTask {
  title: string
  due_time?: string | null
}
interface HeadsUpRoutine {
  title: string
  routine_time?: string
}

export function buildHourlyHeadsUpMessage(data: {
  upcomingEvents: HeadsUpEvent[]
  upcomingTasks: HeadsUpTask[]
  upcomingRoutines: HeadsUpRoutine[]
  upcomingMonthlyRoutines: HeadsUpRoutine[]
}): string | null {
  const total = data.upcomingEvents.length + data.upcomingTasks.length +
    data.upcomingRoutines.length + data.upcomingMonthlyRoutines.length
  if (total === 0) return null

  let message = `🔔 แจ้งเตือนล่วงหน้า 1 ชม.\n`

  let idx = 1
  if (data.upcomingEvents.length > 0) {
    message += `\n📌 นัดหมาย\n`
    for (const e of data.upcomingEvents) {
      const time = e.event_time ? e.event_time.slice(0, 5) + ' น.' : ''
      const loc = e.location && e.location !== 'ไม่มี' ? e.location : ''
      message += `${idx}. ${e.title}\n`
      if (time) message += `   🕐 เวลา ${time}\n`
      if (loc) message += `   📍 ${loc}\n`
      idx++
    }
  }

  if (data.upcomingTasks.length > 0) {
    message += `\n📋 งาน\n`
    for (const t of data.upcomingTasks) {
      const time = t.due_time ? t.due_time.slice(0, 5) + ' น.' : 'กำหนดวันนี้'
      message += `${idx}. ${t.title}\n`
      message += `   🕐 ${time}\n`
      idx++
    }
  }

  if (data.upcomingRoutines.length > 0) {
    message += `\n⏰ กิจวัตร\n`
    for (const r of data.upcomingRoutines) {
      const time = r.routine_time?.slice(0, 5) || ''
      message += `${idx}. ${r.title}\n`
      if (time) message += `   🕐 เวลา ${time} น.\n`
      idx++
    }
  }

  if (data.upcomingMonthlyRoutines.length > 0) {
    message += `\n📅 กิจวัตรรายเดือน\n`
    for (const r of data.upcomingMonthlyRoutines) {
      const time = r.routine_time?.slice(0, 5) || ''
      message += `${idx}. ${r.title}\n`
      if (time) message += `   🕐 เวลา ${time} น.\n`
      idx++
    }
  }

  return message
}

export async function sendUnifiedMorningSummaryToLine(lineUserId: string, userId: string) {
  const data = await fetchMorningSummaryData(userId)
  const message = buildMorningSummaryMessage(data)

  // บันทึก web notification (1 ครั้งต่อ user)
  if (!dailySummaryNotifiedUsers.has(userId)) {
    dailySummaryNotifiedUsers.add(userId)

    const eventCount = data.todayEvents.length
    const taskCount = data.todayTasks.length
    const routineCount = data.todayRoutines.length
    const parts: string[] = []
    if (routineCount > 0) parts.push(`กิจวัตร ${routineCount}`)
    if (eventCount > 0) parts.push(`นัดหมาย ${eventCount}`)
    if (taskCount > 0) parts.push(`งาน ${taskCount}`)

    const webMsg = parts.length > 0 ? parts.join(' | ') : 'วันนี้ว่างๆ ไม่มีนัด ไม่มีงาน'

    await saveWebNotification(
      userId,
      `🌅 สรุปวันนี้ (${formatThaiDate(data.today)})`,
      webMsg,
      'daily_summary'
    )
  }

  return sendTextMessage(lineUserId, truncateMessage(message))
}

export async function sendHourlyHeadsUpToLine(
  lineUserId: string,
  userId: string,
  data: {
    upcomingEvents: HeadsUpEvent[]
    upcomingTasks: HeadsUpTask[]
    upcomingRoutines: HeadsUpRoutine[]
    upcomingMonthlyRoutines: HeadsUpRoutine[]
  }
) {
  const message = buildHourlyHeadsUpMessage(data)
  if (!message) return { success: true }

  // บันทึก web notification
  const total = data.upcomingEvents.length + data.upcomingTasks.length +
    data.upcomingRoutines.length + data.upcomingMonthlyRoutines.length
  const currentHour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false })
  const headsUpKey = `headsup:${userId}:${currentHour}`
  if (!eventNotifiedUsers.has(headsUpKey)) {
    eventNotifiedUsers.add(headsUpKey)
    await saveWebNotification(
      userId,
      `🔔 อีก 1 ชั่วโมง! (${total} รายการ)`,
      message.replace('🔔 อีก 1 ชั่วโมง!\n', '').trim(),
      'reminder'
    )
  }

  return sendTextMessage(lineUserId, truncateMessage(message))
}

export async function sendWeeklySummaryToLine(lineUserId: string, userId?: string) {
  const now = new Date()

  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const dayOfWeek = bangkokNow.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(bangkokNow)
  monday.setDate(bangkokNow.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const mondayStr = monday.toLocaleDateString('en-CA')
  const sundayStr = sunday.toLocaleDateString('en-CA')

  let eventsQuery = adminClient
    .from('events')
    .select('title, event_date, event_time, location')
    .gte('event_date', mondayStr)
    .lte('event_date', sundayStr)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })

  let tasksQuery = adminClient
    .from('tasks')
    .select('title, due_date, status')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(15)

  let completedQuery = adminClient
    .from('tasks')
    .select('title')
    .eq('status', 'completed')
    .gte('updated_at', mondayStr + 'T00:00:00+07:00')
    .limit(10)

  if (userId) {
    eventsQuery = eventsQuery.eq('user_id', userId)
    tasksQuery = tasksQuery.eq('user_id', userId)
    completedQuery = completedQuery.eq('user_id', userId)
  }

  const [
    { data: events },
    { data: pendingTasks },
    { data: completedTasks },
  ] = await Promise.all([eventsQuery, tasksQuery, completedQuery])

  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6)
  const nextMondayStr = nextMonday.toLocaleDateString('en-CA')
  const nextSundayStr = nextSunday.toLocaleDateString('en-CA')

  let nextWeekQuery = adminClient
    .from('events')
    .select('title, event_date, event_time')
    .gte('event_date', nextMondayStr)
    .lte('event_date', nextSundayStr)
    .order('event_date', { ascending: true })
    .limit(5)

  if (userId) nextWeekQuery = nextWeekQuery.eq('user_id', userId)
  const { data: nextWeekEvents } = await nextWeekQuery

  const mondayLabel = formatThaiDate(mondayStr)
  const sundayLabel = formatThaiDate(sundayStr)

  let message = `📊 สรุปรายสัปดาห์\n`
  message += `📆 ${mondayLabel} — ${sundayLabel}\n`

  if (events && events.length > 0) {
    message += `\n📌 นัดหมาย (${events.length} รายการ)\n`
    events.forEach((e, i) => {
      const time = e.event_time ? e.event_time.slice(0, 5) + ' น.' : ''
      const dateLabel = formatThaiDate(e.event_date)
      message += `${i + 1}. ${e.title}\n`
      message += `   📆 ${dateLabel}`
      if (time) message += ` 🕐 ${time}`
      message += '\n'
    })
  } else {
    message += '\n✨ สัปดาห์นี้ไม่มีนัดหมาย\n'
  }

  if (completedTasks && completedTasks.length > 0) {
    message += `\n✅ ทำเสร็จแล้ว (${completedTasks.length} รายการ)\n`
    completedTasks.forEach((t, i) => {
      message += `${i + 1}. ${t.title}\n`
    })
  }

  if (pendingTasks && pendingTasks.length > 0) {
    message += `\n📝 งานค้าง (${pendingTasks.length} รายการ)\n`
    pendingTasks.forEach((t, i) => {
      const due = t.due_date ? formatThaiDate(t.due_date) : 'ไม่มีกำหนด'
      message += `${i + 1}. ${t.title}\n`
      message += `   📆 ${due}\n`
    })
  }

  if (nextWeekEvents && nextWeekEvents.length > 0) {
    message += `\n🔜 สัปดาห์หน้า (${nextWeekEvents.length} นัด)\n`
    nextWeekEvents.forEach((e, i) => {
      const time = e.event_time ? e.event_time.slice(0, 5) + ' น.' : ''
      const dateLabel = formatThaiDate(e.event_date)
      message += `${i + 1}. ${e.title}\n`
      message += `   📆 ${dateLabel}`
      if (time) message += ` 🕐 ${time}`
      message += '\n'
    })
  }

  message += `\nสู้ๆ สัปดาห์หน้านะคะ! 💪`

  if (userId) {
    const eventCount = events?.length ?? 0
    const completedCount = completedTasks?.length ?? 0
    const pendingCount = pendingTasks?.length ?? 0
    const webMsg = `นัด ${eventCount} | เสร็จ ${completedCount} | ค้าง ${pendingCount}`
    await saveWebNotification(
      userId,
      `📊 สรุปสัปดาห์ (${mondayStr})`,
      webMsg,
      'weekly_summary'
    )
  }

  return sendTextMessage(lineUserId, truncateMessage(message))
}
