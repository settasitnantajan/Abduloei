import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function migrate() {
  console.log('🚀 Running Database Migration with pg client\n')

  // Get DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local')
    console.error('\n💡 Tip: Add DATABASE_URL to .env.local')
    console.error('   Format: postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres')
    process.exit(1)
  }

  console.log('✓ DATABASE_URL found')
  const hostInfo = databaseUrl.split('@')[1]?.split('/')[0] || 'hidden'
  console.log('  Host:', hostInfo, '\n')

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

  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
  })

  try {
    // Connect
    console.log('⚙️  Connecting to database...')
    await client.connect()
    console.log('✓ Connected successfully\n')

    // Execute SQL
    console.log('⚙️  Executing SQL migration...')
    await client.query(sql)
    console.log('✓ SQL executed successfully\n')

    // Verify tables were created
    console.log('🔍 Verifying tables...')
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

    console.log('✅ Migration completed successfully!\n')
    console.log('📊 Tables created:')
    result.rows.forEach(row => {
      console.log(`   • ${row.table_name} (${row.column_count} columns)`)
    })

    // Check RLS policies
    const rlsResult = await client.query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE tablename IN ('chat_conversations', 'chat_messages')
      ORDER BY tablename, policyname
    `)

    if (rlsResult.rows.length > 0) {
      console.log('\n🔒 RLS Policies:')
      rlsResult.rows.forEach(row => {
        console.log(`   • ${row.tablename}: ${row.policyname}`)
      })
    }

    // Check indexes
    const indexResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('chat_conversations', 'chat_messages')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `)

    if (indexResult.rows.length > 0) {
      console.log('\n📇 Indexes:')
      indexResult.rows.forEach(row => {
        console.log(`   • ${row.indexname}`)
      })
    }

    // Check triggers
    const triggerResult = await client.query(`
      SELECT
        trigger_name,
        event_manipulation,
        event_object_table
      FROM information_schema.triggers
      WHERE event_object_table IN ('chat_conversations', 'chat_messages')
      ORDER BY event_object_table, trigger_name
    `)

    if (triggerResult.rows.length > 0) {
      console.log('\n⚡ Triggers:')
      triggerResult.rows.forEach(row => {
        console.log(`   • ${row.event_object_table}: ${row.trigger_name}`)
      })
    }

    console.log('\n✨ Chat feature is ready!')
    console.log('   Access at: http://localhost:3000/chat\n')

  } catch (error: any) {
    console.error('\n❌ Migration failed!')
    console.error('Error:', error.message)

    if (error.code) {
      console.error('Error Code:', error.code)
    }

    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Tip: Check DATABASE_URL password in .env.local')
    } else if (error.message.includes('already exists')) {
      console.log('\n⚠️  Tables or objects already exist. Verifying...')

      try {
        const checkResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('chat_conversations', 'chat_messages')
          ORDER BY table_name
        `)

        if (checkResult.rows.length > 0) {
          console.log('✓ Tables verified:')
          checkResult.rows.forEach(row => {
            console.log(`   • ${row.table_name}`)
          })

          // Check RLS
          const rlsCheck = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_policies
            WHERE tablename IN ('chat_conversations', 'chat_messages')
          `)

          console.log(`✓ RLS Policies: ${rlsCheck.rows[0].count} policies found`)

          console.log('\n✨ Migration already completed!')
          console.log('   Access at: http://localhost:3000/chat\n')
          process.exit(0)
        } else {
          console.error('⚠️  Could not find expected tables')
        }
      } catch (verifyError: any) {
        console.error('⚠️  Could not verify tables:', verifyError.message)
      }
    } else if (error.message.includes('does not exist')) {
      console.error('\n💡 Tip: Make sure you are connecting to the correct database')
      console.error('   Check DATABASE_URL points to your Supabase project')
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Tip: Database connection timed out')
      console.error('   Check your internet connection and Supabase status')
    }

    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed')
  }
}

migrate()
