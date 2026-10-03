/**
 * ชั้นที่คุย database ของฟีเจอร์ของหมดอายุ
 *
 * ยึดแพตเทิร์นเดียวกับ lib/db/finance.ts — ใช้ createClient() ฝั่ง server
 * (คุกกี้ + RLS) เรียก auth.getUser() ทุกฟังก์ชัน และกรอง user_id เองด้วยเสมอ
 * ไม่พึ่ง RLS อย่างเดียว
 */

import { createClient } from '@/lib/supabase/server'
import {
  KEEP_AFTER_EXPIRY_DAYS,
  type ExpiryCategory,
  type ExpiryItem,
} from '@/lib/types/expiry'

export interface MutationResult {
  success: boolean
  error?: string
}

const AUTH_ERROR = 'กรุณาเข้าสู่ระบบก่อนใช้งาน'

async function withUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, userId: user.id }
}

/** วันที่วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
function todayBangkok(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

/** เลื่อนวันที่ไปกี่วัน คืนรูปแบบ YYYY-MM-DD */
function shiftDays(dateStr: string, days: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + days * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

/** แปลง row จาก DB (snake_case) เป็นชนิดที่ UI ใช้ (camelCase) */
function toItem(row: Record<string, unknown>): ExpiryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as ExpiryCategory,
    purchasedOn: (row.purchased_on as string | null) ?? null,
    expiresOn: row.expires_on as string,
    remindBeforeDays: Number(row.remind_before_days) || 0,
    note: (row.note as string | null) ?? null,
  }
}

/**
 * ของทั้งหมดที่ยังไม่ถูกลบ
 *
 * ของที่หมดอายุแล้วยังอยู่ต่ออีก 30 วัน — กรองที่ query ด้วย เผื่อ cron
 * ยังไม่ได้กวาด จะได้ไม่เห็นของเก่าเกินกำหนดโผล่มา
 */
export async function getExpiryItems(): Promise<{
  data?: ExpiryItem[]
  error?: string
}> {
  const ctx = await withUser()
  if (!ctx) return { error: AUTH_ERROR }

  const cutoff = shiftDays(todayBangkok(), -KEEP_AFTER_EXPIRY_DAYS)

  const { data, error } = await ctx.supabase
    .from('expiry_items')
    .select('id, name, category, purchased_on, expires_on, remind_before_days, note')
    .eq('user_id', ctx.userId)
    .gte('expires_on', cutoff)
    .order('expires_on', { ascending: true })

  if (error) {
    console.error('[Expiry] getExpiryItems error:', error.message)
    return { error: 'โหลดรายการไม่สำเร็จ' }
  }
  return { data: (data || []).map(toItem) }
}

export interface ExpiryItemInput {
  name: string
  category: ExpiryCategory
  /** YYYY-MM-DD หรือ null */
  purchasedOn?: string | null
  /** YYYY-MM-DD */
  expiresOn: string
  remindBeforeDays?: number
  note?: string | null
}

/** ตรวจข้อมูลก่อนเขียน — คืนข้อความไทยเมื่อไม่ผ่าน */
function validate(input: ExpiryItemInput): string | null {
  if (!input.name?.trim()) return 'กรุณาใส่ชื่อของ'
  if (!input.expiresOn) return 'กรุณาระบุวันหมดอายุ'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) return 'วันหมดอายุไม่ถูกต้อง'
  if (input.purchasedOn && input.purchasedOn > input.expiresOn) {
    return 'วันที่ซื้อต้องไม่หลังวันหมดอายุ'
  }
  const remind = input.remindBeforeDays ?? 3
  if (remind < 0 || remind > 90) return 'เตือนล่วงหน้าต้องอยู่ระหว่าง 0-90 วัน'
  return null
}

export async function createExpiryItem(input: ExpiryItemInput): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const invalid = validate(input)
  if (invalid) return { success: false, error: invalid }

  const { error } = await ctx.supabase.from('expiry_items').insert({
    user_id: ctx.userId,
    name: input.name.trim(),
    category: input.category,
    purchased_on: input.purchasedOn || null,
    expires_on: input.expiresOn,
    remind_before_days: input.remindBeforeDays ?? 3,
    note: input.note?.trim() || null,
  })

  if (error) {
    console.error('[Expiry] createExpiryItem error:', error.message)
    return { success: false, error: 'เพิ่มของไม่สำเร็จ' }
  }
  return { success: true }
}

export async function updateExpiryItem(
  itemId: string,
  input: ExpiryItemInput
): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const invalid = validate(input)
  if (invalid) return { success: false, error: invalid }

  const { error } = await ctx.supabase
    .from('expiry_items')
    .update({
      name: input.name.trim(),
      category: input.category,
      purchased_on: input.purchasedOn || null,
      expires_on: input.expiresOn,
      remind_before_days: input.remindBeforeDays ?? 3,
      note: input.note?.trim() || null,
      // วันหมดอายุเปลี่ยน = ต้องเตือนใหม่ ล้างวันที่เตือนล่าสุดทิ้ง
      last_reminded_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Expiry] updateExpiryItem error:', error.message)
    return { success: false, error: 'แก้ไขไม่สำเร็จ' }
  }
  return { success: true }
}

export async function deleteExpiryItem(itemId: string): Promise<MutationResult> {
  const ctx = await withUser()
  if (!ctx) return { success: false, error: AUTH_ERROR }

  const { error } = await ctx.supabase
    .from('expiry_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', ctx.userId)

  if (error) {
    console.error('[Expiry] deleteExpiryItem error:', error.message)
    return { success: false, error: 'ลบไม่สำเร็จ' }
  }
  return { success: true }
}
