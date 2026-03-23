'use server'

import * as tasksDb from '@/lib/db/tasks'
import { UpdateTaskInput } from '@/lib/types/tasks'

export async function getUserTasks() {
  return tasksDb.getUserTasks()
}

export async function updateTask(taskId: string, data: UpdateTaskInput) {
  return tasksDb.updateTask(taskId, data)
}

export async function deleteTask(taskId: string) {
  return tasksDb.deleteTask(taskId)
}
