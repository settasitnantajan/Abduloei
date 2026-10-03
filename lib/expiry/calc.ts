/**
 * การคำนวณของฟีเจอร์ของหมดอายุ
 *
 * แยกจากชั้น database เพื่อให้เป็น pure function ทดสอบง่าย
 * ทุกอย่างอ้างอิงเวลาไทย เพราะคอลัมน์ DATE ใน DB ไม่มี timezone
 */

import {
  KEEP_AFTER_EXPIRY_DAYS,
  type ExpiryItem,
  type ExpiryItemView,
  type ExpiryStatus,
} from '@/lib/types/expiry'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** วันที่วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayBangkok(nowMs: number = Date.now()): string {
  return new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

/**
 * จำนวนวันจาก a ถึง b (บวก = b อยู่หลัง a)
 *
 * เทียบที่ระดับวัน ไม่สนเวลา — "หมดอายุวันนี้" จึงได้ 0 เสมอ
 * ไม่ว่าจะเปิดดูตอนเช้าหรือตอนดึก
 */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY)
}

/** เลื่อนวันที่ไปกี่วัน คืนรูปแบบ YYYY-MM-DD */
export function shiftDays(dateStr: string, days: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

/**
 * สถานะของชิ้นหนึ่ง
 *
 * ของที่ไม่ตั้งเตือน (remindBeforeDays = 0) ยังนับเป็น "ใกล้หมด" ได้
 * ภายใน 7 วัน เพื่อให้หน้าจอยังเตือนสายตาแม้ไม่ส่ง LINE
 */
export function statusOf(item: ExpiryItem, today: string): ExpiryStatus {
  const daysLeft = daysBetween(today, item.expiresOn)
  if (daysLeft < 0) return 'expired'
  const window = item.remindBeforeDays > 0 ? item.remindBeforeDays : 7
  return daysLeft <= window ? 'soon' : 'fresh'
}

/** เติมสถานะและจำนวนวันให้ของแต่ละชิ้น */
export function toView(item: ExpiryItem, today: string): ExpiryItemView {
  const daysLeft = daysBetween(today, item.expiresOn)
  const status = statusOf(item, today)
  return {
    ...item,
    status,
    daysLeft,
    // นับถอยหลังวันลบ เฉพาะของที่หมดอายุแล้ว
    daysUntilRemoved: status === 'expired' ? KEEP_AFTER_EXPIRY_DAYS + daysLeft : null,
  }
}

/**
 * จัดกลุ่มตามความเร่งด่วน — หมดแล้ว → ใกล้หมด → ยังไม่หมด
 *
 * ในแต่ละกลุ่มเรียงตามวันหมดอายุ ของที่ต้องจัดการก่อนจึงอยู่บนสุดเสมอ
 */
export function groupItems(
  items: ExpiryItem[],
  nowMs: number = Date.now()
): { expired: ExpiryItemView[]; soon: ExpiryItemView[]; fresh: ExpiryItemView[] } {
  const today = todayBangkok(nowMs)
  const views = items
    .map(i => toView(i, today))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))

  return {
    expired: views.filter(v => v.status === 'expired'),
    soon: views.filter(v => v.status === 'soon'),
    fresh: views.filter(v => v.status === 'fresh'),
  }
}

/** ข้อความบอกสถานะแบบสั้น เช่น "อีก 3 วัน" / "หมดอายุวันนี้" */
export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return 'หมดอายุวันนี้'
  if (daysLeft < 0) return `เกิน ${Math.abs(daysLeft)} วัน`
  return `อีก ${daysLeft} วัน`
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** วันที่แบบสั้นพร้อมปี พ.ศ. เช่น "28 ก.ย. 69" */
export function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const buddhistShort = String(y + 543).slice(-2)
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${buddhistShort}`
}
