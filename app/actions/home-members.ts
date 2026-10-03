'use server'

import { createClient } from '@/lib/supabase/server'
import * as db from '@/lib/db/home-members'

/**
 * รายชื่อสมาชิกในบ้านของผู้ใช้ปัจจุบัน
 *
 * lib/db/home-members.ts ใช้ adminClient และรับ userId เป็นพารามิเตอร์
 * (ต่างจาก lib/db/finance.ts ที่อ่าน user จากคุกกี้เอง) จึงต้องหา user id ที่นี่ก่อนส่งต่อ
 */
export async function getMyHomeMembers() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { members: [], error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }

  const members = await db.getHomeMembers(user.id)
  return { members }
}
