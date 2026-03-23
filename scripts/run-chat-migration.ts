import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🚀 Running Chat Migration...\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  console.log('✓ Environment loaded');
  console.log('  URL:', databaseUrl.split('@')[1]?.split('/')[0] || 'hidden', '\n');

  const sqlPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  console.log('✓ Migration file loaded');
  console.log('  Path:', sqlPath);
  console.log('  Size:', sql.length, 'characters\n');

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('⚙️  Connecting to database...');
    await client.connect();
    console.log('✓ Connected\n');

    console.log('⚙️  Executing SQL migration...');
    await client.query(sql);
    console.log('✓ Migration executed successfully\n');

    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('chat_conversations', 'chat_messages')
      ORDER BY table_name
    `);

    console.log('✅ Migration completed!\n');
    console.log('📊 Tables created:');
    result.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });
    console.log('\n✨ Chat feature is ready to use!');
    console.log('   Access at: http://localhost:3000/chat\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Tip: Check DATABASE_URL password in .env.local');
    } else if (error.message.includes('already exists')) {
      console.log('\n💡 Note: Tables may already exist. Verifying...\n');

      try {
        const result = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('chat_conversations', 'chat_messages')
          ORDER BY table_name
        `);

        if (result.rows.length === 2) {
          console.log('✅ Tables already exist and are ready to use!\n');
          console.log('📊 Tables found:');
          result.rows.forEach(row => {
            console.log(`   • ${row.table_name}`);
          });
          console.log('\n✨ Chat feature is ready to use!');
          console.log('   Access at: http://localhost:3000/chat\n');
          return;
        }
      } catch (verifyError) {
        console.error('Failed to verify existing tables');
      }
    }

    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(() => {
  process.exit(1);
});
