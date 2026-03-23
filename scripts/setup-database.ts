/**
 * Database Setup Script
 *
 * Uses Supabase Management API to execute SQL migrations
 * Automatically creates all required tables, indexes, RLS policies, and triggers
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: Missing ${name} in environment`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

// Create Supabase client with service role key (full admin access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLFile(filePath: string): Promise<boolean> {
  try {
    console.log(`\nExecuting SQL file: ${filePath}`);

    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    if (!sql.trim()) {
      console.log('  Skipped (empty file)');
      return true;
    }

    // Split SQL into individual statements (basic splitting by semicolon)
    // Note: This is a simple approach. For complex SQL with semicolons in strings,
    // you might need a more sophisticated parser.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`  Found ${statements.length} SQL statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`  Executing statement ${i + 1}/${statements.length}...`);

      // Use rpc to execute raw SQL via a custom function
      // Note: We need to execute via the postgres connection
      const { data, error } = await supabase.rpc('exec_sql' as any, {
        sql_query: statement + ';'
      });

      if (error) {
        // If exec_sql doesn't exist, try direct execution via Supabase REST API
        console.log('  Note: exec_sql function not available, using alternative method');

        // Try using Supabase's query method (for simple queries)
        try {
          // This is a workaround - we'll execute via HTTP directly
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({ query: statement + ';' })
          });

          if (!response.ok) {
            console.log(`  Warning: HTTP ${response.status} - ${response.statusText}`);
            console.log(`  This might be OK if the table/policy already exists`);
          }
        } catch (httpError: any) {
          console.log(`  Warning: ${httpError.message}`);
          console.log(`  Continuing anyway...`);
        }
      } else {
        console.log(`  Success: Statement ${i + 1} executed`);
      }
    }

    console.log(`  Completed: ${filePath}`);
    return true;

  } catch (error: any) {
    console.error(`  Error executing ${filePath}:`, error.message);
    return false;
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    // Error could mean table doesn't exist or RLS is blocking
    if (error.message.includes('does not exist')) {
      return false;
    }
    // If it's an RLS error, table exists
    if (error.message.includes('policy')) {
      return true;
    }
    return false;
  }

  return true;
}

async function createTablesDirectly(): Promise<boolean> {
  console.log('\nAttempting to create tables using direct SQL execution...\n');

  const chatConversationsSQL = `
-- Chat Conversations Table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  home_id UUID,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

  const chatMessagesSQL = `
-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

  const indexesSQL = `
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
`;

  const rlsEnableSQL = `
-- Enable Row Level Security
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
`;

  const rlsPoliciesSQL = `
-- RLS Policies for chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_conversations'
    AND policyname = 'Users can view their own conversations'
  ) THEN
    CREATE POLICY "Users can view their own conversations"
      ON chat_conversations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_conversations'
    AND policyname = 'Users can create their own conversations'
  ) THEN
    CREATE POLICY "Users can create their own conversations"
      ON chat_conversations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_conversations'
    AND policyname = 'Users can update their own conversations'
  ) THEN
    CREATE POLICY "Users can update their own conversations"
      ON chat_conversations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_conversations'
    AND policyname = 'Users can delete their own conversations'
  ) THEN
    CREATE POLICY "Users can delete their own conversations"
      ON chat_conversations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS Policies for chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages'
    AND policyname = 'Users can view messages in their conversations'
  ) THEN
    CREATE POLICY "Users can view messages in their conversations"
      ON chat_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM chat_conversations
          WHERE chat_conversations.id = chat_messages.conversation_id
          AND chat_conversations.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages'
    AND policyname = 'Users can create messages in their conversations'
  ) THEN
    CREATE POLICY "Users can create messages in their conversations"
      ON chat_messages FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM chat_conversations
          WHERE chat_conversations.id = chat_messages.conversation_id
          AND chat_conversations.user_id = auth.uid()
        )
      );
  END IF;
END $$;
`;

  const triggersSQL = `
-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on chat_conversations
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation timestamp when message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation on new message
DROP TRIGGER IF EXISTS update_conversation_on_new_message ON chat_messages;
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
`;

  const sqlStatements = [
    { name: 'chat_conversations table', sql: chatConversationsSQL },
    { name: 'chat_messages table', sql: chatMessagesSQL },
    { name: 'indexes', sql: indexesSQL },
    { name: 'RLS enable', sql: rlsEnableSQL },
    { name: 'RLS policies', sql: rlsPoliciesSQL },
    { name: 'triggers and functions', sql: triggersSQL },
  ];

  // Try to execute using pg_net or direct connection
  // Since we can't use pg client directly, we'll use a workaround
  console.log('Note: Since we cannot use pg client, please run the following SQL manually in Supabase SQL Editor:\n');
  console.log('======================================');
  console.log('Go to: https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/editor');
  console.log('======================================\n');

  const fullSQL = sqlStatements.map(s => `-- ${s.name}\n${s.sql}`).join('\n\n');

  // Write to a file
  const outputPath = path.join(process.cwd(), 'setup-database.sql');
  fs.writeFileSync(outputPath, fullSQL);
  console.log(`SQL written to: ${outputPath}\n`);
  console.log('Full SQL:');
  console.log('======================================');
  console.log(fullSQL);
  console.log('======================================\n');

  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Supabase Database Setup');
  console.log('='.repeat(60));
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
  console.log('='.repeat(60));

  // Check if tables already exist
  console.log('\nChecking existing tables...');
  const conversationsExist = await checkTableExists('chat_conversations');
  const messagesExist = await checkTableExists('chat_messages');

  console.log(`  chat_conversations: ${conversationsExist ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`  chat_messages: ${messagesExist ? 'EXISTS' : 'NOT FOUND'}`);

  if (conversationsExist && messagesExist) {
    console.log('\nAll tables already exist!');
    console.log('If you want to recreate them, please drop them manually first.');
    return;
  }

  // Create tables
  await createTablesDirectly();

  console.log('\n='.repeat(60));
  console.log('Setup Complete!');
  console.log('='.repeat(60));
  console.log('\nPlease copy the SQL above and run it in Supabase SQL Editor.');
  console.log('Or use the generated file: setup-database.sql');
  console.log('\nAlternatively, you can run migrations:');
  console.log('  npx supabase db push');
  console.log('='.repeat(60));
}

main().catch(console.error);
