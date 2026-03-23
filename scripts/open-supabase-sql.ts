#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load .env.local explicitly
dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;

if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL in .env.local');
  process.exit(1);
}

async function openSupabaseDashboard() {
  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectRef) {
    console.error('❌ Could not extract project reference from SUPABASE_URL');
    process.exit(1);
  }

  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

  console.log('🚀 Opening Supabase SQL Editor...\n');
  console.log('📍 URL:', sqlEditorUrl);
  console.log('\n📋 Next steps:');
  console.log('1. Paste the SQL from your clipboard (already copied!)');
  console.log('2. Click "Run" to execute');
  console.log('3. Verify tables appear in Table Editor\n');

  try {
    await execAsync(`open "${sqlEditorUrl}"`);
    console.log('✅ Browser opened!\n');
  } catch (error) {
    console.log('⚠️  Could not open browser automatically');
    console.log('Please open this URL manually:', sqlEditorUrl);
  }
}

openSupabaseDashboard();
