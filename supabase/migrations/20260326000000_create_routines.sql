-- Routines table: กิจวัตรประจำวัน/สัปดาห์
-- เช่น ทานยา 12:00 ทุกวัน, ออกกำลังกาย 18:00 ทุก จ./พ./ศ.
CREATE TABLE IF NOT EXISTS routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  routine_time TIME NOT NULL,                -- เวลาที่ต้องทำ (HH:mm)
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0=อาทิตย์, 1=จันทร์, ... 6=เสาร์. default=ทุกวัน
  remind_before_minutes INTEGER NOT NULL DEFAULT 10,  -- เตือนก่อนกี่นาที
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_message TEXT,                       -- ข้อความต้นทางจาก AI chat
  last_reminded_date DATE,                   -- วันล่าสุดที่เตือนแล้ว (ป้องกันเตือนซ้ำ)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับ cron query
CREATE INDEX IF NOT EXISTS idx_routines_active ON routines (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines (user_id);

-- RLS
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines"
  ON routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines"
  ON routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines"
  ON routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines"
  ON routines FOR DELETE
  USING (auth.uid() = user_id);
