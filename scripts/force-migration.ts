#!/usr/bin/env tsx

/**
 * Force Migration Script
 *
 * This script attempts to run the chat migration by directly executing
 * SQL statements through Supabase client with various fallback methods.
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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

async function forceMigration() {
  console.log('🚀 Force Migration Script\n');
  console.log('⚠️  WARNING: This will attempt to create tables using various methods\n');

  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260309000000_create_chat_tables.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration file loaded\n');

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });

  // Method 1: Try to create tables one by one using raw queries
  console.log('📝 Method 1: Creating tables individually...\n');

  try {
    // Create conversations table
    console.log('Creating chat_conversations table...');
    const { error: convError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS chat_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          home_id UUID,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    });

    if (convError) {
      console.log('   RPC method not available, trying alternative...');
    } else {
      console.log('   ✅ chat_conversations table created');
    }

    // Since RPC doesn't work, let's try using Supabase Management API
    console.log('\n📝 Method 2: Using Supabase Management API...\n');

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    if (!projectRef) {
      throw new Error('Could not extract project reference');
    }

    // Split SQL into manageable chunks and execute via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      console.log('   REST API method not available\n');
    }

    console.log('⚠️  Automated methods exhausted.\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Please use the manual migration method:\n');
    console.log('   npm run open-sql\n');
    console.log('This will:');
    console.log('1. Copy the SQL to your clipboard');
    console.log('2. Open Supabase SQL Editor in your browser');
    console.log('3. You just need to paste (Cmd+V) and click "Run"\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n📋 Please use manual migration: npm run open-sql\n');
  }
}

forceMigration();
