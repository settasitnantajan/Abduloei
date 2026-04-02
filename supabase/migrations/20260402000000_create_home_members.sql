-- Create home_members table
CREATE TABLE IF NOT EXISTS home_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  line_user_id TEXT,
  profile_image_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE home_members ENABLE ROW LEVEL SECURITY;

-- Users can view own members
CREATE POLICY "Users can view own members" ON home_members
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own members
CREATE POLICY "Users can insert own members" ON home_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own members
CREATE POLICY "Users can update own members" ON home_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete own members
CREATE POLICY "Users can delete own members" ON home_members
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for cron jobs)
CREATE POLICY "Service role full access on home_members" ON home_members
  FOR ALL USING (true);

-- Index for fast lookup by user
CREATE INDEX idx_home_members_user_id ON home_members(user_id);

-- Add assigned_member_id to events, tasks, routines, monthly_routines
ALTER TABLE events ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL;
ALTER TABLE monthly_routines ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL;
