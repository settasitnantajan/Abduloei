import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function runMigration() {
  console.log('🚀 Running Chat Migration via Supabase...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  console.log('✓ Environment loaded');
  console.log('  URL:', supabaseUrl);

  const sqlPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  console.log('✓ Migration file loaded');
  console.log('  Path:', sqlPath);
  console.log('  Size:', sql.length, 'characters\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('✓ Supabase client created\n');

  console.log('⚠️  Note: Automated SQL execution via Supabase client has limitations.');
  console.log('    Checking if tables already exist...\n');

  // Check if tables exist
  const { data: conversations, error: convError } = await supabase
    .from('chat_conversations')
    .select('count', { count: 'exact', head: true });

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('count', { count: 'exact', head: true });

  if (!convError && !msgError) {
    console.log('✅ Tables already exist!\n');
    console.log('📊 Tables verified:');
    console.log('   • chat_conversations');
    console.log('   • chat_messages\n');
    console.log('✨ Chat feature is ready to use!');
    console.log('   Access at: http://localhost:3000/chat\n');
    return;
  }

  console.log('❌ Tables not found. Manual migration required.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 MANUAL MIGRATION STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Open Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/sql/new\n');
  console.log('2. Copy the SQL from:');
  console.log('   supabase/migrations/20260309000000_create_chat_tables.sql\n');
  console.log('3. Paste into SQL Editor\n');
  console.log('4. Click "Run" button to execute\n');
  console.log('5. You should see: "Success. No rows returned"\n');
  console.log('6. Run this script again to verify\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Quick SQL Copy (run this in your terminal):');
  console.log('   cat supabase/migrations/20260309000000_create_chat_tables.sql | pbcopy');
  console.log('   (SQL copied to clipboard - paste in Supabase Dashboard)\n');

  process.exit(1);
}

runMigration().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
