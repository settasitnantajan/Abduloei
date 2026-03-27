-- Monthly routines: กิจวัตรประจำเดือน
-- เช่น จ่ายค่าบ้าน ทุกวันที่ 31, จ่ายค่าเน็ต ทุกวันที่ 5

CREATE TABLE IF NOT EXISTS monthly_routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  routine_time TIME NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  remind_before_minutes INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_message TEXT,
  last_reminded_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_routines_active ON monthly_routines (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_monthly_routines_user ON monthly_routines (user_id);

ALTER TABLE monthly_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly routines"
  ON monthly_routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly routines"
  ON monthly_routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly routines"
  ON monthly_routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly routines"
  ON monthly_routines FOR DELETE
  USING (auth.uid() = user_id);
