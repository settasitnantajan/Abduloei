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

  // ถ้าข้อความยาวเกิน 50 ตัวอักษร ไม่น่าจะเป็นคำยืนยัน/ปฏิเสธ
  if (normalized.length > 50) {
    return 'none'
  }

  // ตรวจสอบคำปฏิเสธก่อน (เพราะ "ไม่ใช่" มีทั้ง "ไม่" และ "ใช่")
  // ใช้ substring match แทน word split (ภาษาไทยไม่มี space แยกคำ)
  const rejectPatterns = [
    'ไม่', 'ยกเลิก', 'cancel', 'เปลี่ยน', 'ผิด',
    'ไม่เอา', 'ไม่ใช่', 'ไม่ต้อง', 'หยุด', 'พอ',
  ]

  for (const pattern of rejectPatterns) {
    if (normalized.includes(pattern)) {
      return 'reject'
    }
  }

  // ตรวจสอบคำยืนยัน — ใช้ substring match เพื่อรองรับคำไทยติดกัน
  // เช่น "ได้ครับ", "โอเคค่ะ", "เอาเลย", "ใช่ครับ"
  const confirmPatterns = [
    'ใช่', 'ยืนยัน', 'ตกลง', 'โอเค', 'ok', 'okay', 'yes', 'confirm', 'sure',
    'เอา', 'ได้', 'จ้า', 'จ๊ะ', 'ถูกต้อง', 'แน่นอน',
    'สร้าง', 'เลย', 'ได้เลย', 'ครับ', 'ค่ะ', 'คะ',
    'ดี', 'จัดไป', 'ลุย', 'เอาเลย', 'โอเคเลย',
    'ได้ครับ', 'ได้ค่ะ', 'ใช่ครับ', 'ใช่ค่ะ',
    'เอาครับ', 'เอาค่ะ', 'จ้ะ', 'ค่ะ',
  ]

  for (const pattern of confirmPatterns) {
    if (normalized.includes(pattern)) {
      return 'confirm'
    }
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
    create_note: 'บันทึก',
    create_routine: 'กิจวัตร'
  }

  if (commandType === 'delete_all') {
    return `⚠️ ยืนยันจะลบรายการทั้งหมด (นัดหมาย, งาน, บันทึก) ไหมคะ?\n\nการลบจะย้อนกลับไม่ได้นะคะ\n\n💬 พิมพ์ "ใช่" เพื่อยืนยันลบ หรือ "ไม่" เพื่อยกเลิก`
  }

  const typeName = typeMap[commandType] || 'คำสั่ง'

  return `ยืนยันสร้าง${typeName} "${title}" นี้ไหมคะ?\n\n💬 พิมพ์ "ใช่" เพื่อยืนยัน หรือ "ไม่" เพื่อยกเลิก`
}
