'use server'

import * as routinesDb from '@/lib/db/routines'
import { CreateRoutineInput } from '@/lib/db/routines'

export async function getUserRoutines() {
  return routinesDb.getUserRoutines()
}

export async function createRoutine(data: CreateRoutineInput) {
  return routinesDb.createRoutine(data)
}

export async function toggleRoutine(routineId: string, isActive: boolean) {
  return routinesDb.toggleRoutine(routineId, isActive)
}

export async function deleteRoutine(routineId: string) {
  return routinesDb.deleteRoutine(routineId)
}
