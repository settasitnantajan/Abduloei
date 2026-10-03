/**
 * รวมรายการทุกชนิด (นัดหมาย / งาน / กิจวัตร / รายเดือน) ให้อยู่ในรูปแบบเดียว
 * พร้อมคำนวณ "รอบถัดไป" ของกิจวัตร เพื่อนับถอยหลังบนหน้าภาพรวม
 *
 * เรื่องเวลา: ทั้งแอปอ้างอิงเวลาไทย (ดู lib/line/timeline-data.ts)
 * คอลัมน์ DATE/TIME ใน DB ไม่มี timezone จึงตีความเป็นเวลาไทยเสมอ
 */

export type CountdownKind = 'event' | 'task' | 'routine' | 'monthly_routine'

export interface CountdownItem {
  id: string
  title: string
  description?: string | null
  kind: CountdownKind
  /** เวลาที่ต้องทำ (รอบถัดไปสำหรับกิจวัตร) เป็น epoch ms */
  targetMs: number
  /** ข้อความบอกกำหนดการแบบอ่านง่าย เช่น "ทุกวัน · 08:00" */
  scheduleLabel: string
  /** เตือนก่อนกี่นาที (เฉพาะกิจวัตร) */
  remindBeforeMinutes?: number | null
}

/** ชดเชยเวลาไทย UTC+7 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** ส่วนประกอบวันที่ตามเวลาไทย ณ เวลา epoch ที่กำหนด */
function bangkokParts(epochMs: number) {
  const shifted = new Date(epochMs + BANGKOK_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    dow: shifted.getUTCDay(), // 0 = อาทิตย์ ตรงกับ days_of_week ใน DB
  }
}

function parseTime(timeStr?: string | null): { hh: number; mm: number } {
  const parts = (timeStr || '').split(':').map(Number)
  return { hh: parts[0] || 0, mm: parts[1] || 0 }
}

/**
 * แปลงวันที่+เวลาแบบไทยเป็น epoch ms
 * @param dateStr รูปแบบ YYYY-MM-DD
 * @param timeStr รูปแบบ HH:mm หรือ HH:mm:ss (ไม่ระบุ = เที่ยงคืน)
 */
export function bangkokToEpoch(dateStr?: string | null, timeStr?: string | null): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const { hh, mm } = parseTime(timeStr)
  // Date.UTC ให้เวลาแบบ UTC แล้วลบ offset เพื่อให้ค่าที่ใส่ถูกตีความเป็นเวลาไทย
  return Date.UTC(y, m - 1, d, hh, mm, 0, 0) - BANGKOK_OFFSET_MS
}

/** จัดรูปแบบวันที่ไทยแบบสั้น เช่น "22 ก.ย. · 09:00" */
export function formatThaiDateTime(epochMs: number): string {
  const p = bangkokParts(epochMs)
  const hh = String(p.hours).padStart(2, '0')
  const mm = String(p.minutes).padStart(2, '0')
  return `${p.day} ${THAI_MONTHS[p.month]} · ${hh}:${mm}`
}

/** หัวหน้าเพจ เช่น "เสาร์ 20 ก.ย. 2569" */
export function formatThaiFullDate(epochMs: number): string {
  const p = bangkokParts(epochMs)
  return `${THAI_DAYS[p.dow]} ${p.day} ${THAI_MONTHS[p.month]} ${p.year + 543}`
}

/**
 * บอกวันแบบสัมพัทธ์ถ้าใกล้ เช่น "วันนี้ · 09:00" / "พรุ่งนี้ · 09:00"
 * นอกนั้นคืนวันที่เต็ม
 */
export function formatRelativeThai(epochMs: number, nowMs: number): string {
  const target = bangkokParts(epochMs)
  const now = bangkokParts(nowMs)
  const hh = String(target.hours).padStart(2, '0')
  const mm = String(target.minutes).padStart(2, '0')

  const dayDiff =
    Date.UTC(target.year, target.month, target.day) -
    Date.UTC(now.year, now.month, now.day)
  const days = Math.round(dayDiff / 86400000)

  if (days === 0) return `วันนี้ · ${hh}:${mm}`
  if (days === 1) return `พรุ่งนี้ · ${hh}:${mm}`
  if (days > 1 && days < 7) return `${THAI_DAYS[target.dow]} · ${hh}:${mm}`
  return formatThaiDateTime(epochMs)
}

/**
 * หารอบถัดไปของกิจวัตรรายวัน
 * มองไปข้างหน้าไม่เกิน 7 วันเพื่อหาวันที่ตรงกับ days_of_week
 */
export function nextDailyOccurrence(
  routineTime: string,
  daysOfWeek: number[] | null | undefined,
  nowMs: number
): number | null {
  const days = daysOfWeek?.length ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]
  const { hh, mm } = parseTime(routineTime)
  const today = bangkokParts(nowMs)

  for (let offset = 0; offset < 8; offset++) {
    const candidate = Date.UTC(today.year, today.month, today.day + offset, hh, mm) - BANGKOK_OFFSET_MS
    // วันในสัปดาห์ของวันที่กำลังพิจารณา
    const dow = new Date(Date.UTC(today.year, today.month, today.day + offset)).getUTCDay()
    if (days.includes(dow) && candidate > nowMs) return candidate
  }
  return null
}

/**
 * หารอบถัดไปของกิจวัตรรายเดือน
 * เดือนที่ไม่มีวันที่กำหนด (เช่น วันที่ 31 ในเดือน ก.พ.) จะถูกข้ามไป
 */
export function nextMonthlyOccurrence(
  routineTime: string,
  dayOfMonth: number,
  nowMs: number
): number | null {
  const { hh, mm } = parseTime(routineTime)
  const today = bangkokParts(nowMs)

  for (let offset = 0; offset < 14; offset++) {
    const month = today.month + offset
    // ตรวจว่าเดือนนั้นมีวันที่นี้จริงไหม — Date.UTC จะ roll over ถ้าเกิน
    const probe = new Date(Date.UTC(today.year, month, dayOfMonth))
    if (probe.getUTCDate() !== dayOfMonth) continue

    const candidate = Date.UTC(today.year, month, dayOfMonth, hh, mm) - BANGKOK_OFFSET_MS
    if (candidate > nowMs) return candidate
  }
  return null
}

/** สรุปวันในสัปดาห์เป็นข้อความ เช่น "ทุกวัน" / "จ-ศ" */
export function describeDays(daysOfWeek: number[] | null | undefined): string {
  const days = daysOfWeek?.length ? [...daysOfWeek].sort((a, b) => a - b) : []
  if (days.length === 0 || days.length === 7) return 'ทุกวัน'
  if (days.join() === '1,2,3,4,5') return 'จ-ศ'
  if (days.join() === '0,6') return 'ส-อา'
  return days.map(d => THAI_DAYS[d].slice(0, 2)).join(', ')
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** เวลาที่เหลือเป็นมิลลิวินาที (<= 0 คือถึงเวลาแล้ว) */
  totalMs: number
  isElapsed: boolean
}

/** แตกเวลาที่เหลือเป็น วัน/ชม./นาที/วิ */
export function breakdown(targetMs: number, nowMs: number): CountdownParts {
  const totalMs = targetMs - nowMs
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs, isElapsed: true }
  }
  const totalSec = Math.floor(totalMs / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
    isElapsed: false,
  }
}

/** ใกล้ถึง = ภายใน 24 ชั่วโมง */
export function isSoon(targetMs: number, nowMs: number): boolean {
  const diff = targetMs - nowMs
  return diff > 0 && diff <= 24 * 60 * 60 * 1000
}

/** ป้ายกำกับและสีประจำชนิดรายการ — ยึดสีเดิมที่แอปใช้อยู่ */
export const KIND_META: Record<
  CountdownKind,
  { label: string; href: string; text: string; bg: string; border: string }
> = {
  event: {
    label: 'นัดหมาย',
    href: '/events',
    text: 'text-[#00B900]',
    bg: 'bg-[#00B900]/10',
    border: 'border-[#00B900]/30',
  },
  task: {
    label: 'งาน',
    href: '/tasks',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  routine: {
    label: 'กิจวัตร',
    href: '/routines',
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  monthly_routine: {
    label: 'รายเดือน',
    href: '/monthly-routines',
    text: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
  },
}
