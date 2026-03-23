import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local explicitly
dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function runMigrationViaAPI() {
  console.log('🚀 Running migration via Supabase Management API...\n');

  try {
    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log('📊 SQL size:', migrationSQL.length, 'characters\n');

    // Extract project ref from URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    if (!projectRef) {
      throw new Error('Could not extract project reference from SUPABASE_URL');
    }

    console.log('🔧 Project:', projectRef);
    console.log('🔄 Executing SQL via REST API...\n');

    // Use Supabase REST API to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', errorText);
      throw new Error('Failed to execute migration via API');
    }

    console.log('✅ Migration executed successfully!\n');
    console.log('🎉 Chat tables created!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Please use manual migration instead:');
    console.log('1. Run: npm run migrate-chat');
    console.log('2. Follow the instructions to copy SQL to Supabase Dashboard\n');
    process.exit(1);
  }
}

runMigrationViaAPI();
