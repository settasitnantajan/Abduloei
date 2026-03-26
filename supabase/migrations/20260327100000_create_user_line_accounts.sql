-- สร้างตาราง user_line_accounts รองรับ 1 user ผูกหลาย LINE ID

CREATE TABLE user_line_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_line_accounts_user_id ON user_line_accounts(user_id);

-- Migrate ข้อมูลจาก user_profiles
INSERT INTO user_line_accounts (user_id, line_user_id)
SELECT user_id, line_user_id FROM user_profiles WHERE line_user_id IS NOT NULL;

-- ลบ column เก่า
DROP INDEX IF EXISTS idx_user_profiles_line_user_id;
ALTER TABLE user_profiles DROP COLUMN line_user_id;

-- RLS
ALTER TABLE user_line_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own line accounts"
  ON user_line_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own line accounts"
  ON user_line_accounts FOR DELETE
  USING (auth.uid() = user_id);
