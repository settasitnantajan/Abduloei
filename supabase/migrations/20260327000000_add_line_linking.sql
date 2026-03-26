-- Add LINE linking support for multi-user notifications

-- เพิ่ม line_user_id ใน user_profiles
ALTER TABLE user_profiles ADD COLUMN line_user_id TEXT UNIQUE;
CREATE INDEX idx_user_profiles_line_user_id ON user_profiles(line_user_id);

-- ตาราง linking codes (ชั่วคราว, มี TTL 10 นาที)
CREATE TABLE line_linking_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE line_linking_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linking codes"
  ON line_linking_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own linking codes"
  ON line_linking_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
