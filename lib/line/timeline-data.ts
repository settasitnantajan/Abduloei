import { adminClient } from '@/lib/supabase/admin'

// === สำหรับสรุปเช้า ===
export async function fetchMorningSummaryData(userId: string) {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  // คำนวณพรุ่งนี้
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const tomorrow = new Date(bangkokNow)
  tomorrow.setDate(bangkokNow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA')

  // วันของสัปดาห์ (0=อาทิตย์ ... 6=เสาร์)
  const todayDow = bangkokNow.getDay()
  const tomorrowDow = tomorrow.getDay()

  // วันที่ของเดือน
  const todayDom = bangkokNow.getDate()
  const lastDayOfMonth = new Date(bangkokNow.getFullYear(), bangkokNow.getMonth() + 1, 0).getDate()
  const isLastDay = todayDom === lastDayOfMonth

  // 24 ชม.ก่อน สำหรับ notes
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: todayEvents, error: eventsError },
    { data: todayTasks, error: tasksError },
    { data: pendingTasks, error: pendingError },
    { data: allRoutines, error: routinesError },
    { data: allMonthlyRoutines, error: monthlyError },
    { data: tomorrowEvents, error: tomorrowError },
    { data: recentNotes, error: notesError },
  ] = await Promise.all([
    // Events วันนี้
    adminClient
      .from('events')
      .select('id, title, description, event_time, location, priority')
      .eq('user_id', userId)
      .eq('event_date', today)
      .order('event_time', { ascending: true }),

    // Tasks ที่ due วันนี้
    adminClient
      .from('tasks')
      .select('id, title, description, due_time, priority')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('due_date', today)
      .order('due_time', { ascending: true }),

    // Tasks ค้างทั้งหมด
    adminClient
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending'),

    // Routines ทั้งหมดที่ active
    adminClient
      .from('routines')
      .select('id, title, description, routine_time, days_of_week')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('routine_time', { ascending: true }),

    // Monthly routines ทั้งหมดที่ active
    adminClient
      .from('monthly_routines')
      .select('id, title, description, routine_time, day_of_month')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('routine_time', { ascending: true }),

    // Events พรุ่งนี้
    adminClient
      .from('events')
      .select('id, title, event_time, location')
      .eq('user_id', userId)
      .eq('event_date', tomorrowStr)
      .order('event_time', { ascending: true }),

    // Notes ล่าสุด 24 ชม.
    adminClient
      .from('notes')
      .select('id, title, category')
      .eq('user_id', userId)
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (eventsError) console.error('[Timeline] Events query failed:', eventsError)
  if (tasksError) console.error('[Timeline] Tasks query failed:', tasksError)
  if (pendingError) console.error('[Timeline] Pending tasks query failed:', pendingError)
  if (routinesError) console.error('[Timeline] Routines query failed:', routinesError)
  if (monthlyError) console.error('[Timeline] Monthly routines query failed:', monthlyError)
  if (tomorrowError) console.error('[Timeline] Tomorrow events query failed:', tomorrowError)
  if (notesError) console.error('[Timeline] Notes query failed:', notesError)

  // Filter routines ตาม days_of_week
  const todayRoutines = (allRoutines || []).filter(r => r.days_of_week?.includes(todayDow))
  const tomorrowRoutines = (allRoutines || []).filter(r => r.days_of_week?.includes(tomorrowDow))

  // Filter monthly routines ตาม day_of_month
  const matchDays = isLastDay ? [todayDom, 32] : [todayDom]
  const todayMonthlyRoutines = (allMonthlyRoutines || []).filter(r => matchDays.includes(r.day_of_month))

  return {
    today,
    todayEvents: todayEvents || [],
    todayTasks: todayTasks || [],
    pendingTaskCount: pendingTasks?.length || 0,
    todayRoutines,
    todayMonthlyRoutines,
    tomorrowEvents: tomorrowEvents || [],
    tomorrowRoutines,
    recentNotes: recentNotes || [],
  }
}

// === สำหรับแจ้งเตือน 1 ชม. ===
export async function fetchHourlyHeadsUpData(userId: string) {
  const now = new Date()
  const nowMs = now.getTime()
  const bangkokNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
  const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const todayDow = bangkokNow.getDay()
  const todayDom = bangkokNow.getDate()
  const lastDayOfMonth = new Date(bangkokNow.getFullYear(), bangkokNow.getMonth() + 1, 0).getDate()
  const isLastDay = todayDom === lastDayOfMonth
  const matchDays = isLastDay ? [todayDom, 32] : [todayDom]

  // ช่วงเวลาสำหรับ query events/tasks (55-65 นาทีข้างหน้า)
  const in55m = new Date(nowMs + 55 * 60 * 1000)
  const in65m = new Date(nowMs + 65 * 60 * 1000)

  const [
    { data: events1h, error: events1hError },
    { data: tasks1h, error: tasks1hError },
    { data: routines, error: routinesError },
    { data: monthlyRoutines, error: monthlyError },
  ] = await Promise.all([
    // Events 1 ชม.
    adminClient
      .from('events')
      .select('id, user_id, title, description, event_date, event_time, location, assigned_member_id')
      .eq('reminder_1h_sent', false)
      .eq('user_id', userId)
      .gte('event_date', in55m.toISOString().split('T')[0])
      .lte('event_date', in65m.toISOString().split('T')[0]),

    // Tasks 1 ชม. (เฉพาะวันนี้)
    adminClient
      .from('tasks')
      .select('id, user_id, title, description, due_date, due_time, assigned_member_id')
      .eq('status', 'pending')
      .eq('reminder_1h_sent', false)
      .eq('user_id', userId)
      .eq('due_date', todayDateStr)
      .not('due_time', 'is', null),

    // Routines ที่ active
    adminClient
      .from('routines')
      .select('id, user_id, title, description, routine_time, days_of_week, remind_before_minutes, last_reminded_date, assigned_member_id')
      .eq('is_active', true)
      .eq('user_id', userId),

    // Monthly routines ที่ active
    adminClient
      .from('monthly_routines')
      .select('id, user_id, title, description, routine_time, day_of_month, remind_before_minutes, last_reminded_date, assigned_member_id')
      .eq('is_active', true)
      .eq('user_id', userId)
      .in('day_of_month', matchDays),
  ])

  if (events1hError) console.error('[Timeline] HeadsUp events query failed:', events1hError)
  if (tasks1hError) console.error('[Timeline] HeadsUp tasks query failed:', tasks1hError)
  if (routinesError) console.error('[Timeline] HeadsUp routines query failed:', routinesError)
  if (monthlyError) console.error('[Timeline] HeadsUp monthly routines query failed:', monthlyError)

  // Filter events 45-75 นาที
  const upcomingEvents = (events1h || []).filter(e => {
    if (!e.event_time) return false
    const eventDateTime = buildEventDate(e.event_date, e.event_time)
    if (!eventDateTime || eventDateTime.getTime() < nowMs) return false
    const diffMin = (eventDateTime.getTime() - nowMs) / (1000 * 60)
    return diffMin >= 45 && diffMin <= 75
  })

  // Filter tasks 45-75 นาที
  const upcomingTasks = (tasks1h || []).filter(t => {
    if (!t.due_time) return false
    const taskDateTime = buildEventDate(t.due_date, t.due_time)
    if (!taskDateTime || taskDateTime.getTime() < nowMs) return false
    const diffMin = (taskDateTime.getTime() - nowMs) / (1000 * 60)
    return diffMin >= 45 && diffMin <= 75
  })

  // Filter routines: แจ้งเตือนเมื่อถึงเวลา remind_before_minutes ก่อนเวลาจริง
  // เช่น routine 12:00 remind_before=0 → แจ้งตอน 12:00 พอดี
  // routine 12:00 remind_before=15 → แจ้งตอน 11:45
  // ใช้ window -2 ถึง +5 นาที จาก remindAt เพื่อให้แม่นยำกว่าเดิม
  const upcomingRoutines = (routines || []).filter(r => {
    if (!r.days_of_week?.includes(todayDow)) return false
    if (r.last_reminded_date === todayDateStr) return false
    const routineDateTime = buildEventDate(todayDateStr, r.routine_time)
    if (!routineDateTime) return false
    const remindAt = new Date(routineDateTime.getTime() - (r.remind_before_minutes || 0) * 60 * 1000)
    const diffMin = (remindAt.getTime() - nowMs) / (1000 * 60)
    // window แคบลง: -2 ถึง +5 นาที (จากเดิม -2 ถึง +15)
    return diffMin >= -2 && diffMin <= 5
  })

  // Filter monthly routines — ใช้ window เดียวกัน
  const upcomingMonthlyRoutines = (monthlyRoutines || []).filter(r => {
    if (r.last_reminded_date === todayDateStr) return false
    const routineDateTime = buildEventDate(todayDateStr, r.routine_time)
    if (!routineDateTime) return false
    const remindAt = new Date(routineDateTime.getTime() - (r.remind_before_minutes || 0) * 60 * 1000)
    const diffMin = (remindAt.getTime() - nowMs) / (1000 * 60)
    return diffMin >= -2 && diffMin <= 5
  })

  return {
    upcomingEvents,
    upcomingTasks,
    upcomingRoutines,
    upcomingMonthlyRoutines,
    todayDateStr,
  }
}

function buildEventDate(eventDate: string, eventTime: string | null): Date | null {
  if (!eventTime) return null
  const time = eventTime.slice(0, 5)
  const dateStr = `${eventDate}T${time}:00+07:00`
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return date
}
