import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function createTables() {
  console.log('🚀 Creating database tables...\n')

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('✓ Loaded environment variables')
  console.log('  URL:', supabaseUrl, '\n')

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Read SQL file
  const sqlPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log('✓ Migration file loaded')
  console.log('  Size:', sql.length, 'characters\n')

  // Check if tables already exist
  console.log('🔍 Checking if tables exist...\n')

  const { data: convData, error: convError } = await supabase
    .from('chat_conversations')
    .select('count', { count: 'exact', head: true })

  const { data: msgData, error: msgError } = await supabase
    .from('chat_messages')
    .select('count', { count: 'exact', head: true })

  if (!convError && !msgError) {
    console.log('✅ Tables already exist!\n')
    console.log('📊 Verified tables:')
    console.log('   ✓ chat_conversations')
    console.log('   ✓ chat_messages\n')
    console.log('✨ Chat feature is ready!')
    console.log('   Access at: http://localhost:3000/chat\n')
    return
  }

  console.log('⚠️  Tables not found. Please run SQL manually.\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 QUICK SETUP INSTRUCTIONS:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('1. Open Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/sql/new\n')
  console.log('2. Copy this SQL (already copied to clipboard if on Mac):\n')
  console.log('   File: supabase/migrations/20260309000000_create_chat_tables.sql\n')
  console.log('3. Paste into SQL Editor and click "Run"\n')
  console.log('4. You should see: "Success. No rows returned"\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Try to copy to clipboard on Mac
  try {
    const { exec } = await import('child_process')
    exec(`cat "${sqlPath}" | pbcopy`, (error) => {
      if (!error) {
        console.log('✓ SQL copied to clipboard! Just paste in Supabase Dashboard.\n')
      }
    })
  } catch (e) {
    // Ignore clipboard errors
  }
}

createTables()
