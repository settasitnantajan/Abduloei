/**
 * ชนิดข้อมูลของฟีเจอร์การเงิน
 *
 * ฝั่ง DB ใช้ snake_case (ดู supabase/migrations/20261003000000_create_finance.sql)
 * ชนิดในไฟล์นี้เป็น camelCase สำหรับใช้ใน UI — lib/db/finance.ts เป็นตัวแปลงให้
 *
 * เรื่องปี: ทุกวันที่ในชนิดเหล่านี้เป็น ค.ศ. เสมอ (ตรงกับที่เก็บใน DB)
 * แปลงเป็น พ.ศ. ตอนแสดงผลเท่านั้น (ดู toBuddhistYear ใน lib/finance/calc.ts)
 */

/** ช่องทางที่จ่าย — เงินสดไม่มีวันครบชำระ ต่างจากบัตร */
export type PaymentChannel = 'credit_card' | 'cash'

/**
 * กลุ่มรายจ่ายที่แสดงบนหน้า
 * ผ่อนไม่ใช่กลุ่มแยก — ผูกกับบัตรเสมอ จึงนับรวมอยู่ใน credit_card
 */
export type ExpenseGroup = 'credit_card' | 'cash' | 'recurring'

/** คนในบ้าน — มาจากตาราง home_members ที่มีอยู่แล้ว (ผูก LINE ID ไว้แล้ว) */
export interface FinanceMember {
  id: string
  name: string
  /** รายรับต่อเดือน — คอลัมน์ monthly_income ใน home_members */
  monthlyIncome: number
}

/** บัตรเครดิต 1 ใบ */
export interface CreditCard {
  id: string
  name: string
  /** เลข 4 ตัวท้าย ไม่ใส่ก็ได้ */
  last4: string | null
  /** เจ้าของบัตร — คนละเรื่องกับคนที่รูด */
  ownerId: string | null
  /** ครบชำระทุกวันที่เท่าไรของเดือน (32 = สิ้นเดือน) */
  dueDayOfMonth: number
  /** เตือนล่วงหน้ากี่วัน */
  remindBeforeDays: number
  /** วันแรกของรอบบิลปัจจุบัน YYYY-MM-DD */
  cycleFrom: string
  /** วันครบชำระของรอบนี้ YYYY-MM-DD */
  cycleTo: string
  /** เหลืออีกกี่วันถึงวันครบชำระ */
  daysUntilDue: number
}

/** รายการใช้จ่าย 1 รายการ (บัตร / เงินสด / ประจำ) */
export interface ExpenseItem {
  id: string
  title: string
  amount: number
  /** คนที่รูด/จ่ายออกไปก่อน — คนละเรื่องกับผู้ร่วมหาร */
  paidById: string | null
  /**
   * คนที่ร่วมหารยอดนี้ — ว่าง = ยังไม่ระบุ
   * ยอดต่อคนคำนวณสดจาก amount / sharedBy.length ไม่ได้เก็บไว้
   */
  sharedBy: string[]
  group: ExpenseGroup
  /** บัตรที่รูด (เฉพาะ group = credit_card) */
  cardId?: string | null
  /** วันที่ใช้จ่าย รูปแบบ YYYY-MM-DD (ค.ศ.) */
  date?: string | null
  /** วันที่ของเดือนที่ต้องจ่าย (เฉพาะ group = recurring) */
  dayOfMonth?: number | null
  /** ไอคอนประกอบรายการ */
  icon?: string | null
  /**
   * true = คลี่มาจากแม่แบบ recurring_expenses ไม่ใช่ row จริงใน finance_expenses
   * ใช้ตัดสินว่าจะแก้/ลบที่แม่แบบหรือที่รายการ
   */
  fromTemplate?: boolean
}

/** รายการผ่อนชำระ */
export interface Installment {
  id: string
  title: string
  /** ยอดต่อเดือน */
  monthlyAmount: number
  /** คนที่รูด/เป็นเจ้าของสัญญาผ่อน */
  ownerId: string | null
  /** คนที่ร่วมหารงวดนี้ — ว่าง = ยังไม่ระบุ */
  sharedBy: string[]
  /** บัตรที่ผ่อนผ่าน — ผ่อนต้องผูกบัตรเสมอ แสดงอยู่ในบัตรใบนั้น */
  cardId: string
  /** เดือนที่เริ่มผ่อน รูปแบบ YYYY-MM-DD (วันที่ 1 ของเดือน, ค.ศ.) */
  startMonth: string
  /** งวดทั้งหมด — null = จ่ายครั้งเดียว ไม่มีงวด */
  totalInstallments: number | null
  /** ไอคอนประกอบรายการ */
  icon?: string | null
}

/** ข้อมูลทั้งหมดของหนึ่งเดือน */
export interface FinanceMonth {
  /** เดือนที่กำลังดู รูปแบบ YYYY-MM (ค.ศ.) */
  month: string
  members: FinanceMember[]
  cards: CreditCard[]
  expenses: ExpenseItem[]
  installments: Installment[]
}

/** ยอดสรุปของคนหนึ่งคน — คำนวณจากรายการทั้งหมด ไม่ได้เก็บใน DB */
export interface MemberSummary {
  member: FinanceMember
  income: number
  totalExpense: number
  remaining: number
  /** ใช้ไปแล้วกี่เปอร์เซ็นต์ของรายรับ */
  usedPercent: number
  /** แยกยอดตามกลุ่ม */
  byGroup: Record<ExpenseGroup, number>
}

/** สถานะงวดผ่อนของเดือนที่กำลังดู — คำนวณสดจาก startMonth ไม่ได้เก็บใน DB */
export interface InstallmentProgress {
  /** เดือนนี้คืองวดที่เท่าไร (1-based) — null เมื่อไม่มีงวด */
  currentInstallment: number | null
  /** จ่ายไปแล้วกี่งวดก่อนเดือนนี้ */
  paidInstallments: number
  /** เหลืออีกกี่งวดหลังเดือนนี้ */
  remainingInstallments: number | null
  /** คืบหน้ากี่เปอร์เซ็นต์ */
  percent: number
  /** จ่ายครั้งเดียว ไม่มีงวด */
  isOneTime: boolean
}
