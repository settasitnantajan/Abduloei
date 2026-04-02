import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

import { analyzeIntent, AnalyzedIntent } from '../lib/ai/intent-analyzer'

// --------------------------------------------------------
// Types
// --------------------------------------------------------

interface TestCase {
  msg: string
  expect: string
  expectIntent: AnalyzedIntent['intent'] | AnalyzedIntent['intent'][]
  expectHas?: (keyof AnalyzedIntent)[]
  safetyNet?: boolean
  group: string
}

// --------------------------------------------------------
// Safety net simulation (เหมือนใน route.ts)
// --------------------------------------------------------

function applySafetyNet(intent: AnalyzedIntent): AnalyzedIntent {
  if (intent.date && !/^\d{4}-\d{2}-\d{2}$/.test(intent.date)) {
    intent.date = undefined
  }
  if (intent.time && !/^\d{2}:\d{2}$/.test(intent.time)) {
    intent.time = undefined
  }
  if (intent.routine_time && !/^\d{2}:\d{2}$/.test(intent.routine_time)) {
    intent.routine_time = undefined
  }

  // วันที่ผ่านไปแล้ว
  if (intent.date && /^\d{4}-\d{2}-\d{2}$/.test(intent.date)) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const intentDate = new Date(intent.date + 'T00:00:00')
    if (intentDate < today) {
      return { ...intent, intent: 'clarify' }
    }
  }

  if (intent.intent === 'create_event' && (!intent.date || !intent.time)) {
    return { ...intent, intent: 'clarify' }
  }
  if (intent.intent === 'create_routine' && !intent.routine_time && !intent.time) {
    return { ...intent, intent: 'clarify' }
  }
  if (intent.intent === 'create_monthly_routine' && !intent.day_of_month) {
    return { ...intent, intent: 'clarify' }
  }

  return intent
}

// --------------------------------------------------------
// Test cases — สุ่มจากภาษาพูดคนไทยจริงๆ
// --------------------------------------------------------

const testCases: TestCase[] = [
  // === กลุ่ม 1: ภาษาพูดห้วนๆ คนไทยพิมพ์จริง ===
  { group: '1-ภาษาพูด', msg: 'หมอพรุ่งนี้ 10 โมง', expect: 'create_event ครบ', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '1-ภาษาพูด', msg: 'กินข้าวเย็นกับแฟนวันเสาร์ 6 โมง', expect: 'create_event ครบ', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '1-ภาษาพูด', msg: 'สัมภาษณ์งานวันจันทร์ 9 โมง', expect: 'create_event ครบ', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '1-ภาษาพูด', msg: 'ซื้อไข่กับนม', expect: 'create_task', expectIntent: 'create_task', expectHas: ['title'] },
  { group: '1-ภาษาพูด', msg: 'อย่าลืมจ่ายค่าเน็ต', expect: 'create_task', expectIntent: 'create_task', expectHas: ['title'] },
  { group: '1-ภาษาพูด', msg: 'จดไว้ pass wifi = abc123', expect: 'create_note', expectIntent: 'create_note', expectHas: ['title'] },
  { group: '1-ภาษาพูด', msg: 'ดูนัดหน่อย', expect: 'query', expectIntent: 'query' },
  { group: '1-ภาษาพูด', msg: 'วันนี้มีไรบ้าง', expect: 'query', expectIntent: 'query' },

  // === กลุ่ม 2: ข้อมูลไม่ครบ → ต้อง clarify ===
  { group: '2-ไม่ครบ', msg: 'นัดหมอ', expect: 'clarify ถามวัน+เวลา', expectIntent: 'clarify', safetyNet: true },
  { group: '2-ไม่ครบ', msg: 'ไปฟิตเนสทุกวัน', expect: 'clarify ถามเวลา', expectIntent: 'clarify', safetyNet: true },
  { group: '2-ไม่ครบ', msg: 'จ่ายค่าไฟทุกเดือน', expect: 'clarify ถามวันที่', expectIntent: 'clarify', safetyNet: true },
  { group: '2-ไม่ครบ', msg: 'ประชุม 3 ทุ่ม', expect: 'clarify ถามวัน', expectIntent: 'clarify', safetyNet: true },
  { group: '2-ไม่ครบ', msg: 'พรุ่งนี้สอบ', expect: 'clarify ถามเวลา', expectIntent: 'clarify', safetyNet: true },
  { group: '2-ไม่ครบ', msg: 'นัดหมอเช้าๆ', expect: 'clarify เวลาคลุมเครือ', expectIntent: 'clarify', safetyNet: true },

  // === กลุ่ม 3: พิมพ์ผิด / คำย่อ / สแลง ===
  { group: '3-พิมพ์ผิด', msg: 'นัดหมอพุ่งนี้ 10 โมง', expect: 'create_event (พุ่งนี้=พรุ่งนี้)', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '3-พิมพ์ผิด', msg: 'ปชม วันศุกร์ 3 ทุ่ม', expect: 'create_event (ปชม=ประชุม)', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '3-พิมพ์ผิด', msg: 'นดหมอพรุ่งนี้ บ่าย 2', expect: 'create_event (นด=นัด)', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '3-พิมพ์ผิด', msg: 'ต้องจ่ายค่า net ทุกสิ้นเดือน', expect: 'monthly_routine (net=เน็ต)', expectIntent: 'create_monthly_routine', expectHas: ['title', 'day_of_month'] },
  { group: '3-พิมพ์ผิด', msg: 'มีndอะไร', expect: 'clarify/chat (ลืมเปลี่ยนภาษา)', expectIntent: ['clarify', 'chat', 'query'] },

  // === กลุ่ม 4: Compound request ===
  { group: '4-compound', msg: 'นัดหมอพรุ่งนี้ 10 โมง แล้วก็ซื้อนมด้วย', expect: 'create_event (จับแค่อันแรก)', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '4-compound', msg: 'ซื้อไข่แล้วก็จดไว้ว่ารหัส wifi คือ 1234', expect: 'create_task (จับอันแรก)', expectIntent: ['create_task', 'create_note'] },
  { group: '4-compound', msg: 'วันนี้ไปหาหมอ หมอบอกกินยาทุกวัน 8 โมง', expect: 'create_routine (จับคำสั่งที่ชัด)', expectIntent: ['create_routine', 'chat', 'clarify'] },

  // === กลุ่ม 5: ข้อความแปลกๆ ===
  { group: '5-แปลกๆ', msg: '...', expect: 'chat', expectIntent: 'chat' },
  { group: '5-แปลกๆ', msg: '👍', expect: 'chat', expectIntent: 'chat' },
  { group: '5-แปลกๆ', msg: '555555555', expect: 'chat', expectIntent: 'chat' },
  { group: '5-แปลกๆ', msg: 'ครับบบบบบบ', expect: 'chat', expectIntent: 'chat' },
  { group: '5-แปลกๆ', msg: 'asdfghjkl', expect: 'chat', expectIntent: 'chat' },

  // === กลุ่ม 6: Chat / อารมณ์ / เรื่องเล่า ===
  { group: '6-chat', msg: 'เหนื่อยมากวันนี้ งานเยอะมาก', expect: 'chat', expectIntent: 'chat' },
  { group: '6-chat', msg: 'สวัสดีจ้า', expect: 'chat', expectIntent: 'chat' },
  { group: '6-chat', msg: 'วันนี้เจอเพื่อนเก่ามา ดีใจมากเลย', expect: 'chat', expectIntent: 'chat' },
  { group: '6-chat', msg: 'อยากกินส้มตำ', expect: 'chat', expectIntent: 'chat' },
  { group: '6-chat', msg: 'ขอบคุณน้า', expect: 'chat', expectIntent: 'chat' },

  // === กลุ่ม 7: กำกวม → choices ===
  { group: '7-กำกวม', msg: 'จ่ายค่าไฟ', expect: 'clarify + choices', expectIntent: 'clarify', expectHas: ['choices'] },
  { group: '7-กำกวม', msg: 'โอนเงินให้แม่', expect: 'task หรือ clarify', expectIntent: ['create_task', 'clarify'] },
  { group: '7-กำกวม', msg: 'หมอ', expect: 'clarify สั้นเกิน', expectIntent: ['clarify', 'chat'], safetyNet: true },

  // === กลุ่ม 8: เวลา/วันไม่ชัด ===
  { group: '8-ไม่ชัด', msg: 'นัดหมอสัปดาห์หน้า', expect: 'clarify', expectIntent: 'clarify', safetyNet: true },
  { group: '8-ไม่ชัด', msg: 'นัดหมอเร็วๆ นี้', expect: 'clarify', expectIntent: 'clarify', safetyNet: true },
  { group: '8-ไม่ชัด', msg: 'ประชุมช่วงบ่าย วันพุธ', expect: 'clarify (ช่วงบ่ายไม่ชัด)', expectIntent: 'clarify', safetyNet: true },
  { group: '8-ไม่ชัด', msg: 'วันไหนก็ได้', expect: 'clarify (คลุมเครือ)', expectIntent: ['clarify', 'chat'] },

  // === กลุ่ม 9: วันที่ผ่านไปแล้ว ===
  { group: '9-อดีต', msg: 'นัดหมอเมื่อวาน 10 โมง', expect: 'clarify (วันผ่านไปแล้ว)', expectIntent: ['clarify', 'chat'], safetyNet: true },
  { group: '9-อดีต', msg: 'สร้างนัด 1 มกราคม 10 โมง', expect: 'clarify (ผ่านไปแล้ว)', expectIntent: ['clarify', 'create_event'], safetyNet: true },

  // === กลุ่ม 10: Follow-up context รวม ===
  { group: '10-followup', msg: 'นัดหมอ พรุ่งนี้ 10 โมง', expect: 'create_event (follow-up ครบ)', expectIntent: 'create_event', expectHas: ['title', 'date', 'time'] },
  { group: '10-followup', msg: 'กินยาทุกวัน 8 โมงเช้า', expect: 'create_routine (follow-up ครบ)', expectIntent: 'create_routine', expectHas: ['title', 'routine_time'] },
  { group: '10-followup', msg: 'จ่ายค่าเน็ตทุกเดือน วันที่ 25', expect: 'monthly_routine (follow-up ครบ)', expectIntent: 'create_monthly_routine', expectHas: ['title', 'day_of_month'] },
]

// --------------------------------------------------------
// Runner
// --------------------------------------------------------

function matchesExpect(actual: string, expect: string | string[]): boolean {
  if (Array.isArray(expect)) return expect.includes(actual)
  return actual === expect
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('=== test-chat.ts — ทดสอบแชทจากภาษาพูดคนไทยจริงๆ ===')
  console.log(`รวม ${testCases.length} test cases | 10 กลุ่ม\n`)

  let passed = 0
  let failed = 0
  let rateLimited = 0
  const failedCases: string[] = []
  const groupResults: Record<string, { pass: number; fail: number }> = {}

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]
    const num = `[${String(i + 1).padStart(2, '0')}/${testCases.length}]`

    if (!groupResults[tc.group]) groupResults[tc.group] = { pass: 0, fail: 0 }

    try {
      let result = await analyzeIntent(tc.msg)

      if (tc.safetyNet || result.intent.startsWith('create_')) {
        result = applySafetyNet(result)
      }

      const intentOk = matchesExpect(result.intent, tc.expectIntent)

      const fieldErrors: string[] = []
      if (tc.expectHas) {
        for (const field of tc.expectHas) {
          const val = result[field]
          if (val === undefined || val === null) {
            fieldErrors.push(`ขาด "${field}"`)
          }
        }
      }

      const ok = intentOk && fieldErrors.length === 0

      if (ok) {
        passed++
        groupResults[tc.group].pass++
        console.log(`✅ ${num} "${tc.msg}"`)
        console.log(`   → ${result.intent}${result.title ? ` | "${result.title}"` : ''}`)
      } else {
        failed++
        groupResults[tc.group].fail++
        console.log(`❌ ${num} "${tc.msg}"`)
        console.log(`   คาดหวัง: ${tc.expect}`)
        console.log(`   ได้จริง: ${result.intent}`)
        if (!intentOk) {
          const expected = Array.isArray(tc.expectIntent) ? tc.expectIntent.join('|') : tc.expectIntent
          console.log(`   !! intent: "${result.intent}" ≠ "${expected}"`)
        }
        for (const e of fieldErrors) console.log(`   !! ${e}`)
        if (result.clarifyMessage) console.log(`   clarify: "${result.clarifyMessage.slice(0, 60)}"`)
        failedCases.push(`[${tc.group}] "${tc.msg}" → "${result.intent}"`)
      }

      // แสดง detail
      const d: string[] = []
      if (result.date) d.push(`date=${result.date}`)
      if (result.time) d.push(`time=${result.time}`)
      if (result.routine_time) d.push(`rt=${result.routine_time}`)
      if (result.day_of_month != null) d.push(`dom=${result.day_of_month}`)
      if (result.editTarget) d.push(`target=${JSON.stringify(result.editTarget)}`)
      if (result.choices?.length) d.push(`choices=${result.choices.length}`)
      if (d.length > 0) console.log(`   ${d.join(' | ')}`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('429') || msg.includes('rate') || msg.includes('RATE')) {
        rateLimited++
        console.log(`⏳ ${num} "${tc.msg}" — RATE LIMITED (ไม่นับ)`)
      } else {
        failed++
        groupResults[tc.group].fail++
        console.log(`❌ ${num} "${tc.msg}" — ERROR: ${msg.slice(0, 80)}`)
        failedCases.push(`[${tc.group}] "${tc.msg}" → error`)
      }
    }

    console.log()

    // Gemini primary → rate limit สูงกว่า แต่ยัง delay ไว้
    if (i < testCases.length - 1) await sleep(2000)
  }

  // ---------- สรุปผล ----------
  console.log('='.repeat(60))
  console.log(`\n🏆 สรุปผล:`)
  console.log(`   ✅ ผ่าน: ${passed}/${testCases.length}`)
  console.log(`   ❌ ล้มเหลว: ${failed}/${testCases.length}`)
  if (rateLimited > 0) console.log(`   ⏳ Rate limited: ${rateLimited} (ไม่นับ)`)
  const effectiveTotal = testCases.length - rateLimited
  const passRate = effectiveTotal > 0 ? Math.round((passed / effectiveTotal) * 100) : 0
  console.log(`   📊 Pass rate: ${passRate}% (ไม่นับ rate limited)`)

  // สรุปแยกกลุ่ม
  console.log(`\n📋 แยกตามกลุ่ม:`)
  for (const [group, r] of Object.entries(groupResults).sort()) {
    const total = r.pass + r.fail
    const icon = r.fail === 0 ? '✅' : '⚠️'
    console.log(`   ${icon} ${group}: ${r.pass}/${total}`)
  }

  if (failedCases.length > 0) {
    console.log(`\n❌ รายการที่ล้มเหลว:`)
    failedCases.forEach((c, idx) => console.log(`   ${idx + 1}. ${c}`))
  }

  console.log('\n' + '='.repeat(60))
  process.exit(failed > 0 ? 1 : 0)
}

main()
