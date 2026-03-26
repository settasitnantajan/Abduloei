'use server'

import { createClient } from '@/lib/supabase/server'
import * as lineLinking from '@/lib/db/line-linking'

export async function generateLinkingCode() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'กรุณาเข้าสู่ระบบก่อน' }

  return lineLinking.generateLinkingCode(user.id)
}

export async function getLinkingStatus() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { linked: false }

  return lineLinking.getLinkingStatus(user.id)
}

export async function unlinkLine() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false, error: 'กรุณาเข้าสู่ระบบก่อน' }

  return lineLinking.unlinkLine(user.id)
}
