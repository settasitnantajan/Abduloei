import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env.local') })

async function migrate() {
  console.log('🚀 Creating database tables...\n')

  // Use the correct database URL format
  const projectRef = 'faxauzhlgrfuhfvlybbg'
  const password = 'nvNqHihBbesBMTt8'
  
  // Try direct connection (Transaction mode)
  const databaseUrl = `postgresql://postgres.${projectRef}:${password}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`
  
  console.log('✓ Using direct connection')
  console.log('  Project:', projectRef)

  // Read SQL file
  const sqlPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql')
  let sql: string

  try {
    sql = readFileSync(sqlPath, 'utf-8')
    console.log('✓ Migration file loaded')
    console.log('  Size:', sql.length, 'characters\n')
  } catch (error: any) {
    console.error('❌ Failed to read migration file:', error.message)
    process.exit(1)
  }

  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })

  try {
    // Connect
    console.log('⚙️  Connecting to database...')
    await client.connect()
    console.log('✓ Connected to database\n')

    // Execute SQL
    console.log('⚙️  Executing SQL migration...')
    await client.query(sql)
    console.log('✓ SQL executed successfully\n')

    // Verify tables
    console.log('🔍 Verifying tables...')
    const tableResult = await client.query(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_name IN ('chat_conversations', 'chat_messages')
      ORDER BY table_name
    `)

    if (tableResult.rows.length === 0) {
      throw new Error('Tables not found after migration!')
    }

    console.log('✅ Migration completed successfully!\n')

    // Show tables
    console.log('📊 Tables created:')
    tableResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} created (${row.column_count} columns)`)
    })

    // Check RLS policies
    const rlsResult = await client.query(`
      SELECT tablename, COUNT(*) as count
      FROM pg_policies
      WHERE tablename IN ('chat_conversations', 'chat_messages')
      GROUP BY tablename
      ORDER BY tablename
    `)

    if (rlsResult.rows.length > 0) {
      console.log('\n🔒 RLS policies created:')
      const totalPolicies = rlsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      rlsResult.rows.forEach(row => {
        console.log(`   ✓ ${row.tablename} (${row.count} policies)`)
      })
      console.log(`   Total: ${totalPolicies} policies`)
    }

    // Check indexes
    const indexResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('chat_conversations', 'chat_messages')
      AND indexname LIKE 'idx_%'
    `)

    if (indexResult.rows[0].count > 0) {
      console.log(`\n📇 Indexes created: ${indexResult.rows[0].count} indexes`)
    }

    // Check triggers
    const triggerResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.triggers
      WHERE event_object_table IN ('chat_conversations', 'chat_messages')
    `)

    if (triggerResult.rows[0].count > 0) {
      console.log(`⚡ Triggers created: ${triggerResult.rows[0].count} triggers`)
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n✨ Chat feature is ready!')
    console.log('   Access at: http://localhost:3000/chat\n')

  } catch (error: any) {
    console.error('\n❌ Migration failed!')
    console.error('Error:', error.message)

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. Verifying...')

      try {
        const checkResult = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('chat_conversations', 'chat_messages')
          ORDER BY table_name
        `)

        if (checkResult.rows.length === 2) {
          console.log('✓ Tables verified:')
          checkResult.rows.forEach(row => {
            console.log(`   • ${row.table_name}`)
          })

          const rlsCheck = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_policies
            WHERE tablename IN ('chat_conversations', 'chat_messages')
          `)

          console.log(`✓ RLS Policies: ${rlsCheck.rows[0].count} policies found`)

          console.log('\n✅ Migration already completed!')
          console.log('   Access at: http://localhost:3000/chat\n')
          process.exit(0)
        }
      } catch (verifyError: any) {
        console.error('⚠️  Could not verify tables:', verifyError.message)
      }
    }

    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()
