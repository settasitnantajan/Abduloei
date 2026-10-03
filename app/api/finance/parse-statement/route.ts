import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ParsedExpense } from '@/lib/ai/statement-parser'
import {
  MAX_FILE_SIZE,
  SUPPORTED_MIME_TYPES,
  PasswordRequiredError,
  WrongPasswordError,
  parseStatement,
} from '@/lib/finance/statement-decrypt'

/** อ่านไฟล์เข้า memory ล้วน ๆ ไม่เขียนลงดิสก์ จึงไม่ต้องใช้ edge/static cache */
export const dynamic = 'force-dynamic'
/** ไฟล์ใหญ่ + Gemini อ่าน PDF หลายหน้าใช้เวลา */
export const maxDuration = 60

/** จำนวนไฟล์สูงสุดต่อครั้ง — กันอัปโหลดทีละมาก ๆ จนรอนาน */
const MAX_FILES = 10

interface FileResult {
  fileName: string
  /** บัตรที่ผู้ใช้เลือกไว้ให้ไฟล์นี้ (อาจเปลี่ยนทีหลังในหน้าตรวจ) */
  cardId: string | null
  expenses: ParsedExpense[]
  warning?: string
  error?: string
  /** ไฟล์นี้ล็อกรหัสไว้ ผู้ใช้ต้องใส่รหัสแล้วลองใหม่ */
  needPassword?: boolean
}

/**
 * อ่านใบแจ้งยอดบัตรเครดิตหลายไฟล์พร้อมกัน
 *
 * รับ FormData: files[] (ไฟล์) และ cardIds[] (บัตรของแต่ละไฟล์ เรียงตรงกัน)
 * ไฟล์ถูกอ่านจาก memory แล้วทิ้ง ไม่มีการบันทึกที่ใดทั้งสิ้น
 * endpoint นี้แค่ "อ่าน" ไม่เขียนลง database — ผู้ใช้ต้องตรวจแล้วกดบันทึกเอง
 */
export async function POST(request: Request) {
  // ต้องล็อกอิน — ไฟล์ statement เป็นข้อมูลการเงินส่วนตัว
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'อ่านไฟล์ที่ส่งมาไม่ได้' }, { status: 400 })
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  const cardIds = formData.getAll('cardIds').map(v => (typeof v === 'string' ? v : ''))
  // รหัสผ่านของแต่ละไฟล์ (เรียงตรงกับ files) ใช้ถอดรหัสในหน่วยความจำแล้วทิ้ง
  const passwords = formData.getAll('passwords').map(v => (typeof v === 'string' ? v : ''))

  if (files.length === 0) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `อัปโหลดได้ครั้งละไม่เกิน ${MAX_FILES} ไฟล์` },
      { status: 400 }
    )
  }

  // อ่านทีละไฟล์ ไฟล์ที่พังไม่ทำให้ไฟล์อื่นล้มไปด้วย
  const results: FileResult[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const cardId = cardIds[i] || null

    if (!SUPPORTED_MIME_TYPES.includes(file.type as (typeof SUPPORTED_MIME_TYPES)[number])) {
      results.push({
        fileName: file.name,
        cardId,
        expenses: [],
        error: 'รองรับเฉพาะ PDF และรูปภาพ',
      })
      continue
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({
        fileName: file.name,
        cardId,
        expenses: [],
        error: `ไฟล์ใหญ่เกิน ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      })
      continue
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { expenses, warning } = await parseStatement(buffer, file.type, passwords[i] || undefined)
      results.push({ fileName: file.name, cardId, expenses, warning })
    } catch (err) {
      // ไฟล์ล็อกรหัส — บอก UI ให้ขึ้นช่องใส่รหัสเฉพาะไฟล์นี้
      if (err instanceof PasswordRequiredError || err instanceof WrongPasswordError) {
        results.push({
          fileName: file.name,
          cardId,
          expenses: [],
          error: err.message,
          needPassword: true,
        })
        continue
      }
      console.error('[ParseStatement] error:', file.name, err)
      results.push({
        fileName: file.name,
        cardId,
        expenses: [],
        error: 'อ่านไฟล์นี้ไม่สำเร็จ',
      })
    }
  }

  const total = results.reduce((sum, r) => sum + r.expenses.length, 0)
  return NextResponse.json({ results, total })
}
