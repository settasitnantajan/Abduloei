'use server'

import * as db from '@/lib/db/monthly-routines'
import { CreateMonthlyRoutineInput } from '@/lib/db/monthly-routines'

export async function getUserMonthlyRoutines() {
  return db.getUserMonthlyRoutines()
}

export async function createMonthlyRoutine(data: CreateMonthlyRoutineInput) {
  return db.createMonthlyRoutine(data)
}

export async function toggleMonthlyRoutine(routineId: string, isActive: boolean) {
  return db.toggleMonthlyRoutine(routineId, isActive)
}

export async function deleteMonthlyRoutine(routineId: string) {
  return db.deleteMonthlyRoutine(routineId)
}

export async function updateMonthlyRoutine(routineId: string, data: Record<string, unknown>) {
  return db.updateMonthlyRoutine(routineId, data as any)
}
