/**
 * หาของที่ใกล้หมดอายุ สำหรับแจ้งเตือนทาง LINE และกวาดของที่เลยกำหนดเก็บ
 *
 * ออกแบบให้ทำงานได้แม้ cron มาสายหรือถูกข้ามรอบ — เงื่อนไขคิดจาก "วันที่"
 * ไม่ใช่ช่วงเวลา และกันส่งซ้ำด้วย last_reminded_date เหมือนบัตรเครดิต
 */

import { adminClient } from '@/lib/supabase/admin'
import { KEEP_AFTER_EXPIRY_DAYS } from '@/lib/types/expiry'

export interface ExpiringItem {
  id: string
  user_id: string
  name: string
  category: string
  expires_on: string
  /** เหลืออีกกี่วันถึงวันหมดอายุ (0 = วันนี้, ติดลบ = เลยมาแล้ว) */
  daysLeft: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY)
}

function shiftDays(dateStr: string, days: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

/**
 * ของที่ควรแจ้งเตือนวันนี้ของผู้ใช้คนหนึ่ง
 *
 * เตือนเมื่อเข้าช่วง remind_before_days และยังไม่ได้เตือนวันนี้
 * ของที่หมดอายุไปแล้วไม่เตือนซ้ำ — เตือนวันสุดท้ายคือวันที่หมดอายุพอดี
 */
export async function fetchExpiringItems(userId: string): Promise<{
  items: ExpiringItem[]
  todayDateStr: string
}> {
  const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  const { data, error } = await adminClient
    .from('expiry_items')
    .select('id, user_id, name, category, expires_on, remind_before_days, last_reminded_date')
    .eq('user_id', userId)
    .gt('remind_before_days', 0)
    .gte('expires_on', todayDateStr)

  if (error) {
    console.error('[Expiry] fetchExpiringItems error:', error.message)
    return { items: [], todayDateStr }
  }

  const items: ExpiringItem[] = []
  for (const row of data || []) {
    // เตือนไปแล้ววันนี้ — ข้าม (กันส่งซ้ำแม้ cron รันหลายรอบต่อวัน)
    if (row.last_reminded_date === todayDateStr) continue

    const daysLeft = daysBetween(todayDateStr, row.expires_on)
    if (daysLeft > row.remind_before_days) continue

    items.push({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      category: row.category,
      expires_on: row.expires_on,
      daysLeft,
    })
  }

  // ของที่ใกล้หมดที่สุดขึ้นก่อน
  items.sort((a, b) => a.daysLeft - b.daysLeft)
  return { items, todayDateStr }
}

/**
 * ลบของที่หมดอายุเกินกำหนดเก็บแล้ว
 *
 * ทำตอน cron รันแทนการตั้ง pg_cron เพราะโปรเจคนี้ยิง cron จาก GitHub Actions
 * อยู่แล้ว และไม่ได้เปิดใช้ส่วนขยาย pg_cron ไว้
 *
 * @returns จำนวนรายการที่ถูกลบ
 */
export async function purgeExpiredItems(): Promise<number> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const cutoff = shiftDays(today, -KEEP_AFTER_EXPIRY_DAYS)

  const { data, error } = await adminClient
    .from('expiry_items')
    .delete()
    .lt('expires_on', cutoff)
    .select('id')

  if (error) {
    console.error('[Expiry] purgeExpiredItems error:', error.message)
    return 0
  }
  return data?.length ?? 0
}
