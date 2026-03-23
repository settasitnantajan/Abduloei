import * as dotenv from 'dotenv'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function main() {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // ทดสอบ select column ก่อน — ถ้ามีแล้วก็ไม่ต้องทำอะไร
  const { error: testErr } = await client.from('events').select('reminder_1d_sent').limit(1)

  if (!testErr) {
    console.log('✅ Columns reminder_1d_sent, reminder_1h_sent มีอยู่แล้ว!')
    return
  }

  console.log('Columns ยังไม่มี — กำลังเพิ่ม...')
  console.log('⚠️  Supabase JS client ไม่สามารถรัน ALTER TABLE ได้โดยตรง')
  console.log('')
  console.log('กรุณารัน SQL นี้ใน Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/sql/new')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_1d_sent boolean DEFAULT false;')
  console.log('ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_1h_sent boolean DEFAULT false;')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(console.error)
