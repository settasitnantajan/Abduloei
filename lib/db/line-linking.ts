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

    // เช็คว่า LINE ID นี้ผูกอยู่แล้วหรือยัง
    const { data: existingAccount } = await adminClient
      .from('user_line_accounts')
      .select('user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    if (existingAccount) {
      if (existingAccount.user_id === linkCode.user_id) {
        // ผูกกับ user เดิมอยู่แล้ว — ถือว่าสำเร็จ
        await adminClient
          .from('line_linking_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', linkCode.id)
        return { success: true }
      }
      return { success: false, error: 'LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว' }
    }

    // INSERT ลง user_line_accounts
    const { error: insertError } = await adminClient
      .from('user_line_accounts')
      .insert({
        user_id: linkCode.user_id,
        line_user_id: lineUserId,
      })

    if (insertError) {
      console.error('Error inserting user_line_accounts:', insertError)
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
 * เช็คสถานะการเชื่อม LINE ของ user — return array ของ accounts
 */
export async function getLinkingStatus(userId: string): Promise<{
  linked: boolean
  accounts: Array<{ id: string; lineUserId: string }>
}> {
  const { data } = await adminClient
    .from('user_line_accounts')
    .select('id, line_user_id')
    .eq('user_id', userId)

  const accounts = (data || []).map(row => ({
    id: row.id,
    lineUserId: row.line_user_id,
  }))

  return { linked: accounts.length > 0, accounts }
}

/**
 * ยกเลิกเชื่อม LINE account ตาม account id
 */
export async function unlinkLine(userId: string, accountId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await adminClient
    .from('user_line_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: 'ไม่สามารถยกเลิกเชื่อมได้' }
  }
  return { success: true }
}

/**
 * เช็คว่า linking code ถูกใช้แล้วหรือยัง
 */
export async function checkCodeUsed(code: string): Promise<boolean> {
  const { data } = await adminClient
    .from('line_linking_codes')
    .select('used_at')
    .eq('code', code)
    .maybeSingle()

  return !!data?.used_at
}

/**
 * นับจำนวน user ที่ผูก LINE แล้ว (distinct)
 */
export async function getLinkedUsersCount(): Promise<number> {
  const { data } = await adminClient
    .from('user_line_accounts')
    .select('user_id')

  const uniqueUsers = new Set((data || []).map(row => row.user_id))
  return uniqueUsers.size
}

/**
 * ดึง user ทุกคนที่ผูก LINE (สำหรับ cron — ส่งทุก LINE ID)
 */
export async function getAllLinkedUsers(): Promise<Array<{ user_id: string; line_user_id: string }>> {
  const { data } = await adminClient
    .from('user_line_accounts')
    .select('user_id, line_user_id')

  return (data || []) as Array<{ user_id: string; line_user_id: string }>
}
