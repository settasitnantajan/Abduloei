-- Memory System Migration
-- Enables long-term AI memory with user profiles and extracted memories

-- User profiles for storing preferences and personal info
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}', -- {"favorite_food": "ข้าวผัด", "allergies": ["ถั่ว"]}
  personal_info JSONB DEFAULT '{}', -- {"family_members": ["แม่: สมหญิง", "พี่: สมชาย"]}
  habits JSONB DEFAULT '{}', -- {"exercise": "อังคาร/พฤหัส 6 โมงเช้า"}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- AI-written memories (เหมือน long-term memory ของมนุษย์)
CREATE TABLE user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('personal', 'family', 'preferences', 'important_dates', 'habits', 'goals')),
  key TEXT NOT NULL, -- e.g., "favorite_food", "mother_name", "exercise_routine"
  value TEXT NOT NULL, -- e.g., "ข้าวผัด", "สมหญิง", "วิ่งทุกเช้า"
  confidence FLOAT DEFAULT 1.0, -- 0-1, how confident AI is about this memory
  source_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}', -- extra data like date mentioned, context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, key)
);

-- RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own memories"
  ON user_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own memories"
  ON user_memories FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_memories_user_category ON user_memories(user_id, category);
CREATE INDEX idx_user_memories_key ON user_memories(key);
CREATE INDEX idx_user_memories_confidence ON user_memories(confidence DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memories_updated_at
  BEFORE UPDATE ON user_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable pgvector extension (for future semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to chat_messages for semantic search
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding
  ON chat_messages USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE user_memories IS 'AI-extracted long-term memories from conversations';
COMMENT ON COLUMN user_memories.confidence IS 'AI confidence level 0-1 for this memory';
