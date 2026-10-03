-- รายได้แยกตามรอบ — รายได้แต่ละเดือนไม่เท่ากัน (โบนัส, OT, ค่าคอม)
--
-- เดิมเก็บ home_members.monthly_income ค่าเดียว ย้อนดูรอบเก่าก็เห็นรายได้ปัจจุบัน
-- ตารางนี้เก็บแยกตามรอบ ถ้ารอบไหนไม่ได้กรอกจะใช้ค่าล่าสุดที่เคยกรอกแทน
-- ผู้ใช้จึงกรอกเฉพาะเดือนที่ต่างจากปกติ ไม่ต้องกรอกซ้ำทุกเดือน
--
-- คอลัมน์ monthly_income เดิมยังอยู่ ใช้เป็นค่าตั้งต้นเมื่อไม่มีประวัติเลย

CREATE TABLE IF NOT EXISTS member_incomes (
  member_id UUID NOT NULL REFERENCES home_members(id) ON DELETE CASCADE,
  -- รอบในรูปแบบ YYYY-MM (ค.ศ.) เก็บเป็นวันที่ 1 ของเดือนนั้น
  period DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, period)
);

CREATE INDEX IF NOT EXISTS idx_member_incomes_member ON member_incomes (member_id);
CREATE INDEX IF NOT EXISTS idx_member_incomes_period ON member_incomes (period);

-- RLS — ไม่มี user_id ของตัวเอง อ้างอิงเจ้าของผ่าน home_members
ALTER TABLE member_incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mi_all" ON member_incomes;
CREATE POLICY "mi_all" ON member_incomes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM home_members hm
    WHERE hm.id = member_incomes.member_id AND hm.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM home_members hm
    WHERE hm.id = member_incomes.member_id AND hm.user_id = auth.uid()
  ));
