/**
 * ถอดรหัส PDF ใบแจ้งยอดที่ธนาคารล็อกไว้ แล้วส่งต่อให้ตัวอ่านรายการ
 *
 * ธนาคารไทยหลายเจ้า (CardX, กสิกร, ไทยพาณิชย์) ส่งใบแจ้งยอดเป็น PDF
 * เข้ารหัสด้วยเลขบัตรประชาชน/วันเกิด ไฟล์พวกนี้ส่งเข้า Gemini ตรง ๆ ไม่ได้
 * ต้องปลดล็อกก่อน
 *
 * รหัสผ่านใช้ถอดในหน่วยความจำเท่านั้น ไม่ถูกบันทึกหรือส่งต่อไปที่ใด
 */

import {
  MAX_FILE_SIZE,
  SUPPORTED_MIME_TYPES,
  parseStatementFromText,
  parseStatement as parseStatementFile,
  type ParseResult,
} from '@/lib/ai/statement-parser'

export { MAX_FILE_SIZE, SUPPORTED_MIME_TYPES }
export type { ParseResult }

// ตัวตรวจอยู่ใน lib/finance/pdf-encrypted.ts เพราะ client ต้องใช้ด้วย
// (ไฟล์นี้ import โมดูล AI ฝั่ง server จึง import จาก client ไม่ได้)
export { isEncryptedPdfBytes } from '@/lib/finance/pdf-encrypted'

/** ข้อผิดพลาดที่ต้องให้ผู้ใช้ใส่รหัสผ่าน */
export class PasswordRequiredError extends Error {
  constructor(message = 'ไฟล์นี้มีรหัสผ่าน กรุณาใส่รหัส') {
    super(message)
    this.name = 'PasswordRequiredError'
  }
}

/** รหัสผ่านที่ใส่มาไม่ถูกต้อง */
export class WrongPasswordError extends Error {
  constructor(message = 'รหัสผ่านไม่ถูกต้อง') {
    super(message)
    this.name = 'WrongPasswordError'
  }
}

/**
 * ดึงข้อความทั้งหมดออกจาก PDF (ถอดรหัสด้วยถ้ามีรหัส)
 *
 * คืนข้อความล้วน ๆ เพื่อส่งต่อให้ Gemini อ่านเป็นรายการ
 * วิธีนี้ประหยัดกว่าส่งทั้งไฟล์ และเลี่ยงปัญหา Gemini อ่าน PDF เข้ารหัสไม่ได้
 */
export async function extractPdfText(
  buffer: Buffer,
  password?: string
): Promise<string> {
  const { getDocumentProxy } = await import('unpdf')

  let doc
  try {
    doc = await getDocumentProxy(new Uint8Array(buffer), {
      password: password || undefined,
    } as Parameters<typeof getDocumentProxy>[1])
  } catch (err) {
    const name = (err as { name?: string })?.name ?? ''
    const message = (err as { message?: string })?.message ?? ''

    // pdf.js แยกสองกรณี: ยังไม่ใส่รหัส กับ ใส่มาแล้วผิด
    if (name === 'PasswordException' || /password/i.test(message)) {
      if (password) throw new WrongPasswordError()
      throw new PasswordRequiredError()
    }
    throw err
  }

  let text = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const line = content.items
      .map(item => (item as { str?: string }).str ?? '')
      .join(' ')
    text += line + '\n'
  }
  return text
}

/**
 * อ่านใบแจ้งยอด รองรับทั้ง PDF (มี/ไม่มีรหัส) และรูปภาพ
 *
 * PDF → ดึงข้อความออกก่อนแล้วให้ Gemini อ่านจากข้อความ
 * รูปภาพ → ส่งรูปให้ Gemini อ่านโดยตรง (ไม่มีข้อความให้ดึง)
 */
export async function parseStatement(
  buffer: Buffer,
  mimeType: string,
  password?: string
): Promise<ParseResult> {
  if (mimeType !== 'application/pdf') {
    return parseStatementFile(buffer, mimeType)
  }

  const text = await extractPdfText(buffer, password)

  // PDF ที่เป็นภาพสแกนล้วนจะดึงข้อความไม่ได้ — ส่งไฟล์ให้ Gemini อ่านเป็นภาพแทน
  if (text.trim().length < 50) {
    return parseStatementFile(buffer, mimeType)
  }

  return parseStatementFromText(text)
}
