-- ของหมดอายุ — เก็บว่าซื้อมาวันไหน หมดอายุวันไหน
--
-- ของที่หมดอายุแล้วยังอยู่ต่ออีก 30 วันเพื่อให้ย้อนดูได้ แล้วระบบลบทิ้งเอง
-- (ลบตอน cron รัน ไม่ได้ใช้ pg_cron เพราะโปรเจคนี้ยิง cron จาก GitHub Actions อยู่แล้ว)
--
-- หมวดเก็บเป็น TEXT + CHECK แทนตารางแยก เพราะชุดหมวดกำหนดตายตัว
-- ไม่ได้ให้ผู้ใช้สร้างเอง จึงไม่ต้องมีตาราง lookup

CREATE TABLE IF NOT EXISTS expiry_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('food', 'medicine', 'cosmetic', 'document', 'household', 'other')),
  -- วันที่ซื้อ ไม่บังคับ (ของบางอย่างจำไม่ได้ว่าซื้อเมื่อไร)
  purchased_on DATE,
  -- วันหมดอายุ บังคับ เพราะเป็นหัวใจของฟีเจอร์
  expires_on DATE NOT NULL,
  -- เตือนล่วงหน้ากี่วัน (0 = ไม่เตือน)
  remind_before_days INTEGER NOT NULL DEFAULT 3
    CHECK (remind_before_days >= 0 AND remind_before_days <= 90),
  note TEXT,
  -- กันส่งแจ้งเตือนซ้ำในวันเดียวกัน แพตเทิร์นเดียวกับ credit_cards/monthly_routines
  last_reminded_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- ซื้อหลังหมดอายุไม่สมเหตุสมผล
  CONSTRAINT expiry_items_dates_sane CHECK (
    purchased_on IS NULL OR purchased_on <= expires_on
  )
);

-- query หลักคือ "ของทั้งหมดของฉัน เรียงตามวันหมดอายุ"
CREATE INDEX IF NOT EXISTS idx_expiry_items_user_expires ON expiry_items (user_id, expires_on);
-- cron กวาดของที่เลยกำหนดลบ
CREATE INDEX IF NOT EXISTS idx_expiry_items_expires ON expiry_items (expires_on);

ALTER TABLE expiry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ei_sel" ON expiry_items;
CREATE POLICY "ei_sel" ON expiry_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ei_ins" ON expiry_items;
CREATE POLICY "ei_ins" ON expiry_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ei_upd" ON expiry_items;
CREATE POLICY "ei_upd" ON expiry_items FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ei_del" ON expiry_items;
CREATE POLICY "ei_del" ON expiry_items FOR DELETE USING (auth.uid() = user_id);
