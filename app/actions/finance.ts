'use server'

import * as db from '@/lib/db/finance'
import type {
  CardInput,
  ExpenseInput,
  InstallmentInput,
  RecurringInput,
} from '@/lib/db/finance'

export async function getFinanceMonth(month?: string) {
  return db.getFinanceMonth(month)
}

// --- สมาชิก ---
export async function updateMemberIncome(
  memberId: string,
  monthlyIncome: number,
  period?: string
) {
  return db.updateMemberIncome(memberId, monthlyIncome, period)
}

// --- บัตรเครดิต ---
export async function createCard(input: CardInput) {
  return db.createCard(input)
}

export async function updateCard(cardId: string, data: Record<string, unknown>) {
  return db.updateCard(cardId, data)
}

export async function deleteCard(cardId: string) {
  return db.deleteCard(cardId)
}

// --- รายการใช้จ่าย ---
export async function createExpense(input: ExpenseInput) {
  return db.createExpense(input)
}

export async function updateExpense(expenseId: string, data: Record<string, unknown>) {
  return db.updateExpense(expenseId, data)
}

export async function deleteExpense(expenseId: string) {
  return db.deleteExpense(expenseId)
}

// --- ผ่อนชำระ ---
export async function createInstallment(input: InstallmentInput) {
  return db.createInstallment(input)
}

export async function updateInstallment(installmentId: string, data: Record<string, unknown>) {
  return db.updateInstallment(installmentId, data)
}

export async function deleteInstallment(installmentId: string) {
  return db.deleteInstallment(installmentId)
}

// --- ค่าใช้จ่ายประจำ (แม่แบบ) ---
export async function createRecurring(input: RecurringInput) {
  return db.createRecurring(input)
}

export async function updateRecurring(recurringId: string, data: Record<string, unknown>) {
  return db.updateRecurring(recurringId, data)
}

export async function deleteRecurring(recurringId: string) {
  return db.deleteRecurring(recurringId)
}

/** บันทึกรายการหลายรายการจากใบแจ้งยอด */
export async function createExpensesBulk(
  cardId: string,
  items: Array<{ title: string; amount: number; spentOn: string; icon?: string | null }>
) {
  return db.createExpensesBulk(cardId, items)
}

/** ตั้งว่าใครร่วมหารรายการนี้บ้าง */
export async function setShares(
  kind: db.ShareKind,
  itemId: string,
  memberIds: string[]
) {
  return db.setShares(kind, itemId, memberIds)
}

/** แปลงรายการใช้จ่ายที่มีอยู่ ให้กลายเป็นรายการผ่อน */
export async function convertExpenseToInstallment(
  expenseId: string,
  options: { startMonth: string; totalInstallments: number | null }
) {
  return db.convertExpenseToInstallment(expenseId, options)
}

/** ตรวจว่ารายการที่จะนำเข้าซ้ำกับของเดิมหรือตรงกับงวดผ่อนไหม */
export async function findDuplicates(
  cardId: string,
  candidates: db.DuplicateCandidate[]
) {
  return db.findDuplicates(cardId, candidates)
}
