/**
 * การคำนวณทั้งหมดของฟีเจอร์การเงิน
 *
 * แยกจากชั้นที่คุย database (lib/db/finance.ts) โดยเจตนา — ฟังก์ชันในไฟล์นี้
 * เป็น pure function รับ FinanceMonth เข้าไปคำนวณ ไม่แตะ I/O จึงทดสอบง่าย
 *
 * ย้ายมาจาก lib/mock/finance.ts (ตอนที่หน้านี้ยังใช้ข้อมูลตัวอย่าง)
 * ของที่เปลี่ยนคือสูตรนับงวดผ่อน ซึ่งเดิมอ่านเลขนิ่งจากข้อมูล ตอนนี้คำนวณสดจากเดือนที่เริ่ม
 */

import type {
  ExpenseGroup,
  FinanceMonth,
  Installment,
  InstallmentProgress,
  MemberSummary,
} from '@/lib/types/finance'

/** คนที่ยังไม่ได้ระบุเจ้าของ — เก็บยอดรวมไว้ไม่ให้หายไปจากผลรวม */
const UNASSIGNED = '__unassigned__'


/**
 * หารยอดเท่ากันตามจำนวนคนที่ร่วม
 *
 * ปัดเป็นสตางค์ แล้วโยนเศษที่เหลือให้คนแรก เพื่อให้ผลรวมย้อนกลับมาเท่ายอดเดิมพอดี
 * เช่น 100 หาร 3 → 33.34 + 33.33 + 33.33 = 100 (ไม่ใช่ 99.99)
 *
 * @returns ยอดของแต่ละคน เรียงตรงกับ memberIds ที่ส่งเข้ามา
 */
export function splitAmount(amount: number, memberIds: string[]): number[] {
  const count = memberIds.length
  if (count === 0) return []
  if (count === 1) return [amount]

  // ทำงานด้วยหน่วยสตางค์เพื่อเลี่ยงปัญหาทศนิยมลอยตัว
  const totalSatang = Math.round(amount * 100)
  const base = Math.floor(totalSatang / count)
  const remainder = totalSatang - base * count

  return memberIds.map((_, index) => (base + (index < remainder ? 1 : 0)) / 100)
}

/**
 * ยอดที่แต่ละคนรับผิดชอบจากรายการหนึ่ง
 *
 * ไม่มีใครร่วมหาร = ยอดทั้งก้อนไปอยู่ช่อง "ไม่ระบุ" ไม่หายจากผลรวม
 */
function shareToMembers(
  amount: number,
  sharedBy: string[],
  into: Record<string, number>
): void {
  if (sharedBy.length === 0) {
    into[UNASSIGNED] = (into[UNASSIGNED] || 0) + amount
    return
  }
  const parts = splitAmount(amount, sharedBy)
  sharedBy.forEach((memberId, index) => {
    into[memberId] = (into[memberId] || 0) + parts[index]
  })
}

// ---------------------------------------------------------------------------
// เดือนและปี
// ---------------------------------------------------------------------------

/** เดือนปัจจุบันตามเวลาไทย รูปแบบ YYYY-MM (ค.ศ.) */
export function currentMonth(nowMs: number = Date.now()): string {
  // en-CA ให้รูปแบบ YYYY-MM-DD ตรงกับที่ Postgres ใช้
  const bangkokDate = new Date(nowMs).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Bangkok',
  })
  return bangkokDate.slice(0, 7)
}

/** แปลง YYYY-MM เป็นตัวเลขปีและเดือน (เดือนเริ่มที่ 1) */
function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number)
  return { year: y, month: m }
}

/** เลื่อนเดือนไปข้างหน้า/ถอยหลัง คืนค่ารูปแบบ YYYY-MM */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: m } = parseMonth(month)
  // ใช้ Date.UTC จัดการการข้ามปีให้ แทนการคิดเลขเอง
  const d = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** จำนวนเดือนจาก a ไป b (ติดลบได้ ถ้า b มาก่อน a) */
export function monthsBetween(a: string, b: string): number {
  const from = parseMonth(a)
  const to = parseMonth(b)
  return (to.year - from.year) * 12 + (to.month - from.month)
}

/** วันสุดท้ายของเดือนนั้น */
export function lastDayOfMonth(month: string): number {
  const { year, month: m } = parseMonth(month)
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
  return new Date(Date.UTC(year, m, 0)).getUTCDate()
}

/**
 * แปลงวันที่ของเดือน (1-32) เป็นวันที่จริงของเดือนที่ระบุ
 * 32 = สิ้นเดือน ตาม convention เดิมของ monthly_routines
 * วันที่เกินจำนวนวันในเดือนนั้นจะถูกหุบลงเป็นวันสุดท้าย (เช่น 31 ในเดือน ก.พ.)
 */
export function resolveDayOfMonth(month: string, dayOfMonth: number): number {
  const last = lastDayOfMonth(month)
  if (dayOfMonth >= 32) return last
  return Math.min(dayOfMonth, last)
}

/** แปลงปี ค.ศ. เป็น พ.ศ. — ใช้ตอนแสดงผลเท่านั้น ข้อมูลใน DB เป็น ค.ศ. เสมอ */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

/** ป้ายชื่อเดือนภาษาไทยพร้อมปี พ.ศ. เช่น "ตุลาคม 2569" */
export function formatMonthLabel(month: string): string {
  const { year, month: m } = parseMonth(month)
  return `${THAI_MONTHS_FULL[m - 1]} ${toBuddhistYear(year)}`
}

// ---------------------------------------------------------------------------
// งวดผ่อน — คำนวณสดจากเดือนที่เริ่ม ไม่เก็บตัวเลขไว้ใน DB
// ---------------------------------------------------------------------------

/**
 * สถานะงวดผ่อนของเดือนที่กำลังดู
 *
 * เหตุที่คำนวณแทนการเก็บ: ถ้าเก็บ "จ่ายไปแล้วกี่งวด" เป็นตัวเลขใน DB
 * จะต้องมี job ไปบวกทุกเดือน พลาดรอบเดียวคือเพี้ยนถาวร และย้อนดูเดือนเก่า
 * จะเห็นเลขของเดือนปัจจุบันไม่ใช่เลขตอนนั้น การคำนวณสดเลยถูกเสมอโดยไม่ต้องมี job
 */
export function installmentProgress(
  inst: Installment,
  viewMonth: string
): InstallmentProgress {
  const isOneTime = inst.totalInstallments === null

  if (isOneTime) {
    return {
      currentInstallment: null,
      paidInstallments: 0,
      remainingInstallments: null,
      percent: 0,
      isOneTime: true,
    }
  }

  const total = inst.totalInstallments as number
  const elapsed = monthsBetween(inst.startMonth.slice(0, 7), viewMonth)
  // หุบให้อยู่ในช่วง 0..total-1 เพื่อไม่ให้เลขทะลุกรอบ
  // (เดือนที่อยู่นอกช่วงผ่อนถูกกรองออกไปก่อนแล้วด้วย isInstallmentActiveIn)
  const clamped = Math.min(Math.max(elapsed, 0), total - 1)
  const current = clamped + 1

  return {
    currentInstallment: current,
    paidInstallments: clamped,
    remainingInstallments: total - current,
    percent: Math.round((clamped / total) * 100),
    isOneTime: false,
  }
}

/**
 * ผ่อนรายการนี้ยังอยู่ในเดือนที่ดูไหม
 * เดือนก่อนเริ่มผ่อน = ยังไม่โผล่, ครบงวดแล้ว = หายไปเอง
 */
export function isInstallmentActiveIn(inst: Installment, viewMonth: string): boolean {
  const elapsed = monthsBetween(inst.startMonth.slice(0, 7), viewMonth)
  if (elapsed < 0) return false
  if (inst.totalInstallments === null) return true
  return elapsed < inst.totalInstallments
}

// ---------------------------------------------------------------------------
// ยอดรวม — ย้ายมาจาก lib/mock/finance.ts ตามเดิม
// ---------------------------------------------------------------------------

/** รายการใช้จ่ายของบัตรใบหนึ่ง (ไม่รวมผ่อน) */
export function cardExpenses(data: FinanceMonth, cardId: string) {
  return data.expenses.filter(e => e.group === 'credit_card' && e.cardId === cardId)
}

/** รายการผ่อนที่ผูกกับบัตรใบหนึ่ง */
export function cardInstallments(data: FinanceMonth, cardId: string) {
  return data.installments.filter(i => i.cardId === cardId)
}

/** ยอดรวมของบัตรหนึ่งใบ — รวมทั้งรายการใช้จ่ายและงวดผ่อนของเดือนนี้ */
export function cardTotal(data: FinanceMonth, cardId: string): number {
  const spend = cardExpenses(data, cardId).reduce((sum, e) => sum + e.amount, 0)
  const inst = cardInstallments(data, cardId).reduce((sum, i) => sum + i.monthlyAmount, 0)
  return spend + inst
}

/** ยอดของบัตรหนึ่งใบ แยกตามคนที่รับผิดชอบ (รวมผ่อน) */
export function cardTotalByMember(data: FinanceMonth, cardId: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const m of data.members) result[m.id] = 0

  for (const e of cardExpenses(data, cardId)) {
    shareToMembers(e.amount, e.sharedBy, result)
  }
  for (const i of cardInstallments(data, cardId)) {
    shareToMembers(i.monthlyAmount, i.sharedBy, result)
  }
  return result
}

/** ยอดรวมของกลุ่มหนึ่ง — กลุ่มบัตรรวมงวดผ่อนด้วย */
export function groupTotal(data: FinanceMonth, group: ExpenseGroup): number {
  const spend = data.expenses
    .filter(e => e.group === group)
    .reduce((sum, e) => sum + e.amount, 0)

  if (group === 'credit_card') {
    return spend + data.installments.reduce((sum, i) => sum + i.monthlyAmount, 0)
  }
  return spend
}

/** ยอดของกลุ่มหนึ่ง แยกตามคน */
export function groupTotalByMember(data: FinanceMonth, group: ExpenseGroup): Record<string, number> {
  const result: Record<string, number> = {}
  for (const m of data.members) result[m.id] = 0

  for (const e of data.expenses) {
    if (e.group === group) {
      shareToMembers(e.amount, e.sharedBy, result)
    }
  }

  if (group === 'credit_card') {
    for (const i of data.installments) {
      shareToMembers(i.monthlyAmount, i.sharedBy, result)
    }
  }
  return result
}

/**
 * สรุปยอดรายคน — รายรับหักรายจ่ายทุกช่องทาง
 *
 * รายจ่ายบัตรคิดตาม "คนที่รูด" ไม่ใช่เจ้าของบัตร
 * เช่น ดยุคถือบัตร KTC แต่แฟนรูดไป 4,800 → ยอดนั้นไปอยู่ที่การ์ดของแฟน
 */
export function summarizeMembers(data: FinanceMonth): MemberSummary[] {
  const groups: ExpenseGroup[] = ['credit_card', 'cash', 'recurring']
  const perGroup = Object.fromEntries(
    groups.map(g => [g, groupTotalByMember(data, g)])
  ) as Record<ExpenseGroup, Record<string, number>>

  return data.members.map(member => {
    const byGroup = Object.fromEntries(
      groups.map(g => [g, perGroup[g][member.id] || 0])
    ) as Record<ExpenseGroup, number>

    const totalExpense = groups.reduce((sum, g) => sum + byGroup[g], 0)
    const income = member.monthlyIncome

    return {
      member,
      income,
      totalExpense,
      remaining: income - totalExpense,
      // ไม่มีรายรับแต่มีรายจ่าย = ใช้เกิน 100%
      usedPercent: income > 0 ? Math.round((totalExpense / income) * 100) : (totalExpense > 0 ? 100 : 0),
      byGroup,
    }
  })
}

/** รายจ่ายทั้งหมดรวมทุกคนทุกช่องทาง */
export function grandTotal(data: FinanceMonth): number {
  const groups: ExpenseGroup[] = ['credit_card', 'cash', 'recurring']
  return groups.reduce((sum, g) => sum + groupTotal(data, g), 0)
}

// ---------------------------------------------------------------------------
// วันครบชำระบัตร
// ---------------------------------------------------------------------------

/**
 * เหลืออีกกี่วันถึงวันครบชำระรอบถัดไป (นับตามเวลาไทย)
 * คืน 0 เมื่อครบชำระวันนี้
 */
export function daysUntilDue(dueDayOfMonth: number, nowMs: number = Date.now()): number {
  const todayStr = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const [y, m, d] = todayStr.split('-').map(Number)
  const thisMonth = `${y}-${String(m).padStart(2, '0')}`

  const dueThis = resolveDayOfMonth(thisMonth, dueDayOfMonth)
  if (dueThis >= d) {
    return dueThis - d
  }

  // เลยกำหนดของเดือนนี้ไปแล้ว → นับไปรอบเดือนหน้า
  const next = shiftMonth(thisMonth, 1)
  const dueNext = resolveDayOfMonth(next, dueDayOfMonth)
  const daysThisMonth = lastDayOfMonth(thisMonth)
  return daysThisMonth - d + dueNext
}

// ---------------------------------------------------------------------------
// รอบบิลของบัตรเครดิต
// ---------------------------------------------------------------------------

/** ช่วงเวลาของรอบบิลหนึ่งรอบ */
export interface BillingCycle {
  /** วันแรกของรอบ YYYY-MM-DD */
  from: string
  /** วันสุดท้ายของรอบ (= วันครบชำระ) YYYY-MM-DD */
  to: string
  /** เหลืออีกกี่วันถึงวันครบชำระ (ติดลบ = เลยมาแล้ว) */
  daysLeft: number
}

/** จัดรูปแบบ YYYY-MM-DD จากส่วนประกอบ */
function ymd(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day))
  return d.toISOString().slice(0, 10)
}

/**
 * รอบบิลปัจจุบันของบัตรใบหนึ่ง — รอบที่ยังไม่ถึงกำหนดชำระ
 *
 * บัตรเรียกเก็บเป็นรอบ ไม่ใช่ตามเดือนปฏิทิน เช่นบัตรครบชำระวันที่ 6
 * รอบปัจจุบันคือ 7 เดือนก่อน ถึง 6 เดือนนี้ — รายการที่รูดคาบสองเดือน
 * จึงอยู่ในบิลใบเดียวกัน ซึ่งคือยอดที่ต้องเตรียมเงินจ่ายจริง
 *
 * @param dueDayOfMonth วันครบชำระ (1-31, หรือ 32 = สิ้นเดือน)
 */
export function currentBillingCycle(
  dueDayOfMonth: number,
  nowMs: number = Date.now()
): BillingCycle {
  const todayStr = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const [year, month, today] = todayStr.split('-').map(Number)
  const monthIndex = month - 1

  const dueThisMonth = resolveDayOfMonth(`${year}-${String(month).padStart(2, '0')}`, dueDayOfMonth)

  // ยังไม่ถึงกำหนดของเดือนนี้ → รอบนี้จบเดือนนี้
  // เลยกำหนดแล้ว → รอบปัจจุบันจบเดือนหน้า
  const endsThisMonth = today <= dueThisMonth
  const endMonthIndex = endsThisMonth ? monthIndex : monthIndex + 1
  const endMonthKey = new Date(Date.UTC(year, endMonthIndex, 1)).toISOString().slice(0, 7)
  const endDay = resolveDayOfMonth(endMonthKey, dueDayOfMonth)

  const to = ymd(year, endMonthIndex, endDay)
  // รอบเริ่มวันถัดจากวันครบชำระของรอบก่อนหน้า
  const prevMonthKey = new Date(Date.UTC(year, endMonthIndex - 1, 1)).toISOString().slice(0, 7)
  const prevDay = resolveDayOfMonth(prevMonthKey, dueDayOfMonth)
  const from = ymd(year, endMonthIndex - 1, prevDay + 1)

  // นับวันที่เหลือจากวันที่จริง เลี่ยงปัญหาเดือนสั้นยาวไม่เท่ากัน
  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / msPerDay
  )

  return { from, to, daysLeft }
}

/** ป้ายช่วงรอบแบบสั้น เช่น "7 ก.ย. – 6 ต.ค." */
export function formatCycleRange(cycle: BillingCycle): string {
  const short = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number)
    return `${d} ${THAI_MONTHS_SHORT[m - 1]}`
  }
  return `${short(cycle.from)} – ${short(cycle.to)}`
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]
