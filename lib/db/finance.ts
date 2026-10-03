/**
 * ชั้นที่คุย database ของฟีเจอร์การเงิน
 *
 * ยึดแพตเทิร์นเดียวกับ lib/db/monthly-routines.ts — ใช้ createClient() ฝั่ง server
 * (คุกกี้ + RLS) และเรียก auth.getUser() ในทุกฟังก์ชัน
 *
 * ทุกฟังก์ชันที่แก้ข้อมูลกรองด้วย user_id ด้วยเสมอ ไม่พึ่ง RLS อย่างเดียว
 * เพื่อไม่ให้พลาดแบบ toggleMonthlyRoutine/deleteMonthlyRoutine ที่ลืม guard ไว้
 *
 * เรื่องปี: คอลัมน์วันที่เก็บ ค.ศ. เสมอ แปลงเป็น พ.ศ. ตอนแสดงผล (lib/finance/calc.ts)
 */

import { createClient } from '@/lib/supabase/server'
import {
  currentBillingCycle,
  isInstallmentActiveIn,
  resolveDayOfMonth,
  shiftMonth,
  currentMonth,
} from '@/lib/finance/calc'
import type {
  CreditCard,
  ExpenseItem,
  FinanceMember,
  FinanceMonth,
  Installment,
} from '@/lib/types/finance'

/** ผลลัพธ์มาตรฐานของการเขียนข้อมูล ข้อความ error เป็นภาษาไทยสำหรับแสดงบนหน้าจอ */
export interface MutationResult {
  success: boolean
  error?: string
}

const AUTH_ERROR = 'กรุณาเข้าสู่ระบบก่อนใช้งาน'

/** รับ client ที่ผูกกับผู้ใช้ปัจจุบัน — คืน null เมื่อยังไม่ล็อกอิน */
async function withUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, userId: user.id }
}

// ---------------------------------------------------------------------------
// อ่านข้อมูลของเดือน
// ---------------------------------------------------------------------------

/** ขอบเขตวันที่ของเดือน [วันที่ 1 ของเดือนนี้, วันที่ 1 ของเดือนถัดไป) */
function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` }
}

/**
 * ดึงข้อมูลการเงินของ "รอบปัจจุบัน"
 *
 * บัตรเครดิตคิดตามรอบบิลของแต่ละใบ (คำนวณจาก due_day_of_month)
 * เพราะบัตรเรียกเก็บเป็นรอบ ไม่ใช่ตามเดือนปฏิทิน — รายการที่รูดคาบสองเดือน
 * จึงอยู่ในบิลใบเดียวกัน ตรงกับยอดที่ต้องเตรียมเงินจ่ายจริง
 *
 * เงินสดและค่าใช้จ่ายประจำไม่มีรอบบิล จึงใช้เดือนปัจจุบันตามปกติ
 * (จ่ายออกไปแล้ว ไม่มีรอบเรียกเก็บ)
 */
export async function getFinanceMonth(
  month?: string
): Promise<{ data?: FinanceMonth; error?: string }> {
  const ctx = await withUser()
  if (!ctx) return { error: AUTH_ERROR }
  const { supabase, userId } = ctx

  // เดือนปฏิทินปัจจุบัน ใช้กับเงินสด/ค่าใช้จ่ายประจำ/รายได้
  const viewMonth = month || currentMonth()
  const { from: monthFrom, to: monthTo } = monthRange(viewMonth)

  const [membersRes, cardsRes, incomeRes, cashRes, instRes, recurringRes] = await Promise.all([
    supabase
      .from('home_members')
      .select('id, name, nickname, monthly_income')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('credit_cards')
      .select('id, name, last4, owner_member_id, due_day_of_month, remind_before_days')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    // รายได้ทุกงวดที่เคยกรอก — ใช้หาค่าของรอบนี้ หรือค่าล่าสุดก่อนหน้า
    supabase
      .from('member_incomes')
      .select('member_id, period, amount')
      .lte('period', `${viewMonth}-01`)
      .order('period', { ascending: true }),
    // เงินสดใช้เดือนปฏิทิน
    supabase
      .from('finance_expenses')
      .select('id, title, amount, paid_by_member_id, channel, card_id, spent_on, icon')
      .eq('user_id', userId)
      .eq('channel', 'cash')
      .gte('spent_on', monthFrom)
      .lt('spent_on', monthTo)
      .order('spent_on', { ascending: false }),
    supabase
      .from('finance_installments')
      .select('id, title, monthly_amount, owner_member_id, card_id, start_month, total_installments, icon')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('recurring_expenses')
      .select('id, title, amount, paid_by_member_id, day_of_month, icon, start_month, end_month')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('day_of_month', { ascending: true }),
  ])

  const firstError =
    membersRes.error || cardsRes.error || cashRes.error || instRes.error || recurringRes.error
  if (firstError) {
    console.error('[Finance] getFinanceMonth error:', firstError.message)
  }

  // --- รอบบิลของแต่ละบัตร แล้วดึงรายการตามช่วงรอบนั้น ---
  const cards: CreditCard[] = (cardsRes.data || []).map(c => {
    const cycle = currentBillingCycle(c.due_day_of_month)
    return {
      id: c.id,
      name: c.name,
      last4: c.last4,
      ownerId: c.owner_member_id,
      dueDayOfMonth: c.due_day_of_month,
      remindBeforeDays: c.remind_before_days,
      cycleFrom: cycle.from,
      cycleTo: cycle.to,
      daysUntilDue: cycle.daysLeft,
    }
  })

  // ดึงรายการบัตรทั้งหมด ไม่จำกัดช่วงวันที่
  //
  // เดิมกรองตามรอบบิลที่คำนวณจาก due_day_of_month แต่วันครบชำระที่ผู้ใช้ตั้งไว้
  // มักไม่ตรงกับรอบจริงของธนาคารเป๊ะ ๆ ทำให้รายการต้นรอบหลุดหายไป
  // การแสดงทุกรายการที่นำเข้ามาจึงตรงกับใบแจ้งยอดเสมอ และไม่ต้องเดารอบ
  const cardExpenseRows = await Promise.all(
    cards.map(card =>
      supabase
        .from('finance_expenses')
        .select('id, title, amount, paid_by_member_id, channel, card_id, spent_on, icon')
        .eq('user_id', userId)
        .eq('card_id', card.id)
        .order('spent_on', { ascending: false })
    )
  )

  const expenseRows = [
    ...cardExpenseRows.flatMap(r => r.data || []),
    ...(cashRes.data || []),
  ]
  const expenseIds = expenseRows.map(e => e.id)

  const [expShareRes, instShareRes, recShareRes] = await Promise.all([
    expenseIds.length > 0
      ? supabase.from('expense_shares').select('expense_id, member_id').in('expense_id', expenseIds)
      : Promise.resolve({ data: [] as { expense_id: string; member_id: string }[] }),
    supabase.from('installment_shares').select('installment_id, member_id'),
    supabase.from('recurring_shares').select('recurring_id, member_id'),
  ])

  /** จับกลุ่มผู้ร่วมหารตาม id ของรายการแม่ */
  function groupShares<T extends Record<string, unknown>>(
    rows: T[] | null,
    idKey: keyof T
  ): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const row of rows || []) {
      const parentId = row[idKey] as string
      const list = map.get(parentId) ?? []
      list.push(row.member_id as string)
      map.set(parentId, list)
    }
    return map
  }

  const expenseShares = groupShares(expShareRes.data, 'expense_id')
  const installmentShares = groupShares(instShareRes.data, 'installment_id')
  const recurringShares = groupShares(recShareRes.data, 'recurring_id')

  // --- รายได้ของรอบนี้ — ไม่มีของรอบนี้ให้ใช้ค่าล่าสุดก่อนหน้า ---
  const latestIncome = new Map<string, number>()
  for (const row of incomeRes.data || []) {
    // เรียงจากเก่าไปใหม่แล้ว ค่าหลังจึงทับค่าก่อนเสมอ
    latestIncome.set(row.member_id, Number(row.amount) || 0)
  }

  const members: FinanceMember[] = (membersRes.data || []).map(m => ({
    id: m.id,
    name: m.nickname || m.name,
    // ยังไม่เคยกรอกประวัติเลย → ใช้ค่าเดิมใน home_members เป็นค่าตั้งต้น
    monthlyIncome: latestIncome.get(m.id) ?? (Number(m.monthly_income) || 0),
  }))

  const expenses: ExpenseItem[] = expenseRows.map(e => ({
    id: e.id,
    title: e.title,
    amount: Number(e.amount) || 0,
    paidById: e.paid_by_member_id,
    group: e.channel === 'credit_card' ? 'credit_card' : 'cash',
    cardId: e.card_id,
    date: e.spent_on,
    icon: e.icon,
    sharedBy: expenseShares.get(e.id) ?? [],
  }))

  // คลี่แม่แบบค่าใช้จ่ายประจำเป็นรายการของเดือนนี้
  for (const r of recurringRes.data || []) {
    if (r.start_month && viewMonth < String(r.start_month).slice(0, 7)) continue
    if (r.end_month && viewMonth > String(r.end_month).slice(0, 7)) continue

    const day = resolveDayOfMonth(viewMonth, r.day_of_month)
    expenses.push({
      id: r.id,
      title: r.title,
      amount: Number(r.amount) || 0,
      paidById: r.paid_by_member_id,
      group: 'recurring',
      date: `${viewMonth}-${String(day).padStart(2, '0')}`,
      dayOfMonth: r.day_of_month,
      icon: r.icon,
      fromTemplate: true,
      sharedBy: recurringShares.get(r.id) ?? [],
    })
  }

  const installments: Installment[] = (instRes.data || [])
    .map(i => ({
      id: i.id,
      title: i.title,
      monthlyAmount: Number(i.monthly_amount) || 0,
      ownerId: i.owner_member_id,
      cardId: i.card_id,
      startMonth: i.start_month,
      totalInstallments: i.total_installments,
      icon: i.icon,
      sharedBy: installmentShares.get(i.id) ?? [],
    }))
    .filter(i => isInstallmentActiveIn(i, viewMonth))

  return { data: { month: viewMonth, members, cards, expenses, installments } }
}

// ---------------------------------------------------------------------------
// สมาชิก — รายรับต่อเดือน
// ---------------------------------------------------------------------------

/**
 * ตั้งรายรับของสมาชิกสำหรับรอบที่ระบุ
 *
 * เก็บแยกตามรอบเพราะรายได้แต่ละเดือนไม่เท่ากัน (โบนัส, OT, ค่าคอม)
 * รอบที่ไม่ได้กรอกจะใช้ค่าล่าสุดก่อนหน้าแทน จึงกรอกเฉพาะเดือนที่ต่างจากปกติ
 *
 * @param period รูปแบบ YYYY-MM — ไม่ระบุ = เดือนปัจจุบัน
 */
export async function updateMemberIncome(
  memberId: string,
  monthlyIncome: number,
  period?: string
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
    return { success: false, error: 'รายรับต้องเป็นตัวเลขที่ไม่ติดลบ' }
  }

  // สมาชิกต้องเป็นของผู้ใช้คนนี้จริง — ตาราง member_incomes ไม่มี user_id ของตัวเอง
  const { data: member, error: memberError } = await ctx.supabase
    .from('home_members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (memberError || !member) return { success: false, error: 'ไม่พบสมาชิกคนนี้' }

  const target = period || currentMonth()
  const { error } = await ctx.supabase.from('member_incomes').upsert(
    {
      member_id: memberId,
      period: `${target}-01`,
      amount: monthlyIncome,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,period' }
  )

  if (error) {
    console.error('[Finance] updateMemberIncome error:', error.message)
    return { success: false, error: 'บันทึกรายรับไม่สำเร็จ' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// บัตรเครดิต
// ---------------------------------------------------------------------------

export interface CardInput {
  name: string
  last4?: string | null
  ownerMemberId?: string | null
  dueDayOfMonth: number
  remindBeforeDays?: number
}

export async function createCard(input: CardInput): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!input.name?.trim()) return { success: false, error: 'กรุณาใส่ชื่อบัตร' }
  if (input.dueDayOfMonth < 1 || input.dueDayOfMonth > 32) {
    return { success: false, error: 'วันครบชำระต้องอยู่ระหว่าง 1-31 หรือเลือกสิ้นเดือน' }
  }

  const { error } = await ctx.supabase.from('credit_cards').insert({
    user_id: ctx.userId,
    name: input.name.trim(),
    last4: input.last4?.trim() || null,
    owner_member_id: input.ownerMemberId || null,
    due_day_of_month: input.dueDayOfMonth,
    remind_before_days: input.remindBeforeDays ?? 3,
  })

  if (error) {
    console.error('[Finance] createCard error:', error.message)
    return { success: false, error: 'เพิ่มบัตรไม่สำเร็จ' }
  }
  return { success: true }
}

export async function updateCard(
  cardId: string,
  data: Record<string, unknown>
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('credit_cards')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', cardId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] updateCard error:', error.message)
    return { success: false, error: 'แก้ไขบัตรไม่สำเร็จ' }
  }
  return { success: true }
}

/** ลบบัตร — รายการและงวดผ่อนที่ผูกอยู่จะถูกลบตาม (ON DELETE CASCADE) */
export async function deleteCard(cardId: string): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('credit_cards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] deleteCard error:', error.message)
    return { success: false, error: 'ลบบัตรไม่สำเร็จ' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// รายการใช้จ่าย (บัตร / เงินสด)
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  title: string
  amount: number
  paidByMemberId?: string | null
  channel: 'credit_card' | 'cash'
  cardId?: string | null
  /** YYYY-MM-DD (ค.ศ.) */
  spentOn: string
  icon?: string | null
}

export async function createExpense(input: ExpenseInput): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!input.title?.trim()) return { success: false, error: 'กรุณาใส่ชื่อรายการ' }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { success: false, error: 'จำนวนเงินต้องเป็นตัวเลขที่ไม่ติดลบ' }
  }
  // ตรงกับ CHECK constraint ในตาราง — เช็กที่นี่ด้วยเพื่อได้ข้อความไทยที่อ่านรู้เรื่อง
  if (input.channel === 'credit_card' && !input.cardId) {
    return { success: false, error: 'กรุณาเลือกบัตรที่ใช้จ่าย' }
  }

  const { error } = await ctx.supabase.from('finance_expenses').insert({
    user_id: ctx.userId,
    title: input.title.trim(),
    amount: input.amount,
    paid_by_member_id: input.paidByMemberId || null,
    channel: input.channel,
    card_id: input.channel === 'credit_card' ? input.cardId : null,
    spent_on: input.spentOn,
    icon: input.icon || null,
  })

  if (error) {
    console.error('[Finance] createExpense error:', error.message)
    return { success: false, error: 'เพิ่มรายการไม่สำเร็จ' }
  }
  return { success: true }
}

/**
 * บันทึกรายการหลายรายการพร้อมกัน — ใช้ตอนนำเข้าจากใบแจ้งยอด
 *
 * ผู้ใช้ตรวจและติ๊กเลือกมาแล้วจากหน้ารีวิว แต่ยังตรวจซ้ำที่นี่
 * เพราะข้อมูลจากฝั่ง client เชื่อถือไม่ได้ และบางรายการมาจากที่ AI อ่าน
 */
export async function createExpensesBulk(
  cardId: string,
  items: Array<{ title: string; amount: number; spentOn: string; icon?: string | null }>
): Promise<MutationResult & { inserted?: number }> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!cardId) return { success: false, error: 'ไม่พบบัตรที่จะบันทึกรายการ' }
  if (!items.length) return { success: false, error: 'ไม่มีรายการให้บันทึก' }
  // กันส่งข้อมูลก้อนใหญ่ผิดปกติ ใบแจ้งยอดปกติไม่เกินนี้
  if (items.length > 300) return { success: false, error: 'รายการมากเกินไป (เกิน 300 รายการ)' }

  // บัตรต้องเป็นของผู้ใช้คนนี้จริง — ไม่พึ่ง RLS อย่างเดียว
  const { data: card, error: cardError } = await ctx.supabase
    .from('credit_cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (cardError || !card) {
    return { success: false, error: 'ไม่พบบัตรนี้' }
  }

  const rows = []
  for (const item of items) {
    const title = item.title?.trim()
    if (!title) continue
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.spentOn)) continue

    rows.push({
      user_id: ctx.userId,
      title: title.slice(0, 120),
      amount: item.amount,
      // นำเข้าจากใบแจ้งยอดยังไม่รู้ว่าใครรูด — ผู้ใช้มากดระบุทีหลังได้
      paid_by_member_id: null,
      channel: 'credit_card' as const,
      card_id: cardId,
      spent_on: item.spentOn,
      icon: item.icon || null,
    })
  }

  if (rows.length === 0) {
    return { success: false, error: 'ไม่มีรายการที่ข้อมูลครบพอจะบันทึก' }
  }

  const { error } = await ctx.supabase.from('finance_expenses').insert(rows)

  if (error) {
    console.error('[Finance] createExpensesBulk error:', error.message)
    return { success: false, error: 'บันทึกรายการไม่สำเร็จ' }
  }
  return { success: true, inserted: rows.length }
}

export async function updateExpense(
  expenseId: string,
  data: Record<string, unknown>
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('finance_expenses')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] updateExpense error:', error.message)
    return { success: false, error: 'แก้ไขรายการไม่สำเร็จ' }
  }
  return { success: true }
}

export async function deleteExpense(expenseId: string): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('finance_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] deleteExpense error:', error.message)
    return { success: false, error: 'ลบรายการไม่สำเร็จ' }
  }
  return { success: true }
}

/** รายการที่อาจซ้ำ 1 รายการ */
export interface DuplicateCandidate {
  date: string
  title: string
  amount: number
}

/** ผลตรวจซ้ำ — คีย์คือ "date|amount|title" ของรายการที่ส่งไปตรวจ */
export type DuplicateReport = Record<string, 'expense' | 'installment'>

/** คีย์ที่ใช้จับคู่รายการ ฝั่ง client สร้างคีย์แบบเดียวกัน */
function dupKey(date: string, amount: number, title: string): string {
  return `${date}|${amount.toFixed(2)}|${title.trim().toLowerCase()}`
}

/**
 * ตรวจว่ารายการที่กำลังจะนำเข้า ซ้ำกับของที่มีอยู่แล้วไหม
 *
 * ตรวจ 2 แบบ:
 * 1. ซ้ำกับรายการใช้จ่ายที่บันทึกไว้ — เทียบ "ทุกเดือน" ไม่ใช่แค่เดือนที่เปิดดู
 *    เพราะใบแจ้งยอดรอบหนึ่งมักมีรายการคาบ 2 เดือน
 * 2. ยอดตรงกับงวดผ่อนของบัตรใบนั้น — ธนาคารใส่งวดผ่อนมาในใบแจ้งยอดทุกเดือน
 *    ถ้านำเข้าโดยไม่ดูจะได้ยอดซ้ำสองชั้น (ทั้งจากผ่อนที่บันทึกไว้ และจากรายการนำเข้า)
 */
export async function findDuplicates(
  cardId: string,
  candidates: DuplicateCandidate[]
): Promise<DuplicateReport> {
  const ctx = await withUser()
  if (!ctx || candidates.length === 0) return {}

  const dates = candidates.map(c => c.date).sort()
  const report: DuplicateReport = {}

  // --- 1. เทียบกับรายการใช้จ่ายในช่วงวันที่ของไฟล์ (ข้ามเดือนได้) ---
  const { data: existing } = await ctx.supabase
    .from('finance_expenses')
    .select('title, amount, spent_on')
    .eq('user_id', ctx.userId)
    .eq('card_id', cardId)
    .gte('spent_on', dates[0])
    .lte('spent_on', dates[dates.length - 1])

  const existingKeys = new Set(
    (existing || []).map(e => dupKey(e.spent_on, Number(e.amount), e.title))
  )

  // --- 2. ยอดของงวดผ่อนในบัตรใบนี้ ---
  const { data: installments } = await ctx.supabase
    .from('finance_installments')
    .select('monthly_amount')
    .eq('user_id', ctx.userId)
    .eq('card_id', cardId)

  const installmentAmounts = new Set(
    (installments || []).map(i => Number(i.monthly_amount).toFixed(2))
  )

  for (const c of candidates) {
    const key = dupKey(c.date, c.amount, c.title)
    if (existingKeys.has(key)) {
      report[key] = 'expense'
    } else if (installmentAmounts.has(c.amount.toFixed(2))) {
      report[key] = 'installment'
    }
  }

  return report
}

// ---------------------------------------------------------------------------
// ผู้ร่วมหารรายการ
// ---------------------------------------------------------------------------

/** ชนิดรายการที่หารกันได้ */
export type ShareKind = 'expense' | 'installment' | 'recurring'

/** ตาราง/คอลัมน์ของแต่ละชนิด — รวมไว้ที่เดียวกันลืมแก้ไม่ครบ */
const SHARE_TABLES: Record<ShareKind, { shares: string; parent: string; fk: string }> = {
  expense: { shares: 'expense_shares', parent: 'finance_expenses', fk: 'expense_id' },
  installment: { shares: 'installment_shares', parent: 'finance_installments', fk: 'installment_id' },
  recurring: { shares: 'recurring_shares', parent: 'recurring_expenses', fk: 'recurring_id' },
}

/**
 * ตั้งว่าใครร่วมหารรายการนี้บ้าง (แทนที่รายชื่อเดิมทั้งหมด)
 *
 * ส่งลิสต์ว่าง = กลับไปเป็น "ไม่ระบุ"
 * ยอดต่อคนไม่ได้เก็บไว้ — คำนวณสดจาก amount หารจำนวนคน (ดู splitAmount)
 */
export async function setShares(
  kind: ShareKind,
  itemId: string,
  memberIds: string[]
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const table = SHARE_TABLES[kind]
  if (!table) return { success: false, error: 'ชนิดรายการไม่ถูกต้อง' }

  // รายการต้องเป็นของผู้ใช้คนนี้จริง — ไม่พึ่ง RLS อย่างเดียว
  const { data: parent, error: parentError } = await ctx.supabase
    .from(table.parent)
    .select('id')
    .eq('id', itemId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (parentError || !parent) {
    return { success: false, error: 'ไม่พบรายการนี้' }
  }

  // ลบรายชื่อเดิมก่อนแล้วใส่ใหม่ — ง่ายกว่าไล่เทียบว่าใครเพิ่ม/ใครออก
  const { error: deleteError } = await ctx.supabase
    .from(table.shares)
    .delete()
    .eq(table.fk, itemId)

  if (deleteError) {
    console.error('[Finance] setShares delete error:', deleteError.message)
    return { success: false, error: 'บันทึกผู้ร่วมหารไม่สำเร็จ' }
  }

  const unique = [...new Set(memberIds.filter(Boolean))]
  if (unique.length === 0) return { success: true }

  const { error: insertError } = await ctx.supabase
    .from(table.shares)
    .insert(unique.map(memberId => ({ [table.fk]: itemId, member_id: memberId })))

  if (insertError) {
    console.error('[Finance] setShares insert error:', insertError.message)
    return { success: false, error: 'บันทึกผู้ร่วมหารไม่สำเร็จ' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// ผ่อนชำระ
// ---------------------------------------------------------------------------

export interface InstallmentInput {
  title: string
  monthlyAmount: number
  ownerMemberId?: string | null
  cardId: string
  /** เดือนที่เริ่มผ่อน รูปแบบ YYYY-MM (ค.ศ.) */
  startMonth: string
  /** null = จ่ายครั้งเดียว ไม่มีงวด */
  totalInstallments: number | null
  icon?: string | null
}

export async function createInstallment(input: InstallmentInput): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!input.title?.trim()) return { success: false, error: 'กรุณาใส่ชื่อรายการผ่อน' }
  if (!input.cardId) return { success: false, error: 'ผ่อนชำระต้องผูกกับบัตรเครดิต' }
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount < 0) {
    return { success: false, error: 'ยอดต่อเดือนต้องเป็นตัวเลขที่ไม่ติดลบ' }
  }
  if (input.totalInstallments !== null && input.totalInstallments < 1) {
    return { success: false, error: 'จำนวนงวดต้องมากกว่า 0' }
  }

  const { error } = await ctx.supabase.from('finance_installments').insert({
    user_id: ctx.userId,
    title: input.title.trim(),
    monthly_amount: input.monthlyAmount,
    owner_member_id: input.ownerMemberId || null,
    card_id: input.cardId,
    // เก็บเป็นวันที่ 1 ของเดือนเสมอ เพื่อให้คำนวณงวดได้ตรง
    start_month: `${input.startMonth}-01`,
    total_installments: input.totalInstallments,
    icon: input.icon || null,
  })

  if (error) {
    console.error('[Finance] createInstallment error:', error.message)
    return { success: false, error: 'เพิ่มรายการผ่อนไม่สำเร็จ' }
  }
  return { success: true }
}

/**
 * แปลงรายการใช้จ่ายที่บันทึกไว้แล้ว ให้กลายเป็นรายการผ่อน
 *
 * ใช้ตอนนำเข้าจากใบแจ้งยอดแล้วเจอว่าบรรทัดนั้นที่จริงเป็นงวดผ่อน
 * — ยอดในรายการคือ "ยอดต่อเดือน" อยู่แล้ว จึงยกมาใช้ได้ตรง ๆ
 *
 * ย้ายผู้ร่วมหารมาด้วย แล้วลบรายการเดิมทิ้ง เพื่อไม่ให้ยอดถูกนับซ้ำสองที่
 */
export async function convertExpenseToInstallment(
  expenseId: string,
  options: { startMonth: string; totalInstallments: number | null }
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { data: expense, error: readError } = await ctx.supabase
    .from('finance_expenses')
    .select('id, title, amount, card_id, channel, icon, paid_by_member_id')
    .eq('id', expenseId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (readError || !expense) return { success: false, error: 'ไม่พบรายการนี้' }
  if (expense.channel !== 'credit_card' || !expense.card_id) {
    return { success: false, error: 'ผ่อนชำระต้องเป็นรายการในบัตรเครดิตเท่านั้น' }
  }
  if (options.totalInstallments !== null && options.totalInstallments < 1) {
    return { success: false, error: 'จำนวนงวดต้องมากกว่า 0' }
  }

  // ผู้ร่วมหารของรายการเดิม ย้ายไปให้รายการผ่อนด้วย
  const { data: shares } = await ctx.supabase
    .from('expense_shares')
    .select('member_id')
    .eq('expense_id', expenseId)

  const { data: created, error: insertError } = await ctx.supabase
    .from('finance_installments')
    .insert({
      user_id: ctx.userId,
      title: expense.title,
      monthly_amount: expense.amount,
      owner_member_id: expense.paid_by_member_id,
      card_id: expense.card_id,
      start_month: `${options.startMonth}-01`,
      total_installments: options.totalInstallments,
      icon: expense.icon,
    })
    .select('id')
    .single()

  if (insertError || !created) {
    console.error('[Finance] convertExpenseToInstallment insert error:', insertError?.message)
    return { success: false, error: 'แปลงเป็นรายการผ่อนไม่สำเร็จ' }
  }

  if (shares && shares.length > 0) {
    await ctx.supabase.from('installment_shares').insert(
      shares.map(sh => ({ installment_id: created.id, member_id: sh.member_id }))
    )
  }

  // ลบรายการเดิมหลังสร้างสำเร็จแล้วเท่านั้น — ถ้าลบไม่ได้ให้ย้อนรายการผ่อนออก
  // ไม่งั้นยอดจะถูกนับซ้ำทั้งสองที่
  const { error: deleteError } = await ctx.supabase
    .from('finance_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', ctx.userId)

  if (deleteError) {
    console.error('[Finance] convertExpenseToInstallment delete error:', deleteError.message)
    await ctx.supabase.from('finance_installments').delete().eq('id', created.id)
    return { success: false, error: 'แปลงเป็นรายการผ่อนไม่สำเร็จ' }
  }

  return { success: true }
}

export async function updateInstallment(
  installmentId: string,
  data: Record<string, unknown>
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('finance_installments')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', installmentId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] updateInstallment error:', error.message)
    return { success: false, error: 'แก้ไขรายการผ่อนไม่สำเร็จ' }
  }
  return { success: true }
}

export async function deleteInstallment(installmentId: string): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('finance_installments')
    .delete()
    .eq('id', installmentId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] deleteInstallment error:', error.message)
    return { success: false, error: 'ลบรายการผ่อนไม่สำเร็จ' }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// ค่าใช้จ่ายประจำ (แม่แบบ)
// ---------------------------------------------------------------------------

export interface RecurringInput {
  title: string
  amount: number
  paidByMemberId?: string | null
  /** 1-31 หรือ 32 = สิ้นเดือน */
  dayOfMonth: number
  icon?: string | null
  /** YYYY-MM — เริ่มคิดตั้งแต่เดือนนี้ (ไม่ใส่ = ทุกเดือนย้อนหลังได้หมด) */
  startMonth?: string | null
}

export async function createRecurring(input: RecurringInput): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  if (!input.title?.trim()) return { success: false, error: 'กรุณาใส่ชื่อรายการ' }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { success: false, error: 'จำนวนเงินต้องเป็นตัวเลขที่ไม่ติดลบ' }
  }
  if (input.dayOfMonth < 1 || input.dayOfMonth > 32) {
    return { success: false, error: 'วันที่ต้องอยู่ระหว่าง 1-31 หรือเลือกสิ้นเดือน' }
  }

  const { error } = await ctx.supabase.from('recurring_expenses').insert({
    user_id: ctx.userId,
    title: input.title.trim(),
    amount: input.amount,
    paid_by_member_id: input.paidByMemberId || null,
    day_of_month: input.dayOfMonth,
    icon: input.icon || null,
    start_month: input.startMonth ? `${input.startMonth}-01` : null,
  })

  if (error) {
    console.error('[Finance] createRecurring error:', error.message)
    return { success: false, error: 'เพิ่มค่าใช้จ่ายประจำไม่สำเร็จ' }
  }
  return { success: true }
}

export async function updateRecurring(
  recurringId: string,
  data: Record<string, unknown>
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('recurring_expenses')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', recurringId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] updateRecurring error:', error.message)
    return { success: false, error: 'แก้ไขค่าใช้จ่ายประจำไม่สำเร็จ' }
  }
  return { success: true }
}

/**
 * ลบแม่แบบค่าใช้จ่ายประจำ
 *
 * ลบจริงออกจากตาราง = เดือนเก่าที่ย้อนดูจะไม่เห็นรายการนี้อีก
 * ถ้าอยากให้หยุดเฉพาะเดือนถัดไปแต่เดือนเก่ายังเห็น ใช้ updateRecurring
 * ตั้ง end_month แทน (คอลัมน์มีไว้สำหรับกรณีนี้)
 */
export async function deleteRecurring(recurringId: string): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('recurring_expenses')
    .delete()
    .eq('id', recurringId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Finance] deleteRecurring error:', error.message)
    return { success: false, error: 'ลบค่าใช้จ่ายประจำไม่สำเร็จ' }
  }
  return { success: true }
}
