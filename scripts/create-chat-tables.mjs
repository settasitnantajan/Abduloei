#!/usr/bin/env node

/**
 * Create Chat Tables using Supabase Client
 *
 * This uses the service role key to bypass RLS and execute SQL
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkIfTablesExist() {
  console.log('Checking if tables exist...');

  // Try to query the tables
  const { data: convData, error: convError } = await supabase
    .from('chat_conversations')
    .select('id')
    .limit(1);

  const { data: msgData, error: msgError } = await supabase
    .from('chat_messages')
    .select('id')
    .limit(1);

  const conversationsExist = !convError || !convError.message.includes('does not exist');
  const messagesExist = !msgError || !msgError.message.includes('does not exist');

  console.log(`  chat_conversations: ${conversationsExist ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`  chat_messages: ${messagesExist ? 'EXISTS' : 'NOT FOUND'}\n`);

  return { conversationsExist, messagesExist };
}

async function createTestConversation() {
  console.log('Testing table by creating a test conversation...');

  try {
    // First, get the current user (we'll use service role)
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.log('  Could not get users:', usersError.message);
      return false;
    }

    if (!users || users.users.length === 0) {
      console.log('  No users found. Please sign up first.');
      return false;
    }

    const userId = users.users[0].id;
    console.log(`  Using user ID: ${userId}`);

    // Try to insert a test conversation
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId,
        title: 'Test Conversation',
        home_id: null
      })
      .select()
      .single();

    if (error) {
      console.log('  Error creating test conversation:', error.message);
      return false;
    }

    console.log('  Successfully created test conversation:', data.id);

    // Clean up - delete the test conversation
    await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', data.id);

    console.log('  Test conversation deleted');
    return true;

  } catch (error) {
    console.log('  Error during test:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Supabase Chat Tables Setup');
  console.log('='.repeat(70));
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Service Key: ${SERVICE_ROLE_KEY.substring(0, 20)}...\n`);

  // Check if tables exist
  const { conversationsExist, messagesExist } = await checkIfTablesExist();

  if (conversationsExist && messagesExist) {
    console.log('All tables already exist!\n');

    // Test the tables
    const testPassed = await createTestConversation();

    if (testPassed) {
      console.log('\n' + '='.repeat(70));
      console.log('SUCCESS: Tables exist and are working correctly!');
      console.log('='.repeat(70));
    } else {
      console.log('\n' + '='.repeat(70));
      console.log('WARNING: Tables exist but may have issues');
      console.log('='.repeat(70));
    }

    return;
  }

  // Tables don't exist - need to create them
  console.log('Tables do not exist. Creating them...\n');

  const SQL = `
-- Chat Conversations Table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  home_id UUID,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON chat_messages;

-- RLS Policies for chat_conversations
CREATE POLICY "Users can view their own conversations"
  ON chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their conversations"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_on_new_message ON chat_messages;
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
`;

  console.log('='.repeat(70));
  console.log('SQL TO RUN IN SUPABASE SQL EDITOR:');
  console.log('='.repeat(70));
  console.log('Go to: https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/editor');
  console.log('Click "New Query" and paste the following SQL:\n');
  console.log(SQL);
  console.log('\n' + '='.repeat(70));
  console.log('After running the SQL in Supabase dashboard, run this script again to verify.');
  console.log('='.repeat(70));
}

main().catch(console.error);
