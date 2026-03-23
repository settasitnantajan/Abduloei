/**
 * Simple script to create chat tables in Supabase using HTTP API
 *
 * This script sends SQL directly to Supabase via the REST API
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// The full SQL to execute
const FULL_SQL = `
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

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

async function main() {
  console.log('='.repeat(70));
  console.log('Creating Chat Tables in Supabase');
  console.log('='.repeat(70));

  // Save SQL to file
  const sqlFilePath = path.join(process.cwd(), 'chat-tables-setup.sql');
  fs.writeFileSync(sqlFilePath, FULL_SQL);

  console.log('\nGenerated SQL file: chat-tables-setup.sql');
  console.log('\nIMPORTANT: Supabase does not allow direct SQL execution via REST API.');
  console.log('You must run this SQL in one of the following ways:\n');

  console.log('Option 1: Supabase Dashboard (Recommended)');
  console.log('  1. Go to: https://supabase.com/dashboard/project/faxauzhlgrfuhfvlybbg/editor');
  console.log('  2. Click "New Query"');
  console.log('  3. Copy and paste the SQL from chat-tables-setup.sql');
  console.log('  4. Click "Run"\n');

  console.log('Option 2: Using psql command line');
  console.log('  psql "postgresql://postgres.faxauzhlgrfuhfvlybbg:nvNqHihBbesBMTt8@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" < chat-tables-setup.sql\n');

  console.log('Option 3: Using Supabase CLI');
  console.log('  npx supabase db push\n');

  console.log('='.repeat(70));
  console.log('\nSQL Preview (first 1000 chars):');
  console.log('='.repeat(70));
  console.log(FULL_SQL.substring(0, 1000) + '...\n');

  console.log('Full SQL content saved to: ' + sqlFilePath);
  console.log('='.repeat(70));
}

main().catch(console.error);
