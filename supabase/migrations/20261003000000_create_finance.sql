-- ฟีเจอร์การเงิน: บัตรเครดิต รายจ่าย ผ่อนชำระ และค่าใช้จ่ายประจำ
--
-- หมายเหตุสำคัญ:
-- 1. home_members สร้างไว้ก่อนหน้านี้แล้ว (ไม่มีไฟล์ migration ในโปรเจค)
--    ที่นี่จึงใช้ ALTER เพิ่มคอลัมน์เท่านั้น ห้าม CREATE TABLE ทับ
-- 2. วันที่ทุกคอลัมน์เก็บเป็น ค.ศ. เสมอ แปลงเป็น พ.ศ. ตอนแสดงผลบนหน้าจอ
-- 3. day_of_month = 32 คือ "สิ้นเดือน" ตาม convention เดิมของ monthly_routines
--    (ดู 20260327400000_allow_end_of_month.sql) cron จะ match 32 เมื่อวันนี้เป็นวันสุดท้ายของเดือน

-- === รายรับต่อเดือนของสมาชิก ===
-- ใช้ home_members ที่มีอยู่แล้ว ไม่สร้างตารางคนใหม่ (สมาชิกผูก LINE ID ไว้แล้ว)
ALTER TABLE home_members ADD COLUMN IF NOT EXISTS monthly_income NUMERIC NOT NULL DEFAULT 0;


-- === บัตรเครดิต ===
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- เลข 4 ตัวท้าย ไม่ใส่ก็ได้
  last4 TEXT,
  -- เจ้าของบัตร — คนละเรื่องกับคนที่รูด (ดู finance_expenses.paid_by_member_id)
  owner_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL,
  due_day_of_month INTEGER NOT NULL CHECK (due_day_of_month >= 1 AND due_day_of_month <= 32),
  remind_before_days INTEGER NOT NULL DEFAULT 3 CHECK (remind_before_days >= 0 AND remind_before_days <= 31),
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- กันส่งแจ้งเตือนซ้ำในวันเดียวกัน ใช้แพตเทิร์นเดียวกับ monthly_routines
  -- (ของที่เกิดซ้ำทุกเดือนต้องใช้ DATE ไม่ใช่ boolean ไม่งั้นยิงครั้งเดียวแล้วเงียบตลอด)
  last_reminded_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_active ON credit_cards (is_active) WHERE is_active = true;


-- === รายการใช้จ่าย (บัตร / เงินสด) ===
CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  -- คนที่รับผิดชอบยอดนี้ — ไม่จำเป็นต้องเป็นเจ้าของบัตร
  paid_by_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('credit_card', 'cash')),
  -- รูดบัตรใบไหน (null เมื่อจ่ายเงินสด)
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  spent_on DATE NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- จ่ายด้วยบัตรต้องมีบัตร / จ่ายเงินสดต้องไม่มีบัตร
  CONSTRAINT finance_expenses_card_matches_channel CHECK (
    (channel = 'credit_card' AND card_id IS NOT NULL) OR
    (channel = 'cash' AND card_id IS NULL)
  )
);

-- query ตามเดือนทุกครั้ง จึง index คู่ user_id + spent_on
CREATE INDEX IF NOT EXISTS idx_finance_expenses_user_month ON finance_expenses (user_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_card ON finance_expenses (card_id);


-- === ผ่อนชำระ — ผูกบัตรเสมอ ===
-- ไม่มีคอลัมน์ paid_installments โดยเจตนา: งวดที่จ่ายแล้วคำนวณจาก start_month
-- เทียบกับเดือนที่กำลังดู (ดู lib/finance/calc.ts) เลขจึงถูกเองทุกเดือนโดยไม่ต้องมี job
-- ตามอัปเดต และย้อนดูเดือนเก่าก็เห็นเลขของเดือนนั้นจริง ๆ
CREATE TABLE IF NOT EXISTS finance_installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  monthly_amount NUMERIC NOT NULL CHECK (monthly_amount >= 0),
  owner_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  -- เดือนที่เริ่มผ่อน เก็บเป็นวันที่ 1 ของเดือนนั้น
  start_month DATE NOT NULL,
  -- จำนวนงวดทั้งหมด — null = จ่ายครั้งเดียว ไม่มีงวด
  total_installments INTEGER CHECK (total_installments IS NULL OR total_installments > 0),
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_installments_user ON finance_installments (user_id);
CREATE INDEX IF NOT EXISTS idx_finance_installments_card ON finance_installments (card_id);


-- === ค่าใช้จ่ายประจำ (แม่แบบ) ===
-- เก็บเป็นแม่แบบใบเดียว แล้วคลี่เป็นรายการของแต่ละเดือนตอนอ่าน
-- ไม่ต้องกรอกซ้ำทุกเดือน และไม่สร้าง row รายเดือนทิ้งไว้ใน DB
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  paid_by_member_id UUID REFERENCES home_members(id) ON DELETE SET NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 32),
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- ให้เริ่ม/หยุดกลางทางได้โดยไม่ต้องลบทิ้ง (เดือนเก่าจะยังเห็นยอดเดิม)
  start_month DATE,
  end_month DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user ON recurring_expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses (is_active) WHERE is_active = true;


-- === RLS — ทุกตารางจำกัดที่เจ้าของข้อมูลเท่านั้น ===
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- credit_cards
DROP POLICY IF EXISTS "cc_sel" ON credit_cards;
CREATE POLICY "cc_sel"
  ON credit_cards FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cc_ins" ON credit_cards;
CREATE POLICY "cc_ins"
  ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cc_upd" ON credit_cards;
CREATE POLICY "cc_upd"
  ON credit_cards FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cc_del" ON credit_cards;
CREATE POLICY "cc_del"
  ON credit_cards FOR DELETE USING (auth.uid() = user_id);

-- finance_expenses
DROP POLICY IF EXISTS "fe_sel" ON finance_expenses;
CREATE POLICY "fe_sel"
  ON finance_expenses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_ins" ON finance_expenses;
CREATE POLICY "fe_ins"
  ON finance_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_upd" ON finance_expenses;
CREATE POLICY "fe_upd"
  ON finance_expenses FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_del" ON finance_expenses;
CREATE POLICY "fe_del"
  ON finance_expenses FOR DELETE USING (auth.uid() = user_id);

-- finance_installments
DROP POLICY IF EXISTS "fi_sel" ON finance_installments;
CREATE POLICY "fi_sel"
  ON finance_installments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fi_ins" ON finance_installments;
CREATE POLICY "fi_ins"
  ON finance_installments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fi_upd" ON finance_installments;
CREATE POLICY "fi_upd"
  ON finance_installments FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fi_del" ON finance_installments;
CREATE POLICY "fi_del"
  ON finance_installments FOR DELETE USING (auth.uid() = user_id);

-- recurring_expenses
DROP POLICY IF EXISTS "re_sel" ON recurring_expenses;
CREATE POLICY "re_sel"
  ON recurring_expenses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "re_ins" ON recurring_expenses;
CREATE POLICY "re_ins"
  ON recurring_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "re_upd" ON recurring_expenses;
CREATE POLICY "re_upd"
  ON recurring_expenses FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "re_del" ON recurring_expenses;
CREATE POLICY "re_del"
  ON recurring_expenses FOR DELETE USING (auth.uid() = user_id);
