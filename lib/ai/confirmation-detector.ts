/**
 * Confirmation Detector
 * ตรวจจับคำยืนยันหรือปฏิเสธจากผู้ใช้
 */

export type ConfirmationType = 'confirm' | 'reject' | 'none'

/**
 * ตรวจจับว่า User ยืนยันหรือปฏิเสธคำสั่ง
 */
export function detectConfirmation(text: string): ConfirmationType {
  const normalized = text.toLowerCase().trim()

  // ถ้าข้อความยาวเกิน 30 ตัวอักษร ไม่น่าจะเป็นคำยืนยัน/ปฏิเสธ
  if (normalized.length > 30) {
    return 'none'
  }

  // แยกคำในข้อความ
  const words = normalized.split(/\s+/)

  // คำที่บ่งบอกว่าเป็นการยืนยัน
  const confirmWords = [
    'ใช่', 'ครับ', 'ค่ะ', 'คะ', 'ยืนยัน', 'ok', 'okay', 'ตกลง',
    'เอา', 'ได้', 'โอเค', 'จ้า', 'จ๊ะ', 'ถูกต้อง', 'แน่นอน',
    'yes', 'confirm', 'sure', 'สร้าง', 'เลย', 'ได้เลย'
  ]

  // คำที่บ่งบอกว่าเป็นการปฏิเสธ
  const rejectWords = [
    'ไม่', 'ยกเลิก', 'cancel', 'no', 'ผิด', 'เปลี่ยน'
  ]

  // ตรวจสอบคำปฏิเสธก่อน (เพราะ "ไม่ใช่" มีทั้ง "ไม่" และ "ใช่")
  const hasReject = words.some(w => rejectWords.includes(w))
  if (hasReject) {
    return 'reject'
  }

  // ตรวจสอบคำยืนยัน — ถ้ามีคำยืนยันอย่างน้อย 1 คำ
  const hasConfirm = words.some(w => confirmWords.includes(w))
  if (hasConfirm) {
    return 'confirm'
  }

  return 'none'
}

/**
 * สร้างข้อความขอยืนยัน
 */
export function generateConfirmationPrompt(commandType: string, title: string): string {
  const typeMap: Record<string, string> = {
    create_event: 'นัดหมาย',
    create_task: 'งาน',
    create_note: 'บันทึก'
  }

  if (commandType === 'delete_all') {
    return `⚠️ ยืนยันจะลบรายการทั้งหมด (นัดหมาย, งาน, บันทึก) ไหมคะ?\n\nการลบจะย้อนกลับไม่ได้นะคะ\n\n💬 พิมพ์ "ใช่" เพื่อยืนยันลบ หรือ "ไม่" เพื่อยกเลิก`
  }

  const typeName = typeMap[commandType] || 'คำสั่ง'

  return `ยืนยันสร้าง${typeName} "${title}" นี้ไหมคะ?\n\n💬 พิมพ์ "ใช่" เพื่อยืนยัน หรือ "ไม่" เพื่อยกเลิก`
}
