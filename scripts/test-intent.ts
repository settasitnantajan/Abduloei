import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env.local ก่อน import intent-analyzer เพราะ module อาจใช้ env ตอน init
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

import { analyzeIntent, AnalyzedIntent } from '../lib/ai/intent-analyzer'

// --------------------------------------------------------
// Types
// --------------------------------------------------------

type ExpectFields = {
  has?: (keyof AnalyzedIntent)[]
  missing?: (keyof AnalyzedIntent)[]
}

interface TestCase {
  msg: string
  expectIntent: AnalyzedIntent['intent'] | AnalyzedIntent['intent'][]
  expectFields?: ExpectFields
  note?: string
}

// --------------------------------------------------------
// Test cases
// --------------------------------------------------------

const testCases: TestCase[] = [
  // ---------- create_event ที่ครบ (ต้อง pass — มี title+date+time) ----------
  {
    msg: 'ไปหาหมอฟันพรุ่งนี้บ่าย 2',
    expectIntent: 'create_event',
    expectFields: { has: ['title', 'date', 'time'] },
    note: 'create_event ครบ',
  },
  {
    msg: 'ประชุมทีมวันศุกร์ 3 ทุ่ม',
    expectIntent: 'create_event',
    expectFields: { has: ['title', 'date', 'time'] },
    note: 'create_event ครบ',
  },
  {
    msg: 'นัดกินข้าวกับเพื่อนวันเสาร์เที่ยง',
    expectIntent: 'create_event',
    expectFields: { has: ['title', 'date', 'time'] },
    note: 'create_event ครบ',
  },

  // ---------- create_event ที่ไม่ครบ (ต้อง clarify) ----------
  {
    msg: 'นัดหมอ',
    expectIntent: 'clarify',
    note: 'create_event ขาด date+time',
  },
  {
    msg: 'ไปหาหมอ',
    expectIntent: 'clarify',
    note: 'create_event ขาด date+time',
  },
  {
    msg: 'ประชุม 3 ทุ่ม',
    expectIntent: 'clarify',
    expectFields: { missing: ['date'] },
    note: 'create_event ขาดวัน',
  },
  {
    msg: 'พรุ่งนี้สอบ',
    expectIntent: 'clarify',
    expectFields: { missing: ['time'] },
    note: 'create_event ขาดเวลา',
  },

  // ---------- create_task ----------
  {
    msg: 'ซื้อนมกลับบ้าน',
    expectIntent: 'create_task',
    expectFields: { has: ['title'] },
    note: 'create_task',
  },
  {
    msg: 'อย่าลืมต่อทะเบียนรถ',
    expectIntent: 'create_task',
    expectFields: { has: ['title'] },
    note: 'create_task',
  },
  {
    msg: 'ต้องโอนเงินให้แม่',
    expectIntent: 'create_task',
    expectFields: { has: ['title'] },
    note: 'create_task',
  },

  // ---------- create_note ----------
  {
    msg: 'จำไว้ว่ารหัส wifi คือ abc123',
    expectIntent: 'create_note',
    expectFields: { has: ['title', 'description'] },
    note: 'create_note',
  },
  {
    msg: 'เลขบัญชี 1234567890',
    expectIntent: 'create_note',
    expectFields: { has: ['title', 'description'] },
    note: 'create_note',
  },

  // ---------- create_routine ที่ครบ ----------
  {
    msg: 'วิ่งทุกเช้า 6 โมง',
    expectIntent: 'create_routine',
    expectFields: { has: ['title', 'routine_time', 'days_of_week'] },
    note: 'create_routine ครบ',
  },
  {
    msg: 'ทานยาทุกวัน เที่ยง',
    expectIntent: 'create_routine',
    expectFields: { has: ['title', 'routine_time', 'days_of_week'] },
    note: 'create_routine ครบ',
  },

  // ---------- create_routine ที่ไม่ครบ (ต้อง clarify) ----------
  {
    msg: 'กินยาทุกวัน',
    expectIntent: 'clarify',
    note: 'create_routine ขาด routine_time',
  },
  {
    msg: 'ออกกำลังกายทุกเช้า',
    expectIntent: 'clarify',
    note: 'create_routine ขาด routine_time',
  },

  // ---------- create_monthly_routine ที่ครบ ----------
  {
    msg: 'จ่ายค่าบ้านทุกวันที่ 5',
    expectIntent: 'create_monthly_routine',
    expectFields: { has: ['title', 'day_of_month'] },
    note: 'create_monthly_routine ครบ',
  },
  {
    msg: 'จ่ายค่าเน็ตสิ้นเดือน',
    expectIntent: 'create_monthly_routine',
    expectFields: { has: ['title', 'day_of_month'] },
    note: 'create_monthly_routine ครบ (day_of_month=32)',
  },

  // ---------- create_monthly_routine ที่ไม่ครบ (ต้อง clarify) ----------
  {
    msg: 'จ่ายค่าไฟทุกเดือน',
    expectIntent: 'clarify',
    note: 'create_monthly_routine ขาด day_of_month',
  },

  // ---------- query ----------
  {
    msg: 'มีนัดอะไรบ้างพรุ่งนี้',
    expectIntent: 'query',
    note: 'query',
  },
  {
    msg: 'วันนี้ต้องทำไรบ้าง',
    expectIntent: 'query',
    note: 'query',
  },
  {
    msg: 'ว่างไหมวันศุกร์',
    expectIntent: 'query',
    note: 'query',
  },

  // ---------- edit ----------
  {
    msg: 'เลื่อนนัดหมอเป็นวันจันทร์',
    expectIntent: ['edit_event'],
    expectFields: { has: ['editTarget'] },
    note: 'edit_event',
  },
  {
    msg: 'เปลี่ยนเวลาประชุมเป็นบ่าย 3',
    expectIntent: ['edit_event'],
    expectFields: { has: ['editTarget', 'time'] },
    note: 'edit_event',
  },

  // ---------- delete ----------
  {
    msg: 'ลบนัดหมอ',
    expectIntent: ['delete_event'],
    expectFields: { has: ['editTarget'] },
    note: 'delete_event',
  },
  {
    msg: 'ยกเลิกนัดประชุม',
    expectIntent: ['delete_event'],
    expectFields: { has: ['editTarget'] },
    note: 'delete_event',
  },
  {
    msg: 'ไม่ไปหมอแล้ว',
    expectIntent: ['delete_event'],
    expectFields: { has: ['editTarget'] },
    note: 'delete_event',
  },

  // ---------- chat ----------
  {
    msg: 'เหนื่อยจัง',
    expectIntent: 'chat',
    note: 'chat',
  },
  {
    msg: 'สวัสดี',
    expectIntent: 'chat',
    note: 'chat',
  },
  {
    msg: '555',
    expectIntent: 'chat',
    note: 'chat',
  },
  {
    msg: 'วันนี้เจอเพื่อนเก่า ดีใจมาก',
    expectIntent: 'chat',
    note: 'chat',
  },

  // ---------- clarify (กำกวม) ----------
  {
    msg: 'จ่ายค่าไฟ',
    expectIntent: 'clarify',
    expectFields: { has: ['choices'] },
    note: 'clarify — กำกวม task vs monthly_routine',
  },
  {
    msg: 'หมอ',
    expectIntent: 'clarify',
    note: 'clarify — สั้นเกินไป',
  },
]

// --------------------------------------------------------
// Runner
// --------------------------------------------------------

function matchesExpect(
  actual: AnalyzedIntent['intent'],
  expect: AnalyzedIntent['intent'] | AnalyzedIntent['intent'][]
): boolean {
  if (Array.isArray(expect)) return expect.includes(actual)
  return actual === expect
}

function checkFields(result: AnalyzedIntent, fields?: ExpectFields): string[] {
  const errors: string[] = []
  if (!fields) return errors

  if (fields.has) {
    for (const field of fields.has) {
      const val = result[field]
      if (val === undefined || val === null) {
        errors.push(`ขาด field "${field}"`)
      }
    }
  }

  if (fields.missing) {
    for (const field of fields.missing) {
      const val = result[field]
      if (val !== undefined && val !== null) {
        errors.push(`ไม่ควรมี field "${field}" (got: ${JSON.stringify(val)})`)
      }
    }
  }

  return errors
}

function formatExpect(
  expect: AnalyzedIntent['intent'] | AnalyzedIntent['intent'][]
): string {
  if (Array.isArray(expect)) return expect.join(' | ')
  return expect
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('=== test-intent.ts — ทดสอบ analyzeIntent() ===\n')

  let passed = 0
  let failed = 0
  const failedCases: string[] = []

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]
    const label = `[${i + 1}/${testCases.length}] "${tc.msg}"`

    try {
      const result = await analyzeIntent(tc.msg)

      const intentOk = matchesExpect(result.intent, tc.expectIntent)
      const fieldErrors = checkFields(result, tc.expectFields)
      const ok = intentOk && fieldErrors.length === 0

      if (ok) {
        passed++
        console.log(`✅ ${label}`)
        console.log(`   intent: ${result.intent}${tc.note ? ` (${tc.note})` : ''}`)
      } else {
        failed++
        const reasons: string[] = []
        if (!intentOk) {
          reasons.push(
            `intent ที่ได้: "${result.intent}" ≠ ที่คาดหวัง: "${formatExpect(tc.expectIntent)}"`
          )
        }
        reasons.push(...fieldErrors)

        console.log(`❌ ${label}`)
        console.log(`   intent: ${result.intent} | คาดหวัง: ${formatExpect(tc.expectIntent)}`)
        for (const r of reasons) console.log(`   !! ${r}`)
        if (result.clarifyMessage) console.log(`   clarifyMessage: ${result.clarifyMessage}`)

        failedCases.push(`"${tc.msg}" — ${reasons.join(', ')}`)
      }

      // แสดง detail บางส่วนที่น่าสนใจ
      const details: string[] = []
      if (result.date) details.push(`date=${result.date}`)
      if (result.time) details.push(`time=${result.time}`)
      if (result.routine_time) details.push(`routine_time=${result.routine_time}`)
      if (result.days_of_week) details.push(`days=${JSON.stringify(result.days_of_week)}`)
      if (result.day_of_month !== undefined) details.push(`day_of_month=${result.day_of_month}`)
      if (result.title) details.push(`title="${result.title}"`)
      if (result.editTarget) details.push(`editTarget=${JSON.stringify(result.editTarget)}`)
      if (result.choices?.length) details.push(`choices=[${result.choices.length} items]`)
      if (details.length > 0) console.log(`   ${details.join(' | ')}`)

      console.log()
    } catch (err: unknown) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`❌ ${label}`)
      console.log(`   ERROR: ${msg}`)
      console.log()
      failedCases.push(`"${tc.msg}" — exception: ${msg}`)
    }

    // หน่วงเวลาระหว่าง test cases เพื่อหลีกเลี่ยง rate limit
    if (i < testCases.length - 1) {
      await sleep(500)
    }
  }

  // ---------- สรุปผล ----------
  console.log('='.repeat(60))
  console.log(`สรุปผล: ผ่าน ${passed}/${testCases.length} | ล้มเหลว ${failed}/${testCases.length}`)

  if (failedCases.length > 0) {
    console.log('\nรายการที่ล้มเหลว:')
    failedCases.forEach((c, idx) => console.log(`  ${idx + 1}. ${c}`))
  }

  console.log('='.repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

main()
