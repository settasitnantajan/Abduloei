'use server'

import { createClient } from '@/lib/supabase/server'
import * as homeMembers from '@/lib/db/home-members'

async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

export async function getHomeMembers() {
  const userId = await getAuthUserId()
  if (!userId) return []

  // สร้าง default member ถ้ายังไม่มี
  await homeMembers.ensureDefaultMember(userId)
  return homeMembers.getHomeMembers(userId)
}

export async function createHomeMember(data: { name: string; nickname?: string; line_user_id?: string }) {
  const userId = await getAuthUserId()
  if (!userId) return { error: 'กรุณาเข้าสู่ระบบก่อน' }

  return homeMembers.createHomeMember(userId, data)
}

export async function updateHomeMember(memberId: string, data: { name?: string; nickname?: string | null; line_user_id?: string | null }) {
  const userId = await getAuthUserId()
  if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อน' }

  return homeMembers.updateHomeMember(userId, memberId, data)
}

export async function deleteHomeMember(memberId: string) {
  const userId = await getAuthUserId()
  if (!userId) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อน' }

  return homeMembers.deleteHomeMember(userId, memberId)
}
