import { adminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * สร้าง linking code 6 หลักสำหรับผูก LINE
 */
export async function generateLinkingCode(userId: string): Promise<{ code?: string; error?: string }> {
  try {
    // ลบ code เก่าที่ยังไม่ใช้ของ user นี้
    await adminClient
      .from('line_linking_codes')
      .delete()
      .eq('user_id', userId)
      .is('used_at', null)

    // สร้าง code 6 หลัก
    const code = String(crypto.randomInt(100000, 999999))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 นาที

    const { error } = await adminClient
      .from('line_linking_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: expiresAt,
      })

    if (error) {
      console.error('Error creating linking code:', error)
      // ถ้า code ซ้ำ ลองใหม่
      if (error.code === '23505') {
        const retryCode = String(crypto.randomInt(100000, 999999))
        const { error: retryError } = await adminClient
          .from('line_linking_codes')
          .insert({
            user_id: userId,
            code: retryCode,
            expires_at: expiresAt,
          })
        if (retryError) return { error: 'ไม่สามารถสร้างรหัสได้' }
        return { code: retryCode }
      }
      return { error: 'ไม่สามารถสร้างรหัสได้' }
    }

    return { code }
  } catch (err) {
    console.error('Unexpected error in generateLinkingCode:', err)
    return { error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * ตรวจสอบ code แล้วผูก LINE User ID กับ Supabase User
 * ใช้จาก webhook (adminClient)
 */
export async function verifyAndLinkCode(
  lineUserId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // เช็คว่า LINE ID นี้ผูกกับ user อื่นอยู่แล้วไหม
    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    if (existingProfile) {
      return { success: false, error: 'LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว' }
    }

    // หา code ที่ยังไม่หมดอายุและยังไม่ใช้
    const { data: linkCode, error: codeError } = await adminClient
      .from('line_linking_codes')
      .select('*')
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (codeError || !linkCode) {
      return { success: false, error: 'รหัสไม่ถูกต้องหรือหมดอายุ' }
    }

    // Upsert user_profiles ด้วย line_user_id
    const { error: upsertError } = await adminClient
      .from('user_profiles')
      .upsert(
        {
          user_id: linkCode.user_id,
          line_user_id: lineUserId,
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Error upserting user_profiles:', upsertError)
      return { success: false, error: 'ไม่สามารถเชื่อมบัญชีได้' }
    }

    // Mark code as used
    await adminClient
      .from('line_linking_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', linkCode.id)

    return { success: true }
  } catch (err) {
    console.error('Unexpected error in verifyAndLinkCode:', err)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * เช็คสถานะการเชื่อม LINE ของ user
 */
export async function getLinkingStatus(userId: string): Promise<{ linked: boolean; lineUserId?: string }> {
  const { data } = await adminClient
    .from('user_profiles')
    .select('line_user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (data?.line_user_id) {
    return { linked: true, lineUserId: data.line_user_id }
  }
  return { linked: false }
}

/**
 * ยกเลิกเชื่อม LINE
 */
export async function unlinkLine(userId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await adminClient
    .from('user_profiles')
    .update({ line_user_id: null })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: 'ไม่สามารถยกเลิกเชื่อมได้' }
  }
  return { success: true }
}

/**
 * ดึง user ทุกคนที่ผูก LINE (สำหรับ cron)
 */
export async function getAllLinkedUsers(): Promise<Array<{ user_id: string; line_user_id: string }>> {
  const { data } = await adminClient
    .from('user_profiles')
    .select('user_id, line_user_id')
    .not('line_user_id', 'is', null)

  return (data || []).filter(u => u.line_user_id) as Array<{ user_id: string; line_user_id: string }>
}
