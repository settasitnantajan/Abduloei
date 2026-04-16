import { adminClient } from '@/lib/supabase/admin'

export interface HomeMember {
  id: string
  user_id: string
  name: string
  nickname: string | null
  line_user_id: string | null
  profile_image_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export async function getHomeMembers(userId: string): Promise<HomeMember[]> {
  const { data, error } = await adminClient
    .from('home_members')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[HomeMembers] getHomeMembers error:', error)
    return []
  }
  return data as HomeMember[]
}

export async function createHomeMember(
  userId: string,
  data: { name: string; nickname?: string; line_user_id?: string }
): Promise<{ member?: HomeMember; error?: string }> {
  const { data: member, error } = await adminClient
    .from('home_members')
    .insert({
      user_id: userId,
      name: data.name,
      nickname: data.nickname || null,
      line_user_id: data.line_user_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[HomeMembers] createHomeMember error:', error)
    return { error: 'ไม่สามารถเพิ่มสมาชิกได้' }
  }
  return { member: member as HomeMember }
}

export async function updateHomeMember(
  userId: string,
  memberId: string,
  data: { name?: string; nickname?: string | null; line_user_id?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await adminClient
    .from('home_members')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('user_id', userId)

  if (error) {
    console.error('[HomeMembers] updateHomeMember error:', error)
    return { success: false, error: 'ไม่สามารถแก้ไขได้' }
  }
  return { success: true }
}

export async function deleteHomeMember(
  userId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  // ห้ามลบ default member
  const { data: member } = await adminClient
    .from('home_members')
    .select('is_default')
    .eq('id', memberId)
    .eq('user_id', userId)
    .single()

  if (member?.is_default) {
    return { success: false, error: 'ไม่สามารถลบเจ้าของบัญชีได้' }
  }

  const { error } = await adminClient
    .from('home_members')
    .delete()
    .eq('id', memberId)
    .eq('user_id', userId)

  if (error) {
    console.error('[HomeMembers] deleteHomeMember error:', error)
    return { success: false, error: 'ไม่สามารถลบได้' }
  }
  return { success: true }
}

export async function ensureDefaultMember(userId: string): Promise<HomeMember | null> {
  // เช็คว่ามี default member แล้วหรือยัง
  const { data: existing } = await adminClient
    .from('home_members')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (existing) return existing as HomeMember

  // สร้าง default member (เจ้าของบัญชี)
  // ลองดึง LINE ID จาก user_line_accounts
  const { data: lineAccount } = await adminClient
    .from('user_line_accounts')
    .select('line_user_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const { data: member, error } = await adminClient
    .from('home_members')
    .insert({
      user_id: userId,
      name: 'ฉัน',
      is_default: true,
      line_user_id: lineAccount?.line_user_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[HomeMembers] ensureDefaultMember error:', error)
    return null
  }
  return member as HomeMember
}

/**
 * หาสมาชิกจากชื่อ/ชื่อเล่น (fuzzy match สำหรับ AI)
 */
export async function findMemberByName(
  userId: string,
  name: string
): Promise<HomeMember | null> {
  const { data: members } = await adminClient
    .from('home_members')
    .select('*')
    .eq('user_id', userId)

  if (!members || members.length === 0) return null

  const normalized = name.trim().toLowerCase()

  // exact match ก่อน
  for (const m of members) {
    if (m.name.toLowerCase() === normalized) return m as HomeMember
    if (m.nickname && m.nickname.toLowerCase() === normalized) return m as HomeMember
  }

  // substring match
  for (const m of members) {
    if (m.name.toLowerCase().includes(normalized) || normalized.includes(m.name.toLowerCase())) return m as HomeMember
    if (m.nickname && (m.nickname.toLowerCase().includes(normalized) || normalized.includes(m.nickname.toLowerCase()))) return m as HomeMember
  }

  return null
}

/**
 * ดึง LINE ID ของสมาชิกจาก member ID
 */
export async function getMemberLineId(memberId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('home_members')
    .select('line_user_id')
    .eq('id', memberId)
    .maybeSingle()

  return data?.line_user_id || null
}
