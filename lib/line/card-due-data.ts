/**
 * หาบัตรเครดิตที่ใกล้ครบชำระ สำหรับแจ้งเตือนทาง LINE
 *
 * ออกแบบให้ทำงานได้แม้ cron มาสายหรือถูกข้ามรอบ:
 * เงื่อนไขทั้งหมดคิดจาก "วันที่" ไม่ใช่ "ช่วงเวลา" และกันส่งซ้ำด้วย last_reminded_date
 * ดังนั้นไม่ว่า job จะรันเวลาไหนของวัน ผลลัพธ์ก็เหมือนกัน และรันซ้ำก็ไม่ส่งซ้ำ
 * (GitHub Actions schedule เป็น best-effort — ดู .github/workflows/event-reminders.yml)
 */

import { adminClient } from '@/lib/supabase/admin'

export interface DueCard {
  id: string
  user_id: string
  name: string
  last4: string | null
  owner_member_id: string | null
  due_day_of_month: number
  remind_before_days: number
  /** เหลืออีกกี่วันถึงวันครบชำระ (0 = ครบวันนี้) */
  daysLeft: number
  /** ยอดรวมของเดือนปัจจุบัน รวมงวดผ่อน */
  amount: number
}

/** วันสุดท้ายของเดือนที่ระบุ (เวลาไทย) */
function lastDayOf(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * บัตรที่ควรแจ้งเตือนวันนี้ของ user คนหนึ่ง
 *
 * ส่งคืนเฉพาะบัตรที่ (ก) อยู่ในช่วง remind_before_days (ข) ยังไม่ได้เตือนวันนี้
 */
export async function fetchDueCards(userId: string): Promise<{
  cards: DueCard[]
  todayDateStr: string
}> {
  const now = new Date()
  const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const [year, month, today] = todayDateStr.split('-').map(Number)
  const monthIndex = month - 1

  const { data: cards, error } = await adminClient
    .from('credit_cards')
    .select('id, user_id, name, last4, owner_member_id, due_day_of_month, remind_before_days, last_reminded_date')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('[CardDue] query error:', error.message)
    return { cards: [], todayDateStr }
  }
  if (!cards?.length) return { cards: [], todayDateStr }

  const daysThisMonth = lastDayOf(year, monthIndex)
  const candidates: DueCard[] = []

  for (const card of cards) {
    // เตือนไปแล้ววันนี้ — ข้าม (กันส่งซ้ำแม้ cron รันหลายรอบต่อวัน)
    if (card.last_reminded_date === todayDateStr) continue

    // 32 = สิ้นเดือน และวันที่เกินจำนวนวันของเดือนนั้นให้หุบลงเป็นวันสุดท้าย
    const dueThisMonth =
      card.due_day_of_month >= 32
        ? daysThisMonth
        : Math.min(card.due_day_of_month, daysThisMonth)

    let daysLeft: number
    if (dueThisMonth >= today) {
      daysLeft = dueThisMonth - today
    } else {
      // เลยกำหนดของเดือนนี้แล้ว → นับไปรอบเดือนหน้า
      const nextMonthDays = lastDayOf(year, monthIndex + 1)
      const dueNext =
        card.due_day_of_month >= 32
          ? nextMonthDays
          : Math.min(card.due_day_of_month, nextMonthDays)
      daysLeft = daysThisMonth - today + dueNext
    }

    if (daysLeft > card.remind_before_days) continue

    candidates.push({
      id: card.id,
      user_id: card.user_id,
      name: card.name,
      last4: card.last4,
      owner_member_id: card.owner_member_id,
      due_day_of_month: card.due_day_of_month,
      remind_before_days: card.remind_before_days,
      daysLeft,
      amount: 0,
    })
  }

  if (candidates.length === 0) return { cards: [], todayDateStr }

  // ยอดของเดือนปัจจุบัน = รายการที่รูดเดือนนี้ + งวดผ่อนที่ยังเดินอยู่
  const monthStart = `${todayDateStr.slice(0, 7)}-01`
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1))
    .toISOString()
    .slice(0, 10)
  const cardIds = candidates.map(c => c.id)

  const [expensesRes, instRes] = await Promise.all([
    adminClient
      .from('finance_expenses')
      .select('card_id, amount')
      .in('card_id', cardIds)
      .gte('spent_on', monthStart)
      .lt('spent_on', nextMonthStart),
    adminClient
      .from('finance_installments')
      .select('card_id, monthly_amount, start_month, total_installments')
      .in('card_id', cardIds),
  ])

  const totals = new Map<string, number>()
  for (const e of expensesRes.data || []) {
    totals.set(e.card_id, (totals.get(e.card_id) || 0) + Number(e.amount || 0))
  }
  for (const i of instRes.data || []) {
    // นับเฉพาะงวดที่ยังเดินอยู่ในเดือนนี้ — จำนวนงวดคำนวณจาก start_month
    const start = String(i.start_month).slice(0, 7)
    const [sy, sm] = start.split('-').map(Number)
    const elapsed = (year - sy) * 12 + (month - sm)
    if (elapsed < 0) continue
    if (i.total_installments !== null && elapsed >= i.total_installments) continue
    totals.set(i.card_id, (totals.get(i.card_id) || 0) + Number(i.monthly_amount || 0))
  }

  for (const c of candidates) c.amount = totals.get(c.id) || 0

  return { cards: candidates, todayDateStr }
}
