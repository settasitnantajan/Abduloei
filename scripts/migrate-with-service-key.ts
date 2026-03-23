import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function migrateWithServiceKey() {
  console.log('🚀 Running Database Migration (Alternative Method)\n')

  // Try DATABASE_URL first
  let databaseUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Read SQL file
  const sqlPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql')
  let sql: string

  try {
    sql = readFileSync(sqlPath, 'utf-8')
    console.log('✓ Migration file loaded')
    console.log('  Path:', sqlPath)
    console.log('  Size:', sql.length, 'characters\n')
  } catch (error: any) {
    console.error('❌ Failed to read migration file:', error.message)
    process.exit(1)
  }

  // Method 1: Try direct DATABASE_URL
  if (databaseUrl) {
    console.log('📌 Method 1: Using DATABASE_URL\n')
    const client = new Client({ connectionString: databaseUrl })

    try {
      console.log('⚙️  Connecting to database...')
      await client.connect()
      console.log('✓ Connected successfully\n')

      console.log('⚙️  Executing SQL migration...')
      await client.query(sql)
      console.log('✓ Migration completed!\n')

      await verifyMigration(client)
      await client.end()
      return
    } catch (error: any) {
      await client.end()
      console.log('⚠️  Method 1 failed:', error.message, '\n')
    }
  }

  // Method 2: Construct URL from Supabase credentials
  if (supabaseUrl && serviceKey) {
    console.log('📌 Method 2: Constructing DATABASE_URL from Supabase credentials\n')

    // Extract project ref from Supabase URL
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
    if (!projectRef) {
      console.error('❌ Could not extract project ref from SUPABASE_URL')
      process.exit(1)
    }

    // Try different connection strings
    const connectionStrings = [
      // Pooler (Transaction mode) - port 6543
      `postgresql://postgres.${projectRef}:${serviceKey}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`,
      // Pooler (Session mode) - port 5432
      `postgresql://postgres.${projectRef}:${serviceKey}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`,
      // Direct connection
      `postgresql://postgres:${serviceKey}@db.${projectRef}.supabase.co:5432/postgres`,
    ]

    for (let i = 0; i < connectionStrings.length; i++) {
      const connString = connectionStrings[i]
      const displayString = connString.replace(serviceKey, '***')
      console.log(`\n🔗 Trying connection ${i + 1}/${connectionStrings.length}`)
      console.log('  ', displayString.split('@')[1])

      const client = new Client({ connectionString: connString })

      try {
        console.log('  Connecting...')
        await client.connect()
        console.log('  ✓ Connected!\n')

        console.log('⚙️  Executing SQL migration...')
        await client.query(sql)
        console.log('✓ Migration completed!\n')

        await verifyMigration(client)
        await client.end()
        return
      } catch (error: any) {
        await client.end()
        console.log('  ✗ Failed:', error.message)
      }
    }
  }

  // All methods failed
  console.error('\n❌ All connection methods failed!\n')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error('📋 TROUBLESHOOTING:')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.error('1. Get your Database Password from Supabase Dashboard:')
  console.error('   https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/settings/database\n')
  console.error('2. Update .env.local with correct DATABASE_URL:')
  console.error('   DATABASE_URL=postgresql://postgres.faxauzhlgrfuhfvlybbg:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres\n')
  console.error('3. Or paste SQL manually in Supabase SQL Editor:')
  console.error('   https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/sql/new\n')
  process.exit(1)
}

async function verifyMigration(client: Client) {
  console.log('🔍 Verifying migration...\n')

  const result = await client.query(`
    SELECT
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    AND table_name IN ('chat_conversations', 'chat_messages')
    ORDER BY table_name
  `)

  if (result.rows.length === 0) {
    throw new Error('Tables not found after migration!')
  }

  console.log('✅ Migration verified!\n')
  console.log('📊 Tables created:')
  result.rows.forEach(row => {
    console.log(`   • ${row.table_name} (${row.column_count} columns)`)
  })

  // Check RLS policies
  const rlsResult = await client.query(`
    SELECT COUNT(*) as count
    FROM pg_policies
    WHERE tablename IN ('chat_conversations', 'chat_messages')
  `)

  console.log(`\n🔒 RLS Policies: ${rlsResult.rows[0].count} policies found`)

  console.log('\n✨ Chat feature is ready!')
  console.log('   Access at: http://localhost:3000/chat\n')
}

migrateWithServiceKey()
